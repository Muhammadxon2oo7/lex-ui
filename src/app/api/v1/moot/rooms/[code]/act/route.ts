import { MootActSchema } from '@/contracts/moot';
import { handle, ownerToken, rateLimit, readBody } from '@/server/http';
import { actRoom } from '@/server/moot/engine';

export const POST = handle(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const owner = await ownerToken();
  rateLimit(`moot-act:${owner}`, 180);
  return { room: actRoom(owner, (await params).code, await readBody(request, MootActSchema)) };
});
