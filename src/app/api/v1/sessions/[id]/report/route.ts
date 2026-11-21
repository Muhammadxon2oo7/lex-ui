import { getReport } from '@/server/engine/session';
import { handle, ownedSession, ownerToken, type IdContext } from '@/server/http';
import { isRemoteId, remoteCourt } from '@/server/remote/court';

export const GET = handle(async (_request: Request, { params }: IdContext) => {
  const id = (await params).id;
  if (isRemoteId(id)) return { report: await remoteCourt.report((await ownerToken(true))!, id) };
  return { report: getReport(await ownedSession(id, true)) };
});
