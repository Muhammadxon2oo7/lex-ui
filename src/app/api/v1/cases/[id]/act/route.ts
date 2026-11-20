import { CaseActRequestSchema } from '@/contracts/case';
import { act, actSaid } from '@/server/case/engine';
import { reportRoom, restoreCase, saveCase } from '@/server/case/persist';
import { understand } from '@/server/case/understand';
import { handle, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { id } = await params;
  rateLimit(`case-act:${id}`, 120);
  const owner = await ownerToken();
  await restoreCase(owner, id);
  const input = await readBody(request, CaseActRequestSchema);
  // an answer in own words is understood first (NLU on the court server, or our lexical matcher)
  const snap = input.type === 'say'
    ? actSaid(id, owner, input, await understand(id, owner, input.text, input.inputMode, input.stt))
    : act(id, owner, input);
  // write-through (durable across restarts) and, when a room ends, its record for the teacher
  void saveCase(owner, snap);
  void reportRoom(owner, snap);
  return { case: snap };
});
