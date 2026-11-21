/**
 * First-instance civil hearing, conducted by the student as presiding judge.
 *
 * SERVER ONLY. The ORDER of the hearing and the article behind every step
 * come from the Civil Procedure Code as published on lex.uz (see
 * `law/fpk-hearing.json`, built from the verified research pack). The case
 * itself — parties, names, what they say — is invented for training and is
 * labelled as such; no substantive ruling is given.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { HearingLine, HearingSnapshot, Speaker } from '@/contracts/hearing';
import { HttpError } from '../engine/session';
import law from '../law/fpk-hearing.json';
import { pack, unpack } from '@/server/durable';

interface Step {
  id: string;
  label: string;
  /** Number of the governing article, as printed in the Code. */
  article: string;
  /** What the presiding judge says / does. */
  action: string;
  then: [Speaker, string][];
  effect?: 'witness-out' | 'witness-in';
}

const STEPS: Step[] = [
  { id: 'open', label: 'Sud majlisini ochish', article: '210-modda',
    action: 'Sud majlisini ochiq deb eʼlon qilaman. Sardor N.ning «Namuna Savdo» MChJga nisbatan ishga tiklash toʻgʻrisidagi daʼvosi boʻyicha fuqarolik ishi koʻriladi.',
    then: [['system', 'Zalda hozir boʻlganlar oʻrinlariga oʻtirdi.']] },
  { id: 'attendance', label: 'Kelgan-kelmaganlikni tekshirish', article: '213-modda',
    action: 'Sud majlisi kotibi, ish boʻyicha chaqirilganlardan kimlar kelganini sudga maʼlum qiling.',
    then: [['secretary', 'Hurmatli sud! Daʼvogar Sardor N., javobgar vakili Dilnoza T. va guvoh Bahodir R. kelgan. Chaqiruv qogʻozlari barchaga topshirilgan.'], ['system', 'Sud kelganlarning shaxsini aniqladi va vakilning vakolatini tekshirdi.']] },
  { id: 'witness-out', label: 'Guvohni zaldan chiqarish', article: '215-modda', effect: 'witness-out',
    action: 'Guvoh, soʻroq qilingunga qadar sud majlisi zalidan chiqib turing.',
    then: [['system', 'Guvoh zaldan chiqdi.']] },
  { id: 'composition', label: 'Sud tarkibini eʼlon qilish, rad qilish huquqi', article: '216-modda',
    action: 'Sud tarkibini eʼlon qilaman: ishda raislik qiluvchi sudya va sud majlisi kotibi ishtirok etmoqda. Sizlar rad qilish toʻgʻrisida ariza berishga haqlisiz. Rad qilish toʻgʻrisida arizalar bormi?',
    then: [['claimant', 'Hurmatli sud, rad qilish toʻgʻrisida arizam yoʻq.'], ['respondent', 'Hurmatli sud, bizda ham yoʻq.']] },
  { id: 'rights', label: 'Huquq va majburiyatlarni tushuntirish', article: '217-modda',
    action: 'Ishda ishtirok etuvchi shaxslarga protsessual huquq va majburiyatlarini tushuntiraman. Huquq va majburiyatlaringiz tushunarlimi?',
    then: [['claimant', 'Tushunarli, hurmatli sud.'], ['respondent', 'Tushunarli.'], ['system', 'Bu haqda sud majlisining bayonnomasida koʻrsatildi.']] },
  { id: 'motions', label: 'Iltimosnomalarni hal qilish', article: '219-modda',
    action: 'Ishni muhokama qilish bilan bogʻliq iltimosnomalaringiz bormi?',
    then: [['respondent', 'Hurmatli sud, ishga qoʻshimcha hujjat nusxasini qoʻshishni soʻrayman.'], ['claimant', 'Hurmatli sud, eʼtirozim yoʻq.'], ['system', 'Sud boshqa tarafning fikrini eshitib, iltimosnomani ajrim bilan hal qildi.']] },
  { id: 'report', label: 'Ishni mazmunan koʻrishni boshlash', article: '225-modda',
    action: 'Ish toʻgʻrisida maʼruza qilaman. Daʼvogar, talablaringizni quvvatlaysizmi? Javobgar, daʼvogarning talablarini tan olasizmi? Taraflar ishni kelishuv bitimi bilan tamomlashni istaydimi?',
    then: [['claimant', 'Hurmatli sud, talablarimni toʻliq quvvatlayman.'], ['respondent', 'Hurmatli sud, talablarni tan olmaymiz. Kelishuv bitimi tuzish niyatimiz yoʻq.']] },
  { id: 'explanations', label: 'Taraflarning tushuntirishlari', article: '227-modda',
    action: 'Tushuntirishlarni eshitamiz: avval daʼvogar, soʻngra javobgar vakili. Daʼvogar, marhamat.',
    then: [['claimant', 'Hurmatli sud! Men korxonada besh yil ishladim. Mehnat shartnomam bekor qilinganidan noroziman, shu sababli sudga murojaat qildim.'], ['respondent', 'Hurmatli sud! Javobgar shartnoma belgilangan tartibda bekor qilingan deb hisoblaydi.']] },
  { id: 'evidence-order', label: 'Dalillarni tekshirish tartibini belgilash', article: '228-modda',
    action: 'Sud dalillarni tekshirish tartibini belgilaydi: avval guvoh soʻroq qilinadi, soʻngra yozma dalillar tekshiriladi.',
    then: [] },
  { id: 'witness', label: 'Guvohni soʻroq qilish', article: '229-modda', effect: 'witness-in',
    action: 'Guvohni zalga taklif qiling. Guvoh, shaxsingizni va ishga aloqangizni aniqlaymiz; bila turib yolgʻon koʻrsatuv berganlik uchun javobgarlik toʻgʻrisida ogohlantirilasiz.',
    then: [['witness', 'Hurmatli sud, men daʼvogar bilan bir boʻlimda ishlaganman. Bilganlarimni aytib beraman.'], ['system', 'Guvoh soʻroq qilindi, yozma dalillar tekshirildi.']] },
  { id: 'completion', label: 'Mazmunan muhokamani tamomlash', article: '243-modda',
    action: 'Barcha dalillar tekshirildi. Ish materiallarini biror narsa bilan toʻldirish istagi bormi? Bunday arzlar boʻlmasa, ishni mazmunan muhokama qilish tamom boʻldi deb eʼlon qilaman.',
    then: [['claimant', 'Yoʻq, hurmatli sud.'], ['respondent', 'Yoʻq.']] },
  { id: 'debates', label: 'Sud muzokaralari', article: '244-modda',
    action: 'Sud muzokaralarini eshitishga oʻtamiz. Dastlab daʼvogar, keyin javobgar vakili soʻzga chiqadi.',
    then: [['claimant', 'Hurmatli sud, sud majlisida tekshirilgan dalillarga asoslanib, daʼvoni qanoatlantirishingizni soʻrayman.'], ['respondent', 'Hurmatli sud, daʼvoni rad etishingizni soʻrayman.']] },
  { id: 'deliberation', label: 'Maslahatxonaga kirish', article: '247-modda',
    action: 'Sud hal qiluv qarorini qabul qilish uchun maslahatxonaga chiqadi.',
    then: [['system', 'Zaldagilar oʻrnidan turdi. Sud maslahatxonaga chiqdi.']] },
  { id: 'judgment', label: 'Hal qiluv qarorini oʻqib eshittirish', article: '248-modda',
    action: 'Sudning hal qiluv qarorini oʻqib eshittiraman. Sud majlisining bayonnomasi bilan tanishish hamda qaror ustidan shikoyat qilish tartibi va muddatini tushuntiraman. Ushbu ish boʻyicha sud majlisini yopiq deb eʼlon qilaman.',
    then: [['system', 'Oʻquv mashqi: qarorning mazmuni keltirilmaydi — mashq sud majlisining protsessual tartibiga bagʻishlangan.']] },
];

const articleOf = (number: string) => law.articles.find((a) => a.number === number)!;
for (const step of STEPS) if (!articleOf(step.article)) throw new Error(`hearing step ${step.id}: ${step.article} missing from law store`);

interface Hearing {
  id: string;
  owner: string;
  seed: number;
  index: number;
  attempts: number[];
  lines: HearingLine[];
  feedback: HearingSnapshot['feedback'];
  witnessPresent: boolean;
  processed: Map<string, HearingSnapshot>;
  createdAt: number;
}

const g = globalThis as unknown as { __lexsimHearings?: Map<string, Hearing> };
const hearings = (g.__lexsimHearings ??= new Map());

function shuffled<T>(items: T[], seed: number): T[] {
  let state = seed | 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return items.map((item) => ({ item, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.item);
}

/** The right action plus three real actions that belong to other moments of the hearing. */
function optionsFor(h: Hearing) {
  if (h.index >= STEPS.length) return [];
  const mix = h.seed ^ Math.imul(h.index + 1, 0x9e3779b1);
  const later = shuffled(STEPS.slice(h.index + 1), mix);
  const earlier = shuffled(STEPS.slice(0, h.index), mix + 1);
  const distractors = [...later.slice(0, 2), ...earlier.slice(0, 1), ...later.slice(2), ...earlier.slice(1)].slice(0, 3);
  return shuffled([STEPS[h.index], ...distractors], mix + 2).map((s) => ({ id: s.id, text: s.action }));
}

function snapshot(h: Hearing): HearingSnapshot {
  const finished = h.index >= STEPS.length;
  return {
    hearingId: h.id,
    caseTitle: 'Ishga tiklash toʻgʻrisidagi daʼvo',
    caseNote: 'Ish holatlari va ishtirokchilar oʻquv uchun toʻqilgan. Majlis tartibi va moddalar matni - Fuqarolik protsessual kodeksidan (lex.uz).',
    parties: [
      { role: 'judge', label: 'Raislik qiluvchi', name: 'Siz' },
      { role: 'secretary', label: 'Sud majlisi kotibi', name: 'Malika S.' },
      { role: 'claimant', label: 'Daʼvogar', name: 'Sardor N.' },
      { role: 'respondent', label: 'Javobgar vakili', name: 'Dilnoza T.' },
      { role: 'witness', label: 'Guvoh', name: 'Bahodir R.' },
    ],
    code: { title: law.title, url: law.url, edition: law.edition, retrievedAt: law.retrievedAt, articles: law.articles },
    total: STEPS.length,
    done: STEPS.slice(0, h.index).map((s, i) => ({ label: s.label, article: s.article, attempts: h.attempts[i] })),
    lines: h.lines,
    options: optionsFor(h),
    feedback: h.feedback,
    witnessPresent: h.witnessPresent,
    finished,
    score: finished ? Math.round((h.attempts.filter((a) => a === 1).length / STEPS.length) * 100) : null,
  };
}

export function createHearing(owner: string): HearingSnapshot {
  for (const [id, h] of hearings) if (h.createdAt < Date.now() - 6 * 3600_000) hearings.delete(id);
  const h: Hearing = {
    id: `crt_${randomBytes(12).toString('base64url')}`,
    owner,
    seed: randomBytes(4).readUInt32LE(0),
    index: 0,
    attempts: [],
    lines: [{ id: 'l_0', speaker: 'system', text: 'Tayinlangan vaqt boʻldi. Siz majlis zaliga kirdingiz - hozir boʻlganlar oʻrnidan turdi.' }],
    feedback: null,
    witnessPresent: true,
    processed: new Map(),
    createdAt: Date.now(),
  };
  hearings.set(h.id, h);
  return snapshot(h);
}

/** The hearing as a stored document (without its owner; the last answers kept for idempotency). */
export function dumpHearing(id: string): unknown | null {
  const h = hearings.get(id);
  if (!h) return null;
  const { owner: _owner, processed, ...rest } = h;
  void _owner;
  return pack({ ...rest, processed: new Map([...processed].slice(-8)) });
}
export function loadHearing(owner: string, raw: unknown): boolean {
  const h = unpack<Omit<Hearing, 'owner'>>(raw);
  if (!h || typeof h !== 'object' || !h.id || !(h.processed instanceof Map)) return false;
  hearings.set(h.id, { ...h, owner });
  return true;
}
export const hasHearing = (id: string) => hearings.has(id);

function owned(id: string, owner: string | undefined): Hearing {
  const h = hearings.get(id);
  if (!h) throw new HttpError(404, 'hearing_not_found', 'Sud majlisi topilmadi yoki muddati tugagan');
  const a = Buffer.from(h.owner);
  const b = Buffer.from(owner ?? '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(403, 'forbidden', 'Bu majlis sizga tegishli emas');
  return h;
}

export const getHearing = (id: string, owner: string | undefined) => snapshot(owned(id, owner));

export function act(id: string, owner: string | undefined, input: { clientActionId: string; optionId: string }): HearingSnapshot {
  const h = owned(id, owner);
  const cached = h.processed.get(input.clientActionId);
  if (cached) return cached;
  const step = STEPS[h.index];
  if (!step) throw new HttpError(409, 'hearing_finished', 'Sud majlisi yopilgan');
  if (!optionsFor(h).some((o) => o.id === input.optionId)) throw new HttpError(422, 'option_unavailable', 'Bu harakat hozir mavjud emas');

  h.attempts[h.index] = (h.attempts[h.index] ?? 0) + 1;
  if (input.optionId === step.id) {
    const say = (speaker: Speaker, text: string) => h.lines.push({ id: `l_${h.lines.length}`, speaker, text });
    say('judge', step.action);
    for (const [speaker, text] of step.then) say(speaker, text);
    if (step.effect === 'witness-out') h.witnessPresent = false;
    if (step.effect === 'witness-in') h.witnessPresent = true;
    h.feedback = { correct: true, message: step.label, article: step.article };
    h.index += 1;
  } else {
    const chosen = STEPS.findIndex((s) => s.id === input.optionId);
    const where = chosen > h.index ? 'Hali erta: bu harakat majlisning keyingi qismiga tegishli.' : 'Bu bosqich allaqachon oʻtdi.';
    // The governing article is named only after a second miss — first, think.
    const hint = h.attempts[h.index] >= 2 ? ` Kodeksga qarang: ${step.article} — «${articleOf(step.article).title}».` : ' Kodeksni ochib, tartibni tekshiring.';
    h.feedback = { correct: false, message: where + hint, article: h.attempts[h.index] >= 2 ? step.article : null };
  }
  const result = snapshot(h);
  h.processed.set(input.clientActionId, result);
  return result;
}
