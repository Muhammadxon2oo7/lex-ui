/**
 * Server-to-server access to the court backend (voice, NLU, case store, xAPI).
 * SERVER ONLY: the key comes from LEXSIM_REMOTE_KEY and never reaches the browser;
 * students are identified to that server only by a salted hash of their owner token.
 */
import { createHash } from 'node:crypto';

export const REMOTE_BASE = process.env.LEXSIM_REMOTE_URL?.replace(/\/+$/, '') || null;
const KEY = process.env.LEXSIM_REMOTE_KEY || null;

/** Is the keyed (server-to-server) API available? */
export const remoteKeyed = () => Boolean(REMOTE_BASE && KEY);

/** A stable, non-reversible id for the student (never the cookie itself). */
export const studentHash = (owner: string) => createHash('sha256').update(`lexsim:v1:${owner}`).digest('hex').slice(0, 32);

export function keyHeaders(owner?: string): Record<string, string> {
  if (!KEY) return {};
  return { 'X-LexSim-Key': KEY, ...(owner ? { 'X-LexSim-Owner': studentHash(owner) } : {}) };
}

/** JSON call to the keyed API; null on any failure (callers degrade gracefully). */
export async function keyed<T>(owner: string | undefined, path: string, init: { method?: string; body?: unknown; timeout?: number } = {}): Promise<{ status: number; json: T | null } | null> {
  if (!remoteKeyed()) return null;
  try {
    const res = await fetch(`${REMOTE_BASE}${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: { ...keyHeaders(owner), ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(init.timeout ?? 8000),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as T | null };
  } catch {
    return null;
  }
}
