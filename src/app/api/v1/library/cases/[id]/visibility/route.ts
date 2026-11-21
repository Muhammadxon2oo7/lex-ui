import { VisibilitySchema } from '@/contracts/library';
import { handle, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';
import { setVisibility } from '@/server/library';

/** The author opens or closes their case. */
export const POST = handle(async (request: Request, { params }: IdContext) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`lib-vis:${owner}`, 20);
  return { case: await setVisibility(owner, (await params).id, (await readBody(request, VisibilitySchema)).visibility) };
});
