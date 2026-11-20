/**
 * Wire contract for "Ish yoʻli" — a case followed room by room, one corridor
 * door per stage. Two cases: a civil labour dispute (FPK) and a theft report
 * through the criminal investigation (JPK).
 * The server owns the story: hidden facts, scoring and the filing ruling
 * never leave it before they are earned.
 */
import { z } from 'zod';
import { ArticleSchema } from './hearing';
import { EmotionSchema, InputModeSchema, LevelSchema } from './index';

export const CASE_KINDS = ['labour', 'theft'] as const;
export const CaseKindSchema = z.enum(CASE_KINDS);
export type CaseKind = z.infer<typeof CaseKindSchema>;

/** Stages of each case, in procedural order. */
export const CASE_STAGES = {
  labour: ['consult', 'draft', 'filing', 'chamber', 'hearing'],
  theft: ['report', 'interview', 'complaint'],
} as const satisfies Record<CaseKind, readonly string[]>;
export const STAGE_IDS = [...CASE_STAGES.labour, ...CASE_STAGES.theft] as const;
export const StageIdSchema = z.enum(STAGE_IDS);
export type StageId = z.infer<typeof StageIdSchema>;
export const kindOfStage = (stage: StageId): CaseKind => ((CASE_STAGES.theft as readonly string[]).includes(stage) ? 'theft' : 'labour');

/** Voice of a party (server TTS voices). */
export const VoiceIdSchema = z.enum(['elder_m', 'male', 'female', 'female_alt']);

export const CaseSpeakerSchema = z.enum(['client', 'clerk', 'judge', 'secretary', 'respondent', 'witness', 'officer', 'investigator', 'chief', 'you', 'system']);
export type CaseSpeaker = z.infer<typeof CaseSpeakerSchema>;

/** The physical state of the room: who is in it, who is on their feet. */
export const SceneSchema = z.object({
  witnessIn: z.boolean(),
  judgeIn: z.boolean(),
  /** Counts the judge's entrances, so each one is walked, not popped in. */
  judgeEntries: z.number().int(),
  clientPresent: z.boolean(),
  everyoneStands: z.boolean(),
  clientMood: z.enum(['neutral', 'uncertain', 'upset', 'reassured', 'calm', 'confused']),
});
export type Scene = z.infer<typeof SceneSchema>;

/** Each line carries the room as it is while the line is spoken, so movement follows speech. */
export const CaseLineSchema = z.object({
  id: z.string(),
  speaker: CaseSpeakerSchema,
  text: z.string(),
  scene: SceneSchema,
  /** How the speaker feels saying it (drives the face and posture). */
  emotion: EmotionSchema.optional(),
});
export type CaseLine = z.infer<typeof CaseLineSchema>;

export const CaseOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** 'say' is spoken by the student; 'act' is a physical action (hand over, sign…). */
  kind: z.enum(['say', 'act']),
});
export type CaseOption = z.infer<typeof CaseOptionSchema>;

export const StageViewSchema = z.object({
  id: StageIdSchema,
  number: z.number().int(),
  title: z.string(),
  place: z.string(),
  goal: z.string(),
  status: z.enum(['open', 'active', 'done', 'returned']),
  /** Last result in this room (0–100), null if not played yet. */
  score: z.number().int().nullable(),
});
export type StageView = z.infer<typeof StageViewSchema>;

/** Picked from the case file in the drafting room; validated on the server against FPK 189–191. */
export const ClaimDraftSchema = z.object({
  court: z.enum(['district', 'regional', 'economic']),
  representative: z.boolean(),
  respondent: z.enum(['company', 'director']),
  demand: z.enum(['reinstate', 'punish', 'apology']),
  facts: z.array(z.string().max(32)).max(12),
  evidence: z.array(z.string().max(32)).max(12),
  pretrial: z.boolean(),
  email: z.boolean(),
  attachments: z.array(z.string().max(32)).max(16),
  copies: z.number().int().min(0).max(5),
  signed: z.boolean(),
});
export type ClaimDraft = z.infer<typeof ClaimDraftSchema>;

export const CaseItemSchema = z.object({ id: z.string(), label: z.string(), detail: z.string() });
export type CaseItem = z.infer<typeof CaseItemSchema>;

export const RulingSchema = z.object({
  kind: z.enum(['accepted', 'returned', 'scheduled', 'judgment']),
  title: z.string(),
  body: z.array(z.string()),
  articles: z.array(z.string()),
});
export type Ruling = z.infer<typeof RulingSchema>;

/** One decision taken in a room, as the debrief shows it. */
export const DecisionSchema = z.object({
  /** Seconds since the room began. */
  at: z.number(),
  /** What you were answering (the last thing said to you). */
  prompt: z.string().nullable(),
  chose: z.string(),
  tone: z.enum(['good', 'bad', 'info']).nullable(),
  /** Points lost on this decision (0 if none). */
  points: z.number().int(),
  why: z.string().nullable(),
  /** The better reply, when yours was a mistake. */
  better: z.string().nullable(),
  article: z.string().nullable(),
  /** How it was given: picked, typed or spoken. */
  inputMode: InputModeSchema.optional(),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const CaseSnapshotSchema = z.object({
  caseId: z.string(),
  kind: CaseKindSchema,
  title: z.string(),
  note: z.string(),
  parties: z.array(z.object({ role: CaseSpeakerSchema, label: z.string(), name: z.string(), voice: VoiceIdSchema.optional() })),
  stages: z.array(StageViewSchema),
  /** The room the student is in (null = corridor). */
  stage: StageIdSchema.nullable(),
  lines: z.array(CaseLineSchema),
  options: z.array(CaseOptionSchema),
  /** What the room waits for besides a reply: rising, sitting, filling in the claim. */
  await: z.enum(['stand', 'sit', 'draft']).nullable(),
  standing: z.boolean(),
  feedback: z.object({ tone: z.enum(['good', 'bad', 'info']), message: z.string(), article: z.string().nullable() }).nullable(),
  facts: z.array(CaseItemSchema),
  evidence: z.array(CaseItemSchema),
  /** Everything a draft may cite (labels only — what the student has not learned stays hidden). */
  draft: ClaimDraftSchema.nullable(),
  rulings: z.array(RulingSchema),
  scene: SceneSchema,
  stageDone: z.boolean(),
  code: z.object({ title: z.string(), url: z.string().url(), edition: z.string(), retrievedAt: z.string(), articles: z.array(ArticleSchema) }),
  /** Hints taken in this room (each costs points). */
  hints: z.number().int(),
  /** How much help this case gives (chosen when it starts). */
  level: LevelSchema,
  /** The ways an answer may be given right now. */
  inputModes: z.array(InputModeSchema),
  /** Intermediate: the options of this moment were opened (−10). */
  revealed: z.boolean(),
  /** The room is waiting for an answer (options on screen or not). */
  answering: z.boolean(),
  /** Result of the room just finished. */
  result: z
    .object({
      score: z.number().int(),
      verdict: z.string().nullable(),
      good: z.array(z.string()),
      notes: z.array(z.string()),
      /** Every decision in the room, in order — the debrief (after-action review). */
      log: z.array(DecisionSchema),
      hints: z.number().int(),
      /** One question to think over after the room. */
      reflect: z.string().nullable(),
    })
    .nullable(),
});
export type CaseSnapshot = z.infer<typeof CaseSnapshotSchema>;

export const CaseActRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hint'), clientActionId: z.string().min(8).max(64) }),
  /** Intermediate: open the options of this moment (−10). */
  z.object({ type: z.literal('reveal'), clientActionId: z.string().min(8).max(64) }),
  /** An answer in the student's own words (typed or spoken), understood on the server. */
  z.object({
    type: z.literal('say'),
    clientActionId: z.string().min(8).max(64),
    text: z.string().trim().min(1).max(800),
    inputMode: InputModeSchema.exclude(['option']),
    stt: z.object({ confidence: z.number().min(0).max(1) }).partial().optional(),
  }),
  z.object({ type: z.literal('enter'), clientActionId: z.string().min(8).max(64), stage: StageIdSchema }),
  z.object({ type: z.literal('choose'), clientActionId: z.string().min(8).max(64), optionId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('stand'), clientActionId: z.string().min(8).max(64), up: z.boolean() }),
  z.object({ type: z.literal('draft'), clientActionId: z.string().min(8).max(64), draft: ClaimDraftSchema }),
  z.object({ type: z.literal('leave'), clientActionId: z.string().min(8).max(64) }),
]);
export type CaseActRequest = z.infer<typeof CaseActRequestSchema>;

export const CaseEnvelopeSchema = z.object({ case: CaseSnapshotSchema });
