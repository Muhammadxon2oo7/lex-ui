import { eventsAfter, toSnapshot } from '@/server/engine/session';
import { handle, ownedSession, ownerToken, type IdContext } from '@/server/http';
import { isRemoteId, remoteCourt } from '@/server/remote/court';

/** Reconnect / missed-events endpoint: `?after=<last seen sequence>`. */
export const GET = handle(async (request: Request, { params }: IdContext) => {
  const id = (await params).id;
  const after = Number(new URL(request.url).searchParams.get('after') ?? 0);
  if (isRemoteId(id)) return remoteCourt.events((await ownerToken(true))!, id, Number.isFinite(after) ? after : 0);
  const session = await ownedSession(id);
  return { events: eventsAfter(session, Number.isFinite(after) ? after : 0), snapshot: toSnapshot(session) };
});
