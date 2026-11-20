import { handle } from '@/server/http';
import { remoteStatus } from '@/server/remote/court';

/** Is the external court backend configured and reachable; its court scenarios. */
export const GET = handle(async () => remoteStatus());
