/**
 * Durable server state on a serverless host (Netlify / Vercel): the next request may land on a fresh
 * instance with empty memory. Every engine keeps working in memory (fast) and writes its state through
 * to the court backend's document store (`/store/cases/{id}`, owner-checked, optimistic versions);
 * whatever is missing from memory is read back on first use.
 *
 * Optional: without LEXSIM_REMOTE_KEY nothing is written and everything behaves as before
 * (a single long-running Node server keeps all state in memory anyway). Failures never break a request.
 */
import { keyed, remoteKeyed, studentHash } from '@/server/remote/key';

const g = globalThis as unknown as { __lexStoreVersions?: Map<string, number> };
const versions = (g.__lexStoreVersions ??= new Map());

export const durable = () => remoteKeyed();

/** Plain JSON for the store: Maps and Sets survive the round trip. */
export function pack<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (v instanceof Map ? { __map: [...v] } : v instanceof Set ? { __set: [...v] } : v)));
}
export function unpack<T>(raw: unknown): T {
  return JSON.parse(JSON.stringify(raw), (_k, v) => {
    if (v && typeof v === 'object' && Array.isArray((v as { __map?: unknown[] }).__map)) return new Map((v as { __map: [unknown, unknown][] }).__map);
    if (v && typeof v === 'object' && Array.isArray((v as { __set?: unknown[] }).__set)) return new Set((v as { __set: unknown[] }).__set);
    return v;
  }) as T;
}

/** Write a document (ours wins on a version clash: the engine in memory is the truth). Never throws. */
export async function storePut(owner: string, id: string, kind: string, state: unknown): Promise<void> {
  if (!remoteKeyed()) return;
  for (let attempt = 0; attempt < 2; attempt++) {
    const version = versions.get(id) ?? 0;
    const r = await keyed<{ version?: number }>(owner, `/store/cases/${encodeURIComponent(id)}`, { method: 'PUT', body: { owner: studentHash(owner), kind, state, version } }).catch(() => null);
    if (!r) return;
    if (r.status === 200 && typeof r.json?.version === 'number') return void versions.set(id, r.json.version);
    if (r.status === 409 && typeof r.json?.version === 'number') versions.set(id, r.json.version);
    else return;
  }
}

/** Read a document back (only the owner's own: the store checks the owner hash). */
export async function storeGet(owner: string, id: string): Promise<unknown | null> {
  if (!remoteKeyed()) return null;
  const r = await keyed<{ state?: unknown; version?: number }>(owner, `/store/cases/${encodeURIComponent(id)}`).catch(() => null);
  if (r?.status !== 200 || !r.json) return null;
  if (typeof r.json.version === 'number') versions.set(id, r.json.version);
  return r.json.state ?? null;
}
