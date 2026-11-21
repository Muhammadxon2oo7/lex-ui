/**
 * Server-authoritative engine for "Ish yoʻli". Runs any case described by a
 * case book (labour dispute — FPK, theft report — JPK). One case of each kind
 * per owner; any room can be entered at any time (earlier stages fall back to
 * the prepared case file). Every mutation is idempotent by `clientActionId`.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { CaseActRequest, CaseKind, CaseLine, CaseSnapshot, CaseSpeaker, ClaimDraft, Ruling, StageId, StageView, Decision } from '@/contracts/case';
import type { Emotion, InputMode, Level } from '@/contracts';
import { kindOfStage } from '@/contracts/case';
import { HttpError } from '../engine/session';
import fpk from '../law/fpk-case.json';
import jpk from '../law/jpk-case.json';
import { checkClaim, filingRuling } from './claim';
import { ATTACHMENTS, BOOK as LABOUR, type CaseBookShape, type CaseView, type Effect, type Line, type Node, type Opt, type Scene, type StageDef } from './ishga-tiklash';
import { BOOK as THEFT } from './ogirlik';
import { situationLine, type Situation } from '@/server/situation';
import { askNpc, canVoice, type NpcAnswer, type NpcRequest } from './npc';

/** Rooms that are courtrooms: answers standing, the judge enters, a judgment closes the room. */
const COURT = new Set<StageId>(['hearing', 'trial']);

const BOOKS: Record<CaseKind, CaseBookShape> = { labour: LABOUR, theft: THEFT };
const LAW: Record<CaseKind, typeof fpk> = { labour: fpk, theft: jpk };
/** Short code name used when citing articles in results. */
const CODE: Record<CaseKind, string> = { labour: 'FPK', theft: 'JPK' };

type Status = 'open' | 'done' | 'returned';

interface CaseState {
  id: string;
  owner: string;
  kind: CaseKind;
  seed: number;
  createdAt: number;
  stage: StageId | null;
  node: string | null;
  status: Partial<Record<StageId, Status>>;
  scores: Partial<Record<StageId, number | null>>;
  known: Set<string>;
  used: Set<string>;
  lines: CaseLine[];
  seq: number;
  /** How many times each human situation (swearing, small talk…) has been answered: the next variant follows. */
  situations: Record<string, number>;
  feedback: CaseSnapshot['feedback'];
  standing: boolean;
  scolded: Set<string>;
  draft: ClaimDraft | null;
  rulings: Ruling[];
  /** Penalties and good moves in the room being played. */
  penalties: { points: number; note: string }[];
  good: string[];
  /** The debrief: every decision in the room being played. */
  log: Decision[];
  hints: number;
  /** How much help this case gives; moments whose options were opened (intermediate). */
  level: Level;
  revealed: Set<string>;
  stageStart: number;
  strength: number;
  scene: Scene;
  stageDone: boolean;
  result: CaseSnapshot['result'];
  processed: Map<string, CaseSnapshot>;
  /** An AI character's line being written (court server /npc/reply): the same request is asked again. */
  npcWait?: { req: NpcRequest; to: CaseSpeaker; since: number } | null;
}

const g = globalThis as unknown as { __lexsimCases2?: Map<string, CaseState>; __lexsimCaseByOwner2?: Map<string, string> };
const cases = (g.__lexsimCases2 ??= new Map());
const byOwner = (g.__lexsimCaseByOwner2 ??= new Map());

// Fail fast: every article a case cites must be in its verified law store.
for (const kind of Object.keys(BOOKS) as CaseKind[]) {
  const articleSet = new Set(LAW[kind].articles.map((a) => a.number));
  for (const s of BOOKS[kind].STAGES) {
    for (const n of BOOKS[kind].STAGE_ARTICLES[s.id] ?? []) if (!articleSet.has(n)) throw new Error(`case ${kind}: ${n} missing from law store`);
    for (const node of s.nodes) for (const o of node.options ?? []) if (o.article && !articleSet.has(o.article)) throw new Error(`case ${kind}: ${o.article} (${s.id}/${o.id}) missing`);
  }
}

const book = (c: CaseState) => BOOKS[c.kind];
const stageDef = (c: CaseState, id: StageId): StageDef => book(c).STAGES.find((s) => s.id === id)!;
const nodeOf = (c: CaseState): Node | null => (c.stage && c.node ? stageDef(c, c.stage).nodes.find((n) => n.id === c.node) ?? null : null);
const view = (c: CaseState): CaseView => ({ knows: (id) => c.known.has(id), draft: c.draft, strength: c.strength });

function rand(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function patchScene(c: CaseState, patch: Partial<Scene> | undefined) {
  if (!patch) return;
  if (patch.judgeIn === true && !c.scene.judgeIn) c.scene.judgeEntries += 1;
  Object.assign(c.scene, patch, { judgeEntries: c.scene.judgeEntries });
}

/** Every line records the room as it is while it is spoken. */
function say(c: CaseState, lines: Line[], engine?: 'llm') {
  for (const [speaker, text, cue] of lines) {
    const { emotion, ...patch } = cue ?? {};
    patchScene(c, patch);
    c.lines.push({ id: `l${++c.seq}`, speaker, text, scene: { ...c.scene }, ...(emotion ? { emotion } : {}), ...(engine ? { engine } : {}) });
  }
}

function apply(c: CaseState, e: Effect | undefined) {
  if (!e) return;
  e.learn?.forEach((id) => c.known.add(id));
  if (e.penalty) c.penalties.push({ points: e.penalty[0], note: e.penalty[1] });
  if (e.mood) c.scene.clientMood = e.mood;
  patchScene(c, e.scene);
  if (e.strength) c.strength += e.strength;
}

function go(c: CaseState, id: string) {
  for (let guard = 0; guard < 8; guard++) {
    c.node = id;
    const node = nodeOf(c)!;
    patchScene(c, node.scene);
    if (node.goto) {
      id = node.goto(view(c));
      continue;
    }
    if (node.enter) say(c, typeof node.enter === 'function' ? node.enter(view(c)) : node.enter);
    if (node.end) finishStage(c);
    return;
  }
}

/** Learning outcomes judged from what happened in the room (the rubric is the outcomes themselves). */
function judgeOutcomes(c: CaseState, stage: StageId) {
  const { FACTS } = book(c);
  const defects = stage === 'draft' && c.draft ? checkClaim(c.draft, (id) => c.known.has(id)) : [];
  return (stageDef(c, stage).outcomes ?? []).map((o) => {
    const arts = new Set(o.articles ?? []);
    const decisions = c.log.filter((d) => d.article && arts.has(d.article) && d.tone !== 'info');
    const missed = (o.facts ?? []).filter((f) => !c.known.has(f));
    const faults = defects.filter((d) => arts.has(d.article));
    const evidence = [
      ...decisions.map((d) => `${d.tone === 'bad' ? '✗' : '✓'} ${d.chose}`),
      ...missed.map((f) => `✗ Aniqlanmadi: ${(FACTS[f]?.label ?? f).toLowerCase()}`),
      ...faults.map((d) => `✗ ${d.message}`),
    ];
    const touched = decisions.length > 0 || (o.facts?.length ?? 0) > 0 || (stage === 'draft' && arts.size > 0 && c.draft !== null);
    const met = !touched ? null : !decisions.some((d) => d.tone === 'bad') && missed.length === 0 && faults.length === 0;
    return { text: o.text, articles: o.articles ?? [], met, evidence: evidence.slice(0, 6) };
  });
}

function finishStage(c: CaseState) {
  const stage = c.stage!;
  c.stageDone = true;
  c.status[stage] = 'done';
  let verdict: string | null = null;
  const notes = c.penalties.map((p) => `−${p.points} · ${p.note}`);
  let score = 100 - c.penalties.reduce((s, p) => s + p.points, 0);

  if (stage === 'consult') {
    const { FACTS } = book(c);
    const missing = Object.entries(FACTS).filter(([k, f]) => f.key && !c.known.has(k)).map(([k]) => k);
    score -= missing.length * 8;
    if (missing.length) notes.push(`−${missing.length * 8} · Aniqlanmagan: ${missing.map((k) => FACTS[k].label.toLowerCase()).join('; ')}`);
    else c.good.push('Barcha muhim holatlar aniqlandi');
  }
  if (stage === 'draft') {
    const defects = checkClaim(c.draft!, (id) => c.known.has(id));
    for (const d of defects) {
      score -= d.penalty * 3;
      notes.push(`−${d.penalty * 3} · ${d.message}`);
    }
    if (!defects.length) c.good.push('Ariza FPK 189–191 talablariga toʻliq mos');
  }
  if (stage === 'filing') {
    const defects = checkClaim(c.draft!, (id) => c.known.has(id));
    const ruling = filingRuling(defects, c.rulings.filter((r) => r.kind !== 'judgment' && r.kind !== 'scheduled').length + 1);
    c.rulings.push(ruling);
    if (ruling.kind === 'returned') {
      c.status.filing = 'returned';
      score -= 30;
      notes.push('−30 · Ariza qaytarildi (FPK 195) — «Hujjatlar» xonasida tuzatib, qayta topshiring');
      verdict = 'Ariza qaytarildi';
    } else {
      c.good.push('Ariza ish yuritishga qabul qilindi (FPK 193)');
      verdict = 'Ish qoʻzgʻatildi';
    }
  }
  if (stage === 'chamber') {
    c.rulings.push({
      kind: 'scheduled',
      title: 'Ishni sud majlisida muhokama qilishga tayinlash toʻgʻrisida AJRIM',
      body: ['Ish sud muhokamasiga yetarli darajada tayyorlangan deb topilsin.', 'Ish sud majlisida koʻrish uchun tayinlansin: 2-zal, soat 10:00.', ...(c.known.has('witness-called') ? ['Guvoh Bahodir R. sud majlisiga chaqirilsin; javobgardan tabel hisobi talab qilib olinsin.'] : [])],
      articles: ['204-modda', '205-modda'],
    });
  }
  const last = book(c).STAGES.at(-1)!.id === stage;
  if (last && stage !== 'hearing') verdict = book(c).verdict(view(c));
  if (stage === 'trial' && !verdict) verdict = book(c).verdict(view(c));
  if (stage === 'hearing') {
    const v = view(c);
    const won = book(c).won;
    verdict = book(c).verdict(v);
    c.rulings.push({
      kind: 'judgment',
      title: 'HAL QILUV QARORI',
      // FPK 253: kirish, bayon, asoslantiruvchi va xulosa qismlari
      body: [
        'Oʻzbekiston Respublikasi nomidan',
        '2026-yil noyabr, Namuna tumani. Fuqarolik ishlari boʻyicha Namuna tumanlararo sudi — raislik qiluvchi sudya B. Islomov, sud majlisi kotibi Malika S. — Sardor N.ning «Namuna Savdo» MChJga nisbatan ishga tiklash va majburiy progul vaqti uchun haq undirish toʻgʻrisidagi daʼvosi boʻyicha 2-1407/26-sonli fuqarolik ishini ochiq sud majlisida koʻrib chiqdi.',
        'Daʼvogar 2026-yil 9–10-oktabr kunlari kasal boʻlgani sababli ishda boʻlmaganini, biroq 14-oktabrdagi 47-k-sonli buyruq bilan mehnat shartnomasi bekor qilinganini bayon qilib, ishga tiklashni soʻradi. Javobgar boʻshatishni qonuniy deb hisobladi.',
        // Mehnat kodeksi 174-modda: the lawfulness of a dismissal is for the employer to prove
        won(v)
          ? `Mehnat shartnomasi bekor qilinishining qonuniyligini isbotlash vazifasi ish beruvchining zimmasida (Mehnat kodeksi 174-modda). Sud majlisida tekshirilgan mehnatga layoqatsizlik varaqasi va guvoh koʻrsatuvi daʼvogarning ishda boʻlmagani uzrli sababga koʻra ekanini tasdiqladi; javobgar boʻshatishning qonuniyligini isbotlamadi${c.known.has('explanation') ? '. Bundan tashqari, intizomiy jazo qoʻllanguniga qadar daʼvogardan yozma tushuntirish talab qilinmagan (Mehnat kodeksi 313-modda)' : ''}.`
          : 'Isbotlash vazifasi ish beruvchida boʻlsa-da (Mehnat kodeksi 174-modda), javobgar tabel hisobi bilan daʼvogarning 9–10-oktabr kunlari ishda boʻlmaganini koʻrsatdi, daʼvogar tomoni esa uzrli sababni tasdiqlovchi dalillarni sud majlisida tekshirtirmadi; hal qiluv qarori faqat sud majlisida tekshirilgan dalillarga asoslanadi (FPK 249-modda).',
        'Bayon qilinganlarga asosan, FPK 248–253-moddalarini qoʻllab, sud quyidagicha hal qildi:',
        won(v) ? 'Daʼvo qanoatlantirilsin. Sardor N. avvalgi lavozimiga tiklansin. Majburiy progul vaqti uchun haq javobgardan undirilsin.' : 'Daʼvo qanoatlantirilmasin.',
        ...(won(v) ? ['Hal qiluv qarorining daʼvogarni avvalgi ishiga tiklash qismi darhol ijro etilsin (266-modda 4-band).'] : []),
        'Hal qiluv qarori ustidan u qabul qilingan kundan eʼtiboran bir oy ichida apellyatsiya shikoyati berilishi mumkin (385¹-modda). Shikoyat qilinmasa, muddat oʻtgach qonuniy kuchga kiradi (264-modda).',
      ],
      articles: ['248-modda', '249-modda', '253-modda', '264-modda', '266-modda', '385¹-modda'],
    });
  }
  if (stage === 'trial' && book(c).judgment) c.rulings.push(book(c).judgment!(view(c)));
  score = Math.max(0, Math.min(100, Math.round(score)));
  c.scores[stage] = score;
  c.result = { score, verdict, good: c.good, notes, log: c.log, hints: c.hints, reflect: stageDef(c, stage).reflect ?? null, outcomes: judgeOutcomes(c, stage) };
}

function visible(c: CaseState, o: Opt, stage: StageId) {
  if (o.once && c.used.has(`${stage}:${o.id}`)) return false;
  if (o.requires?.some((r) => !c.known.has(r))) return false;
  if (o.hideIf?.some((r) => c.known.has(r))) return false;
  return true;
}

/** At most four replies on screen: in the free conversation, the next three useful questions and one temptation. */
/** Every reply the moment allows (for understanding an answer in the student's own words). */
function allVisible(c: CaseState): Opt[] {
  const node = nodeOf(c);
  if (!node?.options || c.stageDone || node.await) return [];
  return node.options.filter((o) => visible(c, o, c.stage!));
}

const momentKey = (c: CaseState) => `${c.stage}:${c.node}`;

/** What is on screen: beginner — always; intermediate — once opened (−10); advanced — never. */
function optionsOf(c: CaseState): Opt[] {
  if (c.level === 'advanced' || (c.level === 'intermediate' && !c.revealed.has(momentKey(c)))) return [];
  return shownOptions(c);
}

function shownOptions(c: CaseState): Opt[] {
  const node = nodeOf(c);
  if (!node?.options || c.stageDone || node.await) return [];
  const list = node.options.filter((o) => visible(c, o, c.stage!));
  if (c.stage === 'consult') {
    const finish = list.filter((o) => o.next);
    const all = list.filter((o) => o.tone !== 'bad' && !o.next);
    const good = all.slice(0, finish.length ? 2 : 3);
    // the power of attorney is always within reach once the story is told
    const authority = all.find((o) => o.id === 'authority');
    if (authority && !good.includes(authority) && c.known.has('dismissal')) good[good.length - 1] = authority;
    const trap = list.filter((o) => o.tone === 'bad').slice(0, 1);
    return [...good, ...trap, ...finish];
  }
  const r = rand(c.seed ^ [...node.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261));
  const keyed = new Map(node.options.map((o) => [o.id, r()]));
  return list.sort((a, b) => keyed.get(a.id)! - keyed.get(b.id)!).slice(0, 4);
}

function snapshot(c: CaseState): CaseSnapshot {
  const { CASE, FACTS, EVIDENCE, STAGES, STAGE_ARTICLES } = book(c);
  const law = LAW[c.kind];
  const stages: StageView[] = STAGES.map((s) => ({
    id: s.id,
    number: s.number,
    title: s.title,
    place: s.place,
    goal: s.goal,
    outcomes: (s.outcomes ?? []).map((o) => ({ text: o.text, articles: o.articles ?? [] })),
    status: c.stage === s.id && !c.stageDone ? 'active' : (c.status[s.id] ?? 'open'),
    score: c.scores[s.id] ?? null,
  }));
  const node = nodeOf(c);
  const cite = new Set<string>(Object.values(STAGE_ARTICLES).flat());
  return {
    caseId: c.id,
    kind: c.kind,
    title: CASE.title,
    note: CASE.note,
    parties: CASE.parties,
    stages,
    stage: c.stage,
    lines: c.lines,
    options: optionsOf(c).map((o) => ({ id: o.id, text: o.text, kind: o.kind ?? 'say' })),
    level: c.level,
    inputModes: c.level === 'beginner' || c.revealed.has(momentKey(c)) ? ['option', 'text', 'voice'] : ['text', 'voice'],
    revealed: c.revealed.has(momentKey(c)),
    answering: allVisible(c).length > 0,
    await: c.stageDone ? null : (node?.await ?? null),
    standing: c.standing,
    feedback: c.feedback,
    thinking: c.npcWait?.to ?? null,
    facts: Object.entries(FACTS).filter(([id]) => c.known.has(id)).map(([id, f]) => ({ id, label: f.label, detail: f.detail })),
    evidence: Object.entries(EVIDENCE).filter(([, e]) => c.known.has(e.requires)).map(([id, e]) => ({ id, label: e.label, detail: e.detail })),
    draft: c.draft,
    rulings: c.rulings,
    scene: { ...c.scene },
    stageDone: c.stageDone,
    hints: c.hints,
    code: { title: law.title, url: law.url, edition: law.edition, retrievedAt: law.retrievedAt, articles: law.articles.filter((a) => cite.has(a.number)) },
    result: c.stageDone ? c.result : null,
  };
}

export function attachmentsFor(known: (id: string) => boolean) {
  return Object.entries(ATTACHMENTS).filter(([, a]) => !a.requires || known(a.requires));
}

function create(owner: string, kind: CaseKind, level: Level = 'beginner'): CaseState {
  for (const [id, c] of cases) if (c.createdAt < Date.now() - 12 * 3600_000) cases.delete(id);
  const c: CaseState = {
    id: `ish_${randomBytes(12).toString('base64url')}`,
    owner,
    kind,
    seed: randomBytes(4).readUInt32LE(0),
    createdAt: Date.now(),
    stage: null,
    node: null,
    status: Object.fromEntries(BOOKS[kind].STAGES.map((s) => [s.id, 'open'])),
    scores: Object.fromEntries(BOOKS[kind].STAGES.map((s) => [s.id, null])),
    known: new Set(),
    used: new Set(),
    lines: [],
    seq: 0,
    situations: {},
    feedback: null,
    standing: false,
    scolded: new Set(),
    draft: null,
    rulings: [],
    penalties: [],
    good: [],
    log: [],
    hints: 0,
    level,
    revealed: new Set(),
    stageStart: Date.now(),
    strength: 0,
    scene: { witnessIn: false, judgeIn: true, judgeEntries: 1, clientPresent: true, everyoneStands: false, clientMood: 'upset' },
    stageDone: false,
    result: null,
    processed: new Map(),
  };
  cases.set(c.id, c);
  byOwner.set(`${owner}:${kind}`, c.id);
  return c;
}

/* ── persistence (src/server/case/persist.ts) ── */

/**
 * The case as plain JSON for the external store. The owner's token is left
 * out (the store keys it by a hash); the idempotency cache is not kept.
 */
export function dumpCase(id: string): { kind: CaseKind; state: unknown } | null {
  const c = cases.get(id);
  if (!c) return null;
  const { owner: _owner, processed: _processed, ...rest } = c;
  void _owner;
  void _processed;
  const state = JSON.parse(JSON.stringify(rest, (_k, v) => (v instanceof Set ? { __set: [...v] } : v)));
  return { kind: c.kind, state };
}

/** Brings a stored case back under this owner (the store has already checked the owner's hash). */
export function loadCase(owner: string, raw: unknown): void {
  const state = JSON.parse(JSON.stringify(raw), (_k, v) => (v && typeof v === 'object' && Array.isArray((v as { __set?: unknown[] }).__set) ? new Set((v as { __set: unknown[] }).__set) : v)) as Omit<CaseState, 'owner' | 'processed'>;
  if (!state || typeof state !== 'object' || !('id' in state) || !BOOKS[(state as CaseState).kind]) return;
  const c: CaseState = { ...(state as CaseState), owner, processed: new Map() };
  // cases stored before levels existed
  c.level ??= 'beginner';
  c.revealed ??= new Set();
  c.situations ??= {};
  c.npcWait ??= null;
  cases.set(c.id, c);
  byOwner.set(`${owner}:${c.kind}`, c.id);
}

export const hasCase = (id: string) => cases.has(id);
export const currentCaseId = (owner: string, kind: CaseKind) => byOwner.get(`${owner}:${kind}`) ?? null;

export function startCase(owner: string, fresh: boolean, kind: CaseKind = 'labour', level: Level = 'beginner'): CaseSnapshot {
  const existing = byOwner.get(`${owner}:${kind}`);
  if (!fresh && existing && cases.has(existing)) return snapshot(cases.get(existing)!);
  return snapshot(create(owner, kind, level));
}

export function currentCase(owner: string | undefined, kind: CaseKind = 'labour'): CaseSnapshot | null {
  const id = owner ? byOwner.get(`${owner}:${kind}`) : undefined;
  const c = id ? cases.get(id) : undefined;
  return c ? snapshot(c) : null;
}

function owned(id: string, owner: string | undefined): CaseState {
  const c = cases.get(id);
  if (!c) throw new HttpError(404, 'case_not_found', 'Ish topilmadi yoki muddati tugagan');
  const a = Buffer.from(c.owner);
  const b = Buffer.from(owner ?? '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(403, 'forbidden', 'Bu ish sizga tegishli emas');
  return c;
}

export const getCase = (id: string, owner: string | undefined) => snapshot(owned(id, owner));

/** Starting later in the case: what the earlier rooms would have produced comes from the prepared file. */
function prepare(c: CaseState, stage: StageId) {
  const { STAGES, PREPARED } = book(c);
  const at = STAGES.findIndex((s) => s.id === stage);
  const notes: string[] = [];
  // only if the first room was never played: what the student learned (or missed) there stands
  if (at > 0 && c.scores[STAGES[0].id] == null && PREPARED.known.some((k) => !c.known.has(k))) {
    PREPARED.known.forEach((k) => c.known.add(k));
    notes.push(`${STAGES[0].place.toLowerCase()} bosqichi`);
  }
  if (c.kind === 'labour' && at > 1 && !c.draft && PREPARED.draft) {
    c.draft = { ...PREPARED.draft };
    notes.push('daʼvo arizasi');
  }
  if (c.kind === 'labour' && at > 3 && c.status.chamber !== 'done' && !c.known.has('witness-called')) {
    c.known.add('witness-called');
    notes.push('tayyorlov (guvoh chaqirilgan)');
  }
  return notes;
}

function enter(c: CaseState, stage: StageId) {
  if (kindOfStage(stage) !== c.kind) throw new HttpError(409, 'wrong_case', 'Bu xona boshqa ishga tegishli');
  if (c.stage === stage && !c.stageDone) return; // reload
  const prepared = prepare(c, stage);
  c.stage = stage;
  c.stageDone = false;
  c.result = null;
  c.lines = [];
  c.feedback = prepared.length ? { tone: 'info', message: `Ish papkasi tayyor holda berildi: ${prepared.join(', ')}.`, article: null } : null;
  c.standing = false;
  c.penalties = [];
  c.good = [];
  c.log = [];
  c.hints = 0;
  c.stageStart = Date.now();
  c.scolded.clear();
  if (COURT.has(stage)) c.strength = 0;
  for (const key of [...c.used]) if (key.startsWith(`${stage}:`)) c.used.delete(key);
  c.scene = { witnessIn: false, judgeIn: !COURT.has(stage), judgeEntries: COURT.has(stage) ? 0 : 1, clientPresent: stage !== 'draft' && stage !== 'filing', everyoneStands: false, clientMood: stage === 'consult' ? 'upset' : 'calm' };
  if (c.status[stage] === 'done') c.status[stage] = 'open';
  go(c, stageDef(c, stage).start);
}

function choose(c: CaseState, optionId: string, via: InputMode = 'option') {
  const stage = c.stage;
  if (!stage || c.stageDone) throw new HttpError(409, 'not_in_room', 'Hozir hech qaysi xonada emassiz');
  const node = nodeOf(c)!;
  // a picked option must be on screen; an answer in own words may land on any reply the moment allows
  const option = (via === 'option' ? optionsOf(c) : allVisible(c)).find((o) => o.id === optionId);
  if (!option) throw new HttpError(422, 'option_unavailable', 'Bu javob hozir mavjud emas');

  // In the courtroom answers are given standing: FPK 212 (civil), JPK 424 (criminal).
  if (COURT.has(stage) && (option.kind ?? 'say') === 'say' && !c.standing) {
    const { rule, address } = book(c).standing;
    if (!c.scolded.has(node.id)) {
      c.penalties.push({ points: 10, note: 'Sudga oʻtirgan holda javob berishga urindingiz' });
      record(c, option.text, 'bad', 10, 'Sudga tik turib murojaat qilinadi (oʻtirgan holda javob berishga urindingiz).', null, rule);
    }
    c.scolded.add(node.id);
    say(c, [['judge', `${address}, oʻrningizdan turib gapiring.`]]);
    c.feedback = { tone: 'bad', message: 'Sudga tik turib murojaat qilinadi. G - turing, soʻng javob bering.', article: rule };
    return;
  }

  c.used.add(`${stage}:${option.id}`);
  {
    const better = option.tone === 'bad' ? (node.options ?? []).find((o) => o.tone === 'good' && o.id !== option.id && !o.requires?.some((q) => !c.known.has(q)) && !o.hideIf?.some((q) => c.known.has(q))) : undefined;
    record(c, option.text, option.tone ?? null, option.effect?.penalty?.[0] ?? 0, option.effect?.penalty?.[1] ?? option.feedback ?? null, better?.text ?? null, option.article ?? better?.article ?? null);
    c.log[c.log.length - 1].inputMode = via;
  }
  say(c, [['you', option.text]]);
  apply(c, option.effect);
  if (option.tone === 'good' && option.article) {
    const title = LAW[c.kind].articles.find((x) => x.number === option.article)?.title;
    const note = `${CODE[c.kind]} ${option.article}${title ? ` - ${title.toLowerCase()}` : ''}`;
    if (!c.good.includes(note)) c.good.push(note);
  }
  if (option.reply) say(c, typeof option.reply === 'function' ? option.reply(view(c)) : option.reply);
  c.feedback = option.tone === 'bad'
    ? { tone: 'bad', message: option.feedback ?? (option.article ? `Kodeksga qarang: ${option.article}.` : 'Bu javob vaziyatga mos emas.'), article: option.article ?? null }
    : option.feedback
      ? { tone: 'info', message: option.feedback, article: option.article ?? null }
      : null;
  // immediate notes follow the level: beginner all, intermediate only serious errors, advanced none (the debrief has everything)
  if (c.level === 'advanced') c.feedback = null;
  else if (c.level === 'intermediate' && !(option.tone === 'bad' && (option.effect?.penalty?.[0] ?? 0) >= 15)) c.feedback = null;
  if (COURT.has(stage) && option.next) c.standing = false;
  if (option.next) go(c, option.next);
}

/** Intermediate: open this moment's options, once, for 10 points. */
function reveal(c: CaseState) {
  if (c.level !== 'intermediate') throw new HttpError(409, 'reveal_disabled', 'Bu darajada variantlarni ochib boʻlmaydi');
  if (!c.stage || c.stageDone || !nodeOf(c)?.options) throw new HttpError(409, 'not_in_room', 'Hozir tanlanadigan javob yoʻq');
  const key = momentKey(c);
  if (c.revealed.has(key)) return;
  c.revealed.add(key);
  c.penalties.push({ points: 10, note: 'Variantlar ochildi' });
  record(c, 'Variantlarni ochdi', 'info', 10, 'Variantlar ochildi (−10).', null, null);
}

/** For understanding a free answer: what the moment allows and what was just said to the student. */
export function freeCandidates(id: string, owner: string | undefined) {
  const c = owned(id, owner);
  const asked = [...c.lines].reverse().find((l) => l.speaker !== 'you' && l.speaker !== 'system');
  return {
    kind: c.kind,
    stage: c.stage,
    node: c.node,
    prompt: asked?.text ?? null,
    options: allVisible(c).map((o) => ({ id: o.id, text: o.text, tone: o.tone ?? 'info' })),
  };
}

/**
 * An answer in own words, already understood: either it lands on a reply (then it is that reply, said in
 * the student's words), or it is unclear (the room asks again, no points), or it crosses an ethical line.
 */
/** Asking again when an answer was not understood (pre-rendered: tools/voice/lines.mjs reads these). */
export const CLARIFY = {
  formal: ['Kechirasiz, fikringizni tushunmadim. Aniqroq ayting, iltimos.', 'Iltimos, qisqa va aniq bayon qiling.', 'Yana bir bor takrorlang, iltimos.'],
  plain: ['Kechirasiz, tushunmadim. Yana bir bor aytasizmi?', 'Uzr, nima demoqchi ekaningizni tushunmadim.', 'Bir oz soddaroq tushuntirib bering.'],
};
export const FORMAL = new Set<string>(['judge', 'clerk', 'secretary', 'officer', 'investigator', 'chief']);

/**
 * What the AI character needs to answer a free line (court server /npc/reply): who is being spoken to,
 * the room's goal, the facts that character knows, the conversation so far. Null when nobody the AI
 * may voice is listening.
 */
export function npcRequest(id: string, owner: string | undefined, utterance: string): NpcRequest | null {
  const c = owned(id, owner);
  const to = [...c.lines].reverse().find((l) => l.speaker !== 'you' && l.speaker !== 'system')?.speaker;
  if (!to || !c.stage || !canVoice(to)) return null;
  const { FACTS, STAGES } = book(c);
  // the client knows their own story; officials know only what is already on file
  const facts = (to === 'client' ? Object.values(FACTS) : [...c.known].map((k) => FACTS[k]).filter(Boolean)).map((f) => `${f.label}: ${f.detail}`).slice(0, 12);
  return {
    speaker: to,
    caseKind: c.kind,
    stage: c.stage,
    goal: STAGES.find((s) => s.id === c.stage)?.goal ?? '',
    utterance,
    facts,
    articles: [],
    history: c.lines.filter((l) => l.speaker !== 'system').slice(-16).map((l) => ({ speaker: l.speaker, text: l.text })),
    conversationId: `${c.kind}-${c.id}-${c.stage}`.slice(0, 64),
  };
}

/** The AI character's line has come (or is given up on): it is said, or the room asks again as before. */
function npcSay(c: CaseState, to: CaseSpeaker, answer: NpcAnswer) {
  c.npcWait = null;
  if (answer.kind === 'ok') {
    say(c, [[to, answer.text, ...(answer.emotion ? [{ emotion: answer.emotion as Emotion }] : [])] as Line], answer.engine === 'llm' ? 'llm' : undefined);
    c.feedback = null;
  } else {
    const set = FORMAL.has(to) ? CLARIFY.formal : CLARIFY.plain;
    say(c, [[to, set[c.seq % set.length]]]);
  }
}

/** The client asks again while a character "thinks" (the same request; the server caches the line). */
export async function npcPoll(id: string, owner: string | undefined): Promise<CaseSnapshot> {
  const c = owned(id, owner);
  const w = c.npcWait;
  if (!w) return snapshot(c);
  const answer = await askNpc(owner, w.req, false);
  // the student may have moved on meanwhile
  if (c.npcWait !== w) return snapshot(c);
  if (answer.kind === 'pending' && Date.now() - w.since < 120_000) return snapshot(c);
  npcSay(c, w.to, answer.kind === 'pending' ? { kind: 'none' } : answer);
  return snapshot(c);
}

export function actSaid(id: string, owner: string | undefined, input: { clientActionId: string; text: string; inputMode: InputMode }, understood: { optionId: string | null; clarify: string | null; ethics: boolean; situation?: Situation | null; npc?: { req: NpcRequest; answer: NpcAnswer } | null }): CaseSnapshot {
  const c = owned(id, owner);
  const cached = c.processed.get(input.clientActionId);
  if (cached) return cached;
  if (!c.stage || c.stageDone) throw new HttpError(409, 'not_in_room', 'Hozir hech qaysi xonada emassiz');
  c.npcWait = null;
  const to = [...c.lines].reverse().find((l) => l.speaker !== 'you' && l.speaker !== 'system')?.speaker;
  const sit = understood.situation && to ? understood.situation : null;
  const line = sit && to ? situationLine(sit, to, (c.situations[sit.id] = (c.situations[sit.id] ?? -1) + 1)) : null;
  const last = to ? [...c.lines].reverse().find((l) => l.speaker === to) : undefined;
  if (sit && to && sit.action === 'repeat_last' && last) {
    // «eshitmadim, qaytaring»: the same words again, no points, the moment stays open
    say(c, [['you', input.text]]);
    if (line) say(c, [[to, line.text, ...(line.emotion ? [{ emotion: line.emotion }] : [])] as Line]);
    say(c, [[to, last.text, ...(last.emotion ? [{ emotion: last.emotion }] : [])] as Line], last.engine);
    c.feedback = null;
  } else if (sit && line && to) {
    // a person's answer to the unexpected: what you said stays on record, they answer in their own
    // words and mood, and the moment stays open (the stage does not move)
    say(c, [['you', input.text]]);
    say(c, [[to, line.text, ...(line.emotion ? [{ emotion: line.emotion }] : [])] as Line]);
    if (sit.tone === 'bad') {
      const points = sit.ethics ? 30 : 10;
      c.penalties.push({ points, note: sit.note ?? (sit.ethics ? 'Kasbiy etikani buzish' : 'Notoʻgʻri xatti-harakat') });
      record(c, input.text, 'bad', points, sit.note ?? null, null, null);
      c.log[c.log.length - 1].inputMode = input.inputMode;
      c.feedback = c.level === 'advanced' ? null : { tone: 'bad', message: sit.note ?? 'Bu gap advokatga yarashmaydi.', article: null };
    } else c.feedback = null;
  } else if (understood.optionId) choose(c, understood.optionId, input.inputMode);
  else if (understood.ethics) {
    say(c, [['you', input.text]]);
    c.penalties.push({ points: 40, note: 'Axloqiy chegarani buzish (pora yoki bosimga ishora)' });
    record(c, input.text, 'bad', 40, 'Pora, tanish-bilish yoki bosimga ishora — mutlaqo mumkin emas.', null, null);
    c.log[c.log.length - 1].inputMode = input.inputMode;
    c.feedback = c.level === 'advanced' ? null : { tone: 'bad', message: 'Bunday gap - korrupsion ishora. Mutlaqo mumkin emas.', article: null };
  } else if (understood.npc && to && understood.npc.answer.kind !== 'none') {
    // nothing ready fits: the character answers in their own role through the AI (or starts thinking)
    say(c, [['you', input.text]]);
    if (understood.npc.answer.kind === 'pending') {
      c.npcWait = { req: understood.npc.req, to, since: Date.now() };
      c.feedback = null;
    } else npcSay(c, to, understood.npc.answer);
  } else {
    // not understood: what you said stays on record, and whoever you are talking to asks again — out loud,
    // in their own way (a judge formally, a client plainly); nothing is lost, the moment stays open
    say(c, [['you', input.text]]);
    const to = [...c.lines].reverse().find((l) => l.speaker !== 'you' && l.speaker !== 'system')?.speaker;
    if (to) {
      const set = FORMAL.has(to) ? CLARIFY.formal : CLARIFY.plain;
      say(c, [[to, set[c.seq % set.length]]]);
    }
    c.feedback = { tone: 'info', message: understood.clarify ?? 'Fikringizni aniqroq, toʻliq gap bilan ayting.', article: null };
  }
  const result = snapshot(c);
  c.processed.set(input.clientActionId, result);
  return result;
}

/** One line of the debrief: what was asked, what you said, what it cost, what would have been better. */
function record(c: CaseState, chose: string, tone: Decision['tone'], points: number, why: string | null, better: string | null, article: string | null) {
  const asked = [...c.lines].reverse().find((l) => l.speaker !== 'you' && l.speaker !== 'system');
  c.log.push({ at: Math.round((Date.now() - c.stageStart) / 1000), prompt: asked?.text ?? null, chose, tone, points, why, better, article });
}

/** A hint: the article the right answer rests on (−5 points, at most once per moment). */
function hint(c: CaseState) {
  const node = nodeOf(c);
  if (c.level === 'advanced') throw new HttpError(409, 'hints_disabled', 'Bu darajada maslahat yoʻq');
  if (!c.stage || c.stageDone || !node?.options) throw new HttpError(409, 'no_hint', 'Hozir maslahat kerak emas');
  const right = allVisible(c).find((o) => o.tone === 'good' && o.article) ?? allVisible(c).find((o) => o.tone === 'good');
  if (!right) throw new HttpError(409, 'no_hint', 'Bu daqiqa uchun maslahat yoʻq');
  const key = `hint:${node.id}`;
  if (!c.scolded.has(key)) {
    c.scolded.add(key);
    c.hints += 1;
    c.penalties.push({ points: 5, note: 'Maslahatdan foydalanildi' });
  }
  const title = right.article ? LAW[c.kind].articles.find((x) => x.number === right.article)?.title : undefined;
  // in the fact-finding room the most useful hint is what is still unknown
  const { FACTS, STAGES } = book(c);
  const unknown = c.stage === STAGES[0].id ? Object.entries(FACTS).find(([k, f]) => f.key && !c.known.has(k)) : undefined;
  if (unknown && !right.article) {
    c.feedback = { tone: 'info', message: `Maslahat: hali aniqlanmagan muhim holat bor — «${unknown[1].label}». Shu haqda soʻrang.`, article: null };
    return;
  }
  c.feedback = {
    tone: 'info',
    message: right.article
      ? `Maslahat: ${CODE[c.kind]} ${right.article}${title ? ` — «${title}»` : ''}. Shu moddaga mos javobni tanlang.`
      : 'Maslahat: holatlarga asoslaning — baho emas, fakt va dalil.',
    article: right.article ?? null,
  };
}

function stand(c: CaseState, up: boolean) {
  if (c.standing === up) return;
  c.standing = up;
  const node = nodeOf(c);
  if (!node || c.stageDone) return;
  if (node.await === (up ? 'stand' : 'sit')) {
    c.feedback = null;
    go(c, node.then!);
  }
}

function submitDraft(c: CaseState, d: ClaimDraft) {
  if (c.stage !== 'draft' || nodeOf(c)?.await !== 'draft') throw new HttpError(409, 'not_drafting', 'Ariza «Hujjatlar» xonasida tuziladi');
  const known = (id: string) => c.known.has(id);
  const { EVIDENCE } = book(c);
  const allowed = new Set(attachmentsFor(known).map(([id]) => id));
  c.draft = {
    ...d,
    evidence: [...new Set(d.evidence)].filter((e) => e in EVIDENCE && known(EVIDENCE[e].requires)),
    attachments: [...new Set(d.attachments)].filter((a) => allowed.has(a)),
  };
  if (c.status.filing === 'returned') c.status.filing = 'open';
  go(c, nodeOf(c)!.then!);
}

export function act(id: string, owner: string | undefined, input: CaseActRequest): CaseSnapshot {
  const c = owned(id, owner);
  const cached = c.processed.get(input.clientActionId);
  if (cached) return cached;
  // any new move supersedes a line the AI is still writing (re-entering the room keeps it)
  if (input.type !== 'enter') c.npcWait = null;
  switch (input.type) {
    case 'enter':
      enter(c, input.stage);
      break;
    case 'choose':
      choose(c, input.optionId);
      break;
    case 'stand':
      stand(c, input.up);
      break;
    case 'hint':
      hint(c);
      break;
    case 'reveal':
      reveal(c);
      break;
    case 'say':
      throw new HttpError(400, 'say_via_route', 'Erkin javob route orqali tushuniladi');
    case 'draft':
      submitDraft(c, input.draft);
      break;
    case 'leave':
      c.stage = null;
      c.node = null;
      break;
  }
  const result = snapshot(c);
  c.processed.set(input.clientActionId, result);
  if (c.processed.size > 400) c.processed.delete(c.processed.keys().next().value!);
  return result;
}
