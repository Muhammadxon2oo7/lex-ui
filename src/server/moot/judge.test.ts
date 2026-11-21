import { describe, expect, it } from 'vitest';
import { MootVerdictSchema } from '@/contracts/moot';
import sample from './__fixtures__/judge-sample.json';
import { MOOT_CASES } from './cases';

describe('court server verdict (POST /moot/judge, backend sample v1.4.8)', () => {
  const v = MootVerdictSchema.parse({ ...sample.verdict, engine: 'model', forfeit: false });

  it('fits our verdict contract', () => {
    expect(v.engine).toBe('model');
    expect(v.pending).toBe(false);
    expect(v.criteria.map((c) => c.id)).toEqual(['participation', 'manners', 'facts', 'rebuttal', 'legal']);
  });

  it('keeps the agreed weights and adds up', () => {
    expect(v.criteria.map((c) => c.max)).toEqual([20, 15, 30, 20, 15]);
    for (const side of ['claimant', 'respondent'] as const) expect(v.criteria.reduce((n, c) => n + c[side], 0)).toBe(v.totals[side]);
    for (const c of v.criteria) for (const side of ['claimant', 'respondent'] as const) expect(c[side]).toBeLessThanOrEqual(c.max);
  });

  it('names the winner of the debate, never decides the claim', () => {
    expect(v.ruling.at(-1)).toBe('Bahsda daʼvogar tomoni ustun keldi.');
    expect(v.ruling.join(' ')).not.toMatch(/qanoatlantirilsin|undirilsin|rad etilsin/);
    expect(v.ruling.length).toBeGreaterThanOrEqual(3);
    expect(v.ruling.length).toBeLessThanOrEqual(6);
  });

  /**
   * KNOWN ISSUE in the sample (reported to the backend): the case file of the ijara moot case has no
   * «FK 333-modda» and no «120 mln soʻm», yet both reach the ruling and the notes. This test records
   * what our case file contains, so the next sample can be checked against it.
   */
  it('reports articles and sums the case file does not contain', () => {
    const c = MOOT_CASES.ijara;
    const file = JSON.stringify([c.claim, c.facts, c.evidence, c.side]);
    const text = JSON.stringify([v.ruling, v.criteria.map((x) => x.note), v.players.map((p) => p.note)]);
    const articles = [...text.matchAll(/(\d+)-moddas?/g)].map((m) => m[1]).filter((n) => !file.includes(`${n}-modda`));
    expect(articles).toContain('333');
    expect(file).not.toContain('120 mln');
  });
});

describe('v1.5: explainable verdict and the new weights', () => {
  it('reads the explain object of the backend note (items, quotes, band, mentor routing)', async () => {
    const { MootExplainSchema } = await import('@/contracts/moot');
    const e = MootExplainSchema.parse({
      rubric: 'moot', version: 'moot-2026.11.1', runs: 1, needsMentor: false, routing: [],
      sides: { claimant: { total: 31, band: [31, 31], criteria: [{ id: 'facts', label: 'Faktlar va dalillar', max: 20, score: 15, basis: ['jessup', 'vis', 'ipk68'] }],
        items: [{ id: 'F2', dim: 'facts', ask: 'Ish materiallaridagi aniq dalil hujjatini nomlab, u nimani isbotlashini aytdi', weight: 3, method: 'ai', met: 'yes', agree: 1.0, basis: ['ipk68', 'jessup'],
          evidence: [{ turnId: '3', quote: 'fakturalar javobgar direktori tomonidan imzolangan', match: 1.0 }], why: 'Imzolangan fakturalarni nomlab…' }] } },
    });
    expect(e.sides.claimant?.items[0].evidence[0].turnId).toBe('3');
    expect(e.sides.respondent).toBeUndefined();
    // anything odd degrades, never breaks the verdict
    expect(MootExplainSchema.safeParse({ sides: { claimant: { items: [{ id: 'X', dim: 'legal', met: 'maybe', evidence: 'none' }] } } }).success).toBe(true);
  });

  it('the rules use the rubric weights (legal 30, rebuttal 25, facts 20, participation 15, manners 10)', async () => {
    const { ruleVerdict } = await import('./judge');
    const v = ruleVerdict(MOOT_CASES.ijara, [], [], [], null);
    expect(Object.fromEntries(v.criteria.map((c) => [c.id, c.max]))).toEqual({ legal: 30, rebuttal: 25, facts: 20, participation: 15, manners: 10 });
    expect(v.winner).toBeNull(); // nobody spoke: a draw
  });

  it('a side that swore scores at most 40 and cannot win', async () => {
    const { ruleVerdict } = await import('./judge');
    const agenda = [{ id: 's1', kind: 'speech' as const, title: 'Daʼvo', side: 'claimant' as const, role: 'lead' as const, seconds: 60 }, { id: 's2', kind: 'speech' as const, title: 'Javob', side: 'respondent' as const, role: 'lead' as const, seconds: 60 }];
    const say = (seq: number, side: 'claimant' | 'respondent', text: string, step: string) => ({ id: `e${seq}`, seq, at: seq, by: side, name: side, side, text, step });
    const v = ruleVerdict(MOOT_CASES.ijara, agenda, [
      say(1, 'claimant', 'Hurmatli sud! 32-P shartnoma, hisob-faktura imzolangan, foydalangan, asosiy qarz 25 620, penya 8.5-band, toʻlanmagan, FK modda, qonun, kodeks. Ahmoq javobgar.', 's1'),
      say(2, 'respondent', 'Hurmatli sud, dalolatnoma imzolanmagan, penyani kamaytirishni soʻraymiz.', 's2'),
    ], [], null);
    expect(v.totals.claimant).toBeLessThanOrEqual(40);
    expect(v.winner).toBe('respondent');
  });
});
