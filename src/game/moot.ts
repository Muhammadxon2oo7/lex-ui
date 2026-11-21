/** Client side of the moot court ("Bahs"): the room API and the long poll that keeps a room live. */
import { MootEnvelope, type MootAct, type MootRoom } from '@/contracts/moot';
import { ApiError } from './api';

async function call(path: string, init?: RequestInit, timeout = 15_000): Promise<MootRoom> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/moot${path}`, { cache: 'no-store', signal: AbortSignal.timeout(timeout), ...init });
  } catch {
    throw new ApiError(0, 'network', 'Aloqa uzildi. Internetni tekshiring.');
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Xatolik yuz berdi');
  }
  const parsed = MootEnvelope.safeParse(json);
  if (!parsed.success) throw new ApiError(502, 'bad_response', 'Server javobi kutilgandek emas');
  return parsed.data.room;
}
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const moot = {
  create: (name: string, avatar: 'man' | 'woman', size: number, assign: 'pick' | 'random', caseId?: string) => call('/rooms', post({ name, avatar, size, assign, ...(caseId ? { caseId } : {}) })),
  join: (code: string, name: string, avatar: 'man' | 'woman') => call(`/rooms/${code}/join`, post({ name, avatar })),
  /** `since`: wait (≈20 s) for a newer version than the one you hold. */
  read: (code: string, since: number | null, signal?: AbortSignal) =>
    call(`/rooms/${code}${since === null ? '' : `?v=${since}`}`, signal ? { signal: AbortSignal.any([signal, AbortSignal.timeout(28_000)]) } : undefined, 28_000),
  act: (code: string, a: MootAct) => call(`/rooms/${code}/act`, post(a)),
  /** Uploads the speaker's own voice for a line; returns the clip id to send with it. */
  async audio(code: string, wav: ArrayBuffer): Promise<string | null> {
    try {
      const r = await fetch(`/api/v1/moot/rooms/${code}/audio`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav, signal: AbortSignal.timeout(20_000) });
      return r.ok ? (((await r.json()) as { audio?: string }).audio ?? null) : null;
    } catch {
      return null;
    }
  },
  clip: (code: string, id: string) => fetch(`/api/v1/moot/rooms/${code}/audio/${id}`, { signal: AbortSignal.timeout(15_000) }).then((r) => (r.ok ? r.arrayBuffer() : null), () => null),
};
