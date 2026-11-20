import { HttpError } from '@/server/engine/session';
import { handle, ownerToken, rateLimit, type IdContext } from '@/server/http';
import { isRemoteId, remoteCourt } from '@/server/remote/court';

/** The court coach (tutorial mode of the external court backend only). */
export const GET = handle(async (request: Request, { params }: IdContext) => {
  const id = (await params).id;
  if (!isRemoteId(id)) throw new HttpError(404, 'no_hint', 'Bu mashqda maslahatchi yoʻq');
  rateLimit(`hint:${id}`, 60);
  return { hint: await remoteCourt.hint((await ownerToken(true))!, id, new URL(request.url).searchParams.get('preview') === '1') };
});
