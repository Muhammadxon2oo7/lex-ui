import { SaveCaseSchema } from '@/contracts/library';
import { handle, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';
import { getCase, saveCase } from '@/server/library';

/** One case; `?code=` opens a private one shared by its author. */
export const GET = handle(async (request: Request, { params }: IdContext) => {
  const code = new URL(request.url).searchParams.get('code')?.slice(0, 64) || undefined;
  return { case: await getCase((await ownerToken(true))!, (await params).id, code) };
});

/** The author edits a case: it goes back to review. */
export const POST = handle(async (request: Request, { params }: IdContext) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`lib-save:${owner}`, 20);
  return { case: await saveCase(owner, await readBody(request, SaveCaseSchema), (await params).id) };
});
