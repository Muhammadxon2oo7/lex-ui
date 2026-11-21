import { TurnRequestSchema } from '@/contracts';
import { availableOptions, processTurn } from '@/server/engine/session';
import { askSituation } from '@/server/situation';
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
  const session = await ownedSession(id, true);
  rateLimit(`turn:${session.id}`, 30);
  const body = await readBody(request, TurnRequestSchema);
  // a free answer may be a human situation (swearing, small talk…): the court server knows the citizen's answer
  const situation = body.text && !session.processed.has(body.clientTurnId)
    ? await askSituation(await ownerToken(), body.text, availableOptions(session).map((o) => ({ id: o.id, text: o.text })), { case: 'dxm', scenario: session.scenario.public.id }, body.stt)
    : null;
  return processTurn(session, body, situation);
});
