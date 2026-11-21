import { handle, ownerToken, type IdContext } from '@/server/http';
import { getDraft } from '@/server/library';

export const GET = handle(async (_r: Request, { params }: IdContext) => ({ draft: await getDraft((await ownerToken(true))!, (await params).id) }));
