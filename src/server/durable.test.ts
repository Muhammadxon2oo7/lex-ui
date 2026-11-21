import { describe, expect, it } from 'vitest';
import { pack, unpack } from './durable';
import { availableOptions, createSession, dumpSession, getSession, interact, loadSession, processTurn, toSnapshot } from './engine/session';
import { act, createHearing, dumpHearing, getHearing, loadHearing } from './hearing/civil';

describe('durable state (serverless: the next request may land on a fresh instance)', () => {
  it('Maps and Sets survive the store', () => {
    const back = unpack<{ m: Map<string, number>; s: Set<string> }>(pack({ m: new Map([['a', 1]]), s: new Set(['x']) }));
    expect(back.m.get('a')).toBe(1);
    expect(back.s.has('x')).toBe(true);
  });

  it('a DXM session comes back from its document and plays on', async () => {
    const owner = 'owner-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const s = createSession({ scenarioId: 'dxm-yoqolgan-staj', mode: 'tutorial', ownerToken: owner });
    await interact(s, { clientActionId: 'act-0001-start', action: 'start' });
    await interact(s, { clientActionId: 'act-0002-desk', action: 'sit-at-desk' });
    const option = availableOptions(s)[0];
    await processTurn(s, { clientTurnId: 'turn-0001-aaaa', optionId: option.id });
    const before = toSnapshot(s);
    const doc = JSON.parse(JSON.stringify(dumpSession(s.id))); // as the store keeps it
    expect(JSON.stringify(doc)).not.toContain(owner); // the owner token never goes to the store
    // another instance: the store has checked the owner, the session is loaded under it
    expect(loadSession(owner, doc)).toBe(true);
    const back = getSession(s.id, owner);
    expect(toSnapshot(back).turns.length).toBe(before.turns.length);
    // an answer already given is still answered once (idempotency survives)
    const again = await processTurn(back, { clientTurnId: 'turn-0001-aaaa', optionId: option.id });
    expect(again.snapshot.turns.length).toBe(before.turns.length);
    // and the dialogue goes on
    const next = availableOptions(back)[0];
    if (next) expect((await processTurn(back, { clientTurnId: 'turn-0002-aaaa', optionId: next.id })).snapshot.turns.length).toBeGreaterThan(before.turns.length);
  });

  it('a presiding-judge hearing comes back too', () => {
    const owner = 'owner-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const h = createHearing(owner);
    const doc = JSON.parse(JSON.stringify(dumpHearing(h.hearingId)));
    expect(JSON.stringify(doc)).not.toContain(owner);
    expect(loadHearing(owner, doc)).toBe(true);
    const back = getHearing(h.hearingId, owner);
    expect(back.hearingId).toBe(h.hearingId);
    const opt = back.options?.[0];
    if (opt) expect(act(h.hearingId, owner, { clientActionId: 'h-act-0001', optionId: opt.id }).hearingId).toBe(h.hearingId);
  });
});
