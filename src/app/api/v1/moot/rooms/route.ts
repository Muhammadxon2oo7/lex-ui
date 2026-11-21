import { MootCreateSchema } from '@/contracts/moot';
import { handle, ownerToken, rateLimit, readBody } from '@/server/http';
import { mootCaseFull } from '@/server/library';
import { fromLibrary } from '@/server/moot/cases';
import { createRoom } from '@/server/moot/engine';

/** Opens a moot-court room; the code is what the others join with. */
export const POST = handle(async (request: Request) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`moot-create:${owner}`, 10);
  const input = await readBody(request, MootCreateSchema);
  // a case approved on the court server; without one, the built-in case file
  const file = input.caseId && input.caseId !== 'ijara' ? fromLibrary(await mootCaseFull(owner, input.caseId)) : undefined;
  return { room: createRoom(owner, input, file) };
});
