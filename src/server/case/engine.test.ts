import { describe, expect, it } from 'vitest';
import type { CaseActRequest, ClaimDraft } from '@/contracts/case';
import { CaseSnapshotSchema } from '@/contracts/case';
import { act, actSaid, dumpCase, loadCase, startCase } from './engine';
import { understand } from './understand';
import { PREPARED } from './ishga-tiklash';

let n = 0;
type Input = CaseActRequest extends infer T ? (T extends { clientActionId: string } ? Omit<T, 'clientActionId'> : never) : never;

function run(owner: string) {
  let s = startCase(owner, true);
  const step = (input: Input) => {
    s = act(s.caseId, owner, { ...input, clientActionId: `test-action-${++n}` } as CaseActRequest);
    expect(CaseSnapshotSchema.safeParse(s).success).toBe(true);
    return s;
  };
  return { get: () => s, step, choose: (optionId: string) => step({ type: 'choose', optionId }) };
}

const goodDraft: ClaimDraft = PREPARED.draft;

describe('Ish yoʻli engine', () => {
  it('never shows more than four replies', () => {
    const r = run('owner-few');
    r.step({ type: 'enter', stage: 'consult' });
    expect(r.get().options.length).toBeLessThanOrEqual(4);
  });

  it('lets the student start in the courtroom with a prepared case file', () => {
    const r = run('owner-jump');
    r.step({ type: 'enter', stage: 'hearing' });
    expect(r.get().feedback?.message).toMatch(/tayyor holda/);
    expect(r.get().await).toBe('stand');
    // the hall is already on its feet before you are
    expect(r.get().lines.at(-1)?.scene.everyoneStands).toBe(true);
    expect(r.get().scene.judgeIn).toBe(false);
  });

  it('runs the whole case in order', () => {
    const r = run('owner-happy');
    r.step({ type: 'enter', stage: 'consult' });
    for (const o of ['greet', 'story', 'docs', 'witness', 'job', 'explain-letter', 'served', 'authority', 'finish']) r.choose(o);
    expect(r.get().result?.score).toBe(100);

    r.step({ type: 'enter', stage: 'draft' });
    r.step({ type: 'draft', draft: goodDraft });
    expect(r.get().result?.score).toBe(100);

    r.step({ type: 'enter', stage: 'filing' });
    for (const o of ['purpose', 'hand']) r.choose(o);
    expect(r.get().rulings.at(-1)?.kind).toBe('accepted');

    r.step({ type: 'enter', stage: 'chamber' });
    for (const o of ['essence', 'call-witness', 'consult-client']) r.choose(o);
    expect(r.get().result?.score).toBe(100);

    r.step({ type: 'enter', stage: 'hearing' });
    r.step({ type: 'stand', up: true });
    r.step({ type: 'stand', up: false });
    r.choose('no-recusal'); // seated → FPK 212 reminder
    expect(r.get().feedback?.article).toBe('212-modda');
    for (const o of ['no-recusal', 'explain', 'dates', 'open-question', 'speech']) {
      r.step({ type: 'stand', up: true });
      r.choose(o);
    }
    // the court retires (all rise), you sit while it deliberates, all rise for the judgment
    r.step({ type: 'stand', up: true });
    r.step({ type: 'stand', up: false });
    r.step({ type: 'stand', up: true });
    expect(r.get().result?.verdict).toMatch(/qanoatlantirildi/);
    expect(r.get().result?.score).toBe(90);
  });

  it('returns a claim filed without the warrant and the duty receipt (FPK 195)', () => {
    const r = run('owner-return');
    r.step({ type: 'enter', stage: 'consult' });
    for (const o of ['story', 'authority', 'finish']) r.choose(o);
    r.step({ type: 'enter', stage: 'draft' });
    r.step({ type: 'draft', draft: { ...goodDraft, attachments: ['order'], signed: false } });
    r.step({ type: 'enter', stage: 'filing' });
    for (const o of ['purpose', 'hand']) r.choose(o);
    const s = r.get();
    expect(s.rulings.at(-1)?.kind).toBe('returned');
    expect(s.stages.find((x) => x.id === 'filing')?.status).toBe('returned');
    expect(s.draft?.circumstances).toBe(goodDraft.circumstances);
  });

  it('runs the theft report (JPK): duty desk → investigator → complaint → trial', () => {
    let s = startCase('owner-theft', true, 'theft');
    const step = (input: Input) => (s = act(s.caseId, 'owner-theft', { ...input, clientActionId: `test-action-${++n}` } as CaseActRequest));
    expect(s.kind).toBe('theft');
    expect(s.stages.map((x) => x.id)).toEqual(['report', 'interview', 'complaint', 'trial']);
    step({ type: 'enter', stage: 'report' });
    for (const o of ['purpose', 'written', 'sign-warning', 'imei']) step({ type: 'choose', optionId: o });
    expect(s.result?.score).toBe(100);
    step({ type: 'enter', stage: 'interview' });
    step({ type: 'choose', optionId: 'go-on' }); // the advocate lets the rights go unexplained
    for (const o of ['open', 'read']) step({ type: 'choose', optionId: o });
    expect(s.result?.score).toBe(80);
    step({ type: 'enter', stage: 'complaint' });
    step({ type: 'choose', optionId: 'precise' });
    expect(s.result?.outcomes[0]).toMatchObject({ met: true });
    expect(s.code.articles.some((a) => a.number === '358-modda')).toBe(true);
  });

  /** The criminal trial (JPK 424-473) played as the victim's representative. */
  const trial = (owner: string, picks: string[]) => {
    let s = startCase(owner, true, 'theft');
    const step = (input: Input) => (s = act(s.caseId, owner, { ...input, clientActionId: `test-action-${++n}` } as CaseActRequest));
    step({ type: 'enter', stage: 'trial' });
    const rise = () => {
      // the room asks you to stand or sit (JPK 424, 473): follow it until a choice is offered or the room ends
      for (let i = 0; i < 8 && !s.result && s.options.length === 0; i++) step({ type: 'stand', up: s.await === 'stand' });
    };
    rise();
    for (const o of picks) {
      if (s.options.find((x) => x.id === o)?.kind !== 'act') step({ type: 'stand', up: true });
      step({ type: 'choose', optionId: o });
      rise();
    }
    return s;
  };
  const STRONG = ['no-recusal', 'understood', 'motion-precise', 'order', 'ask-sim', 'object', 'witness-open', 'no-more', 'speech-evidence', 'listen'];

  it('the trial: the prosecution side proves the charge, the verdict is read standing, outcomes are judged', () => {
    const s = trial('owner-trial', STRONG);
    expect(s.result?.score).toBe(100);
    expect(s.result?.verdict).toMatch(/Ayblov hukmi/);
    expect(s.rulings.at(-1)).toMatchObject({ kind: 'judgment', title: 'HUKM' });
    expect(s.result?.outcomes.every((o) => o.met === true)).toBe(true);
    for (const a of ['102-modda', '424-modda', '438-modda', '449-modda', '451-modda', '473-modda']) expect(s.code.articles.some((x) => x.number === a)).toBe(true);
    for (const r of ['prosecutor', 'defender', 'defendant', 'judge', 'secretary', 'witness']) expect(s.parties.some((p) => p.role === r)).toBe(true);
  });

  it('the trial: weak work leaves the charge unproven - the presumption of innocence decides (JPK 462-463)', () => {
    const s = trial('owner-trial-weak', ['no-recusal', 'understood', 'motion-vague', 'order-any', 'ask-leading', 'silent', 'witness-leading', 'save-for-speech', 'speech-new', 'interrupt']);
    expect(s.result?.verdict).toMatch(/Oqlov hukmi/);
    expect(s.rulings.at(-1)?.body.join(' ')).toMatch(/aybsizlik prezumpsiyasi/);
    expect(s.result?.outcomes.some((o) => o.met === false)).toBe(true);
    expect(s.result?.log.find((d) => d.chose.includes('Ha deng'))?.article).toBe('102-modda');
  });

  it('keeps the two cases apart', () => {
    const civil = startCase('owner-both', true, 'labour');
    expect(() => act(civil.caseId, 'owner-both', { type: 'enter', stage: 'report', clientActionId: 'test-wrong-case-1' })).toThrow(/boshqa ishga/);
  });

  it('debriefs every decision and charges hints once per moment', () => {
    const r = run('owner-debrief');
    r.step({ type: 'enter', stage: 'chamber' });
    r.step({ type: 'hint' });
    r.step({ type: 'hint' }); // the same moment: charged once
    expect(r.get().hints).toBe(1);
    expect(r.get().feedback?.article).toBe('203-modda');
    for (const o of ['emotion', 'essence', 'call-witness', 'consult-client']) r.choose(o);
    const res = r.get().result!;
    expect(res.hints).toBe(1);
    expect(res.score).toBe(100 - 5 - 15);
    const bad = res.log.find((d) => d.tone === 'bad')!;
    expect(bad.points).toBe(15);
    expect(bad.better).toMatch(/kasal boʻlgan/);
    expect(res.log).toHaveLength(4);
    expect(res.reflect).toBeTruthy();
  });

  it('charges no state duty for a labour claim (Davlat boji toʻgʻrisida 8-modda)', () => {
    const r = run('owner-duty');
    r.step({ type: 'enter', stage: 'draft' });
    r.step({ type: 'draft', draft: { ...goodDraft, attachments: [...goodDraft.attachments, 'duty'] } });
    expect(r.get().result?.notes.join(' ')).toMatch(/davlat bojidan ozod/);
  });

  it('survives a restart through the store: dump → load continues where it was, without the owner token', () => {
    const r = run('owner-persist');
    r.step({ type: 'enter', stage: 'consult' });
    for (const o of ['greet', 'story']) r.choose(o);
    const id = r.get().caseId;
    const dumped = dumpCase(id)!;
    expect(JSON.stringify(dumped.state)).not.toContain('owner-persist');
    // as if read back from the store into a fresh process
    loadCase('owner-persist', JSON.parse(JSON.stringify(dumped.state)));
    const again = act(id, 'owner-persist', { type: 'choose', optionId: 'docs', clientActionId: 'test-persist-0001' });
    expect(again.facts.map((f) => f.id)).toEqual(expect.arrayContaining(['dismissal', 'sick', 'contract'.replace('contract', 'refused')]));
    expect(() => act(id, 'someone-else', { type: 'choose', optionId: 'job', clientActionId: 'test-persist-0002' })).toThrow(/tegishli emas/);
  });

  it('levels: intermediate hides the options until opened (−10), advanced gives no hints and no notes until the end', async () => {
    let n2 = 0;
    const id = (prefix: string) => `${prefix}-${String(++n2).padStart(6, '0')}`;
    const mid = startCase('owner-mid', true, 'labour', 'intermediate');
    let s2 = act(mid.caseId, 'owner-mid', { type: 'enter', stage: 'chamber', clientActionId: id('mid') });
    expect(s2.level).toBe('intermediate');
    expect(s2.options).toHaveLength(0);
    expect(s2.inputModes).toEqual(['text', 'voice']);
    s2 = act(mid.caseId, 'owner-mid', { type: 'reveal', clientActionId: id('mid') });
    expect(s2.options.length).toBeGreaterThan(0);
    expect(s2.revealed).toBe(true);

    const adv = startCase('owner-adv', true, 'labour', 'advanced');
    let s3 = act(adv.caseId, 'owner-adv', { type: 'enter', stage: 'chamber', clientActionId: id('adv') });
    expect(s3.options).toHaveLength(0);
    expect(() => act(adv.caseId, 'owner-adv', { type: 'hint', clientActionId: id('adv') })).toThrow(/maslahat yoʻq/);
    // an answer in own words lands on the right reply (lexical fallback without the court server)
    const said = 'Hurmatli sud, daʼvogar 9–10-oktabr kunlari uzrsiz kelmagan deb boʻshatilgan, holbuki u kasal boʻlgan. Ishga tiklashni soʻraymiz.';
    s3 = actSaid(adv.caseId, 'owner-adv', { clientActionId: id('adv'), text: said, inputMode: 'voice' }, await understand(adv.caseId, 'owner-adv', said, 'voice'));
    expect(s3.feedback).toBeNull();
    expect(s3.lines.some((l) => l.speaker === 'you')).toBe(true);
    // gibberish: asked again, nothing lost
    const before = s3.lines.length;
    s3 = actSaid(adv.caseId, 'owner-adv', { clientActionId: id('adv'), text: 'bugun havo yaxshi', inputMode: 'text' }, await understand(adv.caseId, 'owner-adv', 'bugun havo yaxshi', 'text'));
    // not understood: what was said stays on record and the person you talk to asks again, out loud
    expect(s3.lines.length).toBe(before + 2);
    expect(s3.lines.at(-2)?.speaker).toBe('you');
    expect(s3.lines.at(-1)?.speaker).not.toBe('you');
    expect(s3.feedback?.tone).toBe('info');
  });
});

describe('v1.5: the AI character and «qaytaring»', () => {
  const say = (caseId: string, owner: string, text: string, extra: Parameters<typeof actSaid>[3]) => actSaid(caseId, owner, { clientActionId: `ai-${++n}`, text, inputMode: 'text' }, extra);

  it('nothing ready fits: the client answers in role through the AI, marked as such', async () => {
    const { npcRequest } = await import('./engine');
    const r = run('owner-ai-1');
    r.step({ type: 'enter', stage: 'consult' });
    const s = r.get();
    const req = npcRequest(s.caseId, 'owner-ai-1', 'Rahbaringiz bilan janjallashganmidingiz?');
    expect(req?.speaker).toBe('client');
    expect(req?.facts.length).toBeGreaterThan(0);
    expect(req?.conversationId).toContain(s.caseId);
    const after = say(s.caseId, 'owner-ai-1', 'Rahbaringiz bilan janjallashganmidingiz?', { optionId: null, clarify: 'x', ethics: false, npc: { req: req!, answer: { kind: 'ok', text: 'Yoʻq, janjallashmaganman.', emotion: 'uncertain', engine: 'llm' } } });
    expect(after.lines.at(-1)).toMatchObject({ speaker: 'client', text: 'Yoʻq, janjallashmaganman.', engine: 'llm', emotion: 'uncertain' });
    expect(after.thinking).toBeNull();
    expect(CaseSnapshotSchema.safeParse(after).success).toBe(true);
  });

  it('while the AI writes, the character thinks; a new move supersedes it', async () => {
    const { npcRequest } = await import('./engine');
    const r = run('owner-ai-2');
    r.step({ type: 'enter', stage: 'consult' });
    const s = r.get();
    const req = npcRequest(s.caseId, 'owner-ai-2', 'Ish beruvchi sizga nima dedi?')!;
    const thinking = say(s.caseId, 'owner-ai-2', 'Ish beruvchi sizga nima dedi?', { optionId: null, clarify: 'x', ethics: false, npc: { req, answer: { kind: 'pending' } } });
    expect(thinking.thinking).toBe('client');
    expect(thinking.lines.at(-1)?.speaker).toBe('you');
    const moved = r.choose(thinking.options[0].id);
    expect(moved.thinking).toBeNull();
  });

  it('«eshitmadim, qaytaring»: the last line again, no points', () => {
    const r = run('owner-ai-3');
    r.step({ type: 'enter', stage: 'consult' });
    const s = r.get();
    const last = [...s.lines].reverse().find((l) => l.speaker === 'client')!;
    const sit = { id: 'repeat', tone: 'info' as const, ethics: false, note: null, action: 'repeat_last', replies: { client: { lines: ['Albatta, qaytaraman.'] } } };
    const again = say(s.caseId, 'owner-ai-3', 'eshitmadim, qaytaring', { optionId: null, clarify: null, ethics: false, situation: sit });
    expect(again.lines.at(-2)?.text).toBe('Albatta, qaytaraman.');
    expect(again.lines.at(-1)?.text).toBe(last.text);
    expect(again.feedback).toBeNull();
  });
});
