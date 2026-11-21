import { handle } from '@/server/http';
import { mootCatalog } from '@/server/moot/cases';

/** The built-in «Bahs» cases: what anyone may see before choosing one (no confidential facts). */
export const GET = handle(async () => ({ cases: mootCatalog() }));
