/** A random case from the court server's pool, never one of the last three played (remembered per browser). */
const RECENT = 'lexsim.recentScenarios.v1';

export function pickScenario(pool: string[]): string | null {
  if (!pool.length) return null;
  let recent: string[] = [];
  try {
    recent = JSON.parse(localStorage.getItem(RECENT) ?? '[]') as string[];
  } catch {
    /* private mode: any case will do */
  }
  const fresh = pool.filter((id) => !recent.includes(id));
  const from = fresh.length ? fresh : pool;
  const id = from[Math.floor(Math.random() * from.length)];
  try {
    localStorage.setItem(RECENT, JSON.stringify([id, ...recent.filter((r) => r !== id)].slice(0, Math.min(3, pool.length - 1))));
  } catch {
    /* not remembered: fine */
  }
  return id;
}
