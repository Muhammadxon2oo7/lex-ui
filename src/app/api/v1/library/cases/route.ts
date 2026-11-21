import { z } from 'zod';
import { SaveCaseSchema } from '@/contracts/library';
import { handle, ownerToken, rateLimit, readBody } from '@/server/http';
import { listCases, saveCase } from '@/server/library';

const Query = z.object({ domain: z.string().regex(/^[a-z_]{2,30}$/), scope: z.enum(['all', 'mine']).catch('all') });

/** Approved cases of a domain and the student's own. */
export const GET = handle(async (request: Request) => {
  const owner = (await ownerToken(true))!;
  const url = new URL(request.url);
  const q = Query.safeParse({ domain: url.searchParams.get('domain'), scope: url.searchParams.get('scope') ?? 'all' });
  if (!q.success) return { cases: [] };
  return { cases: await listCases(owner, q.data.domain, q.data.scope) };
});

/** Saves an edited draft: it goes to the mentor (status "review"). */
export const POST = handle(async (request: Request) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`lib-save:${owner}`, 20);
  return { case: await saveCase(owner, await readBody(request, SaveCaseSchema)) };
});
