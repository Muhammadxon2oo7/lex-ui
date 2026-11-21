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
});
export type MootCaseView = z.infer<typeof MootCaseViewSchema>;

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

export const MootCreateSchema = z.object({ name: z.string().trim().min(2).max(40), avatar: z.enum(['man', 'woman']), size: z.number().int().min(1).max(3).default(2), assign: z.enum(['pick', 'random']).default('pick'), caseId: z.string().max(64).optional() });
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
