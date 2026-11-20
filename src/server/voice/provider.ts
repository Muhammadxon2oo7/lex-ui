/**
 * Speech provider (server side). Keys never reach the browser.
 *
 * Azure AI Speech supports Uzbek (uz-UZ) for both directions: TTS voices
 * uz-UZ-SardorNeural (male) and uz-UZ-MadinaNeural (female), and
 * speech-to-text. Configure with AZURE_SPEECH_KEY + AZURE_SPEECH_REGION.
 * Without them, the external court backend's voice service is used when
 * LEXSIM_REMOTE_URL is set (MMS-TTS Uzbek, one natural voice shaped into the
 * four roles; Uzbek STT) — same request/response shape as ours. Without
 * either, the browser falls back to its own speech features.
 *
 * NOTE: written against Azure's documented REST endpoints; not yet exercised
 * against a live key in this project.
 */
import { createHash } from 'node:crypto';
import { remoteCookie } from '@/server/remote/court';
import { keyHeaders, remoteKeyed } from '@/server/remote/key';

export type VoiceId = 'elder_m' | 'male' | 'female' | 'female_alt';

const VOICES: Record<VoiceId, { name: string; pitch: string; rate: string }> = {
  elder_m: { name: 'uz-UZ-SardorNeural', pitch: '-9%', rate: '-8%' },
  male: { name: 'uz-UZ-SardorNeural', pitch: '0%', rate: '0%' },
  female: { name: 'uz-UZ-MadinaNeural', pitch: '0%', rate: '0%' },
  female_alt: { name: 'uz-UZ-MadinaNeural', pitch: '+5%', rate: '+3%' },
};

const key = () => process.env.AZURE_SPEECH_KEY;
const region = () => process.env.AZURE_SPEECH_REGION;
const azure = () => Boolean(key() && region());
const REMOTE = process.env.LEXSIM_REMOTE_URL?.replace(/\/+$/, '') || null;

/** How we are let in: the server key (any student) or, without it, the student's court-session cookie. */
function authFor(owner?: string): Record<string, string> | null {
  if (remoteKeyed()) return keyHeaders(owner);
  const cookie = owner ? remoteCookie(owner) : null;
  return cookie ? { Cookie: `lexsim_owner=${cookie}` } : null;
}

/** Is the court backend's voice up? (checked once a minute; the hub must never wait on it) */
let remoteVoice: { at: number; tts: boolean; stt: boolean } | null = null;
async function remoteVoiceStatus() {
  if (!REMOTE) return { tts: false, stt: false };
  if (remoteVoice && Date.now() - remoteVoice.at < 60_000) return remoteVoice;
  try {
    const r = (await fetch(`${REMOTE}/voice/status`, { cache: 'no-store', signal: AbortSignal.timeout(3000) }).then((x) => x.json())) as { tts?: string | null; stt?: string | null };
    remoteVoice = { at: Date.now(), tts: Boolean(r.tts), stt: Boolean(r.stt) };
  } catch {
    remoteVoice = { at: Date.now(), tts: false, stt: false };
  }
  return remoteVoice;
}

/** Per student: the court backend's voice serves only students with a court session open there. */
export async function voiceStatus(owner?: string) {
  if (azure()) return { tts: 'azure', stt: 'azure' } as const;
  // with the server key every student gets the court server's voice; without it, only those with a court session there
  if (!remoteKeyed() && (!owner || !remoteCookie(owner))) return { tts: null, stt: null } as const;
  const r = await remoteVoiceStatus();
  return { tts: r.tts ? 'server' : null, stt: r.stt ? 'server' : null } as const;
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/** Small in-memory cache: the same scripted lines are spoken again and again. */
const cache = new Map<string, Buffer>();
const CACHE_MAX = 300;

/** `owner`: our owner token — the court backend speaks only to students with a court session open there. */
export async function synthesize(text: string, voice: VoiceId, owner?: string): Promise<Buffer | null> {
  const id = createHash('sha256').update(`${voice}\n${text}`).digest('hex');
  const hit = cache.get(id);
  if (hit) return hit;
  if (!azure()) {
    const auth = authFor(owner);
    if (!auth || !(await remoteVoiceStatus()).tts) return null;
    // the court backend: same body, MP3 back (a new line takes 2–7 s, its own cache < 0.3 s)
    const res = await fetch(`${REMOTE}/voice/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ text, voice }), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const audio = Buffer.from(await res.arrayBuffer());
    cache.set(id, audio);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    return audio;
  }
  const v = VOICES[voice];
  const ssml = `<speak version="1.0" xml:lang="uz-UZ"><voice name="${v.name}"><prosody pitch="${v.pitch}" rate="${v.rate}">${escapeXml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${region()}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key()!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'lexsim',
    },
    body: ssml,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const audio = Buffer.from(await res.arrayBuffer());
  cache.set(id, audio);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return audio;
}

/** 16 kHz mono PCM WAV in, recognised Uzbek text out. */
export async function transcribe(wav: ArrayBuffer, owner?: string): Promise<string | null> {
  if (!azure()) {
    const auth = authFor(owner);
    if (!auth || !(await remoteVoiceStatus()).stt) return null;
    // the court backend: WAV in, {text} out (Uzbek Latin with ʻ/ʼ; the audio is not kept)
    const res = await fetch(`${REMOTE}/voice/stt`, { method: 'POST', headers: { 'Content-Type': 'audio/wav', ...auth }, body: wav, signal: AbortSignal.timeout(40_000) });
    if (!res.ok) throw new Error(`stt ${res.status}`);
    return String(((await res.json()) as { text?: string }).text ?? '').trim();
  }
  const res = await fetch(`https://${region()}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=uz-UZ&format=simple`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key()!, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json' },
    body: wav,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`stt ${res.status}`);
  const json = (await res.json()) as { RecognitionStatus?: string; DisplayText?: string };
  return json.RecognitionStatus === 'Success' ? (json.DisplayText ?? '').trim() : '';
}
