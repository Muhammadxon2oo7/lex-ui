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
import { audio } from './audio';

export type VoiceId = 'elder_m' | 'male' | 'female' | 'female_alt';

/**
 * Read every frame by the characters' faces (never React state).
 * `track` is the mouth-shape timeline of the line being spoken (see lib/visemes).
 */
export const speech: { level: number; active: boolean; track: { segments: Segment[]; start: number; duration: number } | null } = { level: 0, active: false, track: null };

/** Start the mouth-shape timeline for a line lasting `ms` milliseconds. */
export function lipTrack(text: string, ms: number) {
  speech.track = { segments: visemeTrack(text), start: performance.now(), duration: Math.max(300, ms) };
}

type Status = { tts: 'server' | null; stt: 'server' | null };
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

/**
 * Speaks a line. Resolves when it has finished (or immediately when no
 * suitable voice exists). Returns whether anything was actually heard.
 */
export async function speak(text: string, voice: VoiceId): Promise<boolean> {
  stopSpeaking();
  if (muted || !text.trim()) return false;
  const status = await voiceStatus();

  if (status.tts) {
    try {
      const res = await fetch('/api/v1/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice }), signal: AbortSignal.timeout(10_000) });
      if (res.ok) return await playThroughAnalyser(await res.arrayBuffer(), text);
    } catch {
      /* fall through to the browser voice */
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

  if (support === 'server') {
    // capture raw PCM with an inline worklet, encode WAV on stop
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
    const stop = () => {
      node.disconnect();
      sink.disconnect();
      release();
    };
    return {
      level,
      onPartial: () => {},
      cancel: stop,
      finish: async () => {
        stop();
        const wav = encodeWav(chunks, ctx.sampleRate, 16000);
        if (wav.byteLength < 8000) return ''; // under ~0.25 s: nothing said
        const res = await fetch('/api/v1/voice/stt', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error('Nutqni tanib boʻlmadi. Qayta urinib koʻring.');
        return ((await res.json()) as { text: string }).text;
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
      release();
    },
    finish: async () => {
      rec.stop();
      await Promise.race([endedP, new Promise((r) => setTimeout(r, 2500))]);
      release();
      if (failure) throw new Error(failure);
      return (finalText || lastPartial).trim();
    },
  };
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
