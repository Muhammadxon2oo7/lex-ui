import { describe, expect, it } from 'vitest';
import { HearingSnapshotSchema } from '@/contracts/hearing';
import { act, createHearing, getHearing } from './civil';

const id = () => `c_${Math.random().toString(36).slice(2)}_${Date.now()}`;
const ORDER = ['open', 'attendance', 'witness-out', 'composition', 'rights', 'motions', 'report', 'explanations', 'evidence-order', 'witness', 'completion', 'debates', 'deliberation', 'judgment'];

describe('civil hearing', () => {
  it('runs in the order of the Code and cites only articles from the law store', () => {
    let h = createHearing('owner-1');
    expect(HearingSnapshotSchema.safeParse(h).success).toBe(true);
    for (const step of ORDER) {
      expect(h.options).toHaveLength(4);
      expect(h.options.some((o) => o.id === step)).toBe(true);
      h = act(h.hearingId, 'owner-1', { clientActionId: id(), optionId: step });
      expect(h.feedback?.correct).toBe(true);
    }
    expect(h.finished).toBe(true);
    expect(h.score).toBe(100);
    const known = new Set(h.code.articles.map((a) => a.number));
    for (const d of h.done) expect(known.has(d.article)).toBe(true);
    for (const a of h.code.articles) expect(a.url.startsWith('https://lex.uz/')).toBe(true);
    expect(h.done.map((d) => d.article)).toEqual(['210', '213', '215', '216', '217', '219', '225', '227', '228', '229', '243', '244', '247', '248'].map((n) => `${n}-modda`));
  });

  it('does not advance on an out-of-order action and names the article only on the second miss', () => {
    let h = createHearing('owner-2');
    const wrong = h.options.find((o) => o.id !== 'open')!.id;
    h = act(h.hearingId, 'owner-2', { clientActionId: id(), optionId: wrong });
    expect(h.done).toHaveLength(0);
    expect(h.feedback).toMatchObject({ correct: false, article: null });
    h = act(h.hearingId, 'owner-2', { clientActionId: id(), optionId: wrong });
    expect(h.feedback?.article).toBe('210-modda');
    h = act(h.hearingId, 'owner-2', { clientActionId: id(), optionId: 'open' });
    expect(h.done[0].attempts).toBe(3);
  });

  it('is idempotent, removes the witness before the merits and guards ownership', () => {
    let h = createHearing('owner-3');
    const clientActionId = id();
    const a = act(h.hearingId, 'owner-3', { clientActionId, optionId: 'open' });
    expect(act(h.hearingId, 'owner-3', { clientActionId, optionId: 'open' })).toBe(a);
    h = act(h.hearingId, 'owner-3', { clientActionId: id(), optionId: 'attendance' });
    expect(h.witnessPresent).toBe(true);
    h = act(h.hearingId, 'owner-3', { clientActionId: id(), optionId: 'witness-out' });
    expect(h.witnessPresent).toBe(false);
    expect(() => getHearing(h.hearingId, 'someone-else')).toThrow();
  });
});
