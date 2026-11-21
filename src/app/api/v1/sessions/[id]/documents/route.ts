import { DocumentRequestSchema } from '@/contracts';
import { saveDocument } from '@/server/engine/session';
import { handle, ownedSession, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';
import { isRemoteId, remoteCourt } from '@/server/remote/court';

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const id = (await params).id;
  if (isRemoteId(id)) {
    rateLimit(`doc:${id}`, 60);
    return remoteCourt.document((await ownerToken(true))!, id, await readBody(request, DocumentRequestSchema));
  }
  const session = await ownedSession(id, true);
  rateLimit(`doc:${session.id}`, 60);
  return saveDocument(session, await readBody(request, DocumentRequestSchema));
});
