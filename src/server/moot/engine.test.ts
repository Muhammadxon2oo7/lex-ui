import { describe, expect, it } from 'vitest';
import { MootRoomSchema } from '@/contracts/moot';
import { __expire, actRoom, createRoom, joinRoom, readRoom } from './engine';

const A = 'owner-moot-a-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'owner-moot-b-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const C = 'owner-moot-c-cccccccccccccccccccccccccccccc';
const D = 'owner-moot-d-dddddddddddddddddddddddddddddd';
const settle = () => new Promise((r) => setTimeout(r, 30));

describe('moot court room', () => {
  it('two teams, drawn sides and roles, and nobody sees the other side’s confidential facts', async () => {
    const code = createRoom(A, { name: 'Aziza', avatar: 'woman', size: 2, assign: 'pick' }).code;
    joinRoom(B, code, { name: 'Bobur', avatar: 'man' });
    joinRoom(C, code, { name: 'Citora', avatar: 'woman' });
    let d = joinRoom(D, code, { name: 'Davron', avatar: 'man' });
    expect(MootRoomSchema.safeParse(d).success).toBe(true);
    expect(d.players.filter((p) => p.team === 'A').length).toBe(2);
    expect(() => joinRoom('owner-moot-e-eeeeeeeeeeeeeeeeeeeeeeeeeeeeee', code, { name: 'Ortiqcha', avatar: 'man' })).toThrow();
    expect(() => actRoom(B, code, { type: 'start' })).toThrow(); // only the host
    expect(() => actRoom(A, code, { type: 'start' })).toThrow(); // not everyone is ready
    for (const o of [B, C, D]) actRoom(o, code, { type: 'ready', ready: true });
    const a = actRoom(A, code, { type: 'start' });
    expect(a.phase).toBe('briefing');
    expect(a.sides).not.toBeNull();
    d = await readRoom(D, code, null);
    // each side reads its own confidential facts only
    const mine = (r: typeof a) => r.case.confidential.join(' ');
    const sameSide = a.me.side === d.me.side;
    expect(mine(a) === mine(d)).toBe(sameSide);
    expect(new Set(a.players.filter((p) => p.team === 'A').map((p) => p.role)).size).toBe(2);
    expect(JSON.stringify(a)).not.toContain(A); // owner tokens never go out
  });

  it('a hearing: one floor at a time, the clock moves it on, and the court decides', async () => {
    const code = createRoom(A, { name: 'Aziza', avatar: 'woman', size: 1, assign: 'random' }).code;
    joinRoom(B, code, { name: 'Bobur', avatar: 'man' });
    actRoom(B, code, { type: 'ready', ready: true });
    actRoom(A, code, { type: 'start' });
    actRoom(A, code, { type: 'ready', ready: true });
    let r = actRoom(B, code, { type: 'ready', ready: true }); // both have read the file: the hearing opens
    expect(r.phase).toBe('hearing');
    expect(r.transcript.some((e) => e.by === 'judge')).toBe(true);
    __expire(code); // the opening has been heard
    r = await readRoom(A, code, null);
    const claimant = r.me.side === 'claimant' ? A : B;
    const respondent = claimant === A ? B : A;
    expect(r.agenda[r.step].id).toBe('claim');
    expect(() => actRoom(respondent, code, { type: 'say', text: 'Hurmatli sud, navbatsiz gapiraman.' })).toThrow(); // not your floor
    actRoom(claimant, code, { type: 'say', text: 'Hurmatli sud, 32-P-sonli shartnoma boʻyicha qarz toʻlanmagan, hisob-fakturalar imzolangan, 8.5-bandga koʻra penya soʻraymiz; FK 326-moddasi va qonun boʻyicha penya mutanosib.' });
    r = actRoom(claimant, code, { type: 'yield' });
    expect(r.agenda[r.step].id).toBe('answer');
    expect(r.speaker).toBe(r.players.find((p) => p.id !== (claimant === A ? r.me.id : ''))?.id ?? r.speaker);
    actRoom(respondent, code, { type: 'say', text: 'Hurmatli sud, topshirish dalolatnomasi imzolanmagan, penyani kamaytirishni soʻraymiz.' });
    // the rest of the floors run out on the clock
    for (let i = 0; i < 30; i++) {
      r = await readRoom(A, code, null);
      if (r.phase === 'verdict') break;
      __expire(code);
      await settle();
    }
    r = await readRoom(A, code, null);
    expect(r.phase).toBe('verdict');
    expect(r.verdict?.winner).toBe('claimant'); // the side that argued its case
    expect(r.verdict?.engine).toBe('rules');
    expect(r.transcript.at(-1)?.text).toContain('yopiq');
    expect(MootRoomSchema.safeParse(r).success).toBe(true);
  });

  it('team chat stays in the team', async () => {
    const code = createRoom(A, { name: 'Aziza', avatar: 'woman', size: 1, assign: 'pick' }).code;
    joinRoom(B, code, { name: 'Bobur', avatar: 'man' });
    actRoom(A, code, { type: 'chat', text: 'Dalolatnomani tilga olmaymiz.' });
    expect((await readRoom(A, code, null)).chat.length).toBe(1);
    expect((await readRoom(B, code, null)).chat.length).toBe(0);
    await expect(readRoom('owner-moot-x-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', code, null)).rejects.toThrow(); // outsiders see nothing
  });
});
