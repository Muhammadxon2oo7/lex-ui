/**
 * Domains and cases (backend v1.4.9 "case-lab"): people describe a problem in plain words, the court
 * server's model turns it into a simulation case built only on articles from its lex.uz base, a mentor
 * approves it before others see it. Schemas are lenient on optional fields (`catch`), strict on what the
 * screens rely on, so a new field on the server never breaks the page.
 */
import { z } from 'zod';

export const ModeSchema = z.enum(['court', 'path', 'moot']);
export type Mode = z.infer<typeof ModeSchema>;

export const DomainSchema = z.object({
  id: z.string(),
  group: z.string(),
  title: z.string(),
  court: z.string().nullable().catch(null),
  caseType: z.string().nullable().catch(null),
  share2025: z.number().nullable().catch(null),
  modes: z.array(z.string()).catch([]),
  codes: z.array(z.string()).catch([]),
  note: z.string().catch(''),
});
export type Domain = z.infer<typeof DomainSchema>;
export const DomainsEnvelope = z.object({ domains: z.array(DomainSchema), source: z.string().nullable().catch(null) });

const Item = z.object({ id: z.string(), title: z.string().catch(''), text: z.string().catch('') });
const Side = z.object({ task: z.array(z.string()).catch([]), confidential: z.array(z.string()).catch([]) });
export const LegalRefSchema = z.object({ normId: z.string(), label: z.string(), url: z.string().catch(''), why: z.string().catch('') });
export type LegalRef = z.infer<typeof LegalRefSchema>;

export const LibCaseSchema = z.object({
  id: z.string(),
  domain: z.string().catch(''),
  source: z.enum(['system', 'user']).catch('user'),
  status: z.enum(['draft', 'review', 'approved', 'rejected']).catch('review'),
  mine: z.boolean().catch(false),
  modes: z.array(z.string()).optional().catch(undefined),
  title: z.string(),
  court: z.string().catch(''),
  summary: z.string().catch(''),
  parties: z.object({ claimant: z.string().catch(''), respondent: z.string().catch('') }).catch({ claimant: '', respondent: '' }),
  claim: z.string().catch(''),
  facts: z.array(Item).catch([]),
  evidence: z.array(Item).catch([]),
  side: z.object({ claimant: Side, respondent: Side }).catch({ claimant: { task: [], confidential: [] }, respondent: { task: [], confidential: [] } }),
  points: z.object({ claimant: z.array(z.array(z.string())).catch([]), respondent: z.array(z.array(z.string())).catch([]) }).optional().catch(undefined),
  legal: z.array(LegalRefSchema).catch([]),
  balance: z.object({ claimant_strong: z.string().catch(''), claimant_weak: z.string().catch(''), respondent_strong: z.string().catch(''), respondent_weak: z.string().catch('') }).nullable().optional().catch(null),
  questions: z.array(z.string()).catch([]),
  disclaimer: z.string().catch('Oʻquv ishi. Huquqiy maslahat emas.'),
  reviewNote: z.string().nullable().optional().catch(null),
  createdAt: z.string().nullable().optional().catch(null),
  updatedAt: z.string().nullable().optional().catch(null),
});
export type LibCase = z.infer<typeof LibCaseSchema>;

export const DraftSchema = z.object({
  id: z.string(),
  status: z.enum(['working', 'ready', 'failed']),
  case: LibCaseSchema.optional(),
  issues: z.array(z.string()).catch([]),
  questions: z.array(z.string()).catch([]),
  sources: z.number().nullable().catch(null),
  redacted: z.number().nullable().catch(null),
  ms: z.number().nullable().catch(null),
  error: z.object({ message: z.string().catch('Qoralama tuzilmadi') }).nullable().optional().catch(null),
});
export type Draft = z.infer<typeof DraftSchema>;

/** What the student may send: the story (80–4000), optional answers to the model's questions. */
export const DraftRequestSchema = z.object({ domain: z.string().min(1).max(40), story: z.string().trim().min(80).max(4000), answers: z.string().trim().max(4000).optional() });
/** A case the student edited and saves (the server keeps only articles from its own base). */
export const SaveCaseSchema = LibCaseSchema.omit({ id: true, source: true, status: true, mine: true, reviewNote: true, createdAt: true, updatedAt: true }).extend({ draftId: z.string().optional() });
export const ReviewSchema = z.object({ decision: z.enum(['approve', 'reject']), note: z.string().trim().max(1000).catch('') });
