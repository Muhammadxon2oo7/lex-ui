/**
 * "Bahs" - the multiplayer moot court. Students argue a case against each other in two teams;
 * only the court (judge and clerk) is run by the machine. Nobody has ready-made answers: each
 * side studies the case file, and speaks when the judge gives it the floor.
 *
 * The server is authoritative (turns, timers, what each side may see); a client only ever
 * receives ITS view: the other side's confidential facts and team chat never leave the server.
 */
import { z } from 'zod';

export const TeamSchema = z.enum(['A', 'B']);
export type Team = z.infer<typeof TeamSchema>;
export const MootSideSchema = z.enum(['claimant', 'respondent']);
export type MootSide = z.infer<typeof MootSideSchema>;
/**
 * The five skills a contested economic case trains (from the research behind the catalogue):
 * dalil - evidence matrix (each fact: document, date, source); qoida - citing the exact article / Plenum band;
 * hisob - calculation (penya, the FK 327 floor, caps, exchange rate); protsess - procedural tactics
 * (claims, counterclaim, expert examination, time limits); tavsif - characterisation and causation.
 */
export const MootSkillSchema = z.enum(['dalil', 'qoida', 'hisob', 'protsess', 'tavsif']);
export type MootSkill = z.infer<typeof MootSkillSchema>;
/** lead - opening and closing; second - evidence and questions; party - the client, answers questions (3 a side). */
export const MootRoleSchema = z.enum(['lead', 'second', 'party']);
export type MootRole = z.infer<typeof MootRoleSchema>;
export const MootPhaseSchema = z.enum(['lobby', 'briefing', 'hearing', 'verdict']);
export type MootPhase = z.infer<typeof MootPhaseSchema>;

export const MootPlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.enum(['man', 'woman']),
  team: TeamSchema.nullable(),
  role: MootRoleSchema.nullable(),
  ready: z.boolean(),
  host: z.boolean(),
  /** Seen in the last few seconds. */
  online: z.boolean(),
});
export type MootPlayer = z.infer<typeof MootPlayerSchema>;

export const MootStepSchema = z.object({
  id: z.string(),
  kind: z.enum(['court', 'speech']),
  title: z.string(),
  /** Speech steps: whose floor it is. */
  side: MootSideSchema.optional(),
  role: MootRoleSchema.optional(),
  seconds: z.number().int().nonnegative(),
});
export type MootStep = z.infer<typeof MootStepSchema>;

export const MootEntrySchema = z.object({
  id: z.string(),
  seq: z.number().int(),
  at: z.number(),
  /** 'judge' | 'secretary' | 'system' | a player id */
  by: z.string(),
  name: z.string(),
  side: MootSideSchema.optional(),
  text: z.string(),
  /** A spoken line: the clip the others hear (the speaker's own voice). */
  audio: z.string().optional(),
  step: z.string(),
});
export type MootEntry = z.infer<typeof MootEntrySchema>;

export const MootChatSchema = z.object({ id: z.string(), at: z.number(), by: z.string(), name: z.string(), text: z.string() });

const CaseItem = z.object({ id: z.string(), title: z.string(), text: z.string() });
/** A norm from the verified pack: `ref` is «DOC:number» (FK:326-modda, PLENUM-OXS-163:4-band). */
export const NormRefSchema = z.object({ ref: z.string(), label: z.string(), title: z.string(), url: z.string() });
export type NormRef = z.infer<typeof NormRefSchema>;
export const NormTextSchema = NormRefSchema.extend({ text: z.string(), document: z.string(), edition: z.string().nullable(), retrievedAt: z.string() });
export type NormText = z.infer<typeof NormTextSchema>;

/** One case of the built-in catalogue: what anyone may see before choosing it (no confidential facts). */
export const MootCatalogItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  topic: z.string(),
  level: z.number().int().min(1).max(3),
  skills: z.array(MootSkillSchema),
  abroad: z.boolean(),
});
export type MootCatalogItem = z.infer<typeof MootCatalogItemSchema>;
export const MootCaseViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  court: z.string(),
  summary: z.string(),
  parties: z.object({ claimant: z.string(), respondent: z.string() }),
  claim: z.string(),
  /** Known to both sides. */
  facts: z.array(CaseItem),
  /** Only your side's (empty before sides are drawn). */
  confidential: z.array(z.string()),
  evidence: z.array(CaseItem),
  /** What your side is expected to do. */
  task: z.array(z.string()),
  disclaimer: z.string(),
  topic: z.string().nullable().default(null),
  level: z.number().int().min(1).max(3).nullable().default(null),
  skills: z.array(MootSkillSchema).default([]),
  /** The chain of dates (both sides). */
  timeline: z.array(z.object({ date: z.string(), text: z.string() })).default([]),
  /** Norms handed out with the file: verbatim text is fetched from /api/v1/law by `ref`. */
  norms: z.array(NormRefSchema).default([]),
  /** The case's id on the court server's case-lab: a solution can be left on it (none for our built-in cases). */
  labId: z.string().nullable().default(null),
  /** Only once the verdict is in: what the case is based on and what the real courts decided. */
  debrief: z.object({
    ruling: z.string(),
    url: z.string(),
    /** T - checked against the ruling's full text; I - from a reliable secondary source. */
    mark: z.enum(['T', 'I']),
    adapted: z.string(),
    outcome: z.array(z.string()),
    lessons: z.array(z.string()),
  }).nullable().default(null),
});
export type MootCaseView = z.infer<typeof MootCaseViewSchema>;

/** One rubric item as the court judged it: met or not, its weight, the student's own words as evidence. */
const ExplainItem = z.object({
  id: z.string(),
  dim: z.string(),
  ask: z.string().catch(''),
  weight: z.number().catch(0),
  method: z.string().catch('ai'),
  met: z.enum(['yes', 'no', 'na']).catch('na'),
  basis: z.array(z.string()).catch([]),
  evidence: z.array(z.object({ turnId: z.union([z.string(), z.number()]).transform(String).catch(''), quote: z.string().catch(''), match: z.number().catch(0) })).catch([]),
  why: z.string().catch(''),
});
const ExplainSide = z.object({
  total: z.number().catch(0),
  band: z.array(z.number()).catch([]),
  criteria: z.array(z.object({ id: z.string(), label: z.string().catch(''), max: z.number().catch(0), score: z.number().catch(0), basis: z.array(z.string()).catch([]) })).catch([]),
  items: z.array(ExplainItem).catch([]),
});
export const MootExplainSchema = z.object({
  rubric: z.string().catch('moot'),
  version: z.string().catch(''),
  needsMentor: z.boolean().catch(false),
  routing: z.array(z.object({ reason: z.string().catch('') }).passthrough()).catch([]),
  sides: z.object({ claimant: ExplainSide.optional(), respondent: ExplainSide.optional() }).catch({}),
});
export type MootExplain = z.infer<typeof MootExplainSchema>;

/** «Nimaga asoslanib?»: the rubric's sources (GET /rubrics/moot, no key), for naming each criterion's basis. */
export const MootRubricSchema = z.object({
  dims: z.array(z.object({ id: z.string(), label: z.string().catch(''), max: z.number().catch(0), why: z.string().catch('') })).catch([]),
  sources: z.record(z.string(), z.object({ title: z.string().catch(''), url: z.string().catch(''), note: z.string().catch('') })).catch({}),
});
export type MootRubric = z.infer<typeof MootRubricSchema>;

const Criterion = z.object({ id: z.string(), label: z.string(), max: z.number(), claimant: z.number(), respondent: z.number(), note: z.string() });
export const MootVerdictSchema = z.object({
  /** null - a draw */
  winner: MootSideSchema.nullable(),
  totals: z.object({ claimant: z.number(), respondent: z.number() }),
  criteria: z.array(Criterion),
  /** What the court says, read out by the judge. */
  ruling: z.array(z.string()),
  /** One line of feedback per player. */
  players: z.array(z.object({ id: z.string(), name: z.string(), side: MootSideSchema, words: z.number().int(), speeches: z.number().int(), note: z.string() })),
  /** 'rules' - the reference scorer (form and coverage); 'model' - the court server's language model (substance). */
  engine: z.enum(['rules', 'model']),
  forfeit: z.boolean(),
  /** The rules' reading is shown while the court server's model is still writing its verdict. */
  pending: z.boolean().default(false),
  /** The court server's id of this verdict (v1.5): a solution can be bound to it, so a result cannot be faked. */
  verdictId: z.string().nullable().default(null),
  /** «Nimaga asoslanib N ball?» (v1.5): each side's criteria and the items behind them, with quotes. */
  explain: MootExplainSchema.nullable().default(null),
});
export type MootVerdict = z.infer<typeof MootVerdictSchema>;

export const MootRoomSchema = z.object({
  code: z.string(),
  version: z.number().int(),
  phase: MootPhaseSchema,
  size: z.number().int().min(1).max(3),
  assign: z.enum(['pick', 'random']),
  players: z.array(MootPlayerSchema),
  me: z.object({ id: z.string(), team: TeamSchema.nullable(), side: MootSideSchema.nullable(), role: MootRoleSchema.nullable(), host: z.boolean() }),
  /** Which side each team argues (drawn at the start). */
  sides: z.object({ A: MootSideSchema, B: MootSideSchema }).nullable(),
  case: MootCaseViewSchema,
  agenda: z.array(MootStepSchema),
  step: z.number().int(),
  /** Whose floor it is now (a player id), when a speech step is on. */
  speaker: z.string().nullable(),
  /** Server time now and when the current step / the briefing ends (ms): the client counts down from the difference. */
  now: z.number(),
  endsAt: z.number().nullable(),
  transcript: z.array(MootEntrySchema),
  /** Your team's private chat. */
  chat: z.array(MootChatSchema),
  verdict: MootVerdictSchema.nullable(),
});
export type MootRoom = z.infer<typeof MootRoomSchema>;

export const MootCreateSchema = z.object({ name: z.string().trim().min(2).max(40), avatar: z.enum(['man', 'woman']), size: z.number().int().min(1).max(3).default(2), assign: z.enum(['pick', 'random']).default('pick'), caseId: z.string().max(64).optional(), code: z.string().max(64).optional() });
export const MootJoinSchema = z.object({ name: z.string().trim().min(2).max(40), avatar: z.enum(['man', 'woman']) });
export const MootActSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('team'), team: TeamSchema.nullable() }),
  z.object({ type: z.literal('ready'), ready: z.boolean() }),
  z.object({ type: z.literal('settings'), size: z.number().int().min(1).max(3).optional(), assign: z.enum(['pick', 'random']).optional() }),
  z.object({ type: z.literal('start') }),
  /** One utterance in your floor time (several may follow one another). */
  z.object({ type: z.literal('say'), text: z.string().trim().min(1).max(1200), audio: z.string().max(40).optional() }),
  /** "I have finished": the floor goes on. */
  z.object({ type: z.literal('yield') }),
  z.object({ type: z.literal('chat'), text: z.string().trim().min(1).max(400) }),
  z.object({ type: z.literal('leave') }),
]);
export type MootAct = z.infer<typeof MootActSchema>;
export const MootEnvelope = z.object({ room: MootRoomSchema });
