/**
 * Speech provider (server side). The court backend's voice only (LEXSIM_REMOTE_URL):
 * cloned role voices with pre-rendered lines (~0.01 s), GPU STT (~1–2 s).
 * Without it, the browser uses its own speech features. Keys never reach the browser.
 */
import { createHash } from 'node:crypto';
import { remoteCookie } from '@/server/remote/court';
import { keyHeaders, remoteKeyed } from '@/server/remote/key';

export type VoiceId = string;

const REMOTE = process.env.LEXSIM_REMOTE_URL?.replace(/\/+$/, '') || null;

/** How we are let in: the server key (any student) or, without it, the student's court-session cookie. */
async function authFor(owner?: string): Promise<Record<string, string> | null> {
  if (!REMOTE) return null;
  if (remoteKeyed()) return keyHeaders(owner);
  const cookie = owner ? await remoteCookie(owner) : null;
  return cookie ? { Cookie: `lexsim_owner=${cookie}` } : null;
}

/** Is the court backend's voice up? (checked once a minute; the hub must never wait on it) */
let remoteVoice: { at: number; tts: boolean; stt: boolean; slow: boolean } | null = null;
async function remoteVoiceStatus() {
  if (!REMOTE) return { tts: false, stt: false, slow: false };
  if (remoteVoice && Date.now() - remoteVoice.at < 30_000) return remoteVoice;
  try {
    const r = (await fetch(`${REMOTE}/voice/status`, { cache: 'no-store', signal: AbortSignal.timeout(3000) }).then((x) => x.json())) as { tts?: string | null; stt?: string | null; sttEngine?: string | null };
    // since v1.4.2 `stt` is the engine actually up ("gpu" / "cpu"), null when none is
    // "cpu" = the GPU machine is off: recognition works but takes 15–40 s (the page then prefers the browser's own)
    remoteVoice = { at: Date.now(), tts: Boolean(r.tts), stt: Boolean(r.stt), slow: r.stt === 'cpu' };
  } catch {
    remoteVoice = { at: Date.now(), tts: false, stt: false, slow: false };
  }
  return remoteVoice;
}

/** Per student: with the server key everyone gets the court server's voice; without it, only those with a court session there. */
export async function voiceStatus(owner?: string) {
  const r = (await authFor(owner)) ? await remoteVoiceStatus() : { tts: false, stt: false, slow: false };
  return { tts: r.tts ? 'server' : null, stt: r.stt ? 'server' : null, sttSlow: r.stt && r.slow } as const;
}

/** Small in-memory cache: the same scripted lines are spoken again and again. */
const cache = new Map<string, { audio: Buffer; at: number }>();
const CACHE_MAX = 300;
/** A voice may be re-recorded on the court server (a clone replaced): our copy lives two hours at most. */
const CACHE_AGE = 2 * 60 * 60 * 1000;

/** The text goes unchanged (the backend's pre-rendered cache is keyed by it). */
export async function synthesize(text: string, voice: VoiceId, owner?: string, emotion?: string): Promise<Buffer | null> {
  const id = createHash('sha256').update(`${voice}\n${emotion ?? ''}\n${text}`).digest('hex');
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_AGE) return hit.audio;
  const auth = await authFor(owner);
  if (!auth || !(await remoteVoiceStatus()).tts) return null;
  const ask = () => fetch(`${REMOTE}/voice/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ text, voice, ...(emotion ? { emotion } : {}) }), signal: AbortSignal.timeout(20_000) });
  let res = await ask();
  // the per-student limit (lines fetched ahead): wait as asked, at most 2 s, once
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1000 * Math.min(2, Number(res.headers.get('retry-after')) || 1)));
    res = await ask();
  }
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const audio = Buffer.from(await res.arrayBuffer());
  cache.set(id, { audio, at: Date.now() });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return audio;
}

/** What the recogniser heard and how sure it is (v1.4.5: `confidence` 0–1, `lowConfidence` under 0.5). */
export interface Heard {
  text: string;
  confidence: number | null;
  low: boolean;
}

/** 16 kHz mono PCM WAV in, recognised Uzbek text out (Latin with ʻ/ʼ; the audio is not kept). */
export async function transcribe(wav: ArrayBuffer, owner?: string): Promise<Heard | null> {
  const auth = await authFor(owner);
  if (!auth || !(await remoteVoiceStatus()).stt) return null;
  // GPU ~1–2 s; when the GPU is off the backend falls back to CPU (up to ~37 s)
  const res = await fetch(`${REMOTE}/voice/stt`, { method: 'POST', headers: { 'Content-Type': 'audio/wav', ...auth }, body: wav, signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`stt ${res.status}`);
  const j = (await res.json()) as { text?: string; confidence?: number | null; lowConfidence?: boolean };
  const confidence = typeof j.confidence === 'number' ? Math.max(0, Math.min(1, j.confidence)) : null;
  return { text: String(j.text ?? '').trim(), confidence, low: j.lowConfidence === true || (confidence !== null && confidence < 0.5) };
}

/**
 * A pre-rendered line by its id (`npcTurn.audio.url`, v1.4.5): the id carries the file's time, so a
 * re-recorded voice has a new address and this one can be cached for good.
 */
export async function cachedAudio(file: string, owner?: string): Promise<Buffer | null> {
  const auth = await authFor(owner);
  if (!auth) return null;
  const res = await fetch(`${REMOTE}/voice/cache/${encodeURIComponent(file)}`, { headers: auth, signal: AbortSignal.timeout(15_000) });
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}
