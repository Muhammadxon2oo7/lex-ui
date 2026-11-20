import { describe, expect, it } from 'vitest';
import { beats, breath, eyes, lidCurve, rng, saccadeDuration, stepEyes } from './liveliness';
import { visemeTrack } from './visemes';

const DEG = Math.PI / 180;

describe('liveliness', () => {
  it('saccades follow the main sequence', () => {
    expect(saccadeDuration(10 * DEG)).toBeCloseTo(0.043, 3);
    expect(saccadeDuration(30 * DEG)).toBeCloseTo(0.087, 3);
  });

  it('blinks close fast and open slow', () => {
    expect(lidCurve(0.07)).toBeCloseTo(1, 5);
    expect(lidCurve(0.035)).toBeCloseTo(0.5, 5);
    expect(lidCurve(0.1 + 0.075)).toBeGreaterThan(0.4); // still half shut half-way through the opening
    expect(lidCurve(0.3)).toBe(0);
  });

  it('blinks every 1–9 s and reaches a large gaze shift within a saccade', () => {
    const r = rng(7);
    const s = eyes(r);
    const blinks: number[] = [];
    let was = 0;
    for (let i = 0; i < 60 * 120; i++) {
      const { blink } = stepEyes(s, 1 / 60, [0, 0], { speaking: false, listening: true, r });
      if (blink > 0.9 && was <= 0.9) blinks.push(i / 60);
      was = blink;
    }
    const gaps = blinks.slice(1).map((t, i) => t - blinks[i]);
    expect(blinks.length).toBeGreaterThan(14); // ≥ 7 a minute
    expect(blinks.length).toBeLessThan(60);
    expect(Math.min(...gaps)).toBeGreaterThan(0.2);
    // a 25° look-away is reached quickly (a saccade, not a slow drift)
    const e = eyes(rng(3));
    let t = 0;
    while (Math.abs(stepEyes(e, 1 / 120, [25 * DEG, 0], { speaking: false, listening: true, r: rng(3) }).yaw - 25 * DEG) > 2 * DEG && t < 1) t += 1 / 120;
    expect(t).toBeLessThan(0.15);
  });

  it('beats fall on the last vowel of words, strongest at the end of a phrase', () => {
    const b = beats(visemeTrack('Sud majlisi ochiq deb eʼlon qilinadi. Oʻtiring.'));
    expect(b.length).toBeGreaterThanOrEqual(6);
    expect(b.filter((x) => x.strength === 1).length).toBeGreaterThanOrEqual(2);
    expect(b.every((x, i) => i === 0 || x.at > b[i - 1].at)).toBe(true);
  });

  it('breathes in a cycle', () => {
    const values = Array.from({ length: 100 }, (_, i) => breath(i * 0.05, 14));
    expect(Math.max(...values)).toBeCloseTo(1, 1);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
  });
});
