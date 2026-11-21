import { createHearing } from '@/server/hearing/civil';
import { handle, keep, ownerToken, rateLimit } from '@/server/http';

export const POST = handle(async () => {
  const owner = (await ownerToken(true))!;
  rateLimit(`hearing:${owner}`, 20);
  const hearing = createHearing(owner);
  keep('hearing', hearing.hearingId, owner);
  return { hearing };
});
