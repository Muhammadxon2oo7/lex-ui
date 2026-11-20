import { AppealRequestSchema } from '@/contracts';
import { appeal } from '@/server/engine/session';
import { handle, ownedSession, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';
import { isRemoteId, remoteCourt } from '@/server/remote/court';

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const id = (await params).id;
  if (isRemoteId(id)) {
    rateLimit(`appeal:${id}`, 5);
    const { reason } = await readBody(request, AppealRequestSchema);
    return { report: await remoteCourt.appeal((await ownerToken(true))!, id, reason) };
  }
  const session = await ownedSession(id);
  rateLimit(`appeal:${session.id}`, 5);
  const { reason } = await readBody(request, AppealRequestSchema);
  return { report: appeal(session, reason) };
});
