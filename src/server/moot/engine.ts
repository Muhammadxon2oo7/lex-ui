/**
 * The moot court room: people in two teams, a drawn side and role for each, one floor at a time,
 * a clock on every floor, and a court run by the machine.
 *
 * The server is the only authority: it decides whose floor it is, when it ends (the clock runs
 * here, not in a browser), who may see what, and when the hearing is over. Clients long-poll a
 * version number; every change bumps it and wakes them.
 *
 * State lives in this process. That is right for one long-running server (development, a VPS);
 * a serverless host needs the room engine on the court backend (docs/BACKEND_TASKS.md, "Bahs").
 */
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { MootAct, MootEntry, MootPhase, MootRole, MootRoom, MootSide, MootStep, MootVerdict, Team } from '@/contracts/moot';
import { HttpError } from '@/server/engine/session';
import { DEFAULT_CASE, MOOT_CASES, type MootCase } from './cases';
import { askJudge, ruleVerdict } from './judge';

interface Player {
  id: string;
  owner: string;
  name: string;
  avatar: 'man' | 'woman';
  team: Team | null;
  role: MootRole | null;
  ready: boolean;
  host: boolean;
  seen: number;
}

interface Room {
  code: string;
  version: number;
  phase: MootPhase;
  size: number;
  assign: 'pick' | 'random';
  case: MootCase;
  players: Player[];
  sides: { A: MootSide; B: MootSide } | null;
  agenda: MootStep[];
  step: number;
  speaker: string | null;
  endsAt: number | null;
  transcript: MootEntry[];
  chat: Record<Team, { id: string; at: number; by: string; name: string; text: string }[]>;
  audio: Map<string, Buffer>;
  audioBytes: number;
  verdict: MootVerdict | null;
  deciding: boolean;
  seq: number;
  timer: ReturnType<typeof setTimeout> | null;
  waiters: Set<() => void>;
  createdAt: number;
}

const g = globalThis as unknown as { __lexMoot?: Map<string, Room> };
const rooms = (g.__lexMoot ??= new Map());
const TTL = 3 * 60 * 60 * 1000;
const ONLINE_MS = 12_000;
const AWAY_MS = 45_000;
const BRIEFING_S = 90;
/** The judge's line before a floor is heard by everyone first. */
const FLOOR_LEAD_S = 6;
const AUDIO_MAX = 3_000_000; // ~90 s of 16 kHz mono
const AUDIO_ROOM_MAX = 80_000_000;

const playerId = (owner: string, code: string) => createHash('sha256').update(`moot:${code}:${owner}`).digest('hex').slice(0, 12);
const SIDE_NAME: Record<MootSide, string> = { claimant: 'daʼvogar', respondent: 'javobgar' };
const ROLE_NAME: Record<MootRole, string> = { lead: 'bosh vakil', second: 'ikkinchi vakil', party: 'taraf' };

/* ───────────────────────── the order of a hearing ───────────────────────── */

/** The same order for every case: opening, both positions, questions each way, evidence, closing, reply. */
function agendaFor(): MootStep[] {
  const speech = (id: string, title: string, side: MootSide, role: MootRole, seconds: number): MootStep => ({ id, kind: 'speech', title, side, role, seconds });
  return [
    { id: 'open', kind: 'court', title: 'Majlis ochilishi', seconds: 16 },
    speech('claim', 'Daʼvo talablari va asoslari', 'claimant', 'lead', 120),
    speech('answer', 'Daʼvoga eʼtiroz', 'respondent', 'lead', 120),
    speech('q1', 'Daʼvogar savoli', 'claimant', 'second', 40),
    speech('a1', 'Javobgar javobi', 'respondent', 'party', 60),
    speech('q2', 'Javobgar savoli', 'respondent', 'second', 40),
    speech('a2', 'Daʼvogar javobi', 'claimant', 'party', 60),
    speech('ev1', 'Dalillar: daʼvogar', 'claimant', 'second', 90),
    speech('ev2', 'Dalillar: javobgar', 'respondent', 'second', 90),
    speech('close1', 'Muzokara: daʼvogar', 'claimant', 'lead', 90),
    speech('close2', 'Muzokara: javobgar', 'respondent', 'lead', 90),
    speech('reply1', 'Replika: daʼvogar', 'claimant', 'lead', 40),
    speech('reply2', 'Replika: javobgar', 'respondent', 'lead', 40),
    { id: 'retire', kind: 'court', title: 'Sud maslahatxonada', seconds: 8 },
  ];
}

/** What the judge says when he gives the floor (constant lines: they can be voiced in advance). */
const FLOOR: Record<string, string> = {
  claim: 'Soʻz daʼvogar vakiliga beriladi. Daʼvo talablaringiz va ularning asoslarini bayon qiling.',
  answer: 'Soʻz javobgar vakiliga beriladi. Daʼvo talablariga munosabatingizni bildiring.',
  q1: 'Daʼvogar tomoni, javobgarga savolingiz bormi?',
  a1: 'Javobgar tomoni, savolga javob bering.',
  q2: 'Javobgar tomoni, daʼvogarga savolingiz bormi?',
  a2: 'Daʼvogar tomoni, savolga javob bering.',
  ev1: 'Dalillarni tekshirishga oʻtamiz. Daʼvogar tomoni, dalillaringizni koʻrsating.',
  ev2: 'Javobgar tomoni, dalillaringiz va eʼtirozlaringiz.',
  close1: 'Sud muzokaralariga oʻtiladi. Soʻz daʼvogar vakiliga beriladi.',
  close2: 'Soʻz javobgar vakiliga beriladi.',
  reply1: 'Daʼvogar tomoni, replika huquqidan foydalanasizmi?',
  reply2: 'Javobgar tomoni, replika huquqidan foydalanasizmi?',
};

/* ───────────────────────── plumbing ───────────────────────── */

function bump(r: Room) {
  r.version += 1;
  for (const w of r.waiters) w();
  r.waiters.clear();
  schedule(r);
}

/** One timer per room, set to the moment the clock next matters. */
function schedule(r: Room) {
  if (r.timer) clearTimeout(r.timer);
  r.timer = null;
  if (!r.endsAt || r.phase === 'verdict' || r.phase === 'lobby') return;
  r.timer = setTimeout(() => {
    tick(r);
  }, Math.max(50, r.endsAt - Date.now() + 30));
}

function entry(r: Room, by: string, name: string, text: string, side?: MootSide, audio?: string) {
  r.seq += 1;
  r.transcript.push({ id: `e${r.seq}`, seq: r.seq, at: Date.now(), by, name, text, step: r.agenda[r.step]?.id ?? 'lobby', ...(side ? { side } : {}), ...(audio ? { audio } : {}) });
}
const judge = (r: Room, text: string) => entry(r, 'judge', 'Sudya', text);
const sideOf = (r: Room, p: Player): MootSide | null => (p.team && r.sides ? r.sides[p.team] : null);
const online = (p: Player) => Date.now() - p.seen < ONLINE_MS;

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

/** Who takes a floor meant for (side, role): that role, else whoever on the side is here. */
function floorOf(r: Room, side: MootSide, role: MootRole): Player | null {
  const team = (Object.entries(r.sides ?? {}) as [Team, MootSide][]).find(([, s]) => s === side)?.[0];
  const mates = r.players.filter((p) => p.team === team);
  const here = mates.filter((p) => Date.now() - p.seen < AWAY_MS);
  const pool = here.length ? here : mates;
  return pool.find((p) => p.role === role) ?? pool.find((p) => p.role === 'lead') ?? pool[0] ?? null;
}

/* ───────────────────────── the flow ───────────────────────── */

function begin(r: Room) {
  // sides and roles are drawn, never chosen
  if (r.assign === 'random') {
    const all = shuffle(r.players);
    all.forEach((p, i) => (p.team = i % 2 === 0 ? 'A' : 'B'));
  }
  r.sides = randomInt(2) === 0 ? { A: 'claimant', B: 'respondent' } : { A: 'respondent', B: 'claimant' };
  for (const team of ['A', 'B'] as Team[]) {
    const order: MootRole[] = ['lead', 'second', 'party'];
    shuffle(r.players.filter((p) => p.team === team)).forEach((p, i) => (p.role = order[Math.min(i, 2)]));
  }
  for (const p of r.players) p.ready = false;
  r.agenda = agendaFor();
  r.phase = 'briefing';
  r.endsAt = Date.now() + BRIEFING_S * 1000;
}

function enter(r: Room) {
  const s = r.agenda[r.step];
  r.speaker = null;
  if (s.kind === 'court') {
    if (s.id === 'open') {
      entry(r, 'secretary', 'Sud majlisi kotibi', 'Sud kirib kelmoqda, oʻrningizdan turing!');
      judge(r, 'Oʻtiring.');
      judge(r, `Sud majlisi ochiq deb eʼlon qilinadi. ${r.case.parties.claimant}ning ${r.case.parties.respondent}ga nisbatan daʼvosi koʻrib chiqiladi: ${r.case.claim}`);
    } else judge(r, 'Sud muzokaralari tugadi. Sud qaror qabul qilish uchun maslahatxonaga kiradi.');
    r.endsAt = Date.now() + s.seconds * 1000;
    return;
  }
  const p = floorOf(r, s.side!, s.role!);
  if (!p) return void advance(r, false); // nobody on that side: the floor passes
  r.speaker = p.id;
  judge(r, FLOOR[s.id] ?? `Soʻz ${SIDE_NAME[s.side!]} tomoniga beriladi.`);
  r.endsAt = Date.now() + (s.seconds + FLOOR_LEAD_S) * 1000;
}

function advance(r: Room, timeUp: boolean) {
  if (r.phase === 'briefing') {
    r.phase = 'hearing';
    r.step = 0;
    return void enter(r);
  }
  if (r.phase !== 'hearing') return;
  if (timeUp && r.agenda[r.step]?.kind === 'speech') judge(r, 'Vaqt tugadi. Rahmat.');
  r.step += 1;
  if (r.step < r.agenda.length) return void enter(r);
  r.step = r.agenda.length - 1;
  finish(r, null);
}

function announce(r: Room, v: MootVerdict, lead: string | null) {
  entry(r, 'secretary', 'Sud majlisi kotibi', 'Sud kirib kelmoqda, oʻrningizdan turing!');
  if (lead) judge(r, lead);
  for (const line of v.ruling) judge(r, line);
  if (!v.pending) judge(r, 'Sud majlisi yopiq deb eʼlon qilinadi.');
}

/**
 * The decision. While the court retires, the court server's model is asked (≈22 s). If it is still
 * writing (judge_pending), the rules' reading is announced as provisional at once and the same request
 * is repeated in the background for up to 90 s; the model's verdict then replaces it and is read out.
 * With no model (no key, an error, a forfeit) the rules decide.
 */
function finish(r: Room, forfeit: MootSide | null) {
  if (r.deciding || r.verdict) return;
  r.deciding = true;
  r.speaker = null;
  r.endsAt = null;
  const players = r.players.filter((p) => sideOf(r, p)).map((p) => ({ id: p.id, name: p.name, side: sideOf(r, p)! }));
  const rules = ruleVerdict(r.case, r.agenda, r.transcript, players, forfeit);
  const owner = r.players.find((p) => p.host)?.owner ?? r.players[0]?.owner ?? r.code;
  const done = (v: MootVerdict, lead: string | null) => {
    r.verdict = v;
    r.phase = 'verdict';
    announce(r, v, lead);
    r.deciding = false;
    bump(r);
  };
  if (forfeit) return void done(rules, null);
  const ask = () => askJudge(r.case, r.agenda, r.transcript, players, owner);
  void ask().then(async (first) => {
    if (first.kind === 'ok') return done(first.verdict, null);
    if (first.kind === 'none') return done(rules, null);
    // the model is still writing: the provisional reading now, the verdict when it comes
    done({ ...rules, pending: true }, 'Sud dastlabki baholarni eʼlon qiladi. Yakuniy qaror yozilmoqda.');
    const until = Date.now() + 90_000;
    let wait = first.retryAfter;
    while (Date.now() < until && rooms.has(r.code)) {
      await new Promise((res) => setTimeout(res, wait * 1000));
      const next = await ask();
      if (next.kind === 'pending') {
        wait = next.retryAfter;
        continue;
      }
      r.verdict = next.kind === 'ok' ? next.verdict : { ...rules, pending: false };
      if (next.kind === 'ok') {
        judge(r, 'Sud yakuniy qarorni eʼlon qiladi.');
        for (const line of next.verdict.ruling) judge(r, line);
      } else judge(r, 'Yakuniy qaror yozilmadi: dastlabki baho kuchda qoladi.');
      judge(r, 'Sud majlisi yopiq deb eʼlon qilinadi.');
      return bump(r);
    }
    if (r.verdict?.pending) {
      r.verdict = { ...r.verdict, pending: false };
      judge(r, 'Yakuniy qaror vaqtida yozilmadi: dastlabki baho kuchda qoladi.');
      judge(r, 'Sud majlisi yopiq deb eʼlon qilinadi.');
      bump(r);
    }
  }, () => done(rules, null));
}

/** Lets the clock and absences take effect. Called on every request and by the room's timer. */
function tick(r: Room) {
  let changed = false;
  for (let guard = 0; guard < 20 && r.endsAt && Date.now() >= r.endsAt && (r.phase === 'briefing' || r.phase === 'hearing') && !r.deciding; guard++) {
    advance(r, true);
    changed = true;
  }
  if (r.phase === 'hearing' && !r.deciding) {
    // a side that has left altogether forfeits; a speaker who has gone hands the floor to a team-mate
    for (const team of ['A', 'B'] as Team[]) {
      const mates = r.players.filter((p) => p.team === team);
      if (mates.length && mates.every((p) => Date.now() - p.seen > 90_000)) {
        finish(r, r.sides![team]);
        return;
      }
    }
    const sp = r.players.find((p) => p.id === r.speaker);
    if (sp && Date.now() - sp.seen > AWAY_MS) {
      const s = r.agenda[r.step];
      const next = floorOf(r, s.side!, s.role!);
      if (next && next.id !== sp.id) {
        r.speaker = next.id;
        entry(r, 'system', '', `${sp.name} aloqada yoʻq - soʻz jamoadoshi ${next.name}ga oʻtdi.`);
      } else {
        entry(r, 'system', '', `${sp.name} aloqada yoʻq - soʻz keyingi tomonga oʻtadi.`);
        advance(r, false);
      }
      changed = true;
    }
  }
  if (changed) bump(r);
  else schedule(r);
}

/* ───────────────────────── what a client sees ───────────────────────── */

function view(r: Room, me: Player): MootRoom {
  const side = sideOf(r, me);
  const c = r.case;
  return {
    code: r.code,
    version: r.version,
    phase: r.phase,
    size: r.size,
    assign: r.assign,
    players: r.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, team: p.team, role: p.role, ready: p.ready, host: p.host, online: online(p) })),
    me: { id: me.id, team: me.team, side, role: me.role, host: me.host },
    sides: r.sides,
    case: {
      id: c.id, title: c.title, court: c.court, summary: c.summary, parties: c.parties, claim: c.claim, facts: c.facts, evidence: c.evidence,
      // the other side's confidential facts never leave the server
      confidential: side ? c.side[side].confidential : [],
      task: side ? c.side[side].task : [],
      disclaimer: c.disclaimer,
    },
    agenda: r.agenda,
    step: r.step,
    speaker: r.speaker,
    now: Date.now(),
    endsAt: r.endsAt,
    transcript: r.transcript,
    chat: me.team ? r.chat[me.team] : [],
    verdict: r.verdict,
  };
}

/* ───────────────────────── the public API ───────────────────────── */

function sweep() {
  for (const [code, r] of rooms) {
    if (Date.now() - r.createdAt > TTL) {
      if (r.timer) clearTimeout(r.timer);
      rooms.delete(code);
    }
  }
}

function room(code: string): Room {
  const r = rooms.get(code.toUpperCase());
  if (!r) throw new HttpError(404, 'room_not_found', 'Xona topilmadi yoki yopilgan');
  return r;
}
function member(r: Room, owner: string | undefined): Player {
  const p = owner ? r.players.find((x) => x.owner === owner) : undefined;
  if (!p) throw new HttpError(403, 'not_in_room', 'Siz bu xonada emassiz - avval qoʻshiling');
  p.seen = Date.now();
  return p;
}

export function createRoom(owner: string, input: { name: string; avatar: 'man' | 'woman'; size: number; assign: 'pick' | 'random' }, file: MootCase = MOOT_CASES[DEFAULT_CASE]): MootRoom {
  sweep();
  if (rooms.size > 300) throw new HttpError(503, 'rooms_full', 'Hozir xonalar juda koʻp. Birozdan soʻng urinib koʻring.');
  // a code people can read aloud: no 0/O, 1/I
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do code = Array.from({ length: 5 }, () => ABC[randomInt(ABC.length)]).join('');
  while (rooms.has(code));
  const host: Player = { id: playerId(owner, code), owner, name: input.name, avatar: input.avatar, team: 'A', role: null, ready: false, host: true, seen: Date.now() };
  const r: Room = {
    code, version: 1, phase: 'lobby', size: input.size, assign: input.assign, case: file, players: [host], sides: null, agenda: [], step: 0, speaker: null, endsAt: null,
    transcript: [], chat: { A: [], B: [] }, audio: new Map(), audioBytes: 0, verdict: null, deciding: false, seq: 0, timer: null, waiters: new Set(), createdAt: Date.now(),
  };
  rooms.set(code, r);
  return view(r, host);
}

export function joinRoom(owner: string, code: string, input: { name: string; avatar: 'man' | 'woman' }): MootRoom {
  const r = room(code);
  const again = r.players.find((p) => p.owner === owner);
  if (again) {
    again.seen = Date.now();
    again.name = input.name;
    return view(r, again);
  }
  if (r.phase !== 'lobby') throw new HttpError(409, 'room_started', 'Majlis boshlangan - qoʻshilib boʻlmaydi');
  if (r.players.length >= r.size * 2) throw new HttpError(409, 'room_full', 'Xona toʻla');
  // the emptier team first
  const count = (t: Team) => r.players.filter((p) => p.team === t).length;
  const p: Player = { id: playerId(owner, r.code), owner, name: input.name, avatar: input.avatar, team: count('A') <= count('B') ? 'A' : 'B', role: null, ready: false, host: false, seen: Date.now() };
  r.players.push(p);
  bump(r);
  return view(r, p);
}

/** The room as this player sees it; waits (up to `hold` ms) for something new when `since` is current. */
export async function readRoom(owner: string | undefined, code: string, since: number | null, hold = 20_000): Promise<MootRoom> {
  const r = room(code);
  const me = member(r, owner);
  tick(r);
  if (since !== null && since >= r.version) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(done, hold);
      function done() {
        clearTimeout(t);
        r.waiters.delete(done);
        resolve();
      }
      r.waiters.add(done);
    });
    me.seen = Date.now();
    tick(r);
  }
  return view(r, me);
}

export function actRoom(owner: string | undefined, code: string, a: MootAct): MootRoom {
  const r = room(code);
  const me = member(r, owner);
  tick(r);
  const lobby = () => {
    if (r.phase !== 'lobby') throw new HttpError(409, 'room_started', 'Majlis boshlangan');
  };
  switch (a.type) {
    case 'team': {
      lobby();
      if (r.assign === 'random') throw new HttpError(409, 'random_teams', 'Jamoalar tasodifiy taqsimlanadi');
      if (a.team && r.players.filter((p) => p.team === a.team && p.id !== me.id).length >= r.size) throw new HttpError(409, 'team_full', 'Bu jamoa toʻla');
      me.team = a.team;
      me.ready = false;
      break;
    }
    case 'ready':
      if (r.phase !== 'lobby' && r.phase !== 'briefing') throw new HttpError(409, 'room_started', 'Majlis boshlangan');
      me.ready = a.ready;
      // everyone has read the file: no need to wait out the clock
      if (r.phase === 'briefing' && r.players.every((p) => p.ready || !online(p))) advance(r, false);
      break;
    case 'settings': {
      lobby();
      if (!me.host) throw new HttpError(403, 'host_only', 'Faqat xona egasi oʻzgartira oladi');
      if (a.size) {
        if (r.players.length > a.size * 2) throw new HttpError(409, 'too_many', 'Xonada bundan koʻp odam bor');
        r.size = a.size;
      }
      if (a.assign) r.assign = a.assign;
      break;
    }
    case 'start': {
      lobby();
      if (!me.host) throw new HttpError(403, 'host_only', 'Majlisni xona egasi boshlaydi');
      if (r.players.length < 2) throw new HttpError(409, 'need_players', 'Kamida ikki kishi kerak');
      if (r.assign === 'pick') {
        const n = (t: Team) => r.players.filter((p) => p.team === t).length;
        if (r.players.some((p) => !p.team)) throw new HttpError(409, 'no_team', 'Hamma jamoa tanlashi kerak');
        if (!n('A') || !n('B')) throw new HttpError(409, 'empty_team', 'Har ikki jamoada kamida bir kishi boʻlsin');
      }
      if (r.players.some((p) => !p.host && !p.ready)) throw new HttpError(409, 'not_ready', 'Hamma «Tayyorman» demagan');
      begin(r);
      break;
    }
    case 'say': {
      if (r.phase !== 'hearing' || r.speaker !== me.id) throw new HttpError(409, 'not_your_floor', 'Hozir soʻz sizda emas');
      if (a.audio && !r.audio.has(a.audio)) throw new HttpError(422, 'audio_missing', 'Ovoz yozuvi topilmadi');
      entry(r, me.id, me.name, a.text, sideOf(r, me) ?? undefined, a.audio);
      break;
    }
    case 'yield':
      if (r.phase !== 'hearing' || r.speaker !== me.id) throw new HttpError(409, 'not_your_floor', 'Hozir soʻz sizda emas');
      advance(r, false);
      break;
    case 'chat': {
      if (!me.team) throw new HttpError(409, 'no_team', 'Avval jamoaga qoʻshiling');
      const list = r.chat[me.team];
      list.push({ id: randomUUID().slice(0, 8), at: Date.now(), by: me.id, name: me.name, text: a.text });
      if (list.length > 200) list.shift();
      break;
    }
    case 'leave': {
      if (r.phase === 'lobby') {
        r.players = r.players.filter((p) => p.id !== me.id);
        if (me.host && r.players[0]) r.players[0].host = true;
        if (!r.players.length) {
          rooms.delete(r.code);
          return view(r, me);
        }
      } else me.seen = 0; // mid-hearing: gone - the floor passes, an empty side forfeits
      break;
    }
  }
  bump(r);
  return view(r, me);
}

/** A spoken line's clip (the speaker's own voice), kept only while the room lives. */
export function putAudio(owner: string | undefined, code: string, wav: Buffer): string {
  const r = room(code);
  const me = member(r, owner);
  if (r.phase !== 'hearing' || r.speaker !== me.id) throw new HttpError(409, 'not_your_floor', 'Hozir soʻz sizda emas');
  if (wav.length < 44 || wav.length > AUDIO_MAX || wav.toString('ascii', 0, 4) !== 'RIFF') throw new HttpError(422, 'bad_audio', 'Ovoz yozuvi notoʻgʻri');
  if (r.audioBytes + wav.length > AUDIO_ROOM_MAX) throw new HttpError(413, 'audio_full', 'Ovoz yozuvlari juda koʻp');
  const id = randomUUID().replace(/-/g, '').slice(0, 16);
  r.audio.set(id, wav);
  r.audioBytes += wav.length;
  return id;
}
export function getAudio(owner: string | undefined, code: string, id: string): Buffer {
  const r = room(code);
  member(r, owner);
  const a = r.audio.get(id);
  if (!a) throw new HttpError(404, 'audio_missing', 'Ovoz yozuvi topilmadi');
  return a;
}

export const MOOT_LABELS = { SIDE_NAME, ROLE_NAME };
/** Tests: move a room's clock. */
export function __expire(code: string) {
  const r = room(code);
  if (r.endsAt) r.endsAt = Date.now() - 1;
  tick(r);
}
