/** Wire contract for court-hearing exercises (separate from the desk simulation). */
import { z } from 'zod';

export const ArticleSchema = z.object({ number: z.string(), title: z.string(), text: z.string(), url: z.string().url() });
export type Article = z.infer<typeof ArticleSchema>;

export const SpeakerSchema = z.enum(['judge', 'secretary', 'claimant', 'respondent', 'witness', 'system']);
export type Speaker = z.infer<typeof SpeakerSchema>;

export const HearingLineSchema = z.object({ id: z.string(), speaker: SpeakerSchema, text: z.string() });
export type HearingLine = z.infer<typeof HearingLineSchema>;

export const HearingSnapshotSchema = z.object({
  hearingId: z.string(),
  caseTitle: z.string(),
  caseNote: z.string(),
  parties: z.array(z.object({ role: SpeakerSchema, label: z.string(), name: z.string() })),
  code: z.object({ title: z.string(), url: z.string().url(), edition: z.string(), retrievedAt: z.string(), articles: z.array(ArticleSchema) }),
  total: z.number().int(),
  /** Steps already conducted, in order, each tied to the article that governs it. */
  done: z.array(z.object({ label: z.string(), article: z.string(), attempts: z.number().int() })),
  lines: z.array(HearingLineSchema),
  /** Procedural actions on offer for the current step. */
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  feedback: z.object({ correct: z.boolean(), message: z.string(), article: z.string().nullable() }).nullable(),
  witnessPresent: z.boolean(),
  finished: z.boolean(),
  score: z.number().int().nullable(),
});
export type HearingSnapshot = z.infer<typeof HearingSnapshotSchema>;

export const HearingActRequestSchema = z.object({ clientActionId: z.string().min(8).max(64), optionId: z.string().min(1).max(64) });
export const HearingEnvelopeSchema = z.object({ hearing: HearingSnapshotSchema });
