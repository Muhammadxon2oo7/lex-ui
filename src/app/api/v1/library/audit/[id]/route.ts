import { z } from 'zod';
import { handle, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';
import { auditDecide, auditItem } from '@/server/library';

const Decision = z.object({
  decision: z.enum(['approve', 'adjust', 'reject']),
  items: z.record(z.string().max(40), z.enum(['yes', 'no', 'na'])).optional(),
  note: z.string().trim().max(1000).optional(),
  reviewer: z.string().trim().max(60).optional(),
}).refine((d) => d.decision !== 'reject' || (d.note?.length ?? 0) >= 5, { message: 'Rad etishda izoh majburiy' })
  .refine((d) => d.decision !== 'adjust' || Object.keys(d.items ?? {}).length > 0, { message: 'Tuzatilgan band yoʻq' });

/** Mentors: one item of the AI review queue in full. */
export const GET = handle(async (_r: Request, { params }: IdContext) => ({ item: await auditItem((await ownerToken(true))!, (await params).id) }));

/** Mentors: approve, adjust items, or reject with a note. */
export const POST = handle(async (request: Request, { params }: IdContext) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`audit:${owner}`, 60);
  const { reviewer, ...body } = await readBody(request, Decision);
  return { result: await auditDecide(owner, (await params).id, body, reviewer) };
});
