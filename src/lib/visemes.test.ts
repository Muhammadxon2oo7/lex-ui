import { describe, expect, it } from 'vitest';
import { sampleTrack, visemeTrack } from './visemes';

describe('Uzbek viseme track', () => {
  it('reads digraphs and the oʻ / gʻ letters as single sounds', () => {
    expect(visemeTrack('shoʻx').map((s) => s.v)).toEqual(['CH', 'O', 'kk']);
    expect(visemeTrack('gʻoz').map((s) => s.v)).toEqual(['kk', 'O', 'SS']);
    expect(visemeTrack('ming').map((s) => s.v)).toEqual(['PP', 'I', 'kk']);
  });
  it('closes the lips on b / p / m and opens on a', () => {
    const t = visemeTrack('Ba');
    expect(t[0].v).toBe('PP');
    expect(t[1].v).toBe('aa');
  });
  it('pauses at punctuation and covers the whole line', () => {
    const t = visemeTrack('Ha, roziman.');
    expect(t.some((s) => s.v === 'sil')).toBe(true);
    expect(t[0].t0).toBe(0);
    expect(t.at(-1)!.t1).toBeCloseTo(1);
  });
  it('blends neighbouring shapes (co-articulation)', () => {
    const t = visemeTrack('aba');
    const w = sampleTrack(t, t[1].t0 + 0.0001);
    expect(w.PP).toBeGreaterThan(0.9);
    expect(w.aa).toBeGreaterThan(0);
  });
});
