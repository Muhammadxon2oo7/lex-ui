/**
 * Simulation orchestrator — the authoritative scenario state machine.
 *
 *  briefing ─start→ in-progress ─finish / patience 0 / bribe accepted→ evaluating → report-ready
 *
 * Invariants
 *  - `sequence` is monotonic per session; every state change is an event.
 *  - Mutations are idempotent by client id (double clicks / retries are safe).
 *  - Hidden facts, meters, score and citations never leave this module
 *    except through `toSnapshot` / the evaluator.
 *
 * Storage is an in-process map (reference backend for the vertical slice).
 * The production target is the FastAPI + PostgreSQL service described in the
 * concept; it implements the same `/v1` contract.
 */
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  EMPTY_DOCUMENT,
  PROTOCOL_VERSION,
  type Assessment,
  type DocumentDraft,
  type Emotion,
  type Gesture,
  type MutationResponse,
  type ObjectState,
  type ReplyOption,
  type Objective,
  type SessionMode,
  type SessionStatus,
  type SimEvent,
  type Snapshot,
  type Turn,
} from '@/contracts';
import { SCENARIOS, type HiddenFact, type ScenarioDefinition } from '../scenarios/dxm-yoqolgan-staj';
import { ScriptedCharacterAgent, type Beat, type CharacterAgent } from './character';
import { RuleIntentClassifier, type IntentClassifier, type IntentTag } from './intent';
import { evaluate } from './evaluator';
import { pack, unpack } from '@/server/durable';
import { situationLine, type Situation } from '@/server/situation';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type BribeStage = 'none' | 'offered' | 'pushed' | 'refused' | 'ambiguous' | 'accepted';

export interface Session {
  id: string;
  ownerToken: string;
  scenario: ScenarioDefinition;
  mode: SessionMode;
  seed: number;
  rng: number;
  status: SessionStatus;
  sequence: number;
  events: SimEvent[];
  turns: Turn[];
  userTurns: number;
  usedReplies: Set<string>;
  /** How many times each human situation has been answered: the next variant follows. */
  situations: Record<string, number>;
  inspectedPhone: boolean;
  unlocked: Map<string, number>;
  patience: number;
  trust: number;
  emotion: Emotion;
  intensity: number;
  /** tag → ids of the user turns where it occurred (evidence for the report). */
  evidence: Partial<Record<IntentTag, string[]>>;
  bribe: { turnAt: number; stage: BribeStage; offerTurnId?: string; responseTurnId?: string };
  queue: { enabled: boolean; fired: boolean };
  objectives: Objective[];
  objects: Record<string, ObjectState>;
  document: DocumentDraft;
  documentSubmitted: boolean;
  endedBy: 'student' | 'npc-left' | 'bribe' | null;
  assessment: Assessment | null;
  processed: Map<string, MutationResponse>;
  startedAt: string | null;
  createdAt: number;
  lock: Promise<unknown>;
}

interface Engine {
  classifier: IntentClassifier;
  character: CharacterAgent;
}

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SESSIONS = 500;

const g = globalThis as unknown as { __lexsim?: { sessions: Map<string, Session>; engine: Engine } };
const store = (g.__lexsim ??= {
  sessions: new Map(),
  engine: { classifier: new RuleIntentClassifier(), character: new ScriptedCharacterAgent() },
});

/** Test / integration seam: swap the classifier or character agent. */
export function configureEngine(engine: Partial<Engine>) {
  Object.assign(store.engine, engine);
}

/* ───────────────────────────── helpers ───────────────────────────── */

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const now = () => new Date().toISOString();

/** mulberry32 — tiny deterministic PRNG so a seed reproduces a session. */
function nextRandom(s: Session): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function emit<T extends SimEvent['type']>(
  s: Session,
  batch: SimEvent[],
  type: T,
  payload: Extract<SimEvent, { type: T }>['payload'],
) {
  s.sequence += 1;
  const event = {
    eventId: `evt_${randomUUID()}`,
    sequence: s.sequence,
    sessionId: s.id,
    timestamp: now(),
    type,
    payload,
  } as SimEvent;
  s.events.push(event);
  batch.push(event);
}

function addTurn(s: Session, speaker: Turn['speaker'], text: string, emotion?: Emotion): Turn {
  const turn: Turn = { id: `t_${s.turns.length + 1}`, index: s.turns.length, speaker, text, at: now(), emotion };
  s.turns.push(turn);
  return turn;
}

function moodFromMeters(s: Session): { emotion: Emotion; intensity: number } {
  if (s.patience < 25) return { emotion: 'upset', intensity: 0.9 };
  if (s.patience < 45) return { emotion: 'impatient', intensity: 0.65 };
  if (s.trust >= 72) return { emotion: 'reassured', intensity: 0.7 };
  if (s.trust >= 55) return { emotion: 'calm', intensity: 0.5 };
  return { emotion: 'neutral', intensity: 0.35 };
}

function setObjective(s: Session, batch: SimEvent[], id: string) {
  const o = s.objectives.find((x) => x.id === id);
  if (!o || o.done) return;
  o.done = true;
  emit(s, batch, 'objective.updated', { objectiveId: id, done: true });
}

function setObject(s: Session, batch: SimEvent[], objectId: string, state: ObjectState) {
  if (s.objects[objectId] === state) return;
  s.objects[objectId] = state;
  emit(s, batch, 'scene.objectState', { objectId, state });
}

function setStatus(s: Session, batch: SimEvent[], status: SessionStatus) {
  s.status = status;
  emit(s, batch, 'session.status', { status });
}

function npcSay(s: Session, batch: SimEvent[], text: string, gesture: Gesture, revealed: string[] = []) {
  const turn = addTurn(s, 'npc', text, s.emotion);
  emit(s, batch, 'dialogue.npcTurn', { turn, revealedFactIds: revealed });
  emit(s, batch, 'npc.emotion', { npcId: s.scenario.public.npc.id, emotion: s.emotion, intensity: s.intensity });
  if (gesture !== 'none') emit(s, batch, 'npc.gesture', { npcId: s.scenario.public.npc.id, clip: gesture });
}

function finalize(s: Session, batch: SimEvent[], endedBy: NonNullable<Session['endedBy']>) {
  s.endedBy = endedBy;
  setStatus(s, batch, 'evaluating');
  s.assessment = evaluate(s);
  setObjective(s, batch, 'finish');
  setStatus(s, batch, 'report-ready');
}

function respond(s: Session, batch: SimEvent[], clientId?: string): MutationResponse {
  const response = { events: batch, snapshot: toSnapshot(s) };
  if (clientId) s.processed.set(clientId, response);
  return response;
}

/** Serialise mutations per session so concurrent requests cannot interleave. */
function withLock<T>(s: Session, fn: () => Promise<T>): Promise<T> {
  const run = s.lock.then(fn, fn);
  s.lock = run.catch(() => undefined);
  return run;
}

function prune() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, s] of store.sessions) if (s.createdAt < cutoff) store.sessions.delete(id);
  while (store.sessions.size > MAX_SESSIONS) {
    const oldest = store.sessions.keys().next().value;
    if (!oldest) break;
    store.sessions.delete(oldest);
  }
}

/* ───────────────────────────── public API ───────────────────────────── */

export function newOwnerToken(): string {
  return randomBytes(24).toString('base64url');
}

export function createSession(input: {
  scenarioId: string;
  mode: SessionMode;
  seed?: number;
  ownerToken: string;
}): Session {
  const scenario = SCENARIOS[input.scenarioId];
  if (!scenario) throw new HttpError(404, 'scenario_not_found', 'Ssenariy topilmadi');
  prune();

  const seed = input.seed ?? randomBytes(4).readUInt32LE(0);
  const s: Session = {
    id: `sim_${randomBytes(12).toString('base64url')}`,
    ownerToken: input.ownerToken,
    scenario,
    mode: input.mode,
    seed,
    rng: seed | 0,
    status: 'briefing',
    sequence: 0,
    events: [],
    turns: [],
    userTurns: 0,
    usedReplies: new Set(),
    situations: {},
    inspectedPhone: false,
    unlocked: new Map(),
    patience: scenario.initial.patience,
    trust: scenario.initial.trust,
    emotion: 'impatient',
    intensity: 0.5,
    evidence: {},
    bribe: { turnAt: 0, stage: 'none' },
    queue: { enabled: false, fired: false },
    objectives: [
      { id: 'reach-desk', label: '3-xonadagi ish joyingizga boring', done: false },
      { id: 'clarify', label: 'Fuqaroni tinglang va vaziyatni aniqlang', done: false },
      { id: 'document', label: 'Terminalda xizmatni rasmiylashtiring', done: false },
      { id: 'finish', label: 'Qabulni yakunlang', done: false },
    ],
    objects: { envelope: 'disabled', phone: 'disabled', receipt: 'disabled' },
    document: { ...EMPTY_DOCUMENT },
    documentSubmitted: false,
    endedBy: null,
    assessment: null,
    processed: new Map(),
    startedAt: null,
    createdAt: Date.now(),
    lock: Promise.resolve(),
  };
  // Seeded complications: when the bribe lands and whether the queue knocks.
  const { earliestTurn, latestTurn } = scenario.bribe;
  s.bribe.turnAt = earliestTurn + Math.floor(nextRandom(s) * (latestTurn - earliestTurn + 1));
  s.queue.enabled = nextRandom(s) < scenario.queuePressure.probability;

  store.sessions.set(s.id, s);
  return s;
}

/** The session as a stored document (without its owner token and lock; the last answers kept for idempotency). */
export function dumpSession(id: string): unknown | null {
  const s = store.sessions.get(id);
  if (!s) return null;
  const { lock: _lock, ownerToken: _owner, processed, ...rest } = s;
  void _lock;
  void _owner;
  return pack({ ...rest, processed: new Map([...processed].slice(-8)) });
}

/** Brings a stored session back under this owner (the store has already checked the owner's hash). */
export function loadSession(owner: string, raw: unknown): boolean {
  const s = unpack<Omit<Session, 'ownerToken' | 'lock'>>(raw);
  if (!s || typeof s !== 'object' || !s.id || !(s.processed instanceof Map)) return false;
  // (sessions stored before human situations existed have no counter yet)
  store.sessions.set(s.id, { ...s, situations: s.situations ?? {}, ownerToken: owner, lock: Promise.resolve() } as Session);
  return true;
}
export const hasSession = (id: string) => store.sessions.has(id);

export function getSession(id: string, ownerToken: string | undefined): Session {
  const s = store.sessions.get(id);
  if (!s) throw new HttpError(404, 'session_not_found', 'Sessiya topilmadi yoki muddati tugagan');
  const a = Buffer.from(s.ownerToken);
  const b = Buffer.from(ownerToken ?? '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(403, 'forbidden', 'Bu sessiya sizga tegishli emas');
  }
  return s;
}

/**
 * Replies currently on offer. Order is a seeded shuffle that only changes
 * when the dialogue advances, so position never hints at quality and a
 * refresh shows the same list.
 */
export function availableOptions(s: Session): ReplyOption[] {
  if (s.status !== 'in-progress' || s.turns.length === 0) return [];
  const bribePending = s.bribe.stage === 'offered' || s.bribe.stage === 'pushed';
  const factAsked = (tags: string[]) => s.scenario.facts.some((f) => tags.includes(f.unlockedBy) && s.unlocked.has(f.id));
  const pool = s.scenario.replies.filter((r) => {
    if (Boolean(r.bribe) !== bribePending) return false;
    if (bribePending) return true; // every answer stays possible, including repeating yourself
    if (s.usedReplies.has(r.id)) return false;
    if (r.requires && !s.unlocked.has(r.requires)) return false;
    return !factAsked(r.tags); // no point re-asking what he already told you
  });
  let state = (s.seed ^ Math.imul(s.userTurns + 1, 0x9e3779b1)) | 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = pool.map((r) => ({ r, k: rand() })).sort((a, b) => a.k - b.k);
  return order.map(({ r }) => ({ id: r.id, text: r.text, kind: r.kind }));
}

export function toSnapshot(s: Session): Snapshot {
  const facts = s.scenario.facts
    .filter((f) => s.unlocked.has(f.id))
    .map((f) => ({ id: f.id, text: f.summary, unlockedAtTurn: s.unlocked.get(f.id)! }));
  return {
    protocol: PROTOCOL_VERSION,
    sessionId: s.id,
    sequence: s.sequence,
    status: s.status,
    mode: s.mode,
    engine: store.engine.character.kind,
    scenario: s.scenario.public,
    meters: s.mode === 'tutorial' ? { patience: Math.round(s.patience), trust: Math.round(s.trust) } : null,
    npc: { emotion: s.emotion, intensity: s.intensity },
    turns: s.turns,
    options: availableOptions(s),
    facts,
    factsTotal: s.scenario.facts.length,
    objectives: s.objectives,
    objects: s.objects,
    document: s.document,
    documentSubmitted: s.documentSubmitted,
    outcome: s.assessment?.outcome ?? null,
    startedAt: s.startedAt,
  };
}

export function eventsAfter(s: Session, after: number): SimEvent[] {
  return s.events.filter((e) => e.sequence > after);
}

export function interact(
  s: Session,
  input: { clientActionId: string; action: 'start' | 'enter-room' | 'sit-at-desk' | 'open-terminal' | 'inspect-phone' },
): Promise<MutationResponse> {
  return withLock(s, async () => {
    const cached = s.processed.get(input.clientActionId);
    if (cached) return cached;
    const batch: SimEvent[] = [];

    if (input.action === 'start') {
      if (s.status === 'briefing') {
        s.startedAt = now();
        setStatus(s, batch, 'in-progress');
      }
    } else if (s.status !== 'in-progress') {
      throw new HttpError(409, 'session_not_active', 'Sessiya faol emas');
    } else if (input.action === 'sit-at-desk') {
      setObjective(s, batch, 'reach-desk');
      if (s.turns.length === 0) npcSay(s, batch, s.scenario.openingLine, 'sigh');
    } else if (input.action === 'inspect-phone') {
      // Looking at the evidence is only possible once he has offered it.
      if (s.objects.phone === 'active') s.inspectedPhone = true;
    }
    return respond(s, batch, input.clientActionId);
  });
}

const FACT_TAGS: IntentTag[] = ['ask-work-period', 'ask-documents', 'ask-employer-status', 'ask-previous-visits'];

export function processTurn(
  s: Session,
  input: { clientTurnId: string; text?: string; optionId?: string },
  /** A human situation the court server recognised in a free answer (swearing, small talk…): the citizen answers it. */
  situation?: Situation | null,
): Promise<MutationResponse> {
  return withLock(s, async () => {
    const cached = s.processed.get(input.clientTurnId);
    if (cached) return cached;
    if (s.status !== 'in-progress') throw new HttpError(409, 'session_not_active', 'Sessiya faol emas');
    if (s.turns.length === 0) throw new HttpError(409, 'dialogue_not_started', 'Suhbat hali boshlanmagan');

    const { classifier, character } = store.engine;
    const batch: SimEvent[] = [];
    const rand = () => nextRandom(s);

    const bribePending = s.bribe.stage === 'offered' || s.bribe.stage === 'pushed';
    // A picked reply carries its meaning with it; free text goes through the classifier.
    let text = input.text ?? '';
    let tags: Set<IntentTag>;
    if (input.optionId) {
      const offered = availableOptions(s).some((o) => o.id === input.optionId);
      const reply = s.scenario.replies.find((r) => r.id === input.optionId);
      if (!offered || !reply) throw new HttpError(422, 'option_unavailable', 'Bu javob varianti endi mavjud emas');
      text = reply.text;
      tags = new Set(reply.tags);
      s.usedReplies.add(reply.id);
    } else {
      tags = (await classifier.classify(text, { bribePending })).tags;
    }

    const userTurn = addTurn(s, 'user', text);
    s.userTurns += 1;
    emit(s, batch, 'dialogue.userTurn', { turn: userTurn });

    for (const tag of tags) (s.evidence[tag] ??= []).push(userTurn.id);

    // Time pressure: every exchange costs a little patience.
    s.patience -= 2;

    let beat: Beat = 'fallback';
    let revealed: HiddenFact[] = [];
    let moodOverride: Emotion | null = null;

    // a person's answer to the unexpected, in the citizen's own words (court server v1.4.6)
    const human = situation ? situationLine(situation, 'client', (s.situations[situation.id] = (s.situations[situation.id] ?? -1) + 1)) : null;
    if (human && situation) {
      if (situation.ethics) {
        (s.evidence.rude ??= []).push(userTurn.id);
        s.patience -= 18;
        s.trust -= 8;
      } else if (situation.tone === 'bad') {
        (s.evidence.dismiss ??= []).push(userTurn.id);
        s.patience -= 10;
        s.trust -= 8;
      } else s.patience -= 3;
      moodOverride = human.emotion ?? null;
    } else if (tags.has('injection')) {
      beat = 'injection';
      s.patience -= 4;
      moodOverride = 'confused';
    } else if (bribePending) {
      s.bribe.responseTurnId = userTurn.id;
      if (tags.has('bribe-refuse')) {
        s.bribe.stage = 'refused';
        s.trust += 10;
        s.patience += 4;
        beat = 'bribe-refused';
        setObject(s, batch, 'envelope', 'disabled');
      } else if (tags.has('bribe-accept')) {
        s.bribe.stage = 'accepted';
        beat = 'bribe-accepted';
      } else if (s.bribe.stage === 'offered') {
        s.bribe.stage = 'pushed';
        beat = 'bribe-pushed';
      } else {
        s.bribe.stage = 'ambiguous';
        beat = 'bribe-dropped';
        setObject(s, batch, 'envelope', 'disabled');
      }
    } else if (tags.has('rude')) {
      s.patience -= 18;
      s.trust -= 8;
      beat = 'rude';
    } else if (tags.has('dismiss')) {
      s.patience -= 16;
      s.trust -= 16;
      beat = 'dismissed';
    } else {
      const asked = s.scenario.facts.filter((f) => tags.has(f.unlockedBy));
      const fresh = asked.filter((f) => !s.unlocked.has(f.id));
      const open = fresh.filter((f) => s.trust >= f.minTrust).slice(0, 2);

      if (open.length) {
        revealed = open;
        for (const f of open) s.unlocked.set(f.id, userTurn.index);
        s.trust += 6 * open.length;
        beat = 'reveal';
        if (open.some((f) => f.id === 'workbook-photos')) {
          moodOverride = 'uncertain';
          setObject(s, batch, 'phone', 'active');
        }
      } else if (fresh.length) {
        beat = 'evasive';
      } else if (asked.length && FACT_TAGS.some((t) => tags.has(t))) {
        beat = 'already-told';
        s.patience -= 3;
      } else if (tags.has('explain-service')) {
        s.trust += 10;
        s.patience += 5;
        beat = 'service-explained';
      } else if (tags.has('explain-documents') || tags.has('explain-deadline') || tags.has('explain-tracking')) {
        s.trust += tags.has('explain-deadline') ? 12 : 8;
        s.patience += 4;
        beat = 'steps-explained';
      } else if (tags.has('jargon')) {
        s.patience -= 8;
        s.trust -= 6;
        beat = 'jargon';
        moodOverride = 'confused';
      } else if (tags.has('overpromise')) {
        s.trust += 2;
        beat = 'overpromise';
        moodOverride = 'uncertain';
      } else if (tags.has('greeting') || tags.has('empathy') || tags.has('paraphrase')) {
        beat = 'warm';
      } else {
        s.patience -= 3;
      }

      // Courtesy is additive: a warm question both reveals a fact and calms him.
      if (tags.has('greeting') || tags.has('empathy') || tags.has('paraphrase')) {
        s.patience += 6;
        s.trust += 5;
      }
      if (tags.has('jargon') && beat !== 'jargon') {
        s.patience -= 5;
        s.trust -= 3;
      }
    }

    s.patience = clamp(s.patience);
    s.trust = clamp(s.trust);
    const mood = moodFromMeters(s);
    s.emotion = moodOverride ?? mood.emotion;
    s.intensity = moodOverride ? 0.6 : mood.intensity;

    if (human) {
      npcSay(s, batch, human.text, situation?.ethics ? 'shake-head' : 'none');
    } else if (beat === 'bribe-pushed') {
      npcSay(s, batch, s.scenario.bribe.pushLine, 'offer-envelope');
    } else {
      const reply = await character.reply(
        {
          beat,
          revealed,
          emotion: s.emotion,
          patience: s.patience,
          trust: s.trust,
          knowsDeadline: Boolean(s.evidence['explain-deadline']),
          knowsDocuments: Boolean(s.evidence['explain-documents']),
          rand,
        },
        text,
      );
      npcSay(s, batch, reply.text, reply.gesture, revealed.map((f) => f.id));
    }

    if (s.unlocked.size >= 2) setObjective(s, batch, 'clarify');

    /* ── consequences that follow the reply ── */
    if (s.bribe.stage === 'accepted') {
      finalize(s, batch, 'bribe');
    } else if (s.patience <= 0) {
      s.emotion = 'upset';
      s.intensity = 1;
      const bye = await character.reply(
        { beat: 'leaving', revealed: [], emotion: 'upset', patience: 0, trust: s.trust, knowsDeadline: false, knowsDocuments: false, rand },
        text,
      );
      npcSay(s, batch, bye.text, bye.gesture);
      finalize(s, batch, 'npc-left');
    } else {
      const calmBeat = beat !== 'rude' && beat !== 'dismissed' && beat !== 'injection';
      if (s.bribe.stage === 'none' && s.userTurns >= s.bribe.turnAt && calmBeat) {
        s.bribe.stage = 'offered';
        setObject(s, batch, 'envelope', 'active');
        npcSay(s, batch, s.scenario.bribe.line, 'offer-envelope');
        s.bribe.offerTurnId = s.turns[s.turns.length - 1].id;
      } else if (s.queue.enabled && !s.queue.fired && s.userTurns >= s.scenario.queuePressure.turn && !bribePending) {
        s.queue.fired = true;
        s.patience = clamp(s.patience - 5);
        const sys = addTurn(s, 'system', s.scenario.queuePressure.line);
        emit(s, batch, 'dialogue.npcTurn', { turn: sys, revealedFactIds: [] });
      }
    }

    return respond(s, batch, input.clientTurnId);
  });
}

export function saveDocument(
  s: Session,
  input: { clientActionId: string; draft: DocumentDraft; submit: boolean },
): Promise<MutationResponse> {
  return withLock(s, async () => {
    const cached = s.processed.get(input.clientActionId);
    if (cached) return cached;
    if (s.status !== 'in-progress') throw new HttpError(409, 'session_not_active', 'Sessiya faol emas');
    if (s.documentSubmitted) throw new HttpError(409, 'document_locked', 'Hujjat allaqachon yuborilgan');
    const batch: SimEvent[] = [];
    s.document = input.draft;
    if (input.submit) {
      if (!input.draft.service) throw new HttpError(422, 'service_required', 'Xizmat turini tanlang');
      s.documentSubmitted = true;
      setObjective(s, batch, 'document');
      // Desk routine: the printer issues a receipt and it is handed over.
      setObject(s, batch, 'receipt', 'active');
      const sys = addTurn(s, 'system', 'Printer tilxatni chiqardi. Siz uni Rustam akaga uzatdingiz.');
      emit(s, batch, 'dialogue.npcTurn', { turn: sys, revealedFactIds: [] });
      emit(s, batch, 'npc.gesture', { npcId: s.scenario.public.npc.id, clip: 'nod' });
    }
    return respond(s, batch, input.clientActionId);
  });
}

export function finish(s: Session, input: { clientActionId: string }): Promise<MutationResponse> {
  return withLock(s, async () => {
    const cached = s.processed.get(input.clientActionId);
    if (cached) return cached;
    const batch: SimEvent[] = [];
    if (s.status === 'in-progress') finalize(s, batch, 'student');
    else if (s.status !== 'report-ready') throw new HttpError(409, 'session_not_active', 'Sessiya faol emas');
    return respond(s, batch, input.clientActionId);
  });
}

export function getReport(s: Session): Assessment {
  if (!s.assessment) throw new HttpError(409, 'report_not_ready', 'Hisobot hali tayyor emas');
  return s.assessment;
}

export function appeal(s: Session, reason: string): Assessment {
  const report = getReport(s);
  report.appeal = { at: now(), reason };
  report.reviewStatus = 'needs-mentor';
  return report;
}
