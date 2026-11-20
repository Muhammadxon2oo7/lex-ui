import { CaseKindSchema } from '@/contracts/case';
import { currentCase } from '@/server/case/engine';
import { restoreCurrent } from '@/server/case/persist';
import { handle, ownerToken } from '@/server/http';

/** The case of this kind in progress for this browser, if any — the corridor shows its progress. */
export const GET = handle(async (request: Request) => {
  const kind = CaseKindSchema.catch('labour').parse(new URL(request.url).searchParams.get('kind') ?? 'labour');
  const owner = await ownerToken();
  await restoreCurrent(owner, kind);
  return { case: currentCase(owner, kind) };
});
