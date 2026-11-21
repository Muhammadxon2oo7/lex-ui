import { handle } from '@/server/http';
import { domains } from '@/server/library';

/** Lines of practice (domains) with their share of 2025 court cases. */
export const GET = handle(async () => domains());
