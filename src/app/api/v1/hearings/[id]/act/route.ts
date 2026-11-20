import { HearingActRequestSchema } from '@/contracts/hearing';
import { act } from '@/server/hearing/civil';
import { handle, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { id } = await params;
  rateLimit(`hearing-act:${id}`, 60);
  return { hearing: act(id, await ownerToken(), await readBody(request, HearingActRequestSchema)) };
});
