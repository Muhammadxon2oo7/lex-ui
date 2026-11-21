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
import { COURT_TYPE_IDS } from '@/lib/labourCase';

export const CASE_KINDS = ['labour', 'theft'] as const;
export const CaseKindSchema = z.enum(CASE_KINDS);
export type CaseKind = z.infer<typeof CaseKindSchema>;

/** Stages of each case, in procedural order. */
export const CASE_STAGES = {
  labour: ['consult', 'draft', 'filing', 'chamber', 'hearing'],
  theft: ['report', 'interview', 'complaint', 'trial'],
} as const satisfies Record<CaseKind, readonly string[]>;
export const STAGE_IDS = [...CASE_STAGES.labour, ...CASE_STAGES.theft] as const;
export const StageIdSchema = z.enum(STAGE_IDS);
export type StageId = z.infer<typeof StageIdSchema>;
export const kindOfStage = (stage: StageId): CaseKind => ((CASE_STAGES.theft as readonly string[]).includes(stage) ? 'theft' : 'labour');

/** Voice of a party (server TTS voices). */
export const VoiceIdSchema = z.enum(['elder_m', 'male', 'female', 'female_alt']);

export const CaseSpeakerSchema = z.enum(['client', 'clerk', 'judge', 'secretary', 'respondent', 'witness', 'officer', 'investigator', 'chief', 'prosecutor', 'defender', 'defendant', 'you', 'system']);
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
  /** Learning outcomes of the room, stated before it starts (scenario-based experiential learning). */
  outcomes: z.array(z.object({ text: z.string(), articles: z.array(z.string()) })).catch([]),
  status: z.enum(['open', 'active', 'done', 'returned']),
  /** Last result in this room (0–100), null if not played yet. */
  score: z.number().int().nullable(),
});
export type StageView = z.infer<typeof StageViewSchema>;

const text = (max: number) => z.string().max(max).catch('');
/** The advocate's order (Adliya vazirining 2023-yil 31-yanvardagi 1-mh-son buyrugʻi, ilova: 12 band). */
export const OrderDraftSchema = z.object({
  number: text(40),
  firm: text(160),
  firmAddress: text(200),
  advocate: text(120),
  license: text(160),
  specialty: z.enum(['', 'civil-economic', 'admin-criminal']).catch(''),
  basis: z.enum(['', 'contract', 'ruling']).catch(''),
  basisDate: text(40),
  client: text(160),
  caseType: z.enum(['', 'civil', 'economic', 'admin-offence', 'administrative', 'criminal', 'other']).catch(''),
  issued: text(40),
  signed: z.boolean().catch(false),
});
export type OrderDraft = z.infer<typeof OrderDraftSchema>;

const ClaimDraftV2 = z.object({
  /** Chosen from the court system (Law «Sudlar toʻgʻrisida», art. 2) and the place. */
  court: z.object({ type: z.enum(['', ...COURT_TYPE_IDS]).catch(''), district: text(40) }),
  /** Typed by the student from the papers in the folder (FPK 189, parts 1–3). */
  claimant: z.object({ name: text(160), address: text(200) }),
  representative: z.object({ name: text(160), address: text(200) }),
  respondent: z.object({ name: text(200), address: text(200) }),
  /** Written: the claim (189 p.4) and the circumstances with their evidence (189 p.6). */
  demand: text(2000),
  circumstances: text(6000),
  evidence: z.array(z.string().max(32)).max(12),
  /** 189 p.7: 'none' — the law sets no compulsory pre-trial route; 'done' — the employer was asked first. */
  pretrial: z.enum(['', 'none', 'done']).catch(''),
  email: text(120),
  attachments: z.array(z.string().max(32)).max(16),
  copies: z.number().int().min(0).max(5),
  date: text(40),
  signed: z.boolean(),
  order: OrderDraftSchema.nullable().catch(null),
});

/** Drafts kept from before the drafting room asked students to write (picked options): read as text. */
function fromPicked(v: Record<string, unknown>): unknown {
  const facts = Array.isArray(v.facts) ? (v.facts as string[]) : [];
  return {
    court: { type: v.court === 'economic' ? 'economic' : v.court === 'regional' ? 'regional' : 'civil', district: 'Namuna' },
    claimant: { name: 'Nurmatov Sardor Akmal oʻgʻli', address: 'Namuna tumani, Bogʻbon mahallasi, 12-uy' },
    representative: v.representative ? { name: 'Advokat', address: 'Namuna tumani, Mustaqillik koʻchasi, 3-uy' } : { name: '', address: '' },
    respondent: v.respondent === 'director' ? { name: 'Karimov Anvar, direktor', address: '' } : { name: '«Namuna Savdo» MChJ', address: 'Namuna tumani, Ipak yoʻli koʻchasi, 5-uy' },
    demand: v.demand === 'reinstate' ? 'Daʼvogarni avvalgi lavozimiga tiklashni va majburiy progul vaqti uchun oʻrtacha ish haqini undirishni soʻrayman.' : v.demand === 'punish' ? 'Direktorni javobgarlikka tortishni soʻrayman.' : 'Javobgardan rasmiy uzr soʻrashni talab qilaman.',
    circumstances: facts.map((f) => LEGACY_FACT[f] ?? '').filter(Boolean).join(' '),
    evidence: v.evidence ?? [],
    pretrial: v.pretrial ? 'done' : 'none',
    email: v.email ? 'advokat@namuna-byuro.uz' : '',
    attachments: v.attachments ?? [],
    copies: v.copies ?? 0,
    date: '2026-11-20',
    signed: Boolean(v.signed),
    order: null,
  };
}
const LEGACY_FACT: Record<string, string> = {
  dismissal: '2026-yil 14-oktabrdagi 47-k-sonli buyruq bilan 9 va 10-oktabr kunlari uzrsiz ishda boʻlmagan deb mehnat shartnomasi bekor qilingan.',
  sick: 'Daʼvogar oʻsha kunlari kasal boʻlgan, kasallik varaqasi berilgan.',
  notified: '9-oktabr kuni boʻlim boshligʻiga telefon orqali xabar bergan.',
  refused: '13-oktabr kuni kasallik varaqasi kadrlar boʻlimida qabul qilinmagan.',
  witness: 'Buni guvoh Bahodir R. tasdiqlaydi.',
  explanation: 'Intizomiy jazodan oldin yozma tushuntirish talab qilinmagan.',
  served: 'Buyruq nusxasi 14-oktabrda berilgan, uch oylik muddat oʻtmagan.',
  employer: 'Daʼvogar «Namuna Savdo» MChJda omborchi boʻlib ishlagan.',
  authority: 'Manfaatlarni advokat shartnoma asosida ifodalaydi.',
};

/** The statement of claim as the student drafted it; checked on the server against FPK 189–191 and 195. */
export const ClaimDraftSchema = z.preprocess(
  (v) => (v && typeof v === 'object' && typeof (v as { court?: unknown }).court === 'string' ? fromPicked(v as Record<string, unknown>) : v),
  ClaimDraftV2,
);
export type ClaimDraft = z.infer<typeof ClaimDraftV2>;

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
      /** Each learning outcome judged from the decisions: met, not met, or not reached in this run (null). */
      outcomes: z.array(z.object({ text: z.string(), articles: z.array(z.string()), met: z.boolean().nullable(), evidence: z.array(z.string()) })).catch([]),
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
