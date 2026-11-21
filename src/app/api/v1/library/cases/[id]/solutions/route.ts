import { NewSolutionSchema } from '@/contracts/library';
import { handle, ownerToken, rateLimit, readBody, type IdContext } from '@/server/http';
import { addSolution, solutions } from '@/server/library';

const code = (request: Request) => new URL(request.url).searchParams.get('code')?.slice(0, 64) || undefined;

/** Public solutions of a case and the student's own (private ones too). */
export const GET = handle(async (request: Request, { params }: IdContext) => ({ solutions: await solutions((await ownerToken(true))!, (await params).id, code(request)) }));

/** Leaves a solution (private unless the student opens it); a moot verdict is bound by the server from `verdictId`. */
export const POST = handle(async (request: Request, { params }: IdContext) => {
  const owner = (await ownerToken(true))!;
  rateLimit(`lib-sol:${owner}`, 10);
  return { solution: await addSolution(owner, (await params).id, await readBody(request, NewSolutionSchema)) };
});
