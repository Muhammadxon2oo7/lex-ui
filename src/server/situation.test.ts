import { describe, expect, it } from 'vitest';
import { act, actSaid, startCase } from './case/engine';
import { availableOptions, createSession, interact, processTurn } from './engine/session';
import { readSituation, situationLine } from './situation';

// what the court server sends (v1.4.6, /nlu/match → situation)
const PROFANITY = {
  id: 'profanity', tone: 'bad', ethics: true, note: 'Soʻkinish — kasbiy etikaning qoʻpol buzilishi.',
  replies: {
    client: { emotion: 'upset', voices: ['male', 'female'], lines: ['Nima?! Bunaqa gaplarni sizdan kutmagan edim…', 'Iltimos, men bilan bunday gaplashmang.'] },
    officer: { emotion: 'impatient', voices: ['male'], lines: ['Haqorat qilmang.'] },
  },
};
const OFFTOPIC = { id: 'offtopic', tone: 'info', ethics: false, note: null, replies: { client: { emotion: 'uncertain', lines: ['Hozir boshqa gapga holim yoʻq… Ishim haqida gaplashsak boʻladimi?'] } } };

describe('human situations', () => {
  it('reads only what is well formed, and never repeats a line twice in a row', () => {
    expect(readSituation({ id: 'x' })).toBeNull();
    expect(readSituation({ id: 'x', replies: { client: { lines: [] } } })).toBeNull();
    const s = readSituation(PROFANITY)!;
    expect(s.ethics).toBe(true);
    expect(situationLine(s, 'client', 0)!.text).not.toBe(situationLine(s, 'client', 1)!.text);
    expect(situationLine(s, 'client', 0)!.emotion).toBe('upset');
    expect(situationLine(s, 'judge', 0)).toBeNull();
  });

  it('a room: the client answers swearing like a person, it is an ethics error, and the moment stays open', () => {
    const owner = 'owner-situation-room';
    let c = startCase(owner, true);
    c = act(c.caseId, owner, { type: 'enter', stage: 'consult', clientActionId: 'sit-enter-1' });
    const options = c.options.map((o) => o.id).join();
    const lines = c.lines.length;
    c = actSaid(c.caseId, owner, { clientActionId: 'sit-say-1', text: 'soʻkinish', inputMode: 'text' }, { optionId: null, clarify: null, ethics: true, situation: readSituation(PROFANITY) });
    expect(c.lines.length).toBe(lines + 2);
    expect(c.lines.at(-2)?.speaker).toBe('you');
    expect(c.lines.at(-1)).toMatchObject({ speaker: 'client', text: 'Nima?! Bunaqa gaplarni sizdan kutmagan edim…', emotion: 'upset' });
    expect(c.feedback?.tone).toBe('bad');
    expect(c.options.map((o) => o.id).join()).toBe(options); // the question is still open
    // the second time: the other variant
    c = actSaid(c.caseId, owner, { clientActionId: 'sit-say-2', text: 'yana', inputMode: 'text' }, { optionId: null, clarify: null, ethics: true, situation: readSituation(PROFANITY) });
    expect(c.lines.at(-1)?.text).toBe('Iltimos, men bilan bunday gaplashmang.');
  });

  it('a room: small talk is answered and costs nothing', () => {
    const owner = 'owner-situation-chat';
    let c = startCase(owner, true);
    c = act(c.caseId, owner, { type: 'enter', stage: 'consult', clientActionId: 'chat-enter-1' });
    c = actSaid(c.caseId, owner, { clientActionId: 'chat-say-1', text: 'ishlaringiz qalay?', inputMode: 'text' }, { optionId: null, clarify: null, ethics: false, situation: readSituation(OFFTOPIC) });
    expect(c.lines.at(-1)?.speaker).toBe('client');
    expect(c.feedback).toBeNull();
  });

  it('the DXM office: the citizen answers swearing in his own words, and it counts as rudeness', async () => {
    const owner = 'owner-situation-dxm-aaaaaaaaaaaaaaaaaaaaaa';
    const s = createSession({ scenarioId: 'dxm-yoqolgan-staj', mode: 'tutorial', ownerToken: owner });
    await interact(s, { clientActionId: 'dxm-start-1', action: 'start' });
    await interact(s, { clientActionId: 'dxm-desk-1', action: 'sit-at-desk' });
    const before = s.patience;
    const r = await processTurn(s, { clientTurnId: 'dxm-turn-0001', text: 'soʻkinish' }, readSituation(PROFANITY));
    expect(r.snapshot.turns.at(-1)?.text).toContain('Nima?!');
    expect(s.evidence.rude?.length).toBe(1);
    expect(s.patience).toBeLessThan(before - 10);
    expect(availableOptions(s).length).toBeGreaterThan(0);
  });
});
