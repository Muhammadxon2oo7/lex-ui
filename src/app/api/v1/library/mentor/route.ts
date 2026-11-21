import { z } from 'zod';
import { handle, rateLimit, readBody } from '@/server/http';
import { isMentor, mentorLogin } from '@/server/library';

export const GET = handle(async () => ({ mentor: await isMentor() }));

/** Mentor sign-in with the shared code; sets a signed httpOnly cookie. */
export const POST = handle(async (request: Request) => {
  rateLimit(`mentor-login:${request.headers.get('x-forwarded-for') ?? 'local'}`, 8);
  await mentorLogin((await readBody(request, z.object({ code: z.string().min(4).max(128) }))).code);
  return { mentor: true };
});
