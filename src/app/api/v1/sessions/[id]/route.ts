import { toSnapshot } from '@/server/engine/session';
import { handle, ownedSession, ownerToken, type IdContext } from '@/server/http';
import { isRemoteId, remoteCourt } from '@/server/remote/court';

export const GET = handle(async (_request: Request, { params }: IdContext) => {
  const id = (await params).id;
  if (isRemoteId(id)) return { snapshot: await remoteCourt.get((await ownerToken(true))!, id) };
  return { snapshot: toSnapshot(await ownedSession(id)) };
});
