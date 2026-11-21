import { MootCreateSchema } from '@/contracts/moot';
import { handle, ownerToken, rateLimit, readBody } from '@/server/http';
import { createRoom } from '@/server/moot/engine';

/** Opens a moot-court room; the code is what the others join with. */
export const POST = handle(async (request: Request) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`moot-create:${owner}`, 10);
  return { room: createRoom(owner, await readBody(request, MootCreateSchema)) };
});
