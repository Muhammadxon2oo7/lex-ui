import { CaseActRequestSchema } from '@/contracts/case';
import { act, actSaid, npcRequest } from '@/server/case/engine';
import { askNpc } from '@/server/case/npc';
import { reportRoom, restoreCase, saveCase } from '@/server/case/persist';
import { understand } from '@/server/case/understand';
import { after } from 'next/server';
import { handle, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { id } = await params;
  rateLimit(`case-act:${id}`, 120);
  const owner = await ownerToken();
  await restoreCase(owner, id);
  const input = await readBody(request, CaseActRequestSchema);
  // an answer in own words is understood first (NLU on the court server, or our lexical matcher)
  let snap;
  if (input.type === 'say') {
    const understood = await understand(id, owner, input.text, input.inputMode, input.stt);
    // nothing ready fits: the character may answer in their own role through the AI (court server v1.5)
    const req = understood.ai ? npcRequest(id, owner, input.text) : null;
    const npc = req ? { req, answer: await askNpc(owner, req, true) } : null;
    snap = actSaid(id, owner, input, { ...understood, npc });
  } else snap = act(id, owner, input);
  // write-through (durable across restarts) and, when a room ends, its record for the teacher
  // (after the response: the student never waits for the store, and a serverless host still finishes it)
  after(() => Promise.all([saveCase(owner, snap), reportRoom(owner, snap)]));
  return { case: snap };
});
