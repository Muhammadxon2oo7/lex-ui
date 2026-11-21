import { DraftRequestSchema } from '@/contracts/library';
import { handle, ownerToken, rateLimit, readBody } from '@/server/http';
import { startDraft } from '@/server/library';

/** The model starts drafting a case from the student's story (45-95 s); the client polls. */
export const POST = handle(async (request: Request) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`lib-draft:${owner}`, 6);
  return startDraft(owner, await readBody(request, DraftRequestSchema));
});
