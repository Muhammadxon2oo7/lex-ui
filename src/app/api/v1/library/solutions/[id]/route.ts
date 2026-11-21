import { EditSolutionSchema } from '@/contracts/library';
import { handle, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';
import { editSolution } from '@/server/library';

/** One's own solution: edit, open, close or delete. */
export const POST = handle(async (request: Request, { params }: IdContext) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`lib-sol-edit:${owner}`, 30);
  return { solution: await editSolution(owner, (await params).id, await readBody(request, EditSolutionSchema)) };
});
