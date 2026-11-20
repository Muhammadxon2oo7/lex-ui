import { TurnRequestSchema } from '@/contracts';
import { processTurn } from '@/server/engine/session';
import { handle, ownedSession, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';
import { isRemoteId, remoteCourt } from '@/server/remote/court';

// a court turn may wait for the external LLM (60–90 s)
export const maxDuration = 200;

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const id = (await params).id;
  if (isRemoteId(id)) {
    rateLimit(`turn:${id}`, 30);
    return remoteCourt.turn((await ownerToken(true))!, id, await readBody(request, TurnRequestSchema));
  }
  const session = await ownedSession(id);
  rateLimit(`turn:${session.id}`, 30);
  return processTurn(session, await readBody(request, TurnRequestSchema));
});
