import { MootJoinSchema } from '@/contracts/moot';
import { handle, ownerToken, rateLimit, readBody } from '@/server/http';
import { joinRoom } from '@/server/moot/engine';

export const POST = handle(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`moot-join:${owner}`, 30);
  return { room: joinRoom(owner, (await params).code, await readBody(request, MootJoinSchema)) };
});
