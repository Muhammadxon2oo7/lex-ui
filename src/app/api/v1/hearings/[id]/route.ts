import { getHearing } from '@/server/hearing/civil';
import { handle, ownerToken, restoreHearing, type IdContext } from '@/server/http';

export const GET = handle(async (_request: Request, { params }: IdContext) => {
  const { id } = await params;
  await restoreHearing(id);
  return { hearing: getHearing(id, await ownerToken()) };
});
