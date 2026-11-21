import { z } from 'zod';
import { LevelSchema } from '@/contracts';
import { CaseKindSchema } from '@/contracts/case';
import { startCase } from '@/server/case/engine';
import { restoreCurrent, saveCase } from '@/server/case/persist';
import { after } from 'next/server';
import { handle, ownerToken, rateLimit, readBody } from '@/server/http';

/** Starts a case of the given kind (or returns the one in progress unless `fresh`). */
export const POST = handle(async (request: Request) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`case:${owner}`, 20);
  const { fresh, kind, level } = await readBody(request, z.object({ fresh: z.boolean().optional(), kind: CaseKindSchema.optional(), level: LevelSchema.optional() }));
  if (!fresh) await restoreCurrent(owner, kind ?? 'labour');
  const snap = startCase(owner, fresh ?? false, kind ?? 'labour', level ?? 'beginner');
  after(() => saveCase(owner, snap)); // after the response: the student never waits for the store
  return { case: snap };
});
