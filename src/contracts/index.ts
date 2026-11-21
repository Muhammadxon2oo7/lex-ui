/**
 * LexSim wire contracts (v1).
 *
 * Single source of truth for everything that crosses the client/server
 * boundary. The server is authoritative for facts, meters, score and
 * citations; the client validates every payload with these schemas before
 * it is allowed to drive the 3D scene.
 */
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;

/* ───────────── presentation enums (allow-listed, never free-form) ───────────── */

export const EmotionSchema = z.enum([
  'neutral',
  'impatient',
  'upset',
  'confused',
  'uncertain',
  'calm',
  'reassured',
]);
export type Emotion = z.infer<typeof EmotionSchema>;

export const GestureSchema = z.enum([
  'none',
  'nod',
  'shake-head',
  'sigh',
  'lean-in',
  'check-watch',
  'show-phone',
  'offer-envelope',
  'withdraw-envelope',
  'stand',
]);
export type Gesture = z.infer<typeof GestureSchema>;

export const ObjectStateSchema = z.enum(['active', 'disabled', 'open', 'closed']);
export type ObjectState = z.infer<typeof ObjectStateSchema>;

export const SessionStatusSchema = z.enum([
  'briefing',
  'in-progress',
  'evaluating',
  'report-ready',
  'aborted',
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionModeSchema = z.enum(['tutorial', 'assessment']);

/** How much help the student gets (orthogonal to the mode). See docs/BACKEND_AI_ROADMAP.md §2. */
export const LevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type Level = z.infer<typeof LevelSchema>;
/** How an answer was given. */
export const InputModeSchema = z.enum(['option', 'text', 'voice']);
export type InputMode = z.infer<typeof InputModeSchema>;
export type SessionMode = z.infer<typeof SessionModeSchema>;

/* ───────────────────────────── dialogue ───────────────────────────── */

/** The courtroom as a line is spoken (external court backend): who is in, who is on their feet. */
export const CourtSceneSchema = z.object({ judgeIn: z.boolean(), everyoneStands: z.boolean(), witnessIn: z.boolean() });
export type CourtScene = z.infer<typeof CourtSceneSchema>;

export const TurnSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  speaker: z.enum(['user', 'npc', 'system']),
  text: z.string(),
  at: z.string(),
  emotion: EmotionSchema.optional(),
  /** Court sessions: who wrote the line — a canonical script line, the reply bank, or the language model (v1.4.1). */
  engine: z.enum(['script', 'bank', 'llm']).optional().catch(undefined),
  /** Court sessions: a gesture with the line (nod, shake-head, lean-in…); unknown ones are dropped. */
  gesture: GestureSchema.optional().catch(undefined),
  /** Court sessions: how the listeners take this line (the opponent pleased by a refusal, the client worried…). */
  reactions: z.array(z.object({ role: z.enum(['judge', 'secretary', 'opponent', 'witness', 'expert', 'principal']), emotion: EmotionSchema })).max(5).optional().catch(undefined),
  /** Court sessions only: which NPC speaks (one speaker per turn). */
  role: z.enum(['judge', 'secretary', 'opponent', 'witness', 'expert']).optional(),
  /** Court sessions only: how the room changes as this line begins. */
  scene: CourtSceneSchema.partial().optional(),
  /** Court sessions only: the procedural articles this line rests on. */
  articles: z.array(z.object({ id: z.string(), label: z.string(), url: z.string() })).optional(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const FactSchema = z.object({
  id: z.string(),
  text: z.string(),
  unlockedAtTurn: z.number().int(),
});
export type Fact = z.infer<typeof FactSchema>;

export const ObjectiveSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

/**
 * A reply the student can pick, simulation-game style. The server decides
 * which replies are on offer; it never reveals what a reply is "worth".
 */
export const ReplyOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(['ask', 'explain', 'react']),
});
export type ReplyOption = z.infer<typeof ReplyOptionSchema>;

/* ───────────────────────────── document ───────────────────────────── */

export const ServiceIdSchema = z.enum([
  'archive-reference',
  'pension-recalculation',
  'refer-elsewhere',
  'written-complaint',
]);
export type ServiceId = z.infer<typeof ServiceIdSchema>;

export const EvidenceIdSchema = z.enum([
  'passport',
  'workbook-photos',
  'employer-details',
  'pension-decision',
  'witness-statement',
]);
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;

export const DocumentDraftSchema = z.object({
  service: ServiceIdSchema.nullable(),
  applicantName: z.string().max(120),
  periodFrom: z.string().max(10),
  periodTo: z.string().max(10),
  employer: z.string().max(200),
  evidence: z.array(EvidenceIdSchema).max(8),
  nextStep: z.string().max(1200),
  notify: z.enum(['sms', 'written', 'none']),
});
export type DocumentDraft = z.infer<typeof DocumentDraftSchema>;

export const EMPTY_DOCUMENT: DocumentDraft = {
  service: null,
  applicantName: '',
  periodFrom: '',
  periodTo: '',
  employer: '',
  evidence: [],
  nextStep: '',
  notify: 'none',
};

/* ───────────────────────────── snapshot ───────────────────────────── */

export const OutcomeSchema = z.object({
  id: z.enum(['excellent', 'average', 'poor', 'failed']),
  title: z.string(),
  description: z.string(),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

const ScenePageSchema = z.object({ head: z.string().max(120), title: z.string().max(120), lines: z.array(z.string().max(200)).max(14), foot: z.string().max(120).optional(), stamp: z.string().max(60).optional() });
const SceneDocSchema = z.object({
  id: z.string(),
  kind: z.enum(['sheet', 'folder', 'box']),
  name: z.string().max(80),
  note: z.string().max(200),
  pages: z.array(ScenePageSchema).min(1).max(6),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
const CastModelSchema = z.enum(['elder_man', 'woman', 'man', 'worker', 'secretary', 'lawyer', 'client', 'clerk', 'investigator', 'chief']);
const VoiceNameSchema = z.string().regex(/^[a-z][a-z0-9_]{1,23}$/);
export const SceneSchema = z.object({
  kind: z.string().max(40).optional(),
  /** A voice per speaking role, from the court server's palette (it must match the body: a woman's voice for a woman). */
  voices: z.object({ judge: VoiceNameSchema, secretary: VoiceNameSchema, opponent: VoiceNameSchema, witness: VoiceNameSchema, expert: VoiceNameSchema }).partial().optional(),
  cast: z.object({ principal: CastModelSchema.nullable().optional(), opponent: CastModelSchema.optional(), witness: CastModelSchema.optional() }).optional(),
  papers: z.object({ claimant: z.array(SceneDocSchema).max(6).optional(), respondent: z.array(SceneDocSchema).max(6).optional() }).optional(),
});

export const ScenarioPublicSchema = z.object({
  id: z.string(),
  title: z.string(),
  role: z.string(),
  level: z.string(),
  durationMinutes: z.string(),
  roomId: z.string(),
  briefing: z.object({
    workplace: z.string(),
    position: z.string(),
    authority: z.array(z.string()),
    task: z.array(z.string()),
  }),
  npc: z.object({ id: z.string(), name: z.string(), age: z.number().int() }),
  disclaimer: z.string(),
  /**
   * Optional, from the court server's scenario pack: who sits in the hall and the papers on each table.
   * A malformed scene is dropped (the frontend preset is used), never a reason to fail the session.
   */
  scene: SceneSchema.optional().catch(undefined),
});
export type ScenarioPublic = z.infer<typeof ScenarioPublicSchema>;

export const SnapshotSchema = z.object({
  protocol: z.literal(PROTOCOL_VERSION),
  sessionId: z.string(),
  sequence: z.number().int().nonnegative(),
  status: SessionStatusSchema,
  mode: SessionModeSchema,
  /** Which character engine produced the NPC lines; shown truthfully in the UI. */
  engine: z.enum(['scripted', 'llm']),
  scenario: ScenarioPublicSchema,
  /** Only present in tutorial mode; assessment mode relies on NPC acting. */
  meters: z.object({ patience: z.number(), trust: z.number() }).nullable(),
  npc: z.object({
    emotion: EmotionSchema,
    intensity: z.number().min(0).max(1),
  }),
  turns: z.array(TurnSchema),
  /** Replies currently on offer (empty unless the dialogue is running). */
  options: z.array(ReplyOptionSchema),
  facts: z.array(FactSchema),
  factsTotal: z.number().int(),
  objectives: z.array(ObjectiveSchema),
  objects: z.record(z.string(), ObjectStateSchema),
  document: DocumentDraftSchema,
  documentSubmitted: z.boolean(),
  outcome: OutcomeSchema.nullable(),
  startedAt: z.string().nullable(),
  /** Court sessions only: an answer is being prepared (LLM) — poll /events. */
  pending: z.boolean().optional(),
  /** Court sessions only: the room now. */
  scene: CourtSceneSchema.optional(),
  /** Court sessions only: is the student on their feet (null until stand/sit is used). */
  standing: z.boolean().nullable().optional(),
  /** Court sessions: the level and what it allows right now. */
  level: LevelSchema.optional(),
  inputModes: z.array(InputModeSchema).optional(),
  optionsRevealed: z.boolean().optional(),
  /** Seconds of silence after which the client reports `silence` (null = no limit). */
  silenceSec: z.number().nullable().optional(),
  hintsAllowed: z.boolean().optional(),
  /** Immediate note on the last answer (beginner always; intermediate on serious errors; advanced never). */
  feedback: z.object({ tone: z.enum(['good', 'bad', 'info']), message: z.string(), article: z.string().nullable().optional(), optionId: z.string().nullable().optional() }).nullable().optional(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

/* ───────────────────────────── events ───────────────────────────── */

const eventBase = {
  eventId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  sessionId: z.string().min(1),
  timestamp: z.string(),
};

export const SimEventSchema = z.discriminatedUnion('type', [
  z.object({ ...eventBase, type: z.literal('dialogue.userTurn'), payload: z.object({ turn: TurnSchema }) }),
  z.object({
    ...eventBase,
    type: z.literal('dialogue.npcTurn'),
    payload: z.object({ turn: TurnSchema, revealedFactIds: z.array(z.string()) }),
  }),
  z.object({
    ...eventBase,
    type: z.literal('npc.emotion'),
    payload: z.object({ npcId: z.string(), emotion: EmotionSchema, intensity: z.number().min(0).max(1) }),
  }),
  z.object({
    ...eventBase,
    type: z.literal('npc.gesture'),
    payload: z.object({ npcId: z.string(), clip: GestureSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal('scene.objectState'),
    payload: z.object({ objectId: z.string(), state: ObjectStateSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal('objective.updated'),
    payload: z.object({ objectiveId: z.string(), done: z.boolean() }),
  }),
  z.object({
    ...eventBase,
    type: z.literal('session.status'),
    payload: z.object({ status: SessionStatusSchema }),
  }),
]);
export type SimEvent = z.infer<typeof SimEventSchema>;

/** Every mutating endpoint answers with the new events plus a full snapshot. */
export const MutationResponseSchema = z.object({
  events: z.array(SimEventSchema),
  snapshot: SnapshotSchema,
});
export type MutationResponse = z.infer<typeof MutationResponseSchema>;

/* ───────────────────────────── requests ───────────────────────────── */

export const CreateSessionRequestSchema = z.object({
  scenarioId: z.string().min(1),
  mode: SessionModeSchema.default('tutorial'),
  level: LevelSchema.optional(),
  seed: z.number().int().optional(),
});

export const TurnRequestSchema = z
  .object({
    /** Client-generated id → makes retries / double submits idempotent. */
    clientTurnId: z.string().min(8).max(64),
    /** Pick one of `snapshot.options` … */
    optionId: z.string().min(1).max(64).optional(),
    /** … or answer in your own words. Exactly one of the two. */
    text: z.string().trim().min(1).max(800).optional(),
    /** How it was given, and the recogniser's confidence for a spoken answer. */
    inputMode: InputModeSchema.optional(),
    stt: z.object({ confidence: z.number().min(0).max(1), durationMs: z.number().int().nonnegative() }).partial().optional(),
    /**
     * Court sessions: what the room looked like when the answer was given. The player sends an answer only
     * after every line before it has been heard to the end (never over someone), so `heardTurnId` is the last
     * line the student heard; `spokenSeconds` is the length of a spoken answer (long monologues); `standing`
     * is the student's posture at that moment.
     */
    presence: z.object({ heardTurnId: z.string().max(64), spokenSeconds: z.number().min(0).max(600), standing: z.boolean() }).partial().optional(),
  })
  .refine((v) => Boolean(v.optionId) !== Boolean(v.text), { message: 'optionId xor text' });

export const InteractionRequestSchema = z.object({
  clientActionId: z.string().min(8).max(64),
  // 'stand' / 'sit' are understood by the court backend only (answers are given standing)
  action: z.enum(['start', 'enter-room', 'sit-at-desk', 'open-terminal', 'inspect-phone', 'stand', 'sit', 'reveal-options', 'silence']),
  /** Court sessions, stand / sit: the line being spoken at that moment (e.g. standing while the opponent speaks). */
  context: z.object({ during: z.object({ turnId: z.string().max(64), role: z.enum(['judge', 'secretary', 'opponent', 'witness', 'expert']).optional() }) }).partial().optional(),
});

export const DocumentRequestSchema = z.object({
  clientActionId: z.string().min(8).max(64),
  draft: DocumentDraftSchema,
  submit: z.boolean(),
});

export const FinishRequestSchema = z.object({
  clientActionId: z.string().min(8).max(64),
});

export const AppealRequestSchema = z.object({
  reason: z.string().trim().min(10).max(1500),
});

/* ───────────────────────────── assessment ───────────────────────────── */

export const CriterionIdSchema = z.enum([
  'legal',
  'facts',
  'procedure',
  'communication',
  'ethics',
  'document',
]);
export type CriterionId = z.infer<typeof CriterionIdSchema>;

export const SourceSchema = z.object({
  title: z.string(),
  officialUrl: z.string().url(),
  articleNumber: z.string().optional(),
  effectiveAt: z.string().optional(),
  /** null → not yet verified by a mentor against the current Lex.uz edition. */
  verifiedAt: z.string().nullable(),
});
export type Source = z.infer<typeof SourceSchema>;

export const AssessmentSchema = z.object({
  sessionId: z.string(),
  scenarioId: z.string(),
  rubricVersion: z.string(),
  scoreTotal: z.number().int().min(0).max(100),
  zeroedByEthics: z.boolean(),
  outcome: OutcomeSchema,
  criteria: z.array(
    z.object({
      id: CriterionIdSchema,
      label: z.string(),
      score: z.number().min(0),
      max: z.number().positive(),
      explanation: z.string(),
      supportingTurnIds: z.array(z.string()),
    }),
  ),
  feedback: z.array(
    z.object({
      kind: z.enum(['strength', 'error', 'mentor-review']),
      title: z.string(),
      message: z.string(),
      quote: z.string().optional(),
      relatedTurnIds: z.array(z.string()),
      sources: z.array(SourceSchema),
    }),
  ),
  betterAnswer: z
    .object({ original: z.string(), improved: z.string(), why: z.string() })
    .nullable(),
  idealPath: z.array(z.object({ step: z.string(), done: z.boolean() })),
  nextScenario: z.object({ id: z.string(), title: z.string(), reason: z.string() }),
  reviewStatus: z.enum(['auto', 'needs-mentor', 'mentor-approved']),
  appeal: z.object({ at: z.string(), reason: z.string() }).nullable(),
  turns: z.array(TurnSchema),
  facts: z.array(FactSchema),
  factsTotal: z.number().int(),
  evaluatedAt: z.string(),
  /** Court sessions: every decision, as the debrief shows it. */
  decisions: z
    .array(
      z.object({
        at: z.number(),
        prompt: z.string().nullable(),
        chose: z.string(),
        tone: z.enum(['good', 'bad', 'info']).nullable(),
        points: z.number(),
        why: z.string().nullable(),
        better: z.string().nullable(),
        article: z.string().nullable(),
      }),
    )
    .optional(),
  hints: z.number().int().optional(),
  reflect: z.string().nullable().optional(),
  /** How the answers were given (counts). */
  inputModes: z.object({ option: z.number(), text: z.number(), voice: z.number() }).partial().optional(),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

/** What the coach suggests at this moment of a court session (external court backend, tutorial mode). */
export const HintSchema = z.object({
  stage: z.string(),
  title: z.string(),
  todo: z.string(),
  example: z.string().nullable().optional(),
  commonMistake: z.string().nullable().optional(),
  sources: z.array(SourceSchema.extend({ officialUrl: z.string() })).default([]),
});
export type Hint = z.infer<typeof HintSchema>;

/** Is the external court backend reachable, and which court scenarios does it offer. */
export const RemoteStatusSchema = z.object({
  enabled: z.boolean(),
  ok: z.boolean(),
  llm: z.boolean(),
  scenarios: z.array(z.object({ id: z.string(), title: z.string(), role: z.string(), position: z.string().optional(), durationMinutes: z.string(), briefing: z.string(), disclaimer: z.string() })),
});
export type RemoteStatus = z.infer<typeof RemoteStatusSchema>;

/** Only links to these hosts are ever rendered as "official source". */
export const OFFICIAL_SOURCE_HOSTS = ['lex.uz', 'www.lex.uz'] as const;

export function isOfficialSource(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (OFFICIAL_SOURCE_HOSTS as readonly string[]).includes(u.hostname);
  } catch {
    return false;
  }
}
