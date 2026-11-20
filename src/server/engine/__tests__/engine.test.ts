import { describe, expect, it } from 'vitest';
import { MutationResponseSchema, AssessmentSchema } from '@/contracts';
import { RuleIntentClassifier, normalize } from '../intent';
import { createSession, finish, getReport, getSession, interact, processTurn, saveDocument, toSnapshot, HttpError } from '../session';

const id = () => `c_${Math.random().toString(36).slice(2)}_${Date.now()}`;

async function start(seed = 7, mode: 'tutorial' | 'assessment' = 'tutorial') {
  const s = createSession({ scenarioId: 'dxm-yoqolgan-staj', mode, seed, ownerToken: 'owner-token-1' });
  await interact(s, { clientActionId: id(), action: 'start' });
  await interact(s, { clientActionId: id(), action: 'sit-at-desk' });
  return s;
}
const say = (s: Awaited<ReturnType<typeof start>>, text: string) => processTurn(s, { clientTurnId: id(), text });

describe('intent classifier', () => {
  const c = new RuleIntentClassifier();
  it('normalises apostrophes and Cyrillic', () => {
    expect(normalize('Қайси йилларда ишлагансиз?')).toBe('qaysi yillarda ishlagansiz?');
    expect(normalize('Xoʻjalik')).toBe("xo'jalik");
  });
  it('tags clarifying questions', async () => {
    expect((await c.classify('Qaysi yillarda va qayerda ishlagansiz?', { bribePending: false })).tags.has('ask-work-period')).toBe(true);
    expect((await c.classify('Qoʻlingizda qanday hujjatlar bor?', { bribePending: false })).tags.has('ask-documents')).toBe(true);
  });
  it('only reads bribe answers while a bribe is pending', async () => {
    expect((await c.classify('Yoʻq, rahmat, bu mumkin emas', { bribePending: false })).tags.has('bribe-refuse')).toBe(false);
    expect((await c.classify('Yoʻq, rahmat, bu mumkin emas', { bribePending: true })).tags.has('bribe-refuse')).toBe(true);
    expect((await c.classify('Mayli, qoʻyib keting', { bribePending: true })).tags.has('bribe-accept')).toBe(true);
  });
});

describe('scenario engine', () => {
  it('opens with the complaint and never leaks hidden facts', async () => {
    const s = await start();
    const snap = toSnapshot(s);
    expect(snap.turns).toHaveLength(1);
    expect(snap.facts).toHaveLength(0);
    expect(JSON.stringify(snap)).not.toContain('1991');
  });

  it('unlocks a fact only for the right question, with monotonic sequence', async () => {
    const s = await start();
    const a = await say(s, 'Bugun havo yaxshi ekan');
    expect(a.snapshot.facts).toHaveLength(0);
    const b = await say(s, 'Xavotir olmang. Qaysi yillarda va qayerda ishlagansiz?');
    expect(b.snapshot.facts.map((f) => f.id)).toEqual(['work-period-1991-1998']);
    const seqs = s.events.map((e) => e.sequence);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(MutationResponseSchema.safeParse(b).success).toBe(true);
  });

  it('offers replies without leaking facts and accepts a picked option', async () => {
    const s = await start();
    const before = toSnapshot(s).options;
    expect(before.length).toBeGreaterThan(6);
    expect(before.some((o) => o.text.includes('1991'))).toBe(false); // gated behind the fact
    expect(Object.keys(before[0]).sort()).toEqual(['id', 'kind', 'text']); // no tags / scores on the wire
    const r = await processTurn(s, { clientTurnId: id(), optionId: 'ask-period' });
    expect(r.snapshot.facts.map((f) => f.id)).toEqual(['work-period-1991-1998']);
    expect(r.snapshot.options.some((o) => o.id === 'ask-period')).toBe(false);
    expect(r.snapshot.options.some((o) => o.id === 'route')).toBe(true);
    await expect(processTurn(s, { clientTurnId: id(), optionId: 'ask-period' })).rejects.toMatchObject({ code: 'option_unavailable' });
  });

  it('switches to bribe replies while the envelope is on the desk', async () => {
    const s = await start();
    while (s.bribe.stage === 'none') await processTurn(s, { clientTurnId: id(), optionId: toSnapshot(s).options.find((o) => o.kind === 'ask')!.id });
    const ids = toSnapshot(s).options.map((o) => o.id);
    expect(ids.every((x) => x.startsWith('bribe-'))).toBe(true);
    const r = await processTurn(s, { clientTurnId: id(), optionId: 'bribe-refuse' });
    expect(r.snapshot.objects.envelope).toBe('disabled');
    expect(s.bribe.stage).toBe('refused');
  });

  it('is idempotent for a repeated client turn id', async () => {
    const s = await start();
    const clientTurnId = id();
    const first = await processTurn(s, { clientTurnId, text: 'Assalomu alaykum' });
    const second = await processTurn(s, { clientTurnId, text: 'Assalomu alaykum' });
    expect(second).toBe(first);
    expect(s.turns.filter((t) => t.speaker === 'user')).toHaveLength(1);
  });

  it('hides meters in assessment mode', async () => {
    const s = await start(3, 'assessment');
    expect(toSnapshot(s).meters).toBeNull();
  });

  it('rejects access with the wrong owner token', async () => {
    const s = await start();
    expect(() => getSession(s.id, 'someone-else')).toThrow(HttpError);
    expect(getSession(s.id, 'owner-token-1')).toBe(s);
  });

  it('ends with the citizen leaving when patience runs out', async () => {
    const s = await start();
    for (let i = 0; i < 6 && s.status === 'in-progress'; i++) await say(s, 'Bizda emas, boshqa joyga boring. Vaqtim yoʻq.');
    expect(s.status).toBe('report-ready');
    expect(getReport(s).outcome.id).toBe('poor');
  });

  it('zeroes the score when the bribe is accepted', async () => {
    const s = await start();
    while (s.bribe.stage === 'none') await say(s, 'Tushunaman, davom eting.');
    const r = await say(s, 'Mayli, qoʻyib keting.');
    expect(r.snapshot.status).toBe('report-ready');
    const report = getReport(s);
    expect(report.scoreTotal).toBe(0);
    expect(report.zeroedByEthics).toBe(true);
    expect(report.outcome.id).toBe('failed');
  });

  it('awards an excellent outcome for the ideal path', async () => {
    const s = await start();
    const script = [
      'Assalomu alaykum, Rustam aka. Xavotir olmang, birga koʻrib chiqamiz.',
      'Qaysi yillarda va qayerda ishlagansiz?',
      'Qoʻlingizda qanday hujjatlar bor? Mehnat daftarchangiz bormi?',
      'Oʻsha xoʻjalik hozir faoliyat yuritadimi yoki tugatilganmi?',
      'Avval boshqa idoraga murojaat qilganmisiz?',
      'Demak, staj tasdiqlanmagan. Arxivga maʼlumotnoma uchun soʻrov yuboramiz.',
      'Kerakli hujjatlar: pasport va daftarcha rasmlari. Javob 15 ish kuni ichida keladi, SMS orqali xabar beramiz.',
    ];
    for (const line of script) {
      if (s.bribe.stage === 'offered' || s.bribe.stage === 'pushed') {
        await say(s, 'Yoʻq, rahmat, Rustam aka. Bu mumkin emas — xizmat bepul, belgilangan tartibda koʻrsatiladi.');
      }
      await say(s, line);
    }
    if (s.bribe.stage === 'offered') await say(s, 'Pulingizni oling, bu noqonuniy. Xizmat bepul.');
    expect(s.unlocked.size).toBe(4);
    await saveDocument(s, {
      clientActionId: id(),
      submit: true,
      draft: {
        service: 'archive-reference',
        applicantName: 'Rustam aka',
        periodFrom: '1991',
        periodTo: '1998',
        employer: 'Jamoa xoʻjaligi (tugatilgan)',
        evidence: ['passport', 'workbook-photos', 'employer-details'],
        nextStep: 'Arxiv javobi kelgach, stajni qayta hisoblash uchun murojaat qilinadi.',
        notify: 'sms',
      },
    });
    await finish(s, { clientActionId: id() });
    const report = getReport(s);
    expect(AssessmentSchema.safeParse(report).success).toBe(true);
    expect(report.outcome.id).toBe('excellent');
    expect(report.scoreTotal).toBeGreaterThanOrEqual(90);
    expect(report.criteria.reduce((n, c) => n + c.max, 0)).toBe(100);
    // "Manba boʻlmasa, modda yoʻq": nothing is presented as verified.
    for (const f of report.feedback) for (const src of f.sources) {
      expect(src.articleNumber).toBeUndefined();
      expect(src.verifiedAt).toBeNull();
    }
  });
});
