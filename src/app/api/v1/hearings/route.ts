import { createHearing } from '@/server/hearing/civil';
import { handle, ownerToken, rateLimit } from '@/server/http';

export const POST = handle(async () => {
  const owner = (await ownerToken(true))!;
  rateLimit(`hearing:${owner}`, 20);
  return { hearing: createHearing(owner) };
});
