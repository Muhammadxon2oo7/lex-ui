import { handle, ownerToken } from '@/server/http';
import { readRoom } from '@/server/moot/engine';

// a long poll: the answer waits (up to ~20 s) until the room changes
export const maxDuration = 30;

/** The room as you see it. `?v=<version>`: wait for something newer than what you have. */
export const GET = handle(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const v = new URL(request.url).searchParams.get('v');
  return { room: await readRoom(await ownerToken(), (await params).code, v === null ? null : Number(v) || 0) };
});
