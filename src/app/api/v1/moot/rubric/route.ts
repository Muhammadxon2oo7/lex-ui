import { MootRubricSchema, type MootRubric } from '@/contracts/moot';
import { handle } from '@/server/http';
import { REMOTE_BASE } from '@/server/remote/key';

let cached: { at: number; rubric: MootRubric } | null = null;

/** The moot rubric's criteria and their sources (court server GET /rubrics/moot, public): «Nimaga asoslanib?». */
export const GET = handle(async () => {
  if (cached && Date.now() - cached.at < 3_600_000) return { rubric: cached.rubric };
  if (!REMOTE_BASE) return { rubric: null };
  const json = await fetch(`${REMOTE_BASE}/rubrics/moot`, { cache: 'no-store', signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : null), () => null);
  const parsed = MootRubricSchema.safeParse({ dims: json?.rubric?.dims, sources: json?.sources });
  if (!parsed.success) return { rubric: null };
  cached = { at: Date.now(), rubric: parsed.data };
  return { rubric: parsed.data };
});
