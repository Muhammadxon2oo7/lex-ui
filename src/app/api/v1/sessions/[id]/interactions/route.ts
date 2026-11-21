import { InteractionRequestSchema } from '@/contracts';
import { HttpError, interact } from '@/server/engine/session';
import { handle, ownedSession, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';
import { isRemoteId, remoteCourt } from '@/server/remote/court';

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const id = (await params).id;
  if (isRemoteId(id)) {
    rateLimit(`act:${id}`, 60);
    return remoteCourt.interact((await ownerToken(true))!, id, await readBody(request, InteractionRequestSchema));
  }
  const session = await ownedSession(id, true);
  rateLimit(`act:${session.id}`, 60);
  const body = await readBody(request, InteractionRequestSchema);
  // standing up / sitting down is a courtroom rule, kept by the court backend
  if (body.action === 'stand' || body.action === 'sit' || body.action === 'reveal-options' || body.action === 'silence') throw new HttpError(422, 'validation_failed', 'Bu harakat faqat sud majlisida');
  return interact(session, { ...body, action: body.action });
});
