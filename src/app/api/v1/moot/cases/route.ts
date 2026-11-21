import { handle, ownerToken } from '@/server/http';
import { mootCases } from '@/server/library';

/** Approved cases that can be argued in a moot room (titles only). */
export const GET = handle(async () => ({ cases: await mootCases((await ownerToken(true))!) }));
