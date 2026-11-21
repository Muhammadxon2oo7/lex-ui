import { handle, ownerToken } from '@/server/http';
import { reviewQueue } from '@/server/library';

/** Mentor: cases waiting for review. */
export const GET = handle(async () => ({ cases: await reviewQueue((await ownerToken(true))!) }));
