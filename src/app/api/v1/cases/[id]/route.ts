import { getCase } from '@/server/case/engine';
import { restoreCase } from '@/server/case/persist';
import { handle, ownerToken, type IdContext } from '@/server/http';

export const GET = handle(async (_request: Request, { params }: IdContext) => {
  const { id } = await params;
  const owner = await ownerToken();
  await restoreCase(owner, id);
  return { case: getCase(id, owner) };
});
