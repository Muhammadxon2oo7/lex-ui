import { ReviewSchema } from '@/contracts/library';
import { handle, ownerToken, readBody, type IdContext } from '@/server/http';
import { review } from '@/server/library';

/** Mentor: approve or reject (with a note). The admin token stays on this server. */
export const POST = handle(async (request: Request, { params }: IdContext) => {
  const b = await readBody(request, ReviewSchema);
  return { case: await review((await ownerToken(true))!, (await params).id, b.decision, b.note) };
});
