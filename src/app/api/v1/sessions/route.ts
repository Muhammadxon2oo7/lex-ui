import { CreateSessionRequestSchema } from '@/contracts';
import { createSession, toSnapshot } from '@/server/engine/session';
import { handle, keep, ownerToken, rateLimit, readBody } from '@/server/http';
import { isRemoteScenario, remoteCourt } from '@/server/remote/court';

export const POST = handle(async (request: Request) => {
  const body = await readBody(request, CreateSessionRequestSchema);
  const owner = (await ownerToken(true))!;
  rateLimit(`create:${owner}`, 20);
  // court scenarios live on the external court backend (see src/server/remote/court.ts)
  if (await isRemoteScenario(body.scenarioId)) return { snapshot: await remoteCourt.create(owner, body.scenarioId, body.mode, body.level) };
  const s = createSession({ ...body, ownerToken: owner });
  keep('dxm', s.id, owner);
  return { snapshot: toSnapshot(s) };
});
