import { handle, ownerToken } from '@/server/http';
import { auditStats } from '@/server/library';

/** Mentors: agreement between mentors and the AI (Cohen's kappa, target ≥ 0.61). */
export const GET = handle(async () => ({ stats: await auditStats((await ownerToken(true))!) }));
