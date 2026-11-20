/**
 * Lip-sync track from Uzbek text.
 *
 * Uzbek in the Latin script is close to phonemic — one letter (or digraph)
 * per sound — so the mouth shapes can be read off the spelling and spread
 * over the duration of the line (the length of the synthesised audio, or the
 * subtitle's reading time when there is no voice). Shapes follow the 15
 * Oculus visemes the character meshes carry (`viseme_aa` … `viseme_U`).
 */
export const VISEMES = ['sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U'] as const;
export type Viseme = (typeof VISEMES)[number];

export interface Segment {
  v: Viseme;
  /** start and end as fractions of the line (0..1) */
  t0: number;
  t1: number;
}

const APOS = /[ʻʼ'‘’`]/g;
// digraphs first: sh, ch, ng, oʻ, gʻ
const UNITS: [RegExp, Viseme, number][] = [
  [/^sh/, 'CH', 0.75],
  [/^ch/, 'CH', 0.75],
  [/^ng/, 'kk', 0.6],
  [/^o'/, 'O', 1.05],
  [/^g'/, 'kk', 0.6],
  [/^[a]/, 'aa', 1.0],
  [/^[e]/, 'E', 0.95],
  [/^[iy]/, 'I', 0.8],
  [/^[o]/, 'O', 1.0],
  [/^[u]/, 'U', 0.95],
  [/^[bpm]/, 'PP', 0.65],
  [/^[fv]/, 'FF', 0.65],
  [/^[dtl]/, 'DD', 0.55],
  [/^[n]/, 'nn', 0.55],
  [/^[kgqxh]/, 'kk', 0.55],
  [/^[jc]/, 'CH', 0.65],
  [/^[sz]/, 'SS', 0.65],
  [/^[r]/, 'RR', 0.55],
];

/** Builds the timeline: one segment per sound, pauses on spaces and punctuation. */
export function visemeTrack(text: string): Segment[] {
  const s = text.toLowerCase().replace(APOS, "'").replace(/[«»"“”()]/g, '');
  const raw: { v: Viseme; w: number }[] = [];
  for (let i = 0; i < s.length; ) {
    const rest = s.slice(i);
    if (/^[.!?…]/.test(rest)) {
      raw.push({ v: 'sil', w: 2.6 });
      i += 1;
      continue;
    }
    if (/^[,;:—–-]/.test(rest)) {
      raw.push({ v: 'sil', w: 1.4 });
      i += 1;
      continue;
    }
    if (/^\s/.test(rest)) {
      raw.push({ v: 'sil', w: 0.25 });
      i += 1;
      continue;
    }
    const unit = UNITS.find(([re]) => re.test(rest));
    if (unit) {
      raw.push({ v: unit[1], w: unit[2] });
      i += rest.match(unit[0])![0].length;
      continue;
    }
    if (/^\d/.test(rest)) {
      // numbers are read as words: a vowel–consonant rhythm
      raw.push({ v: 'aa', w: 0.9 }, { v: 'DD', w: 0.5 });
    }
    i += 1;
  }
  const total = raw.reduce((a, r) => a + r.w, 0) || 1;
  let t = 0;
  return raw.map((r) => {
    const seg = { v: r.v, t0: t / total, t1: (t + r.w) / total };
    t += r.w;
    return seg;
  });
}

/** How open the jaw is for each shape (0..1). */
export const JAW: Record<Viseme, number> = { sil: 0, PP: 0.02, FF: 0.12, TH: 0.18, DD: 0.22, kk: 0.25, CH: 0.2, SS: 0.12, nn: 0.16, RR: 0.24, aa: 0.75, E: 0.45, I: 0.3, O: 0.55, U: 0.32 };

/**
 * Weights of every viseme at position `x` (0..1) of the line, with
 * co-articulation: each sound eases in before its segment and out after it,
 * so the mouth moves through shapes instead of snapping between them.
 */
export function sampleTrack(track: Segment[], x: number, out: Partial<Record<Viseme, number>> = {}): Partial<Record<Viseme, number>> {
  for (const v of VISEMES) out[v] = 0;
  if (!track.length || x < 0 || x > 1) return out;
  // binary search for the current segment
  let lo = 0, hi = track.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (track[mid].t1 < x) lo = mid + 1;
    else hi = mid;
  }
  for (let i = Math.max(0, lo - 1); i <= Math.min(track.length - 1, lo + 1); i++) {
    const s = track[i];
    const len = s.t1 - s.t0;
    const ramp = Math.max(len * 0.6, 0.004);
    const w = x < s.t0 ? 1 - (s.t0 - x) / ramp : x > s.t1 ? 1 - (x - s.t1) / ramp : 1;
    if (w > 0) out[s.v] = Math.max(out[s.v] ?? 0, w * w * (3 - 2 * w));
  }
  return out;
}
