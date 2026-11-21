/**
 * Voice: actors speak, the student answers out loud.
 *
 * Output (actors):
 *   1. server TTS (the court backend's cloned role voices) → played through Web Audio so
 *      the mouth follows the real loudness of the voice;
 *   2. otherwise the browser's own Uzbek voice, if the system has one;
 *   3. otherwise silence — the subtitle is still shown. We never read Uzbek
 *      text with a voice for another language.
 *
 * Input (student): push-to-talk.
 *   1. server STT: 16 kHz mono WAV recorded in the browser;
 *   2. otherwise the browser's SpeechRecognition with lang "uz-UZ", if the
 *      browser supports that language;
 *   3. otherwise unavailable — replies can still be chosen on screen.
 */
import { visemeTrack, type Segment } from '@/lib/visemes';
import { spokenText } from '@/lib/spoken';
import { audio } from './audio';

/** The court server's voices: four built in, more per scenario (`scene.voices`). */
export type VoiceId = 'elder_m' | 'male' | 'female' | 'female_alt' | (string & {});

/**
 * Read every frame by the characters' faces (never React state).
 * `track` is the mouth-shape timeline of the line being spoken (see lib/visemes).
 */
export const speech: { level: number; active: boolean; track: { segments: Segment[]; start: number; duration: number } | null } = { level: 0, active: false, track: null };

/** Start the mouth-shape timeline for a line lasting `ms` milliseconds. */
export function lipTrack(text: string, ms: number) {
  speech.track = { segments: visemeTrack(text), start: performance.now(), duration: Math.max(300, ms) };
}

/** `sttSlow`: the court server recognises speech on its CPU (15–40 s) — the browser's own words are used then. */
type Status = { tts: 'server' | null; stt: 'server' | null; sttSlow?: boolean };
let statusPromise: Promise<Status> | null = null;
/** Read once per page; `refresh` after opening a court session (its server voice becomes available). */
export function voiceStatus(refresh = false): Promise<Status> {
  if (refresh) statusPromise = null;
  statusPromise ??= fetch('/api/v1/voice/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    .then((r) => (r.ok ? (r.json() as Promise<Status>) : { tts: null, stt: null }))
    .catch(() => ({ tts: null, stt: null }));
  return statusPromise;
}

/* ───────────────────────── speaking ───────────────────────── */

let current: { stop: () => void } | null = null;
let muted = false;
export const setVoiceMuted = (value: boolean) => {
  muted = value;
  if (value) stopSpeaking();
};

export function stopSpeaking() {
  current?.stop();
  current = null;
  speech.active = false;
  speech.level = 0;
  speech.track = null;
}

function uzbekSystemVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('uz')) ?? null;
}

/** Server audio, asked for once per line: lines that come next are fetched while the current one plays. */
const fetched = new Map<string, Promise<ArrayBuffer | null>>();
/** A line's pre-rendered audio as the court server names it (`npcTurn.audio`). */
export interface LineAudio {
  url: string;
  voice: string;
}
function serverAudio(text: string, voice: VoiceId, emotion?: string, ready?: LineAudio): Promise<ArrayBuffer | null> {
  const key = `${voice}\n${emotion ?? ''}\n${text}`;
  let p = fetched.get(key);
  if (!p) {
    const tts = () =>
      fetch('/api/v1/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice, ...(emotion ? { emotion } : {}) }), signal: AbortSignal.timeout(10_000) })
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
    // the server already has this line recorded in this very voice: one cacheable GET, kept by the browser
    const file = ready && ready.voice === voice ? ready.url.split('/').pop() : null;
    p = file
      ? fetch(`/api/v1/voice/cache/${encodeURIComponent(file)}`, { signal: AbortSignal.timeout(10_000) })
          .then((r) => (r.ok ? r.arrayBuffer() : tts()))
          .catch(tts)
      : tts();
    fetched.set(key, p);
    p.then((a) => !a && fetched.delete(key)); // a failure may succeed next time
    if (fetched.size > 40) fetched.delete(fetched.keys().next().value!);
  }
  return p;
}

/** Start fetching a line that will be spoken soon (no sound; ignored when the server has no voice). */
export async function prefetchLine(line: string, voice: VoiceId, emotion?: string, ready?: LineAudio) {
  const text = spokenText(line);
  if (muted || !text || !(await voiceStatus()).tts) return;
  void serverAudio(text, voice, emotion, ready);
}

/**
 * Speaks a line. Resolves when it has finished (or immediately when no
 * suitable voice exists). Returns whether anything was actually heard.
 */
export async function speak(line: string, voice: VoiceId, emotion?: string, ready?: LineAudio): Promise<boolean> {
  stopSpeaking();
  const text = spokenText(line); // «(sekin)» stays in the subtitle, never read aloud
  if (muted || !text) return false;
  const status = await voiceStatus();

  if (status.tts) {
    const audio = await serverAudio(text, voice, emotion, ready);
    if (audio) {
      fetched.delete(`${voice}\n${emotion ?? ''}\n${text}`); // decoded once; the server cache answers a repeat in ~10 ms
      try {
        return await playThroughAnalyser(audio, text);
      } catch {
        /* fall through to the browser voice */
      }
    }
  }

  const system = uzbekSystemVoice();
  if (system) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = system;
      u.lang = system.lang;
      u.rate = voice === 'elder_m' ? 0.92 : 1;
      u.pitch = voice === 'elder_m' ? 0.85 : voice === 'female_alt' ? 1.08 : 1;
      let pulse = 0;
      // no audio stream to analyse: pulse the mouth on word boundaries
      u.onboundary = () => {
        speech.level = 0.9;
        clearTimeout(pulse);
        pulse = window.setTimeout(() => (speech.level = 0.25), 120);
      };
      const finish = () => {
        speech.active = false;
        speech.level = 0;
        resolve(true);
      };
      u.onend = finish;
      u.onerror = finish;
      current = { stop: () => speechSynthesis.cancel() };
      speech.active = true;
      // the browser does not report the length: estimate it from the speaking rate
      lipTrack(text, (text.length * 62) / u.rate);
      speechSynthesis.speak(u);
    });
  }
  return false;
}

/**
 * Plays a recorded line (another person's own voice in the moot court) through the same path as the
 * actors' voices: one voice at a time, the speaker's mouth follows the sound. Resolves when it ends.
 */
export async function playClip(data: ArrayBuffer, text: string): Promise<boolean> {
  stopSpeaking();
  if (muted) return false;
  try {
    return await playThroughAnalyser(data, text);
  } catch {
    return false;
  }
}

async function playThroughAnalyser(data: ArrayBuffer, text: string): Promise<boolean> {
  const graph = audio.graph();
  if (!graph) return false;
  const { ctx, out } = graph;
  const buffer = await ctx.decodeAudioData(data);
  // the mouth shapes are spread over the real length of the synthesised voice
  lipTrack(text, buffer.duration * 1000);
  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const gain = ctx.createGain();
    gain.gain.value = 1.6; // voices sit above the room tone
    source.connect(analyser).connect(gain).connect(out);
    const samples = new Float32Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += v * v;
      speech.level = Math.min(1, Math.sqrt(sum / samples.length) * 7);
      raf = requestAnimationFrame(tick);
    };
    const done = () => {
      cancelAnimationFrame(raf);
      speech.active = false;
      speech.level = 0;
      resolve(true);
    };
    source.onended = done;
    current = {
      stop: () => {
        source.onended = null;
        try {
          source.stop();
        } catch {}
        done();
      },
    };
    speech.active = true;
    source.start();
    tick();
  });
}

/* ───────────────────────── listening ───────────────────────── */

export type ListenSupport = 'server' | 'browser' | 'none';

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

let browserUzUnsupported = false;
export async function listenSupport(): Promise<ListenSupport> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'none';
  if ((await voiceStatus()).stt) return 'server';
  return recognitionCtor() && !browserUzUnsupported ? 'browser' : 'none';
}

export interface Listening {
  /** Live mic level 0..1 for the meter. */
  level: { current: number };
  /** Partial transcript (browser recognition only). */
  onPartial: (cb: (text: string) => void) => void;
  /** Stop and get the final transcript ('' if nothing was understood). */
  finish: () => Promise<string>;
  cancel: () => void;
}

/**
 * The student's own voice, kept for the practice record (never sent anywhere but STT).
 * Every finished utterance waits here until the answer it belongs to is sent: then the page
 * takes it (`takeVoice`) and files it with the transcript; a typed or chosen answer drops it.
 */
let pendingVoice: ArrayBuffer[] = [];
/** How sure the recogniser was of the last answer (0–1; null when it does not say) — sent on with the answer. */
let lastConfidence: number | null = null;
let lastSeconds: number | null = null;
export function takeConfidence(): number | null {
  const c = lastConfidence;
  lastConfidence = null;
  return c;
}
/** How long the last spoken answer was (ms), sent with it (`stt.durationMs`). */
export function takeDuration(): number | null {
  const d = lastSeconds;
  lastSeconds = null;
  return d === null ? null : Math.round(d * 1000);
}
export function takeVoice(): ArrayBuffer | null {
  const all = pendingVoice;
  pendingVoice = [];
  return all.length ? joinWav(all) : null;
}
export const dropVoice = () => void (pendingVoice = []);

/** Raw PCM from the mic through an inline worklet (both recognition modes keep the student's voice). */
async function capture(ctx: AudioContext, source: MediaStreamAudioSourceNode) {
  const chunks: Float32Array[] = [];
  const worklet = `registerProcessor('cap', class extends AudioWorkletProcessor { process(i) { const c = i[0] && i[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; } });`;
  const url = URL.createObjectURL(new Blob([worklet], { type: 'application/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const node = new AudioWorkletNode(ctx, 'cap');
  node.port.onmessage = (e) => chunks.push(e.data as Float32Array);
  source.connect(node);
  const sink = ctx.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(ctx.destination);
  return {
    chunks,
    stop: () => {
      node.disconnect();
      sink.disconnect();
    },
  };
}

/** The browser's own recognition, for live words only (null where it does not speak Uzbek). */
function browserPreview(): { onPartial: (cb: (t: string) => void) => void; stop: () => Promise<string>; abort: () => void } | null {
  const Ctor = recognitionCtor();
  if (!Ctor || browserUzUnsupported) return null;
  try {
    const rec = new Ctor();
    rec.lang = 'uz-UZ';
    rec.interimResults = true;
    rec.continuous = true;
    let text = '';
    let cb: (t: string) => void = () => {};
    let ended: () => void = () => {};
    const endedP = new Promise<void>((r) => (ended = r));
    rec.onresult = (e) => {
      let all = '';
      for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript;
      text = all.trim();
      cb(text);
    };
    rec.onerror = (e) => {
      if (e.error === 'language-not-supported' || e.error === 'language-unavailable') browserUzUnsupported = true;
    };
    rec.onend = () => ended();
    rec.start();
    return {
      onPartial: (f) => (cb = f),
      stop: async () => {
        rec.stop();
        await Promise.race([endedP, new Promise((r) => setTimeout(r, 1200))]);
        return text;
      },
      abort: () => rec.abort(),
    };
  } catch {
    return null;
  }
}

/** Starts capturing. Throws a user-facing message if the mic is unavailable. */
export async function startListening(): Promise<Listening> {
  stopSpeaking(); // the student interrupts — the actor stops talking
  const support = await listenSupport();
  if (support === 'none') throw new Error('Bu brauzerda oʻzbekcha nutqni tanish imkoni yoʻq. Javobni ekrandan tanlang.');

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  } catch {
    throw new Error('Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida mikrofonni yoqing.');
  }
  const graph = audio.graph();
  if (!graph) throw new Error('Audio tizimini ishga tushirib boʻlmadi');
  const { ctx } = graph;
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const level = { current: 0 };
  const samples = new Float32Array(analyser.fftSize);
  let raf = 0;
  const meter = () => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const v of samples) sum += v * v;
    level.current = Math.min(1, Math.sqrt(sum / samples.length) * 9);
    raf = requestAnimationFrame(meter);
  };
  meter();

  const release = () => {
    cancelAnimationFrame(raf);
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
  };

  const cap = await capture(ctx, source);
  const keep = (said: string) => {
    if (!said) return;
    const wav = encodeWav(cap.chunks, ctx.sampleRate, 16000);
    if (wav.byteLength >= 8000) pendingVoice.push(wav);
  };

  if (support === 'server') {
    // the browser's own recognition runs alongside, only to SHOW the words as they are said
    // (and to answer at once when the server is slow); the server's text is the better one when it comes in time
    const preview = browserPreview();
    const stop = () => {
      cap.stop();
      release();
    };
    return {
      level,
      onPartial: (cb) => preview?.onPartial(cb),
      cancel: () => {
        preview?.abort();
        stop();
      },
      finish: async () => {
        stop();
        const wav = encodeWav(cap.chunks, ctx.sampleRate, 16000);
        const quick = preview ? await preview.stop() : '';
        if (wav.byteLength < 8000) return quick; // under ~0.25 s: nothing said
        const slow = Boolean((await voiceStatus()).sttSlow);
        if (quick && slow) {
          // the GPU machine is off: do not keep the student waiting half a minute
          pendingVoice.push(wav);
          return quick;
        }
        const abort = new AbortController();
        type Heard = { text: string; confidence?: number | null; lowConfidence?: boolean };
        const server = fetch('/api/v1/voice/stt', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav, signal: typeof AbortSignal.any === 'function' ? AbortSignal.any([abort.signal, AbortSignal.timeout(45_000)]) : abort.signal })
          .then(async (res) => (res.ok ? ((await res.json()) as Heard) : null))
          .catch(() => null);
        // the server's (better) text if it comes within ~4 s; otherwise what the browser heard
        const heard = quick ? await Promise.race([server, new Promise<null>((r) => setTimeout(() => r(null), 4000))]) : await server;
        abort.abort();
        if (!heard && !quick) throw new Error('Nutqni tanib boʻlmadi. Qayta urinib koʻring.');
        // the server is not sure of what it heard: never a guess as a firm answer — prefer what the browser
        // heard; otherwise the words go on marked unsure, and whoever is listening asks again out loud
        // (the court and the rooms re-ask without a penalty when confidence < 0.5)
        lastSeconds = (wav.byteLength - 44) / 32000;
        if (heard?.lowConfidence && quick) {
          lastConfidence = null;
          pendingVoice.push(wav);
          return quick;
        }
        const said = heard?.text || quick;
        lastConfidence = heard?.text ? (heard.confidence ?? (heard.lowConfidence ? 0.3 : null)) : null;
        if (said) pendingVoice.push(wav);
        return said;
      },
    };
  }

  // browser recognition
  const Ctor = recognitionCtor()!;
  const rec = new Ctor();
  rec.lang = 'uz-UZ';
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = '';
  let partialCb: (t: string) => void = () => {};
  let failure: string | null = null;
  let ended: () => void = () => {};
  const endedP = new Promise<void>((r) => (ended = r));
  rec.onresult = (e) => {
    let interim = '';
    finalText = '';
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    partialCb((finalText + ' ' + interim).trim());
  };
  rec.onerror = (e) => {
    if (e.error === 'language-not-supported' || e.error === 'language-unavailable') {
      browserUzUnsupported = true;
      failure = 'Brauzer oʻzbek tilini tanimaydi. Javobni ekrandan tanlang.';
    } else if (e.error === 'not-allowed') failure = 'Mikrofonga ruxsat berilmadi.';
    else if (e.error !== 'no-speech' && e.error !== 'aborted') failure = 'Nutqni tanib boʻlmadi. Qayta urinib koʻring.';
  };
  rec.onend = () => ended();
  rec.start();
  let lastPartial = '';
  return {
    level,
    onPartial: (cb) => {
      partialCb = (t) => {
        lastPartial = t;
        cb(t);
      };
    },
    cancel: () => {
      rec.abort();
      cap.stop();
      release();
    },
    finish: async () => {
      rec.stop();
      await Promise.race([endedP, new Promise((r) => setTimeout(r, 2500))]);
      cap.stop();
      release();
      if (failure) throw new Error(failure);
      const said = (finalText || lastPartial).trim();
      keep(said);
      return said;
    },
  };
}

/** Several 16 kHz mono WAVs (as encodeWav makes them) as one, with a short breath between. */
function joinWav(parts: ArrayBuffer[]): ArrayBuffer {
  if (parts.length === 1) return parts[0];
  const gap = 16000 * 0.25 * 2; // 0.25 s of silence, in bytes
  const data = parts.reduce((n, p) => n + (p.byteLength - 44), 0) + gap * (parts.length - 1);
  const out = new Uint8Array(44 + data);
  out.set(new Uint8Array(parts[0], 0, 44));
  const view = new DataView(out.buffer);
  view.setUint32(4, 36 + data, true);
  view.setUint32(40, data, true);
  let o = 44;
  parts.forEach((p, i) => {
    out.set(new Uint8Array(p, 44), o);
    o += p.byteLength - 44 + (i < parts.length - 1 ? gap : 0);
  });
  return out.buffer;
}

function encodeWav(chunks: Float32Array[], from: number, to: number): ArrayBuffer {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const ratio = from / to;
  const length = Math.floor(total / ratio);
  const flat = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    flat.set(c, o);
    o += c.length;
  }
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const str = (off: number, s: string) => [...s].forEach((ch, i) => view.setUint8(off + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, to, true);
  view.setUint32(28, to * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    // box-filter downsample
    const start = Math.floor(i * ratio);
    const end = Math.min(total, Math.floor((i + 1) * ratio));
    let acc = 0;
    for (let j = start; j < end; j++) acc += flat[j];
    const v = Math.max(-1, Math.min(1, acc / Math.max(1, end - start)));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return buffer;
}
