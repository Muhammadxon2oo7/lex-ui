/**
 * The court server's model is slow (~46 s, backend v1.4.8): it answers 503 judge_pending first. The room
 * then announces the rules' reading as provisional and, once the model has written, the verdict.
 */
import { describe, expect, it, vi } from 'vitest';
import sample from './__fixtures__/judge-sample.json';

const answers: unknown[] = [];
vi.mock('./judge', async (orig) => {
  const real = await orig<typeof import('./judge')>();
  return { ...real, askJudge: vi.fn(async () => answers.shift() ?? { kind: 'none' }) };
});

const { __expire, actRoom, createRoom, joinRoom, readRoom } = await import('./engine');
const A = 'owner-pend-a-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'owner-pend-b-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('a slow court model', () => {
  it('provisional reading first, the model’s verdict replaces it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const code = createRoom(A, { name: 'Aziza', avatar: 'woman', size: 1, assign: 'random' }).code;
    joinRoom(B, code, { name: 'Bobur', avatar: 'man' });
    actRoom(B, code, { type: 'ready', ready: true });
    actRoom(A, code, { type: 'start' });
    actRoom(A, code, { type: 'ready', ready: true });
    actRoom(B, code, { type: 'ready', ready: true });
    answers.push({ kind: 'pending', retryAfter: 15 }, { kind: 'ok', verdict: { ...sample.verdict, players: [], engine: 'model', forfeit: false, pending: false } });
    for (let i = 0; i < 30; i++) {
      const r = await readRoom(A, code, null);
      if (r.phase === 'verdict') break;
      __expire(code);
      await vi.advanceTimersByTimeAsync(50);
    }
    let r = await readRoom(A, code, null);
    expect(r.verdict?.pending).toBe(true);
    expect(r.verdict?.engine).toBe('rules');
    expect(r.transcript.some((e) => /dastlabki baholarni/.test(e.text))).toBe(true);
    await vi.advanceTimersByTimeAsync(15_000);
    r = await readRoom(A, code, null);
    expect(r.verdict?.engine).toBe('model');
    expect(r.verdict?.pending).toBe(false);
    expect(r.transcript.at(-1)?.text).toContain('yopiq');
    expect(r.transcript.some((e) => e.text === 'Bahsda daʼvogar tomoni ustun keldi.')).toBe(true);
    vi.useRealTimers();
  });
});
