import { handle, ownerToken } from '@/server/http';
import { auditQueue } from '@/server/library';

/** Mentors: the AI review queue (`?kind=moot_verdict|npc_reply`). */
export const GET = handle(async (request: Request) => {
  const kind = new URL(request.url).searchParams.get('kind') === 'npc_reply' ? 'npc_reply' : 'moot_verdict';
  return { queue: await auditQueue((await ownerToken(true))!, kind) };
});
