/**
 * The small, involuntary behaviour that makes a face read as alive — kept
 * separate from the renderer so it can be tested and tuned.
 *
 *   Eyes   · gaze shifts are saccades: fast, with duration following the
 *            "main sequence" (≈ 21 ms + 2.2 ms per degree); between them the
 *            eye holds with tiny fixational micro-saccades (≈ 0.5–1.5°, every
 *            0.5–2 s); speakers look away now and then while they think
 *            (gaze aversion), listeners hold the gaze longer.
 *   Lids   · blinks are asymmetric (close ≈ 70 ms, open ≈ 150 ms), come every
 *            2–8 s (more often while speaking), sometimes double, and often
 *            ride on a large gaze shift; the upper lid follows the eye down.
 *   Speech · beats: Uzbek stresses the last syllable of a word, so the last
 *            vowel before each pause is a beat — brows lift and the head dips
 *            a little on some of them, more at the end of a phrase.
 *   Body   · breathing (≈ 12–16 per minute, slower when calm), and listeners
 *            give small back-channel nods while someone else speaks.
 *
 * Sources for the parameter ranges: saccade main sequence (Bahill et al. 1975;
 * Leigh & Zee), blink kinematics (Evinger et al. 1991), gaze aversion in
 * conversation (Argyle & Cook 1976), and the eye-behaviour models used in
 * embodied conversational agents (Lee, Badler & Badler 2002, "Eyes Alive").
 */
import type { Segment } from './visemes';

export type Rand = () => number;

/** A small deterministic PRNG, so every character has its own rhythm and tests are repeatable. */
export function rng(seed: number): Rand {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}
const between = (r: Rand, a: number, b: number) => a + (b - a) * r();
const DEG = Math.PI / 180;

/* ───────────────────────────── eyes and lids ───────────────────────────── */

export interface EyeState {
  /** current eye-in-head direction (radians) */
  yaw: number;
  pitch: number;
  /** saccade in flight */
  from: [number, number];
  to: [number, number];
  t: number;
  dur: number;
  /** fixational jitter around the target */
  micro: [number, number];
  nextMicro: number;
  /** looking away while speaking */
  avert: [number, number];
  avertFor: number;
  nextAvert: number;
  /** blink */
  nextBlink: number;
  blinkT: number;
  doubleBlink: boolean;
  lastTarget: [number, number];
}

export function eyes(r: Rand): EyeState {
  return {
    yaw: 0, pitch: 0, from: [0, 0], to: [0, 0], t: 1, dur: 0.05,
    micro: [0, 0], nextMicro: between(r, 0.5, 2),
    avert: [0, 0], avertFor: 0, nextAvert: between(r, 2, 5),
    nextBlink: between(r, 1, 4), blinkT: 1, doubleBlink: false, lastTarget: [0, 0],
  };
}

/** Saccade duration from its amplitude (main sequence). */
export const saccadeDuration = (amplitude: number) => 0.021 + (0.0022 * Math.abs(amplitude)) / DEG;

/** Upper-lid closure over a blink (t: seconds since the blink began). Close fast, open slow. */
export function lidCurve(t: number): number {
  const close = 0.07, hold = 0.03, open = 0.15;
  if (t < 0) return 0;
  if (t < close) return t / close;
  if (t < close + hold) return 1;
  if (t < close + hold + open) {
    const u = (t - close - hold) / open;
    return 1 - u * u * (3 - 2 * u);
  }
  return 0;
}
const BLINK_LENGTH = 0.25;

/**
 * Advances the eyes by dt toward the wanted eye-in-head direction.
 * Returns the lid closure (0..1) besides updating the state.
 */
/** Ask for a blink now (e.g. at the end of a spoken phrase). */
export function cueBlink(s: EyeState) {
  if (s.blinkT >= BLINK_LENGTH) s.nextBlink = 0;
}

export function stepEyes(s: EyeState, dt: number, want: [number, number], o: { speaking: boolean; listening: boolean; r: Rand; calm?: number }): { yaw: number; pitch: number; blink: number } {
  const { r } = o;
  // gaze aversion: a speaker glances away for a moment every few seconds
  s.nextAvert -= dt;
  if (s.avertFor > 0) s.avertFor -= dt;
  else if (o.speaking && s.nextAvert < 0) {
    s.avertFor = between(r, 0.7, 1.6);
    s.avert = [between(r, -1, 1) * between(r, 8, 15) * DEG, -between(r, 2, 8) * DEG];
    s.nextAvert = between(r, 2.5, 5); // a speaker holds eye contact roughly half to two-thirds of the time
  } else if (!o.speaking) s.nextAvert = Math.max(s.nextAvert, 1);
  const away = s.avertFor > 0 ? s.avert : [0, 0];

  // fixational micro-saccades
  s.nextMicro -= dt;
  if (s.nextMicro < 0) {
    s.micro = [between(r, -1.2, 1.2) * DEG, between(r, -0.8, 0.8) * DEG];
    s.nextMicro = between(r, 0.5, 2);
  }

  const target: [number, number] = [want[0] + away[0] + s.micro[0], want[1] + away[1] + s.micro[1]];
  const amp = Math.hypot(target[0] - s.to[0], target[1] - s.to[1]);
  let blinkOnShift = false;
  if (amp > 0.4 * DEG) {
    // a new saccade from wherever the eye is now
    s.from = [s.yaw, s.pitch];
    s.to = target;
    s.t = 0;
    s.dur = saccadeDuration(amp);
    // big gaze shifts often carry a blink (head-and-eye shifts beyond ~20°)
    const shift = Math.hypot(target[0] - s.lastTarget[0], target[1] - s.lastTarget[1]);
    if (shift > 20 * DEG && r() < 0.45) blinkOnShift = true;
    s.lastTarget = target;
  }
  if (s.t < 1) {
    s.t = Math.min(1, s.t + dt / s.dur);
    const e = s.t * s.t * (3 - 2 * s.t);
    s.yaw = s.from[0] + (s.to[0] - s.from[0]) * e;
    s.pitch = s.from[1] + (s.to[1] - s.from[1]) * e;
  }

  // blinks: every 2–8 s, more often while speaking, now and then double
  s.nextBlink -= dt;
  if (s.blinkT >= BLINK_LENGTH && (s.nextBlink < 0 || blinkOnShift)) {
    s.blinkT = 0;
    s.doubleBlink = r() < 0.12;
    // ≈ 26/min in conversation, ≈ 17/min at rest, fewer while listening closely
    const mean = o.speaking ? 2.3 : o.listening ? 4.0 : 3.5;
    s.nextBlink = Math.max(1.2, mean * (0.45 + r() * 1.3)) * (1 + (o.calm ?? 0) * 0.4);
  }
  let blink = 0;
  if (s.blinkT < BLINK_LENGTH * (s.doubleBlink ? 2 : 1) + 0.05) {
    s.blinkT += dt;
    blink = Math.max(lidCurve(s.blinkT), s.doubleBlink ? lidCurve(s.blinkT - BLINK_LENGTH - 0.05) : 0);
  }
  return { yaw: s.yaw, pitch: s.pitch, blink };
}

/* ───────────────────────────── speech beats ───────────────────────────── */

const VOWEL = new Set(['aa', 'E', 'I', 'O', 'U']);
export interface Beat {
  /** time in the line (0..1) */
  at: number;
  /** 0..1: phrase ends are strong, word ends weaker */
  strength: number;
}

/** Stressed moments of a line: the last vowel of each word (Uzbek final stress), strongest before a pause. */
export function beats(segments: Segment[]): Beat[] {
  const out: Beat[] = [];
  let lastVowel: Segment | null = null;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (VOWEL.has(s.v)) lastVowel = s;
    const end = s.v === 'sil' || i === segments.length - 1;
    if (end && lastVowel) {
      const pause = s.v === 'sil' ? s.t1 - s.t0 : 0;
      // a long pause (punctuation) marks the end of a phrase
      const strength = i === segments.length - 1 || pause > 0.02 ? 1 : 0.45;
      if (!out.length || lastVowel.t0 - out[out.length - 1].at > 0.04) out.push({ at: lastVowel.t0, strength });
      lastVowel = null;
    }
  }
  return out;
}

/** Envelope of a beat accent at `since` seconds after it (quick rise, slower fall). */
export const accent = (since: number) => (since < 0 ? 0 : since < 0.09 ? since / 0.09 : Math.max(0, 1 - (since - 0.09) / 0.35));

/* ───────────────────────────── breathing ───────────────────────────── */

/** Chest motion (−1..1) at time t; ~14/min at rest, faster when upset, with a slower exhale. */
export function breath(t: number, rate = 14): number {
  const phase = ((t * rate) / 60) % 1;
  // inhale 40 %, exhale 60 % of the cycle
  return phase < 0.4 ? Math.sin((phase / 0.4) * (Math.PI / 2)) : Math.cos(((phase - 0.4) / 0.6) * (Math.PI / 2));
}
