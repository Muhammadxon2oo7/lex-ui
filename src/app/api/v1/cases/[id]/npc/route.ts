import { after } from 'next/server';
import { npcPoll } from '@/server/case/engine';
import { restoreCase, saveCase } from '@/server/case/persist';
import { handle, ownerToken, rateLimit, type IdContext } from '@/server/http';

/** While a character "thinks" (an AI line being written): ask again; the line comes when it is ready. */
export const POST = handle(async (_request: Request, { params }: IdContext) => {
  const { id } = await params;
  rateLimit(`case-npc:${id}`, 30);
  const owner = await ownerToken();
  await restoreCase(owner, id);
  const snap = await npcPoll(id, owner);
  after(() => saveCase(owner, snap));
  return { case: snap };
});
