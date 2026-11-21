import { MootCreateSchema } from '@/contracts/moot';
import { handle, ownerToken, rateLimit, readBody } from '@/server/http';
import { mootCaseFull } from '@/server/library';
import { fromLibrary, MOOT_CASES } from '@/server/moot/cases';
import { createRoom } from '@/server/moot/engine';

/** Opens a moot-court room; the code is what the others join with. */
export const POST = handle(async (request: Request) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`moot-create:${owner}`, 10);
  const input = await readBody(request, MootCreateSchema);
  // a built-in case, or one approved on the court server; without one, the default case file
  const file = !input.caseId ? undefined : (Object.hasOwn(MOOT_CASES, input.caseId) ? MOOT_CASES[input.caseId] : null) ?? fromLibrary(await mootCaseFull(owner, input.caseId));
  return { room: createRoom(owner, input, file) };
});
