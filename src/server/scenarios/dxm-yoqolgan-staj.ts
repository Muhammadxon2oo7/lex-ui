/**
 * Scenario: "Yoʻqolgan staj" — DXM xodimi, oʻrta daraja.
 *
 * SERVER ONLY. This file contains hidden facts, the ideal path and the
 * rubric. Nothing here may be imported from client code; the public part is
 * exposed through `toPublicScenario`.
 *
 * Legal note: service names, deadlines and the required-documents list are
 * TRAINING PLACEHOLDERS. Per the project concept they must be confirmed by a
 * practising DXM employee / mentor before this scenario is marked "approved".
 * No article numbers are cited anywhere until that review happens.
 */
import type { EvidenceId, ScenarioPublic, ServiceId, Source } from '@/contracts';
import type { IntentTag } from '../engine/intent';

export interface HiddenFact {
  id: string;
  /** What the student sees in the "aniqlangan faktlar" list once unlocked. */
  summary: string;
  unlockedBy: IntentTag;
  /** Below this trust level the citizen dodges the question. */
  minTrust: number;
  /** How Rustam aka phrases it (picked by seeded RNG). */
  lines: string[];
  gesture?: 'show-phone' | 'sigh' | 'nod';
}

export interface Reply {
  id: string;
  text: string;
  kind: 'ask' | 'explain' | 'react';
  /** What the engine understands this reply to be. Never sent to the client. */
  tags: IntentTag[];
  /** Offered only while the bribe is on the table. */
  bribe?: boolean;
  /** Offered only once this fact is known (otherwise the reply would leak it). */
  requires?: string;
}

export interface ScenarioDefinition {
  public: ScenarioPublic;
  mentorApproved: boolean;
  initial: { patience: number; trust: number };
  openingLine: string;
  facts: HiddenFact[];
  replies: Reply[];
  correctService: ServiceId;
  expectedEvidence: EvidenceId[];
  bribe: { earliestTurn: number; latestTurn: number; line: string; pushLine: string };
  queuePressure: { probability: number; turn: number; line: string };
  idealPath: { id: string; step: string }[];
  sources: Record<'procedure' | 'appeals' | 'pension' | 'anticorruption', Source>;
  nextScenario: { id: string; title: string };
}

/**
 * An act checked against lex.uz: the link goes to the document, `effectiveAt` is the edition shown
 * there and `verifiedAt` the day its text was taken into the research pack (legal/sources). Which
 * article answers this exact situation is still for a mentor to confirm (reviewStatus 'needs-mentor').
 */
const lex = (title: string, url: string, edition: string): Source => ({ title, officialUrl: url, effectiveAt: edition, verifiedAt: '2026-11-20' });

export const dxmYoqolganStaj: ScenarioDefinition = {
  public: {
    id: 'dxm-yoqolgan-staj',
    title: 'Yoʻqolgan staj',
    role: 'DXM xodimi',
    level: 'Oʻrta',
    durationMinutes: '12–18',
    roomId: 'dxm-centre-01',
    briefing: {
      workplace: 'Davlat xizmatlari markazi, tuman boʻlimi (oʻquv muhiti)',
      position: 'Fuqarolarni qabul qilish boʻyicha mutaxassis · 3-xona',
      authority: [
        'Murojaatni tinglash va masalani aniqlashtirish',
        'Tegishli davlat xizmatiga ariza/soʻrovni rasmiylashtirish',
        'Vakolatli idoraga aniq yoʻnaltirish va keyingi qadamni tushuntirish',
        'Xizmat faqat belgilangan tartibda, qoʻshimcha haqsiz koʻrsatiladi',
      ],
      task: [
        'Navbatdagi fuqaro 3-xonada sizni kutmoqda.',
        'Uning muammosi oldindan aytilmaydi — oʻzingiz aniqlaysiz.',
        'Qabul yakunida terminalda xizmatni rasmiylashtiring.',
      ],
    },
    npc: { id: 'rustam-aka', name: 'Rustam aka', age: 64 },
    disclaimer:
      'Bu oʻquv simulyatsiyasi. Xizmat nomlari, muddatlar va hujjatlar roʻyxati mentor tasdigʻidan oʻtmagan oʻquv namunalari; professional huquqiy maslahat emas.',
  },
  mentorApproved: false,
  initial: { patience: 60, trust: 40 },
  openingLine:
    'Assalomu alaykum… Menga bir yordam bering. Nafaqamni kam qilib qoʻyishibdi. Hamma joyga bordim, hech kim gapimni eshitmaydi.',
  facts: [
    {
      id: 'work-period-1991-1998',
      summary: '1991–1998-yillarda jamoa xoʻjaligida ishlagan; shu davr stajga qoʻshilmagan.',
      unlockedBy: 'ask-work-period',
      minTrust: 0,
      lines: [
        'Toʻqson birinchi yildan toʻqson sakkizgacha kolxozda — jamoa xoʻjaligida traktorchi boʻlib ishlaganman. Yetti yil! Shu yillarni hisobga olishmabdi.',
        'Men 1991-yildan 1998-yilgacha jamoa xoʻjaligida ishlaganman, ukam. Keyin shaharga koʻchdik. Oʻsha yetti yilni stajga qoʻshishmagan.',
      ],
      gesture: 'sigh',
    },
    {
      id: 'workbook-photos',
      summary: 'Mehnat daftarchasi yoʻqolgan; ayrim sahifalarining rasmi telefonida bor.',
      unlockedBy: 'ask-documents',
      minTrust: 0,
      lines: [
        'Mehnat daftarcham koʻchganda yoʻqolib ketgan. Lekin nabiram baʼzi sahifalarini rasmga olib qoʻygan ekan — mana, telefonimda turibdi.',
        'Trudovoy knijkam yoʻq, yoʻqotganman. Faqat bir-ikki betining rasmi telefonda saqlanib qolgan, xolos.',
      ],
      gesture: 'show-phone',
    },
    {
      id: 'employer-liquidated',
      summary: 'Xoʻjalik tugatilgan; hujjatlari arxivga topshirilgan boʻlishi mumkin.',
      unlockedBy: 'ask-employer-status',
      minTrust: 0,
      lines: [
        'E, u xoʻjalik allaqachon tugatilgan. Idorasi ham yoʻq hozir. Hujjatlarini arxivga topshirishgan deb eshitganman, aniq bilmayman.',
        'Kolxoz tarqab ketgan, oʻrnida hech narsa qolmagan. Qogʻozlarini tuman arxiviga berishgan boʻlsa kerak.',
      ],
    },
    {
      id: 'previous-refusal',
      summary: 'Avval boshqa idoraga borgan, “bizning ishimiz emas” degan javob olgan.',
      unlockedBy: 'ask-previous-visits',
      minTrust: 30,
      lines: [
        'Bordim-da! Oʻtgan oy boshqa idoraga bordim, ikki soat navbatda turdim. Oxiri “bu bizning ishimiz emas” deb chiqarib yuborishdi. Shuning uchun jahlim chiqyapti.',
        'Ha, avval ham borganman. “Bizga emas, boshqa joyga boring” deyishdi, qayerga ekanini ham aytishmadi.',
      ],
      gesture: 'sigh',
    },
  ],
  replies: [
    { id: 'greet', kind: 'react', tags: ['greeting', 'empathy'], text: 'Assalomu alaykum, Rustam aka. Bemalol oʻtiring. Xavotir olmang, birga koʻrib chiqamiz.' },
    { id: 'paraphrase', kind: 'react', tags: ['paraphrase'], text: 'Toʻgʻri tushungan boʻlsam, nafaqangiz kutganingizdan kam tayinlangan — shundaymi?' },
    { id: 'empathy', kind: 'react', tags: ['empathy'], text: 'Tushunaman, qatnab charchagansiz. Bugun masalani oxirigacha aniqlab beraman.' },
    { id: 'ask-period', kind: 'ask', tags: ['ask-work-period'], text: 'Qaysi yillarda va qayerda ishlagansiz?' },
    { id: 'ask-docs', kind: 'ask', tags: ['ask-documents'], text: 'Qoʻlingizda qanday hujjatlar bor? Mehnat daftarchangiz saqlanganmi?' },
    { id: 'ask-employer', kind: 'ask', tags: ['ask-employer-status'], requires: 'work-period-1991-1998', text: 'Oʻsha xoʻjalik hozir ham faoliyat yuritadimi?' },
    { id: 'ask-before', kind: 'ask', tags: ['ask-previous-visits'], text: 'Bu masala bilan avval ham biror idoraga murojaat qilganmisiz?' },
    { id: 'ask-amount', kind: 'ask', tags: [], text: 'Nafaqangiz aniq qancha chiqdi?' },
    { id: 'dismiss', kind: 'react', tags: ['dismiss'], text: 'Nafaqa masalasi bizda emas. Boshqa idoraga boring.' },
    { id: 'system-right', kind: 'react', tags: ['dismiss'], text: 'Nafaqa dastur orqali hisoblanadi, u xato qilmaydi. Hammasi toʻgʻri boʻlsa kerak.' },
    { id: 'hurry', kind: 'react', tags: ['rude'], text: 'Otaxon, gapni choʻzmang, navbat katta. Aniq nima kerak?' },
    { id: 'promise', kind: 'explain', tags: ['overpromise'], text: 'Xotirjam boʻling, nafaqangizni bugunoq oshirtirib beraman — kafolat.' },
    { id: 'jargon', kind: 'explain', tags: ['jargon'], text: 'Normativ-huquqiy hujjatlarga muvofiq, staj subyektning protsessual hujjatlari asosida legitimlashtiriladi.' },
    { id: 'recalc', kind: 'explain', tags: ['overpromise'], text: 'Nafaqani qayta hisoblashga ariza yozamiz, shu bilan hal boʻladi.' },
    { id: 'route', kind: 'explain', tags: ['explain-service', 'paraphrase'], requires: 'work-period-1991-1998', text: 'Demak, gap hisob-kitobda emas: 1991–1998-yillardagi stajingiz tasdiqlanmagan. Arxivdan maʼlumotnoma olish uchun soʻrov rasmiylashtiramiz.' },
    { id: 'docs-list', kind: 'explain', tags: ['explain-documents'], requires: 'work-period-1991-1998', text: 'Buning uchun pasportingiz, daftarcha sahifalarining suratlari va xoʻjalikning nomi kerak boʻladi.' },
    { id: 'deadline', kind: 'explain', tags: ['explain-deadline'], requires: 'work-period-1991-1998', text: 'Soʻrov bugun yuboriladi. Javob belgilangan muddatda keladi — keyingi qadamni yozib beraman.' },
    { id: 'tracking', kind: 'explain', tags: ['explain-tracking'], requires: 'work-period-1991-1998', text: 'Javob tayyor boʻlgach sizga SMS keladi; ariza raqami boʻyicha holatini oʻzingiz ham tekshira olasiz.' },
    // ── only while the envelope is on the desk ──
    { id: 'bribe-refuse', kind: 'react', bribe: true, tags: ['bribe-refuse'], text: 'Rustam aka, rahmat, lekin buni ololmayman. Xizmat bepul va belgilangan tartibda koʻrsatiladi. Pulingizni oling.' },
    { id: 'bribe-illegal', kind: 'react', bribe: true, tags: ['bribe-refuse'], text: 'Bunaqasi mumkin emas — bu noqonuniy. Ishingiz shundoq ham bugun rasmiylashtiriladi.' },
    { id: 'bribe-later', kind: 'react', bribe: true, tags: [], text: 'Qoʻying, bu haqda keyin gaplashamiz… Xoʻsh, hujjatlarga qaytaylik.' },
    { id: 'bribe-hide', kind: 'react', bribe: true, tags: [], text: 'Hozir emas, odamlar koʻrib qoladi.' },
    { id: 'bribe-accept', kind: 'react', bribe: true, tags: ['bribe-accept'], text: 'Mayli, stolga qoʻyib keting. Tezlashtirib beraman.' },
  ],
  correctService: 'archive-reference',
  expectedEvidence: ['passport', 'workbook-photos', 'employer-details'],
  bribe: {
    earliestTurn: 3,
    latestTurn: 5,
    line: 'Ukam, mana… tezroq qilib bering, choy pulini beraman. Qari odamman, yana qatnab yurmay.',
    pushLine: 'Oling, oling, hech kim koʻrmaydi. Faqat ishimni tezlashtirib bersangiz boʻldi.',
  },
  queuePressure: {
    probability: 0.7,
    turn: 4,
    line: 'Eshik qiya ochilib, navbatdagi fuqaro moʻraladi: «Yana qancha kutamiz? Yarim soatdan beri oʻtiribmiz!»',
  },
  idealPath: [
    { id: 'listen', step: 'Salomlashish, xotirjam tinglash va muammoni takrorlab tasdiqlash' },
    { id: 'clarify', step: 'Aniqlashtiruvchi savollar: qaysi yillar, qayerda ishlagan, qanday hujjatlari bor' },
    { id: 'diagnose', step: 'Haqiqiy muammoni aniqlash: staj tasdiqlanmagan (hisoblash xatosi emas)' },
    { id: 'route', step: 'Tegishli xizmatni rasmiylashtirish yoki vakolatli idoraga aniq yoʻnaltirish' },
    { id: 'explain', step: 'Hujjatlar roʻyxati, muddat va keyingi qadamni tushuntirish' },
    { id: 'ethics', step: 'Pora taklifini xushmuomalalik bilan, lekin qatʼiy rad etish' },
    { id: 'tracking', step: 'Natijani qanday kuzatish mumkinligini aytish' },
  ],
  sources: {
    procedure: lex('“Maʼmuriy tartib-taomillar toʻgʻrisida”gi Qonun', 'https://lex.uz/docs/-3492199', '25.07.2026'),
    appeals: lex('“Jismoniy va yuridik shaxslarning murojaatlari toʻgʻrisida”gi Qonun', 'https://lex.uz/docs/-3336169', '15.10.2026'),
    pension: lex('“Fuqarolarning davlat pensiya taʼminoti toʻgʻrisida”gi Qonun', 'https://lex.uz/docs/-112314', '20.05.2025'),
    anticorruption: lex('“Korrupsiyaga qarshi kurashish toʻgʻrisida”gi Qonun', 'https://lex.uz/docs/-3088008', '23.06.2026'),
  },
  nextScenario: { id: 'dxm-arxiv-rus-tilida', title: 'Rus tilidagi arxiv hujjati' },
};

export const SCENARIOS: Record<string, ScenarioDefinition> = {
  [dxmYoqolganStaj.public.id]: dxmYoqolganStaj,
};
