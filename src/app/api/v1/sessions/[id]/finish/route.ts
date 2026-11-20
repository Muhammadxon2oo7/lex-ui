import { FinishRequestSchema } from '@/contracts';
import { finish } from '@/server/engine/session';
import { handle, ownedSession, ownerToken, readBody, type IdContext } from '@/server/http';
import { isRemoteId, remoteCourt } from '@/server/remote/court';

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const id = (await params).id;
  if (isRemoteId(id)) return remoteCourt.finish((await ownerToken(true))!, id, await readBody(request, FinishRequestSchema));
  const session = await ownedSession(id);
  return finish(session, await readBody(request, FinishRequestSchema));
});
