import { HearingActRequestSchema } from '@/contracts/hearing';
import { act } from '@/server/hearing/civil';
import { handle, keep, ownerToken, rateLimit, readBody, restoreHearing, type IdContext } from '@/server/http';

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { id } = await params;
  rateLimit(`hearing-act:${id}`, 60);
  await restoreHearing(id);
  const owner = await ownerToken();
  const hearing = act(id, owner, await readBody(request, HearingActRequestSchema));
  keep('hearing', id, owner);
  return { hearing };
});
