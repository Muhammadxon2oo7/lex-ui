/**
 * "Ish yoʻli": Sardor N. v «Namuna Savdo» MChJ — ishga tiklash.
 *
 * SERVER ONLY. One fictional labour case, five rooms; the student may start
 * in any of them (earlier stages are then taken from a prepared case file).
 * The PROCEDURE and every article cited come from the Civil Procedure Code
 * (FPK) as published on lex.uz (`law/fpk-case.json`). People, dates and the
 * outcome are invented for training; substantive labour law is not cited
 * because it is not in the verified pack — "Manba boʻlmasa, modda yoʻq".
 *
 * Each stage is a handful of decisions, not a questionnaire: 3–4 moments,
 * at most four replies on screen at once.
 */
import { norm, PEOPLE } from '@/lib/labourCase';
import type { Emotion } from '@/contracts';
import type { CaseSnapshot, CaseSpeaker, ClaimDraft, StageId } from '@/contracts/case';

export type Mood = CaseSnapshot['scene']['clientMood'];
/** A spoken line; the optional patch changes the room as the line begins (people rise, enter, sit). */
export type Line = [CaseSpeaker, string, (Partial<CaseSnapshot['scene']> & { emotion?: Emotion })?];
export type Scene = CaseSnapshot['scene'];

export interface CaseView {
  knows: (id: string) => boolean;
  draft: CaseSnapshot['draft'];
  strength: number;
}

export interface Effect {
  learn?: string[];
  /** Points off this stage's score (0–100), with the reason shown in the result. */
  penalty?: [number, string];
  mood?: Mood;
  scene?: Partial<Scene>;
  /** Strength of the claimant's case at the hearing. */
  strength?: number;
}

export interface Opt {
  id: string;
  text: string;
  kind?: 'say' | 'act';
  requires?: string[];
  hideIf?: string[];
  once?: boolean;
  reply?: Line[] | ((c: CaseView) => Line[]);
  next?: string;
  effect?: Effect;
  tone?: 'good' | 'bad' | 'info';
  feedback?: string;
  article?: string;
}

export interface Node {
  id: string;
  enter?: Line[] | ((c: CaseView) => Line[]);
  options?: Opt[];
  await?: 'stand' | 'sit' | 'draft';
  then?: string;
  goto?: (c: CaseView) => string;
  scene?: Partial<Scene>;
  end?: boolean;
}

export interface StageDef {
  id: StageId;
  number: number;
  title: string;
  place: string;
  goal: string;
  start: string;
  nodes: Node[];
  /** The question to think over in the debrief. */
  reflect?: string;
}

/** Everything the engine needs to run one case. */
export interface CaseBookShape {
  kind: 'labour' | 'theft';
  CASE: { title: string; note: string; parties: { role: CaseSpeaker; label: string; name: string; voice?: 'elder_m' | 'male' | 'female' | 'female_alt' }[] };
  FACTS: Record<string, { label: string; detail: string; key?: boolean }>;
  EVIDENCE: Record<string, { label: string; detail: string; requires: string }>;
  PREPARED: { known: string[]; draft: ClaimDraft | null };
  STAGES: StageDef[];
  STAGE_ARTICLES: Partial<Record<StageId, string[]>>;
  won: (c: CaseView) => boolean;
  /** The outcome line shown in the last room's result (null = none). */
  verdict: (c: CaseView) => string | null;
}

export const CASE = {
  title: 'Sardor N. - «Namuna Savdo» MChJ: ishga tiklash',
  note: 'Ish holatlari, ismlar, sanalar va natija oʻquv uchun toʻqilgan. Protsessual tartib va moddalar matni - Fuqarolik protsessual kodeksidan (lex.uz). Mehnat kodeksi normalari bu mashqda baholanmaydi.',
  parties: [
    { role: 'you' as const, label: 'Daʼvogar vakili (advokat)', name: 'Siz' },
    { role: 'client' as const, label: 'Daʼvogar', name: 'Sardor N.', voice: 'male' as const },
    { role: 'clerk' as const, label: 'Sud devonxonasi', name: 'Gulnora A.', voice: 'female' as const },
    { role: 'judge' as const, label: 'Sudya', name: 'B. Islomov', voice: 'elder_m' as const },
    { role: 'secretary' as const, label: 'Sud majlisi kotibi', name: 'Malika S.', voice: 'female' as const },
    { role: 'respondent' as const, label: 'Javobgar vakili', name: 'Dilnoza T.', voice: 'female_alt' as const },
    { role: 'witness' as const, label: 'Guvoh', name: 'Bahodir R.', voice: 'male' as const },
  ],
};

export const FACTS: Record<string, { label: string; detail: string; key?: boolean }> = {
  dismissal: { label: 'Boʻshatish buyrugʻi 14-oktabr', detail: '«Ishga uzrsiz kelmagani uchun» - 9 va 10-oktabr kunlari.', key: true },
  sick: { label: '9-10-oktabr kunlari kasal boʻlgan', detail: 'Poliklinika kasallik varaqasi bergan.', key: true },
  notified: { label: 'Boshligʻiga telefonda xabar bergan', detail: '9-oktabr ertalab boʻlim boshligʻiga qoʻngʻiroq qilgan.', key: true },
  refused: { label: 'Kadrlar varaqani qabul qilmagan', detail: '13-oktabr kuni varaqani topshirmoqchi boʻlgan, qabul qilinmagan.', key: true },
  witness: { label: 'Guvoh: hamkasbi Bahodir R.', detail: 'Qoʻngʻiroq paytida boshliq yonida boʻlgan.', key: true },
  employer: { label: 'Javobgar: «Namuna Savdo» MChJ', detail: 'Namuna tumanida roʻyxatdan oʻtgan; besh yil omborchi, oyligi 4,2 mln soʻm.', key: true },
  authority: { label: 'Advokatlik shartnomasi tuzildi', detail: 'Sudda daʼvogar nomidan ish yuritish vakolati (FPK 67, 68).', key: true },
  explanation: { label: 'Yozma tushuntirish talab qilinmagan', detail: 'Intizomiy jazodan oldin ish beruvchi yozma tushuntirish talab qilishi shart (Mehnat kodeksi 313-modda).', key: true },
  served: { label: 'Buyruq nusxasi 14-oktabrda berilgan', detail: 'Ishga tiklash nizosi boʻyicha sudga murojaat muddati - shu kundan uch oy (Mehnat kodeksi 560-modda).', key: true },
};

export const EVIDENCE: Record<string, { label: string; detail: string; requires: string }> = {
  order: { label: 'Boʻshatish buyrugʻi nusxasi', detail: '14-oktabrdagi buyruq.', requires: 'order' },
  contract: { label: 'Mehnat shartnomasi', detail: 'Omborchi lavozimi.', requires: 'contract' },
  sickleave: { label: 'Kasallik varaqasi', detail: '9-10-oktabr kunlari uchun.', requires: 'sickleave' },
  warrant: { label: 'Advokat orderi', detail: 'Advokatning vakolati order bilan tasdiqlanadi (FPK 68; «Advokatlik faoliyatining kafolatlari…» Qonun, 4-modda).', requires: 'authority' },
};

export const ATTACHMENTS: Record<string, { label: string; requires?: string; trap?: string }> = {
  order: { label: 'Boʻshatish buyrugʻi nusxasi', requires: 'order' },
  contract: { label: 'Mehnat shartnomasi nusxasi', requires: 'contract' },
  sickleave: { label: 'Kasallik varaqasi nusxasi', requires: 'sickleave' },
  warrant: { label: 'Advokat orderi (vakolat hujjati)', requires: 'authority' },
  // a worker suing over the employment relation pays no state duty (Law «Davlat boji toʻgʻrisida», art. 8, item 1); postage is still paid (FPK 191)
  receipt: { label: 'Pochta xarajatlari toʻlanganligi kvitansiyasi' },
  duty: { label: 'Davlat boji toʻlanganligi kvitansiyasi', trap: 'Xodim mehnat munosabatlaridan kelib chiqadigan talab boʻyicha davlat bojidan ozod («Davlat boji toʻgʻrisida»gi Qonun, 8-modda 1-band) — kvitansiya kerak emas.' },
  passport: { label: 'Daʼvogar pasportining asli', trap: 'Asl shaxsiy hujjat ilova qilinmaydi — FPK 191-moddada sanalgan hujjatlarga kirmaydi.' },
  tax: { label: 'Korxonaning soliq hisobotlari', trap: 'Ishga aloqasi yoʻq hujjat (FPK 72).' },
};

/** What a student who starts later in the case finds in the prepared file. */
export const PREPARED = {
  known: ['dismissal', 'sick', 'notified', 'refused', 'witness', 'employer', 'authority', 'explanation', 'served', 'order', 'contract', 'sickleave'],
  draft: {
    court: { type: 'civil', district: 'Namuna' },
    claimant: { name: PEOPLE.claimant.name, address: PEOPLE.claimant.address },
    representative: { name: 'Advokat (siz)', address: `${PEOPLE.firm.name}, ${PEOPLE.firm.address}` },
    respondent: { name: PEOPLE.employer.short, address: PEOPLE.employer.address },
    demand: '1) daʼvogarni avvalgi lavozimiga — omborchi lavozimiga tiklashni; 2) majburiy progul vaqti uchun oʻrtacha ish haqini javobgardan undirishni soʻrayman.',
    circumstances: 'Daʼvogar javobgar tashkilotda besh yil omborchi boʻlib ishlagan. 2026-yil 14-oktabrdagi 47-k-sonli buyruq bilan 9 va 10-oktabr kunlari uzrsiz ishda boʻlmagan deb mehnat shartnomasi bekor qilingan. Mehnat kodeksining 313-moddasiga zid ravishda undan yozma tushuntirish talab qilinmagan. Biroq daʼvogar oʻsha kunlari kasal boʻlgan, unga mehnatga layoqatsizlik varaqasi berilgan. 9-oktabr ertalab u boʻlim boshligʻiga telefon orqali xabar bergan, buni guvoh Bahodir R. tasdiqlaydi. 13-oktabr kuni varaqa kadrlar boʻlimida qabul qilinmagan.',
    evidence: ['order', 'contract', 'sickleave', 'warrant'],
    pretrial: 'none', email: 'advokat@namuna-byuro.uz', attachments: ['order', 'contract', 'sickleave', 'warrant', 'receipt'], copies: 1, date: '2026-11-20', signed: true,
    order: { number: '1', firm: PEOPLE.firm.name, firmAddress: `${PEOPLE.firm.address}, tel. ${PEOPLE.firm.phone}`, advocate: 'Advokat (siz)', license: `${PEOPLE.license.number}, ${PEOPLE.license.issued}, ${PEOPLE.license.by}`, specialty: 'civil-economic', basis: 'contract', basisDate: PEOPLE.agreement.date, client: PEOPLE.claimant.name, caseType: 'civil', issued: '2026-yil 20-noyabr', signed: true },
  } satisfies ClaimDraft,
};

const consult: StageDef = {
  id: 'consult',
  number: 1,
  title: 'Mijoz bilan maslahat',
  place: 'Advokatlik byurosi',
  goal: 'Holatlar va dalillarni aniqlang, vakolatni rasmiylashtiring.',
  reflect: 'Qaysi savolingiz ishning taqdirini hal qildi? Qaysi holatni bilmay qolsangiz, sudda nima boʻlardi?',
  start: 'c-hub',
  nodes: [
    {
      id: 'c-hub',
      enter: [['client', 'Assalomu alaykum. Meni ishdan boʻshatishdi… Nima qilishni bilmayapman.', { emotion: 'upset' }]],
      options: [
        { id: 'greet', once: true, text: 'Va alaykum assalom. Oʻtiring, xotirjam gapiring - suhbatimiz sir saqlanadi.',
          reply: [['client', 'Rahmat… Kechadan beri uxlay olmadim.', { emotion: 'uncertain' }]], effect: { mood: 'calm' }, tone: 'good' },
        { id: 'story', once: true, text: 'Nima boʻlganini boshidan aytib bering.',
          reply: [['client', '14-oktabr kuni buyruq bilan boʻshatishdi: 9–10-oktabr ishga kelmagansan, deb. Lekin oʻsha kunlari kasal edim, boshligʻimga telefon qilib aytganman.']],
          effect: { learn: ['dismissal', 'sick', 'notified', 'order'], mood: 'uncertain' }, tone: 'good' },
        { id: 'docs', once: true, text: 'Qoʻlingizda qanday hujjatlar bor?',
          reply: [['client', 'Mehnat shartnomam, buyruq nusxasi va kasallik varaqasi. Varaqani kadrlarga olib borgandim — olishmadi.']],
          effect: { learn: ['contract', 'order', 'sickleave', 'refused'] }, tone: 'good' },
        { id: 'witness', once: true, requires: ['notified'], text: 'Qoʻngʻiroq qilganingizni kim tasdiqlay oladi?',
          reply: [['client', 'Hamkasbim Bahodir aka. U oʻshanda boshliqning yonida edi.']], effect: { learn: ['witness'] }, tone: 'good' },
        { id: 'job', once: true, text: 'Ish beruvchingiz, lavozimingiz va oyligingiz qanday?',
          reply: [['client', '«Namuna Savdo» MChJ, Namuna tumanida. Besh yil omborchi boʻldim, oyligim 4,2 million.']], effect: { learn: ['employer'] }, tone: 'good' },
        { id: 'explain-letter', once: true, requires: ['dismissal'], text: 'Boʻshatishdan oldin sizdan yozma tushuntirish soʻrashganmi?',
          reply: [['client', 'Yoʻq. Hech narsa soʻrashmadi — toʻgʻridan-toʻgʻri buyruq chiqarishdi.']], effect: { learn: ['explanation'] }, tone: 'good',
          feedback: 'Mehnat kodeksi 313-modda: ish beruvchi intizomiy jazo qoʻllanguniga qadar xodimdan yozma tushuntirish talab qilishi shart. Bu - muhim dalil.' },
        { id: 'served', once: true, requires: ['dismissal'], text: 'Buyruq nusxasini qachon qoʻlingizga berishdi?',
          reply: [['client', '14-oktabrning oʻzida berishdi, imzo qoʻydirib.']], effect: { learn: ['served'] }, tone: 'good',
          feedback: 'Mehnat kodeksi 560-modda: ishga tiklash nizolari boʻyicha sudga murojaat muddati - buyruq nusxasi topshirilgan kundan uch oy. 14-oktabrdan hisoblaganda muddat oʻtmagan.' },
        { id: 'authority', once: true, text: 'Sizni sudda himoya qilishim uchun shartnoma tuzamiz, advokat orderi rasmiylashtiriladi.',
          reply: [['client', 'Roziman. Qayerga imzo qoʻyay?']], effect: { learn: ['authority'] }, tone: 'good', article: '67-modda',
          feedback: 'FPK 67-68: sudda professional vakil - advokat; vakolati belgilangan tartibda tasdiqlanadi.' },
        { id: 'promise', once: true, text: 'Xavotir olmang, yuz foiz yutamiz - kafolat beraman.',
          reply: [['client', 'Rostdanmi?! Unda xotirjam boʻldim…', { emotion: 'reassured' }]], effect: { penalty: [15, 'Natijani kafolatladingiz — qarorni sud qabul qiladi'] },
          tone: 'bad', feedback: 'Advokat natijani kafolatlay olmaydi. Imkoniyat va xavflarni halol ayting.' },
        { id: 'connections', once: true, text: 'Sudda tanishlarim bor, ish tez hal boʻladi.',
          reply: [['client', 'Yoʻq… Men bunday ishlarga aralashmayman. Qonun boʻyicha qilaylik.', { emotion: 'upset' }]], effect: { mood: 'upset', penalty: [40, 'Korrupsion ishora'] },
          tone: 'bad', feedback: 'Sudga taʼsir oʻtkazishga ishora - korrupsiya. Mutlaqo mumkin emas.' },
        { id: 'finish', requires: ['authority'], text: 'Hujjatlar nusxasini olib qolaman. Ariza tayyor boʻlgach qoʻngʻiroq qilaman.',
          reply: [['client', 'Katta rahmat. Sizga ishonaman.', { emotion: 'reassured' }]], next: 'c-end', tone: 'info' },
      ],
    },
    { id: 'c-end', end: true },
  ],
};

const draft: StageDef = {
  id: 'draft',
  number: 2,
  title: 'Daʼvo arizasini tuzish',
  place: 'Hujjatlar',
  goal: 'FPK 189-191 boʻyicha arizani tuzing va imzolang.',
  reflect: 'Arizangizdagi eng kuchli holat va dalil qaysi? Javobgar unga qanday eʼtiroz bildirishi mumkin?',
  start: 'd-form',
  nodes: [
    { id: 'd-form', await: 'draft', then: 'd-end' },
    { id: 'd-end', enter: [['system', 'Ariza chop etildi va ilovalar bilan papkaga solindi.']], end: true },
  ],
};

const filing: StageDef = {
  id: 'filing',
  number: 3,
  title: 'Arizani sudga topshirish',
  place: 'Sud devonxonasi',
  goal: 'Arizani roʻyxatdan oʻtkazing va sudya ajrimini oling.',
  reflect: 'Qaysi kamchilik arizani qaytarishga asos boʻlardi (FPK 195), qaysi biri esa faqat ishni zaiflashtiradi?',
  start: 'f-hello',
  nodes: [
    {
      id: 'f-hello',
      enter: [['clerk', 'Assalomu alaykum. Qanday masalada keldingiz?']],
      options: [
        { id: 'purpose', text: 'Advokatman. Sardor N.ning ishga tiklash toʻgʻrisidagi daʼvo arizasini topshirmoqchiman.',
          reply: [['clerk', 'Ariza, javobgar uchun nusxa, ilovalar va vakolat hujjatingizni bering.']], next: 'f-hand', tone: 'good' },
        { id: 'judge-first', text: 'Avval sudyaning oʻziga kirib, ishni tushuntirsam boʻladimi?',
          reply: [['clerk', 'Arizalar devonxona orqali roʻyxatdan oʻtadi. Qabul qilish masalasini sudya yakka tartibda hal qiladi.']],
          effect: { penalty: [15, 'Arizadan oldin sudyaga shaxsan kirishga urindingiz'] }, tone: 'bad', article: '192-modda' },
        { id: 'gift', text: '(papkaga konvert qoʻyib) Bu sizga… ish tezroq yursin.',
          reply: [['clerk', 'Olib qoʻying! Buni qabul qilmayman.', { emotion: 'upset' }]], effect: { penalty: [40, 'Pora taklifi'] }, tone: 'bad', feedback: 'Pora taklifi - jinoyat.' },
      ],
    },
    {
      id: 'f-hand',
      options: [
        { id: 'hand', kind: 'act', text: 'Hujjatlar papkasini uzatish',
          reply: (c) => [
            ...(c.draft && c.draft.copies < 1 ? ([['clerk', 'Javobgar uchun nusxa yoʻq-ku. Ariza javobgarlar soniga mutanosib nusxalar bilan beriladi — shu yerda koʻchirib oling.']] as Line[]) : []),
            ['clerk', `Qabul qildim. Roʻyxat raqami — 2-1407/26. Sudya oʻn kun ichida ajrim chiqaradi, nusxasi ${c.draft?.email ? 'elektron manzilingizga' : 'pochta orqali'} yuboriladi.`],
          ],
          next: 'f-ruling', tone: 'good', article: '192-modda' },
        { id: 'copies', text: 'Javobgar uchun nusxa shartmi? Asli yetadi-ku.',
          reply: [['clerk', 'Shart. Javobgar oʻz nusxasini oladi.']], effect: { penalty: [10, 'Nusxalar talabini bilmadingiz'] }, tone: 'bad', article: '190-modda' },
      ],
    },
    { id: 'f-ruling', enter: [['system', 'Oradan toʻrt kun oʻtdi. Sudyaning ajrimi keldi.']], end: true },
  ],
};

const chamber: StageDef = {
  id: 'chamber',
  number: 4,
  title: 'Ishni sud muhokamasiga tayyorlash',
  place: 'Sudya kabineti',
  goal: 'Talabni bayon qiling, dalil soʻrang, kelishuv masalasini hal qiling.',
  reflect: 'Guvohni chaqirtirish qaroringiz sud majlisidagi kuchlar nisbatini qanday oʻzgartirdi?',
  start: 'k-start',
  nodes: [
    {
      id: 'k-start',
      enter: [['judge', 'Oʻtiring. Ishni tayyorlash tartibida taraflarni soʻroq qilaman. Daʼvogar vakili, talablaringiz mohiyatini qisqacha bayon qiling.']],
      options: [
        { id: 'essence', requires: ['sick'], text: 'Hurmatli sud, daʼvogar 9-10-oktabr kunlari uzrsiz kelmagan deb boʻshatilgan, holbuki u kasal boʻlgan. Ishga tiklashni soʻraymiz.',
          reply: [['judge', 'Tushunarli.']], next: 'k-evidence', tone: 'good', article: '203-modda' },
        { id: 'essence-thin', hideIf: ['sick'], text: 'Hurmatli sud, daʼvogar asossiz boʻshatilgan, ishga tiklashni soʻraymiz.',
          reply: [['judge', 'Asossiz deysiz — qaysi holatlarga tayanasiz?']], effect: { penalty: [10, 'Holatlarni aniq aytmadingiz'] }, next: 'k-evidence', tone: 'info', article: '203-modda' },
        { id: 'emotion', text: 'Mijozimni nohaq haydashgan, hamma buni biladi!',
          reply: [['judge', 'Bu baho, holat emas. Qaysi holatlarga asoslanasiz?', { emotion: 'impatient' }]], effect: { penalty: [15, 'Holat oʻrniga baho berdingiz'] }, tone: 'bad', article: '72-modda' },
      ],
    },
    {
      id: 'k-evidence',
      enter: [['judge', 'Javobgar eʼtiroz bildirishi aniq. Qoʻshimcha dalil yoki iltimosingiz bormi?']],
      options: [
        { id: 'call-witness', requires: ['witness'], text: 'Hurmatli sud, guvoh Bahodir R.ni majlisga chaqirishni va javobgardan tabel hisobini talab qilishni soʻraymiz.',
          reply: [['judge', 'Iltimos qanoatlantiriladi.']], effect: { learn: ['witness-called'] }, next: 'k-settle', tone: 'good', article: '204-modda' },
        { id: 'only-docs', text: 'Hurmatli sud, ilova qilingan hujjatlar bilan cheklanamiz.',
          reply: [['judge', 'Yaxshi.']], effect: { penalty: [10, 'Guvohni chaqirtirmadingiz'] }, next: 'k-settle', tone: 'info' },
        { id: 'self-witness', text: 'Hurmatli sud, mijoz hammasini menga aytgan - guvoh sifatida oʻzim gapiraman.',
          reply: [['judge', 'Mumkin emas: vakil vakillik munosabati bilan bilgan holatlar boʻyicha guvoh boʻla olmaydi.', { emotion: 'impatient' }]], effect: { penalty: [15, 'Vakil guvoh boʻla olmaydi'] }, tone: 'bad', article: '56-modda' },
      ],
    },
    {
      id: 'k-settle',
      enter: [['judge', 'Taraflar kelishuv bitimi yoki mediativ kelishuv tuzishi mumkin. Daʼvogar bunga qanday qaraydi?']],
      options: [
        { id: 'consult-client', text: 'Hurmatli sud, mijozim bilan maslahatlashdik: faqat ishga tiklanish sharti bilan kelishuvga tayyormiz.',
          reply: [['client', 'Ha, shunday.'], ['judge', 'Qayd etildi. Ish 2-zalda, soat 10:00 da koʻriladi.']], next: 'k-end', tone: 'good', article: '203-modda' },
        { id: 'refuse-alone', text: 'Kelishuv - yutqazish degani. Rad etamiz.',
          reply: [['client', '(sekin) Meni ham bir soʻrasangiz boʻlardi…', { emotion: 'uncertain' }], ['judge', 'Bu qarorni daʼvogarning oʻzi qabul qiladi. Ish 2-zalda, soat 10:00 da koʻriladi.']],
          effect: { mood: 'uncertain', penalty: [15, 'Kelishuv masalasini mijozsiz hal qildingiz'] }, next: 'k-end', tone: 'bad', article: '44-modda' },
      ],
    },
    { id: 'k-end', end: true },
  ],
};

/** In court: answers are given standing and begin with "Hurmatli sud!" (FPK 212). */
const hearing: StageDef = {
  id: 'hearing',
  number: 5,
  title: 'Sud majlisi',
  place: 'Sud majlisi zali',
  goal: 'Tik turib, «Hurmatli sud!» deb gapiring.',
  reflect: 'Qaysi dalil qarorga eng koʻp taʼsir qildi? Javobgar oʻrnida boʻlsangiz, nimaga tayangan boʻlardingiz?',
  start: 'h-rise',
  nodes: [
    {
      id: 'h-rise',
      scene: { judgeIn: false, everyoneStands: false, witnessIn: false },
      // the hall rises on the secretary's call — whether or not you do
      enter: [['secretary', 'Sud kelmoqda! Barchangizdan oʻrningizdan turishingizni soʻrayman.', { everyoneStands: true }]],
      await: 'stand',
      then: 'h-open',
    },
    {
      id: 'h-open',
      // FPK 210: the judge opens the session and names the case; FPK 213: the secretary reports who has appeared
      enter: (c) => [
        ['system', 'Sudya xizmat eshigidan zalga kirib, oʻz oʻrniga oʻtdi.', { judgeIn: true }],
        ['judge', 'Sud majlisini ochiq deb eʼlon qilaman. Sardor N.ning «Namuna Savdo» MChJga nisbatan ishga tiklash toʻgʻrisidagi daʼvosi boʻyicha fuqarolik ishi koʻriladi. Oʻtiring.'],
        ['system', 'Zaldagilar oʻtirdi.', { everyoneStands: false }],
        ['secretary', `Hurmatli sud! Ish boʻyicha chaqirilganlardan daʼvogar Sardor N. va uning vakili — advokat, javobgar «Namuna Savdo» MChJ vakili hozir.${c.knows('witness-called') ? ' Guvoh Bahodir R. chaqiruv qogʻozini olgan, yoʻlakda kutmoqda.' : ''}`],
      ],
      await: 'sit',
      then: 'h-recusal',
    },
    {
      id: 'h-recusal',
      scene: { everyoneStands: false },
      // FPK 17: at first instance a civil case is heard by one judge sitting alone
      enter: [['judge', 'Ish sudya B. Islomov tomonidan yakka tartibda koʻriladi, sud majlisi kotibi — Malika S. Taraflar rad qilish toʻgʻrisida arz qilishga haqli. Daʼvogar tomonida arizalar bormi?']],
      options: [
        { id: 'no-recusal', text: 'Hurmatli sud, rad qilish toʻgʻrisida arizamiz yoʻq.', next: 'h-explain', tone: 'good', article: '216-modda' },
        { id: 'rude', text: 'Yoʻq.', reply: [['judge', 'Sudga «Hurmatli sud!» deb murojaat qilinadi.', { emotion: 'impatient' }]], next: 'h-explain', effect: { penalty: [10, '«Hurmatli sud!» demadingiz'] }, tone: 'bad', article: '212-modda' },
        { id: 'recuse-party', text: 'Hurmatli sud, javobgar vakilini rad qilishni soʻraymiz - u bizga nisbatan xolis emas.',
          reply: [['judge', 'Rad qilish sudya, prokuror, ekspert, mutaxassis, tarjimon va sud majlisi kotibiga nisbatan bildiriladi. Taraf vakili rad qilinmaydi.', { emotion: 'impatient' }]],
          next: 'h-explain', effect: { penalty: [10, 'Taraf vakilini rad qilishga urindingiz'] }, tone: 'bad', article: '22-modda',
          feedback: 'FPK 21-22: rad qilish sudya, prokuror, ekspert, mutaxassis, tarjimon va sud majlisi kotibiga nisbatan bildiriladi; taraflar va ularning vakillari rad qilinmaydi.' },
      ],
    },
    {
      id: 'h-explain',
      // FPK 217: rights explained; FPK 225: the presiding judge's report opens the hearing on the merits
      enter: [
        ['judge', 'Ishda ishtirok etuvchi shaxslarga protsessual huquq va majburiyatlari tushuntiriladi: dalillar taqdim etish, iltimosnoma berish, boshqa ishtirokchilarga va guvohlarga savol berish, tushuntirish berish huquqiga egasiz.'],
        ['judge', 'Ish mazmunan koʻriladi. Daʼvogar 14-oktabrdagi buyruq bilan boʻshatilgan va ishga tiklashni soʻraydi. Daʼvogar tomoni, talablaringizni quvvatlaysizmi? Tushuntirish bering.'],
      ],
      options: [
        { id: 'explain', requires: ['sick'], text: 'Hurmatli sud! Talabni quvvatlaymiz. Daʼvogar 9-10-oktabr kunlari kasal boʻlgan, kasallik varaqasi bor va boshligʻiga xabar bergan. Undan yozma tushuntirish ham soʻralmagan. Boʻshatish asossiz.',
          reply: [['respondent', 'Hurmatli sud! Varaqa vaqtida topshirilmagan, shu sababli kunlar uzrsiz deb topildi.', { emotion: 'calm' }]], next: 'h-evidence', effect: { strength: 1 }, tone: 'good', article: '227-modda' },
        { id: 'thin', text: 'Hurmatli sud, arizada hammasi yozilgan.',
          reply: [['respondent', 'Hurmatli sud! Daʼvogar ikki kun ishga kelmagan. Boʻshatish qonuniy.']], next: 'h-evidence', effect: { penalty: [15, 'Tushuntirish bermadingiz'] }, tone: 'bad', article: '227-modda' },
        { id: 'angry', text: 'Hurmatli sud, bu korxona doim xodimlarga zulm qiladi!',
          reply: [['judge', 'Ish holatlari boʻyicha gapiring.', { emotion: 'impatient' }]], next: 'h-evidence', effect: { penalty: [15, 'Holat oʻrniga ayblov'] }, tone: 'bad', article: '227-modda' },
      ],
    },
    {
      id: 'h-evidence',
      // FPK 233: written evidence is read out in the session and shown to the parties
      enter: [['judge', 'Yozma dalillar oʻqib eshittiriladi: 14-oktabrdagi 47-k-sonli buyruq va mehnatga layoqatsizlik varaqasi. Taraflar, dalillar yuzasidan fikringiz?']],
      options: [
        { id: 'dates', requires: ['sickleave'], text: 'Hurmatli sud, varaqadagi sanalarga eʼtibor qaratishingizni soʻraymiz: 9-10-oktabr - buyruqda «kelmagan» deb koʻrsatilgan aynan oʻsha kunlar.',
          reply: [['judge', 'Qayd etildi.']], next: 'h-evidence-next', tone: 'good', article: '233-modda' },
        { id: 'skip-reading', text: 'Hurmatli sud, hujjatlar ishda bor - oʻqib oʻtirmasak ham boʻladi, vaqtni tejaylik.',
          reply: [['judge', 'Yozma dalillar sud majlisida oʻqib eshittiriladi — qaror faqat majlisda tekshirilgan dalillarga asoslanadi.', { emotion: 'impatient' }]],
          next: 'h-evidence-next', effect: { penalty: [10, 'Yozma dalillarni tekshirishdan voz kechishni taklif qildingiz'] }, tone: 'bad', article: '233-modda' },
      ],
    },
    { id: 'h-evidence-next', goto: (c) => (c.knows('witness-called') ? 'h-witness' : 'h-debate') },
    {
      id: 'h-witness',
      enter: [
        ['judge', 'Guvoh Bahodir R.ni zalga taklif qiling.'],
        ['secretary', 'Guvoh, marhamat, tribunaga oʻting.', { witnessIn: true }],
        // the walk from the door to the lectern takes a few seconds: the court waits for him
        ['system', 'Guvoh zalga kirib, yoʻlak boʻylab tribunaga keldi.'],
        // FPK 229: identity and relation to the parties, the warning, the oath, the signed acknowledgement
        ['judge', 'Guvohning shaxsi, mashgʻuloti va taraflar bilan munosabati aniqlandi: daʼvogarning hamkasbi. Guvoh, bila turib yolgʻon koʻrsatuv berganlik uchun Jinoyat kodeksining 238-moddasiga muvofiq javobgarlik toʻgʻrisida ogohlantirilasiz. Qasamyod qiling va tilxatga imzo qoʻying.'],
        ['witness', 'Ish yuzasidan oʻzimga maʼlum boʻlgan barcha maʼlumotlarni sudga aytib berishga qasamyod qilaman. Faqat haqiqatni gapirib beraman.'],
        ['judge', 'Daʼvogar vakili, savolingiz?'],
      ],
      options: [
        { id: 'open-question', text: 'Hurmatli sud, ruxsatingiz bilan. Bahodir aka, 9-oktabr ertalab nima boʻlganini aytib bering.',
          reply: [
            ['witness', 'Boshliqning yonida edim. Sardor qoʻngʻiroq qilib, isitmasi baland, poliklinikaga ketayotganini aytdi.', { emotion: 'uncertain' }],
            ['respondent', 'Hurmatli sud, guvohga savol. Qoʻngʻiroqni oʻzingiz eshitdingizmi yoki keyin aytib berishganmi?'],
            ['witness', 'Oʻzim eshitdim — telefon baland ovozda edi.'],
          ], next: 'h-debate', effect: { strength: 1 }, tone: 'good', article: '229-modda' },
        { id: 'leading', text: 'Siz daʼvogarning kasal ekanini bilgansiz, toʻgʻrimi? Ha deng.',
          reply: [['judge', 'Guvohga javobni oʻzingiz aytib bermang.', { emotion: 'impatient' }], ['witness', 'U kasal boʻlib qolganini aytgan edi.']], next: 'h-debate', effect: { penalty: [15, 'Yoʻnaltiruvchi savol'] }, tone: 'bad', article: '229-modda' },
      ],
    },
    {
      id: 'h-debate',
      // FPK 243: nothing to add → the hearing on the merits ends; then the debate
      enter: [['judge', 'Ish materiallarini toʻldirish istagi yoʻq. Ishni mazmunan muhokama qilish tugallandi. Sud muzokaralariga oʻtamiz — soʻz daʼvogar vakiliga.']],
      options: [
        { id: 'speech', text: 'Hurmatli sud! Tekshirilgan dalillar daʼvogarning kelmasligi uzrli boʻlganini tasdiqlaydi. Uni ishga tiklashingizni soʻrayman.',
          reply: [['respondent', 'Hurmatli sud, daʼvoni rad etishingizni soʻrayman.']], next: 'h-retire', effect: { strength: 1 }, tone: 'good', article: '244-modda' },
        { id: 'law-only', text: 'Hurmatli sud! Boshqa sudlar ham bunday ishlarda xodim foydasiga qaror chiqargan - shuning uchun daʼvoni qanoatlantirishingizni soʻrayman.',
          reply: [['judge', 'Sud ushbu ishda tekshirilgan dalillar va qonunga asoslanadi. Dalillaringizni tahlil qiling.', { emotion: 'impatient' }], ['respondent', 'Hurmatli sud, daʼvoni rad etishingizni soʻrayman.']],
          next: 'h-retire', effect: { penalty: [10, 'Muzokarada dalillar tahlili oʻrniga boshqa ishlarga tayandingiz'] }, tone: 'bad', article: '249-modda' },
        { id: 'new-evidence', text: 'Hurmatli sud, hozir ishda yoʻq yangi maʼlumotnomani koʻrsataman.',
          reply: [['judge', 'Muzokarada sud majlisida tekshirilmagan dalillarga asoslanish mumkin emas.', { emotion: 'impatient' }]], next: 'h-retire', effect: { penalty: [20, 'Muzokarada tekshirilmagan dalil'] }, tone: 'bad', article: '244-modda' },
      ],
    },
    {
      id: 'h-retire',
      enter: [
        ['judge', 'Sud hal qiluv qarorini qabul qilish uchun maslahatxonaga chiqadi.'],
        ['secretary', 'Sud chiqmoqda! Oʻrningizdan turing.', { everyoneStands: true }],
      ],
      await: 'stand',
      then: 'h-out',
    },
    {
      id: 'h-out',
      enter: [
        ['system', 'Sudya maslahatxonaga chiqib ketdi.', { judgeIn: false }],
        ['system', 'Zaldagilar oʻtirdi. Qaror kutilmoqda.', { everyoneStands: false }],
      ],
      await: 'sit',
      then: 'h-back',
    },
    {
      id: 'h-back',
      enter: [
        ['system', 'Yigirma daqiqadan soʻng.'],
        ['secretary', 'Sud kelmoqda! Hal qiluv qarori eʼlon qilinadi — oʻrningizdan turing.', { everyoneStands: true }],
        ['system', 'Sudya zalga qaytib kirdi.', { judgeIn: true }],
      ],
      await: 'stand',
      then: 'h-judgment',
    },
    {
      id: 'h-judgment',
      enter: (c) => [
        ['judge', verdictLine(c)],
        ...(won(c) ? ([['judge', 'Hal qiluv qarorining ishga tiklash qismi darhol ijro etilsin.']] as Line[]) : []),
        ['judge', 'Qaror ustidan bir oy ichida apellyatsiya shikoyati berilishi mumkin. Sud majlisi yopildi.'],
      ],
      end: true,
    },
  ],
};

/** The court can reinstate only if reinstatement was asked for (FPK 189 p.4) and the sick note is in the file. */
export const won = (c: CaseView) => Boolean(c.draft && /tikla/.test(norm(c.draft.demand)) && c.draft.attachments.includes('sickleave') && c.strength >= 2);

export function verdictLine(c: CaseView): string {
  return won(c)
    ? 'Oʻzbekiston Respublikasi nomidan: daʼvo qanoatlantirilsin. Sardor N. avvalgi lavozimiga tiklansin, majburiy progul vaqti uchun haq undirilsin.'
    : 'Oʻzbekiston Respublikasi nomidan: daʼvo qanoatlantirilmasin — kelmaslik sababi uzrli ekani yetarli isbotlanmadi.';
}

export const STAGES: StageDef[] = [consult, draft, filing, chamber, hearing];

export const STAGE_ARTICLES: Partial<Record<StageId, string[]>> = {
  consult: ['65-modda', '67-modda', '68-modda', '72-modda', '192-modda'],
  draft: ['26-modda', '28-modda', '33-modda', '188-modda', '189-modda', '190-modda', '191-modda'],
  filing: ['190-modda', '192-modda', '193-modda', '195-modda'],
  chamber: ['44-modda', '56-modda', '201-modda', '202-modda', '203-modda', '204-modda', '205-modda'],
  hearing: ['17-modda', '21-modda', '22-modda', '210-modda', '212-modda', '213-modda', '216-modda', '217-modda', '225-modda', '227-modda', '233-modda', '243-modda', '229-modda', '244-modda', '247-modda', '248-modda', '249-modda', '253-modda', '264-modda', '266-modda', '385¹-modda'],
};

export const BOOK: CaseBookShape = {
  kind: 'labour',
  CASE,
  FACTS,
  EVIDENCE,
  PREPARED,
  STAGES,
  STAGE_ARTICLES,
  won,
  verdict: (c) => (won(c) ? 'Daʼvo qanoatlantirildi — Sardor N. ishga tiklandi' : 'Daʼvo rad etildi — dalillar yetarli boʻlmadi'),
};
