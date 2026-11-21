import { describe, expect, it } from 'vitest';
import type { CaseActRequest, ClaimDraft } from '@/contracts/case';
import { CaseSnapshotSchema } from '@/contracts/case';
import { act, actSaid, dumpCase, loadCase, startCase } from './engine';
import { understand } from './understand';

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

const goodDraft: ClaimDraft = {
  court: 'district', representative: true, respondent: 'company', demand: 'reinstate',
  facts: ['dismissal', 'explanation', 'sick', 'notified', 'refused', 'witness', 'employer'], evidence: ['order', 'contract', 'sickleave', 'warrant'],
  pretrial: false, email: true, attachments: ['order', 'contract', 'sickleave', 'warrant', 'receipt'], copies: 1, signed: true,
};

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
    expect(s.draft?.facts).not.toContain('witness');
  });

  it('runs the theft report (JPK): duty desk → investigator → complaint', () => {
    let s = startCase('owner-theft', true, 'theft');
    const step = (input: Input) => (s = act(s.caseId, 'owner-theft', { ...input, clientActionId: `test-action-${++n}` } as CaseActRequest));
    expect(s.kind).toBe('theft');
    expect(s.stages.map((x) => x.id)).toEqual(['report', 'interview', 'complaint']);
    step({ type: 'enter', stage: 'report' });
    for (const o of ['purpose', 'written', 'sign-warning', 'imei']) step({ type: 'choose', optionId: o });
    expect(s.result?.score).toBe(100);
    step({ type: 'enter', stage: 'interview' });
    step({ type: 'choose', optionId: 'go-on' }); // the advocate lets the rights go unexplained
    for (const o of ['open', 'read']) step({ type: 'choose', optionId: o });
    expect(s.result?.score).toBe(80);
    step({ type: 'enter', stage: 'complaint' });
    step({ type: 'choose', optionId: 'precise' });
    expect(s.result?.verdict).toMatch(/Shikoyat qabul qilindi/);
    expect(s.code.articles.some((a) => a.number === '358-modda')).toBe(true);
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
