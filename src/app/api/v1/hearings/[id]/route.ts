import { getHearing } from '@/server/hearing/civil';
import { handle, ownerToken, type IdContext } from '@/server/http';

export const GET = handle(async (_request: Request, { params }: IdContext) => {
  return { hearing: getHearing((await params).id, await ownerToken()) };
});
