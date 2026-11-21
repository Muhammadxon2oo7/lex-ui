/**
 * Contested economic-court cases for «Bahs», built from published rulings where two courts disagreed.
 * Source: the research «Munozarali iqtisodiy sud ishlari» (docs/) checked against the rulings
 * themselves (legal/raw/lex: 2882730, 2831719, 2839956, 2875644, -3079484) and the court pages named
 * in each `basis`.
 *
 * Rules kept here:
 *   · Facts, sums and dates are the sources' own. Where a source contradicts itself, the case says so.
 *   · Party names are replaced by «A», «B», «V»; the ruling is named only in the debrief (after the verdict).
 *   · Every norm in `norms` and every «N-modda» / «N-band» in the text is in the verified pack
 *     (legal/sources ← lex.uz) - src/server/moot/econ.test.ts fails otherwise.
 *   · Foreign cases are argued under Uzbek law; their own codes are named without article numbers.
 *   · `outcome` and `lessons` are what the real courts decided and what the case teaches; players see
 *     them only after the verdict.
 */
import type { MootCase } from './cases';

const UZ = 'Oʻquv ishi. Oliy xoʻjalik sudi qarori asosida: taraflar nomi oʻzgartirilgan, faktlar va summalar qarordan. Huquqiy maslahat emas.';
const ABROAD = 'Oʻquv ishi. Chet el sudi qarori asosida, Oʻzbekiston huquqi boʻyicha bahslashiladi: taraflar nomi oʻzgartirilgan, faktlar va summalar manbadan. Huquqiy maslahat emas.';
const HALL = (n: number) => `Namuna tumanlararo iqtisodiy sudi · ${n}-sud majlislari zali`;
const POLITE = 'Sudga «Hurmatli sud!» deb murojaat qiling.';

export const ECON_CASES: Record<string, MootCase> = {
  /* ───────────── 1. Penya yoki foiz ───────────── */
  'penya-foiz': {
    id: 'penya-foiz',
    title: 'Penya ham, foiz ham: ikkalasi birga mumkinmi?',
    court: HALL(1),
    summary: 'Ekipaji bilan texnika ijarasi uchun qarz. Daʼvogar asosiy qarz, penya va bank foizini birga soʻraydi; javobgar penyani kamaytirishni soʻraydi.',
    parties: { claimant: '«A» MChJ (texnikani ekipaji bilan ijaraga beruvchi)', respondent: '«B» xorijiy kompaniyasi (ijarachi)' },
    claim: '258 326 345 soʻm asosiy qarz, 13 140 718 soʻm penya va 32 205 980 soʻm bank foizi undirish.',
    facts: [
      { id: 'contract', title: 'Shartnoma', text: '2015-yil 3-yanvardagi 4-son shartnoma: «A» MChJ «B»ga texnikani ekipaji bilan ijaraga bergan. 2015-yil yanvardan 30-iyungacha 616 660 216 soʻmlik xizmat koʻrsatilgan (1.1-band).' },
      { id: 'pay', title: 'Toʻlov', text: 'Hisob-faktura olingandan keyin 15 bank kuni ichida toʻlanadi (3.5-band). Javobgar 358 333 871 soʻm toʻlagan.' },
      { id: 'liability', title: 'Javobgarlik sharti', text: 'Javobgarlik «Xoʻjalik yurituvchi subyektlar faoliyatining shartnomaviy-huquqiy bazasi toʻgʻrisida»gi Qonun boʻyicha (4.1-band). Kechiktirilgan har bir kun uchun 0,01 foiz penya, kechiktirilgan summaning 20 foizidan oshmagan holda (4.2-band).' },
      { id: 'acts', title: 'Dalolatnomalar', text: 'Koʻrsatilgan xizmatlar dalolatnomalari sifat boʻyicha eʼtirozsiz imzolangan.' },
    ],
    evidence: [
      { id: 'e-contract', title: '4-son shartnoma', text: 'Narx, toʻlov muddati (3.5-band), javobgarlik (4.1-4.2-bandlar).' },
      { id: 'e-invoices', title: 'Hisob-fakturalar', text: '2015-yil yanvar - iyun, jami 616 660 216 soʻm.' },
      { id: 'e-acts', title: 'Xizmat dalolatnomalari', text: 'Ikki taraf imzolagan, sifat boʻyicha eʼtiroz yoʻq.' },
      { id: 'e-paid', title: 'Toʻlov topshiriqnomalari', text: 'Jami 358 333 871 soʻm.' },
      { id: 'e-calc', title: 'Daʼvogarning hisob-kitobi', text: 'Penya 13 140 718 soʻm (0,01 foiz, 20 foiz chegarasida) va bank foizi 32 205 980 soʻm.' },
    ],
    timeline: [
      { date: '03.01.2015', text: 'Shartnoma tuzildi.' },
      { date: 'yanvar - 30.06.2015', text: 'Xizmat koʻrsatildi: 616 660 216 soʻm.' },
      { date: '2015-2016', text: 'Javobgar 358 333 871 soʻm toʻladi, qolgani toʻlanmadi.' },
      { date: '28.03.2016', text: 'Daʼvo dastlab javobgarning doimiy muassasasiga berilgan edi; shu kuni kompaniyaning oʻzi javobgar sifatida jalb qilindi.' },
    ],
    side: {
      claimant: {
        task: ['Uchala talabni asoslang: qarz, penya va foiz nimaga tayanadi.', 'Javobgarning penyani kamaytirish iltimosiga javob bering.', POLITE],
        confidential: ['Bank foizini mijozingiz «ishonch uchun» qoʻshgan: shartnomada faqat penya yozilgan.', 'Javobgar oʻz moliyaviy ahvoli haqida birorta hujjat bermagan.'],
      },
      respondent: {
        task: ['Qaysi talab ortiqcha ekanini toping va sudga koʻrsating.', 'Penyani kamaytirishni soʻrasangiz, uni nima bilan asoslashingizni oʻylang.', POLITE],
        confidential: ['Mijozingiz qarzni inkor etmaydi: xizmat koʻrsatilgan, dalolatnomalar eʼtirozsiz imzolangan.', 'Moliyaviy ahvol haqida ishda hozircha birorta hujjat yoʻq.'],
      },
    },
    points: {
      claimant: [['asosiy qarz', '258 326', 'qarz'], ['dalolatnoma', 'eʼtirozsiz', 'etirozsiz'], ['hisob-faktura', 'faktura'], ['4.2', '0,01', '20 foiz'], ['mutanosib'], ['hujjat yoʻq', 'dalil yoʻq', 'isbotlanma'], ['penya']],
      respondent: [['foiz', '327'], ['birga', 'ikkalasi', 'faqat penya', 'bittasi'], ['4.1', '4.2'], ['kamaytir'], ['moliyaviy', 'ahvol'], ['326'], ['toʻlagan', '358']],
    },
    disclaimer: UZ,
    topic: 'Neustoyka',
    level: 1,
    skills: ['qoida', 'dalil'],
    norms: [{ doc: 'FK', n: '260-modda' }, { doc: 'FK', n: '326-modda' }, { doc: 'FK', n: '327-modda' }, { doc: 'PLENUM-OXS-163', n: '2-band' }, { doc: 'PLENUM-OXS-163', n: '4-band' }, { doc: 'PLENUM-OXS-163', n: '13-band' }, { doc: 'IPK', n: '68-modda' }],
    basis: { ruling: 'Oliy xoʻjalik sudi sudlov hayʼatining 2016-yil 3-oktabrdagi 20-1606/2095-son qarori', url: 'https://lex.uz/docs/-3079484', mark: 'T', adapted: 'Ish eski Xoʻjalik protsessual kodeksi davrida koʻrilgan; bahs birinchi instansiya majlisi sifatida oʻynaladi.' },
    outcome: [
      'Birinchi instansiya (05.04.2016): asosiy qarz va bank foizi toʻliq undirildi, penya 7 884 430 soʻmgacha kamaytirildi. Apellyatsiya (09.06.2016) oʻzgartirmadi.',
      'Kassatsiya (03.10.2016): penyani kamaytirish asossiz - penya toʻgʻri hisoblangan va mutanosib, ishda qarzdorning moliyaviy ahvoli haqida hujjat yoʻq. Penya toʻliq, 13 140 718 soʻm qilib tiklandi.',
      'Bank foizi (32 205 980 soʻm) bekor qilindi: shartnoma faqat penyani nazarda tutgan, kreditor ikki choradan faqat birini talab qila oladi (OXS Plenumining 163-son qarori, 13-band).',
      'Davlat boji 1 518 365 soʻmdan 1 357 335 soʻmga qayta hisoblandi. Shikoyat qilgan javobgar oxirida koʻproq penya toʻladi.',
    ],
    lessons: [
      'Pul majburiyatida kreditor penya YOKI FK 327-moddasi boʻyicha foizni talab qiladi, ikkalasini birga emas.',
      'Kamaytirishni soʻragan tomon nomutanosiblikni va oʻz moliyaviy ahvolini dalil bilan koʻrsatishi kerak (IPK 68-modda). Sud dalilsiz kamaytirsa, yuqori instansiya buni bekor qiladi.',
      'Penya past boʻlsa (kuniga 0,01 foiz, 20 foiz chegarasi), «nomutanosib» degan vajning oʻzi kuchsiz. Qonuniy penya bilan solishtiring (670-I-son Qonun 32-modda).',
      'Tipik xato: daʼvogar penya va foizni birga soʻraydi; javobgar «summa katta» deydi-yu, balans bermaydi.',
    ],
  },

  /* ───────────── 2. Qurilish kechikdi ───────────── */
  'qurilish-kechikish': {
    id: 'qurilish-kechikish',
    title: 'Uy oʻz vaqtida bitmadi: penya va boshqalarning aybi',
    court: HALL(3),
    summary: 'Tender asosida 50 xonadonli uy qurilishi. Muddat ikki marta uzaytirilgan, baribir ish tugamagan. Buyurtmachi neustoyka talab qiladi; pudratchi kechikishni buyurtmachi jalb qilgan boshqa pudratchilarga bogʻlaydi.',
    parties: { claimant: '«A» yagona buyurtmachi xizmati (davlat buyurtmachisi)', respondent: '«B» MChJ (pudratchi)' },
    claim: '134 786 264 soʻm neustoyka undirish.',
    facts: [
      { id: 'contract', title: 'Shartnoma', text: 'Tender natijasida 2010-yil 17-fevralda tuzilgan 5-son shartnoma: 5 qavatli 50 xonadonli turar-joy binosi qurilishi, 2 701 344 590 soʻm.' },
      { id: 'ext1', title: '1-uzaytirish', text: '5/1-son qoʻshimcha kelishuv (30.04.2012): tender komissiyasining 16.04.2012 dagi 9/4-12-son bayonnomasi asosida muddat 30.08.2012 gacha surildi.' },
      { id: 'ext2', title: '2-uzaytirish', text: '5/2-son qoʻshimcha kelishuv (26.11.2012): tender komissiyasining 05.11.2012 dagi 16/4-12-son bayonnomasi asosida yakuniy narx 2 699 680 629 soʻm, ishlar 01.12.2012 gacha.' },
      { id: 'gap', title: 'Bajarilmagan qism', text: '01.12.2012 holatiga 291 745 161 soʻmlik qurilish-montaj ishlari bajarilmagan.' },
      { id: 'sanctions', title: 'Neustoyka sharti', text: 'Shartnomada aynan bitta buzilish (muddatni kechiktirish) uchun turli neustoyka nazarda tutilgan; daʼvo summasi ularga asoslangan.' },
    ],
    evidence: [
      { id: 'e-contract', title: '5-son shartnoma va 5/1, 5/2 kelishuvlar', text: 'Tender komissiyasi bayonnomalari bilan birga.' },
      { id: 'e-invoices', title: 'Pudratchining hisob-fakturalari', text: '01.12.2012 gacha bajarilgan ishlar hajmi.' },
      { id: 'e-calc', title: 'Buyurtmachining hisob-kitobi', text: 'Neustoyka 134 786 264 soʻm.' },
    ],
    timeline: [
      { date: '17.02.2010', text: 'Tender asosida shartnoma tuzildi.' },
      { date: '16.04.2012', text: 'Tender komissiyasi muddatni uzaytirishni koʻrib chiqdi (9/4-12).' },
      { date: '30.04.2012', text: '5/1-son kelishuv: muddat 30.08.2012 gacha.' },
      { date: '05.11.2012', text: 'Tender komissiyasi yana koʻrib chiqdi (16/4-12).' },
      { date: '26.11.2012', text: '5/2-son kelishuv: narx 2 699 680 629 soʻm, muddat 01.12.2012.' },
      { date: '01.12.2012', text: 'Muddat tugadi: 291 745 161 soʻmlik ish bajarilmagan.' },
    ],
    side: {
      claimant: {
        task: ['Neustoykani asoslang: muddat, bajarilmagan qism, shartnoma sharti.', 'Pudratchining «biz aybdor emasmiz» degan vajiga javob bering.', POLITE],
        confidential: ['Muddat ikki marta, har gal tender komissiyasi bayonnomasi bilan uzaytirilgan: pudratchiga vaqt berilgan.', 'Hisob-kitobni tekshiring: bitta buzilish uchun shartnomada bir necha xil neustoyka yozilgan.'],
      },
      respondent: {
        task: ['Mijozni javobgarlikdan ozod qilish yoki neustoykani kamaytirish uchun asos keltiring.', 'Kamaytirishni soʻrasangiz, sudga qaysi holatlarni koʻrsatishingizni oʻylang.', POLITE],
        confidential: ['Buyurtmachi jalb qilgan boshqa pudrat tashkilotlari oʻz shartnomalarini buzgan; mijozingiz kechikishni shunga bogʻlaydi.', 'Bajarilmagan qism shartnoma bahosining taxminan 11 foizi (291 745 161 / 2 699 680 629).'],
      },
    },
    points: {
      claimant: [['tender', 'bayonnoma'], ['01.12.2012', 'muddat'], ['291 745', 'bajarilmagan'], ['ikki marta', 'uzaytir'], ['penya', 'neustoyka'], ['aybsiz', 'ayb', '333'], ['shartlashuvchi', 'sherik', 'boshqa pudrat']],
      respondent: [['boshqa pudrat', 'uchinchi shaxs', 'buyurtmachi jalb'], ['ayb', '333', '335'], ['kamaytir', '326'], ['alohida hol', 'nomutanosib'], ['bitta buzilish', 'jarima', 'faqat bir'], ['11 foiz', 'bajarilgan qism', 'darajasi'], ['kreditor']],
    },
    disclaimer: UZ,
    topic: 'Neustoyka',
    level: 2,
    skills: ['qoida', 'tavsif', 'hisob'],
    norms: [{ doc: 'FK', n: '261-modda' }, { doc: 'FK', n: '326-modda' }, { doc: 'FK', n: '333-modda' }, { doc: 'FK', n: '335-modda' }, { doc: 'FK2', n: '666-modda' }, { doc: 'PLENUM-OXS-163', n: '3-band' }, { doc: 'PLENUM-OXS-163', n: '3²-band' }, { doc: 'PLENUM-OXS-163', n: '12-band' }],
    basis: { ruling: 'Oliy xoʻjalik sudi sudlov hayʼatining 2013-yil 26-avgustdagi 10-1312/3177-son qarori', url: 'https://lex.uz/docs/2882730', mark: 'T', adapted: 'Daʼvo summasi tarkibi (jarima va penya) qarorda alohida koʻrsatilmagan. Qarordagi «bajarilgan ishlar 2 407 468 soʻm» raqami xato yozilgan, shuning uchun ishga kiritilmadi.' },
    outcome: [
      'Birinchi instansiya: bitta buzilish uchun turli neustoyka nazarda tutilgani sababli faqat penya qoʻllandi - 112 321 887 soʻm, qolgan qismi rad etildi.',
      'Apellyatsiya: FK 326-moddasi boʻyicha penya 56 000 000 soʻmgacha kamaytirildi.',
      'Kassatsiya (26.08.2013) apellyatsiyani oʻz kuchida qoldirdi: sud «alohida hollarda» ikki tomon manfaatini hisobga olib kamaytirishga haqli. Pudratchining «boshqa pudratchilar aybdor» degan vaji qabul qilinmadi.',
    ],
    lessons: [
      'Bitta buzilish uchun faqat bir shakldagi neustoyka undiriladi (OXS Plenumining 163-son qarori, 3-band).',
      'Qarzdorning shartlashuvchi sheriklari majburiyatni buzgani uni javobgarlikdan ozod qilmaydi (FK 333-modda; 163-son qarori, 12-band). Bahsli savol: buyurtmachining oʻzi jalb qilgan pudratchilar - qarzdorning sherigimi yoki kreditor aybimi (FK 335-modda)?',
      'Apellyatsiya penyani ikki baravar kamaytirishni batafsil asoslamagan: bunday qarorga «asoslanmagan kamaytirish» deb eʼtiroz bildirish mumkin.',
      'Bugun: tender natijasida tuzilgan shartnoma shartlari faqat tender komissiyasi bayonnomasi bilan oʻzgartiriladi, aks holda oʻzgarish oʻz-oʻzidan haqiqiy emas (163-son qarori, 3²-band). Bu ishda bayonnomalar bor edi.',
    ],
  },

  /* ───────────── 3. Lizing: quyi chegara ───────────── */
  'lizing-chegara': {
    id: 'lizing-chegara',
    title: 'Lizing: penyani qancha kamaytirish mumkin?',
    court: HALL(2),
    summary: 'Avtomobil va gaz ballon uskunasi lizingi. Lizing beruvchi penyani oʻzi yarmiga kamaytirgan, qarzdor yangi muddatlarni ham buzgan. Endi foiz va penya lizing oluvchi va kafildan solidar undirilmoqda.',
    parties: { claimant: '«A» lizing kompaniyasi', respondent: '«B» (lizing oluvchi) va «V» MChJ (kafil, solidar javobgar)' },
    claim: '16 870 534,22 soʻm foiz va 30 294 760 soʻm penyani ikkala javobgardan solidar undirish.',
    facts: [
      { id: 'lease1', title: '1-lizing shartnomasi', text: '2006-yil 14-dekabrdagi 2006/2-son: 20 ta GAZ-31105 avtomobili.' },
      { id: 'lease2', title: '2-lizing shartnomasi', text: '2007-yil 16-martdagi 2007/2-son: 60 komplekt gaz ballon uskunasi.' },
      { id: 'surety', title: 'Kafillik', text: '«V» MChJ ikkala shartnoma boʻyicha kafil (13.12.2006 va 16.03.2007 dagi kafillik shartnomalari).' },
      { id: 'addenda', title: 'Qoʻshimcha kelishuvlar', text: '21.12.2009 dagi 2- va 5-son kelishuvlar: lizing beruvchi hisoblangan penyani 50 foizga kamaytirdi; qarzdor qarzni tan olib, foizni 01.03.2010 gacha, penyani 01.08.2010 gacha toʻlash majburiyatini oldi. Bu muddatlar ham buzildi.' },
      { id: 'figure', title: 'Penya summasi', text: 'Hujjatlarda penya ikki xil yozilgan: 30 294 760 soʻm va 30 314 760 soʻm.' },
    ],
    evidence: [
      { id: 'e-leases', title: 'Ikki lizing shartnomasi', text: '2006/2 va 2007/2-son.' },
      { id: 'e-acts', title: 'Topshirish-qabul qilish dalolatnomalari', text: '21.12.2006, 07.06.2007 va 31.07.2007: lizing beruvchi mol-mulkni topshirgan.' },
      { id: 'e-surety', title: 'Kafillik shartnomalari', text: '13.12.2006 va 16.03.2007.' },
      { id: 'e-addenda', title: '2- va 5-son kelishuvlar', text: 'Penyaning 50 foizga kamaytirilishi, qarzning tan olinishi, yangi muddatlar.' },
    ],
    timeline: [
      { date: '14.12.2006', text: '20 ta avtomobil lizingi.' },
      { date: '16.03.2007', text: '60 komplekt uskuna lizingi.' },
      { date: '21.12.2009', text: 'Penya 50 foizga kamaytirildi, qarz tan olindi.' },
      { date: '01.03.2010', text: 'Foizni toʻlash muddati - buzildi.' },
      { date: '01.08.2010', text: 'Penyani toʻlash muddati.' },
    ],
    side: {
      claimant: {
        task: ['Foiz va penyani ikkala javobgardan solidar undirishni asoslang.', 'Penya kamaytirilsa, u qaysi chegaradan pastga tushmasligi kerakligini koʻrsating.', POLITE],
        confidential: ['Mijozingiz 2009-yildagi kelishuvlarni novatsiya deb hisoblaydi: «yangi majburiyat - penyani endi kamaytirib boʻlmaydi».', 'Hisobchingiz shu davr uchun FK 327-moddasi boʻyicha foizni hisoblagan: 4 241 266 soʻm.'],
      },
      respondent: {
        task: ['Penyani iloji boricha kamaytirish uchun asos keltiring.', 'Kreditorning novatsiya haqidagi vajiga javob bering.', POLITE],
        confidential: ['20 ta avtomobildan 10 tasi lizing beruvchiga qaytarilgan.', 'Lizing beruvchi penyani bir marta oʻzi kamaytirgan - bu uning yaxshi niyatimi yoki qarzdorga qarshi dalilmi, oʻylab koʻring.'],
      },
    },
    points: {
      claimant: [['novatsiya', '347'], ['tan olgan', 'tan oldi'], ['01.03.2010', '01.08.2010', 'yangi muddat'], ['kafil', 'solidar'], ['327', 'quyi chegara', 'eng kam'], ['50 foiz', 'oʻzi kamaytir'], ['4 241']],
      respondent: [['10 ta', 'qaytarilgan', 'qaytardi'], ['kamaytir', '326'], ['alohida hol', 'nomutanosib'], ['50 foiz', 'yarmi'], ['ikki xil', '30 314'], ['bajarilish darajasi', 'qisman'], ['mulkiy ahvol', 'moliyaviy']],
    },
    disclaimer: UZ,
    topic: 'Neustoyka',
    level: 3,
    skills: ['hisob', 'qoida'],
    norms: [{ doc: 'FK', n: '292-modda' }, { doc: 'FK', n: '326-modda' }, { doc: 'FK', n: '327-modda' }, { doc: 'FK', n: '347-modda' }, { doc: 'FK2', n: '587-modda' }, { doc: 'PLENUM-OXS-163', n: '4-band' }, { doc: 'PLENUM-OXS-163', n: '16-band' }],
    basis: { ruling: 'Oliy xoʻjalik sudi sudlov hayʼatining 2010-yil 12-iyuldagi 10-1021/3457(17)-son qarori', url: 'https://lex.uz/docs/2831719', mark: 'T', adapted: '4 241 266 soʻm - kassatsiya sudi aniqlagan FK 327-moddasi boʻyicha foiz miqdori; oʻyinda u daʼvogarning hisob-kitobi sifatida berilgan.' },
    outcome: [
      'Birinchi instansiya (07.05.2010): foiz toʻliq undirildi, penya ikkala javobgardan solidar tartibda 4 000 000 soʻmgacha kamaytirildi. Apellyatsiya koʻrilmagan.',
      'Kassatsiya (12.07.2010): qoʻshimcha kelishuvlar novatsiya boʻlsa ham, bu sudning FK 326-moddasi boʻyicha kamaytirish huquqini cheklamaydi.',
      'Lekin 4 000 000 soʻm FK 327-moddasidagi foizlardan kam: kamaytirilgan neustoyka bu chegaradan past boʻlmasligi kerak (OXS Plenumining 163-son qarori, 4-band). Penya 4 241 266 soʻmga oshirildi.',
    ],
    lessons: [
      'Sud penyani kamaytirsa, FK 327-moddasi boʻyicha quyi chegarani raqam bilan hisoblab chiqishi shart.',
      'Novatsiya (FK 347-modda) kamaytirishga toʻsiq emas - kreditorning bu vaji sudda oʻtmadi, uning kuchli dalili quyi chegara edi.',
      'Qarzdor uchun «10 ta avtomobil qaytarilgan» - majburiyat qay darajada bajarilganining dalili (FK 326-modda).',
      'Hujjatdagi ikki xil summa - mayda, lekin tekshirilishi kerak boʻlgan narsa: sud qaysi raqamdan hisoblayotganini aniqlang.',
    ],
  },

  /* ───────────── 4. Kam yetkazib berish ───────────── */
  'kam-yetkazish': {
    id: 'kam-yetkazish',
    title: 'Penyadan oldin: qarz bormi oʻzi?',
    court: HALL(2),
    summary: 'Bir yillik yetkazib berish shartnomasi, toʻrt turkum. Yetkazib beruvchi asosiy qarz, shartnomaviy penya va unga qoʻshimcha qonuniy penya soʻraydi. Xaridor qarzning bir qismini tan olgan, kurs farqi va ogʻir moliyaviy ahvol haqida gapiradi.',
    parties: { claimant: '«A» ishlab chiqarish kooperativi (yetkazib beruvchi)', respondent: '«B» ishlab chiqarish birlashmasi (xaridor)' },
    claim: '142 964 465,56 soʻm asosiy qarz, 52 315 185 soʻm shartnomaviy penya va qoʻshimcha ravishda qonuniy penya (kuniga 0,4 foiz, 50 foizgacha) undirish.',
    facts: [
      { id: 'contract', title: 'Shartnoma', text: 'Bir yillik yetkazib berish shartnomasi: tovar 4 ta teng turkumda; toʻlov joʻnatilgandan 30 kun keyin.' },
      { id: 'price', title: 'Narx va kurs', text: 'Narx AQSh dollari ekvivalentida, toʻlov kunidagi Markaziy bank kursi boʻyicha soʻmda toʻlanadi.' },
      { id: 'penalty', title: 'Penya', text: 'Shartnomaviy penya - kechiktirilgan har kun uchun 0,1 foiz.' },
      { id: 'admitted', title: 'Xaridorning pozitsiyasi', text: 'Xaridor kurs farqi bilan birga 71 543 126 soʻm qarzni tan oladi va sud majlisigacha 54 939 287 soʻm toʻlagan. Ogʻir moliyaviy ahvolga ishora qiladi.' },
    ],
    evidence: [
      { id: 'e-contract', title: 'Yetkazib berish shartnomasi', text: 'Turkumlar, toʻlov muddati, kurs sharti, 0,1 foiz penya.' },
      { id: 'e-waybills', title: 'Yuk xatlari (4 turkum)', text: 'Har turkumda haqiqatda joʻnatilgan tovar miqdori.' },
      { id: 'e-payments', title: 'Toʻlov topshiriqnomalari', text: 'Xaridor toʻlovlari, shu jumladan majlisgacha 54 939 287 soʻm.' },
      { id: 'e-calc', title: 'Daʼvogarning hisob-kitobi', text: 'Asosiy qarz 142 964 465,56 soʻm, penya 52 315 185 soʻm.' },
    ],
    timeline: [
      { date: '1-yil', text: 'Shartnoma: 4 turkum, toʻlov 30 kunda.' },
      { date: 'har turkum', text: 'Joʻnatish va toʻlov.' },
      { date: 'majlisgacha', text: 'Xaridor 54 939 287 soʻm toʻladi.' },
    ],
    side: {
      claimant: {
        task: ['Asosiy qarz va ikkala penyani asoslang.', 'Xaridorning kurs va moliyaviy ahvol haqidagi vajlariga javob bering.', POLITE],
        confidential: ['Kooperativ hech bir turkumni shartnomadagi miqdorda joʻnatmagan.', 'Mijozingiz qonuniy penyani shartnomaviy penyaga «qoʻshimcha» soʻramoqchi.'],
      },
      respondent: {
        task: ['Avval asosiy qarzning oʻzini tekshiring, keyin penyaga oʻting.', 'Kurs farqi va moliyaviy ahvol haqidagi vajlaringizni dalil bilan bering.', POLITE],
        confidential: ['Yuk xatlari boʻyicha har bir turkum shartnomadagi miqdordan kam kelgan.', 'Buxgalteriya: haqiqatda olingan tovar uchun toʻliq toʻlangan.'],
      },
    },
    points: {
      claimant: [['shartnoma', 'turkum'], ['30 kun', 'toʻlov muddati'], ['0,1', 'penya'], ['qonuniy penya', '0,4', '670'], ['tan olgan', '71 543'], ['kurs', 'markaziy bank', '245'], ['moliyaviy ahvol', 'ozod qilmaydi']],
      respondent: [['kam yetkaz', 'kam keldi', 'toʻliq yetkazilmagan'], ['yuk xat'], ['olingan tovar', 'toʻliq toʻlangan', 'qarz yoʻq'], ['solishtir', 'jadval'], ['440', 'turkum'], ['ikki penya', 'bitta', 'birga'], ['kamaytir', '326']],
    },
    disclaimer: 'Oʻquv ishi. Oliy xoʻjalik sudi amaliyoti sharhi asosida (taraflar manbada anonim). Huquqiy maslahat emas.',
    topic: 'Yetkazib berish',
    level: 2,
    skills: ['dalil', 'hisob'],
    norms: [{ doc: 'FK2', n: '437-modda' }, { doc: 'FK2', n: '440-modda' }, { doc: 'FK', n: '236-modda' }, { doc: 'FK', n: '245-modda' }, { doc: 'FK', n: '263-modda' }, { doc: 'FK', n: '326-modda' }, { doc: 'SHARTNOMAVIY', n: '32-modda' }, { doc: 'PLENUM-OXS-163', n: '3-band' }, { doc: 'PLENUM-OXS-163', n: '20-band' }],
    basis: { ruling: '«Yetkazib berish shartnomasi shartlarini buzganlik uchun jarima sanksiyalarini undirish toʻgʻrisidagi nizo boʻyicha» sharh, NTV jurnali, 2003-yil 11-iyul, 27-28-son (ish raqami va taraflar koʻrsatilmagan)', url: 'https://buxgalter.uz/doc?id=397609_po_sporu_o_vzyskanii_shtrafnyh_sankciy_za_narushenie_usloviy_dogovora_postavki&prodid=1_vse_zakonodatelstvo_uzbekistana', mark: 'I', adapted: 'Ish 2001-2003-yillarda eski qoidalar bilan koʻrilgan. Oʻsha paytdagi 77-son Plenum qarori bekor qilingan (OXS Plenumining 163-son qarori, 20-band) - bugungi bahsda unga tayanish xato. Turkumlar boʻyicha aniq miqdorlar manbada yoʻq.' },
    outcome: [
      'Shahar xoʻjalik sudi: asosiy qarz undirildi; faqat shartnomaviy 0,1 foiz penya - 17 609 449 soʻm. Qonuniy penya nomutanosib deb rad etildi (eski 77-son Plenum, 4-band).',
      'Apellyatsiya: xaridorning 2001-yil oktabr kursini qoʻllash haqidagi vaji (kurs farqi 15 865 045,25 soʻm boʻlardi) rad etildi - narx chet el valyutasida emas, soʻm ekvivalentida belgilangan. Yetkazib beruvchining yana 34 705 736 soʻm qonuniy penya talabi ham rad etildi.',
      'Kassatsiya ikkala qarorni bekor qilib, daʼvoni TOʻLIQ rad etdi: yetkazib beruvchining oʻzi har turkumni kam yetkazgan, xaridor olingan tovar uchun toʻliq toʻlagan. Birinchi instansiya majlisi paytida qarz yoʻq edi.',
    ],
    lessons: [
      'Penya haqida bahslashishdan oldin asosiy qarz bor-yoʻqligini tekshiring: joʻnatilgan va toʻlangan miqdorni solishtiruv jadvaliga soling.',
      'Turkumlab yetkazib berishda har davr alohida bajariladi (FK 440-modda).',
      'Shartnomaviy va qonuniy penya bitta buzilish uchun birga undirilmaydi (163-son qarori, 3-band); qonuniy penya stavkasi - 670-I-son Qonun 32-modda.',
      'Bekor qilingan qoida («penyani asosiy qarzgacha kamaytirish», eski 77-son Plenum) bugun qoʻllanmaydi.',
    ],
  },

  /* ───────────── 5. Kafillik muddati ───────────── */
  'kafillik-muddati': {
    id: 'kafillik-muddati',
    title: 'Kafil qutulib qoldimi: kafillik muddati va sud tanlovi',
    court: HALL(1),
    summary: 'Xorijiy yetkazib beruvchi shinalar uchun qarzni xaridor va kafildan solidar undirmoqchi. Dastlabki shartnomada arbitraj izohi bor edi, keyin taraflar sud tanlovini oʻzgartirgan. Kafillik shartnomasining oʻz muddati bor.',
    parties: { claimant: '«A» savdo uyi MChJ (Ukraina, yetkazib beruvchi)', respondent: '«B» MChJ (xaridor) va «V» MChJ (kafil)' },
    claim: '317 101 687,50 soʻm qarzni xaridor va kafildan solidar undirish (133 250 AQSh dollari, 1 dollar = 2 379 soʻm).',
    facts: [
      { id: 'c174', title: '174-son shartnoma', text: '2008-yil 19-maydagi shina yetkazib berish shartnomasi (spetsifikatsiyalar 316 100 va 268 832 AQSh dollari). 26.05.2008 dagi kelishuv bilan 9.3-band qoʻshilgan: kechiktirilgan toʻlov uchun yillik 12 foiz penya. Qarz - 61 850 AQSh dollari.' },
      { id: 'c175', title: '175-son shartnoma', text: '2008-yil 25-iyuldagi shartnoma (spetsifikatsiyalar 148 650 va 71 400 AQSh dollari). Qarz - 71 400 AQSh dollari.' },
      { id: 'forum', title: 'Nizo qayerda koʻriladi', text: 'Dastlab nizolar Ukraina Savdo-sanoat palatasi huzuridagi xalqaro tijorat arbitrajiga berilishi kerak edi. 21.02.2013 dagi kelishuvlar: nizolar javobgar joylashgan joydagi davlat sudida, Oʻzbekiston huquqi boʻyicha koʻriladi; «talabnoma tartibi majburiy emas».' },
      { id: 'surety', title: 'Kafillik', text: '11.09.2012 dagi 1-son kafillik shartnomasi; 27.03.2013 dagi qoʻshimcha kelishuv uni solishtirma dalolatnomalardagi qarzlarga ham tatbiq etgan. 5.1-band: nizo kafil joylashgan joydagi sudda, talabnoma tartibi majburiy. 6.2-band: shartnoma 11.09.2014 gacha amal qiladi.' },
    ],
    evidence: [
      { id: 'e-contracts', title: '174 va 175-son shartnomalar', text: 'Spetsifikatsiyalar va qoʻshimcha kelishuvlar bilan.' },
      { id: 'e-forum', title: '21.02.2013 dagi ikki kelishuv', text: 'Nizolarni hal qilish tartibini oʻzgartirish haqida.' },
      { id: 'e-surety', title: 'Kafillik shartnomasi va 27.03.2013 kelishuv', text: '5.1 va 6.2-bandlar bilan.' },
      { id: 'e-recon', title: 'Hisob-fakturalar, yozishmalar, solishtirma dalolatnomalar', text: '22.10.2014 holatiga qarz 133 250 AQSh dollari.' },
    ],
    timeline: [
      { date: '19.05.2008', text: '174-son shartnoma.' },
      { date: '25.07.2008', text: '175-son shartnoma.' },
      { date: '11.09.2012', text: 'Kafillik shartnomasi (6.2-band: 11.09.2014 gacha).' },
      { date: '21.02.2013', text: 'Nizolar Oʻzbekiston davlat sudiga oʻtkazildi.' },
      { date: '27.03.2013', text: 'Kafillik solishtirma dalolatnomalardagi qarzlarga tatbiq etildi.' },
      { date: '11.09.2014', text: 'Kafillik shartnomasida koʻrsatilgan muddat tugadi.' },
      { date: '22.10.2014', text: 'Qarz hisoblangan sana: 133 250 AQSh dollari.' },
      { date: '21.11.2014', text: 'Daʼvoni taʼminlash: javobgarlarning mablagʻi va mol-mulki xatlandi.' },
    ],
    side: {
      claimant: {
        task: ['Qarzni ikkala javobgardan solidar undirishni asoslang.', 'Ish shu sudda koʻrilishi kerakligini koʻrsating.', POLITE],
        confidential: ['Mijozingiz 27.03.2013 dagi kelishuvni kafillik doirasini ham, muddatini ham kengaytirgan deb hisoblaydi.', 'Kafilga alohida talabnoma yuborilgani haqida hujjat topa olmadingiz.'],
      },
      respondent: {
        task: ['Xaridor va kafilni himoya qiling: har biri uchun alohida eʼtiroz toping.', 'Ish qaysi sudda koʻrilishi kerakligi haqida pozitsiya bildiring.', POLITE],
        confidential: ['Kafil sifatida sizni 6.2-band qiziqtiradi.', 'Xaridor tomonida qarz hujjatlari bilan tasdiqlangan; uni inkor etish qiyin.'],
      },
    },
    points: {
      claimant: [['133 250', '317 101', 'qarz'], ['solishtirma', 'dalolatnoma'], ['21.02.2013', 'sud tanlov', 'davlat sud'], ['27.03.2013', 'qoʻshimcha kelishuv'], ['solidar'], ['talabnoma', 'majburiy emas'], ['294', 'qarzdor jalb']],
      respondent: [['11.09.2014', 'muddat', '6.2'], ['298', 'bekor boʻl'], ['arbitraj'], ['talabnoma', '5.1', 'majburiy'], ['kafil joylashgan', 'sudlov'], ['kafil'], ['ozod']],
    },
    disclaimer: UZ,
    topic: 'Kafillik',
    level: 3,
    skills: ['protsess', 'qoida', 'dalil'],
    norms: [{ doc: 'FK', n: '292-modda' }, { doc: 'FK', n: '294-modda' }, { doc: 'FK', n: '298-modda' }, { doc: 'FK', n: '245-modda' }, { doc: 'IPK', n: '33-modda' }],
    basis: { ruling: 'Oliy xoʻjalik sudi sudlov hayʼatining 2015-yil 8-apreldagi 10-1416/21046-son qarori', url: 'https://lex.uz/docs/2839956', mark: 'T', adapted: 'Ish eski Xoʻjalik protsessual kodeksi davrida koʻrilgan. Daʼvo berilgan aniq sana qarorda yoʻq: xatlov 21.11.2014 da qoʻyilgan.' },
    outcome: [
      'Birinchi instansiya (16.01.2015): Ukraina arbitraj izohi amal qiladi deb, daʼvoni toʻliq rad etdi va 317 101 687,50 soʻmlik xatlovni bekor qildi. Apellyatsiya koʻrilmagan.',
      'Kassatsiya (daʼvogar shikoyati va Toshkent shahar prokurori protesti boʻyicha): 2013-yilgi kelishuvlar - alohida sudlovlilik kelishuvi; qarz 317 101 687,50 soʻm xaridordan undirildi.',
      'Kafil ozod qilindi: FK 298-moddasining uchinchi qismiga koʻra kafillik shartnomada koʻrsatilgan muddat (11.09.2014) oʻtgach, daʼvodan oldin bekor boʻlgan. Kafilga daʼvo qilinganda qarzdor ishga jalb qilinadi (FK 294-modda).',
      'Xatlovni bekor qilish oʻz kuchida qoldi; xaridordan 4 756 525,5 soʻm davlat boji va 14 200 soʻm pochta xarajati undirildi.',
    ],
    lessons: [
      'Kafilga daʼvo kafillik muddati ichida berilishi kerak (FK 298-modda, 3-qism). Muddatni oʻtkazib yuborgan kreditor kafilni yoʻqotadi.',
      'Hujjatlar sanalarini jadvalga soling: 2008, 2012, 2013, 2014. Muddat masalasi koʻpincha shu jadvalda koʻrinadi.',
      'Keyinroq tuzilgan sudlovlilik kelishuvi - taraflarning soʻnggi irodasi. Arbitraj izohi bilan farqini ajrating.',
      'Ikki hujjatdagi talabnoma bandlari bir-biriga zid (biri majburiy emas, biri majburiy): kafil uchun talabnoma tartibi alohida tekshiriladi.',
    ],
  },

  /* ───────────── 6. Qoʻriqlash: imzolanmagan dalolatnoma ───────────── */
  'qoriqlash-dalolatnoma': {
    id: 'qoriqlash-dalolatnoma',
    title: 'Qoʻriqlash xizmati: dalolatnoma imzolanmagan, xizmat koʻrsatilganmi?',
    court: HALL(1),
    summary: 'Supermarketni qoʻriqlash shartnomasi xizmatni «ikki taraf imzolagan dalolatnoma» bilan rasmiylashtirishni talab qiladi. Birorta dalolatnoma imzolanmagan. Ijrochi haq talab qiladi, buyurtmachi esa avansni qaytarishni soʻrab qarshi daʼvo bergan.',
    parties: { claimant: '«A» MChJ (qoʻriqlash firmasi, ijrochi)', respondent: '«B» MChJ (supermarket, buyurtmachi)' },
    claim: '16 497 600 soʻm qarz undirish. Qarshi daʼvo: 8 700 000 soʻm avansni qaytarish, 1 001 095,80 soʻm foiz va 1 000 000 soʻm zarar (jami 10 701 095,80 soʻm).',
    facts: [
      { id: 'contract', title: 'Shartnoma', text: '2012-yil 2-iyuldagi 6-son shartnoma: Toshkent shahridagi supermarketni qoʻriqlash. Narx oyiga 8 700 000 soʻm, 100 foiz oldindan toʻlov (4.1-4.2-bandlar).' },
      { id: 'act', title: '4.5-band', text: 'Xizmat ikki taraf imzolagan bajarilgan ishlar dalolatnomasi bilan rasmiylashtiriladi.' },
      { id: 'paid', title: 'Toʻlov', text: 'Avgust uchun 31.07.2012 dagi 138-son topshiriqnoma bilan oldindan toʻlangan. Sentyabr toʻlanmagan. Birorta dalolatnoma imzolanmagan.' },
      { id: 'letters', title: 'Yozishmalar', text: '13.08.2012: buyurtmachining 24-son xati - ijro boʻyicha eʼtirozlar roʻyxati. 18.09.2012: ijrochining 114-son javobi - eʼtirozlar rad etilgan. 24.09.2012: ijrochining xati - shartnomani bekor qilish va sentyabr dalolatnomasini imzolash taklifi.' },
    ],
    evidence: [
      { id: 'e-contract', title: '6-son shartnoma', text: '4.1, 4.2 va 4.5-bandlar.' },
      { id: 'e-acts', title: 'Yuborilgan dalolatnomalar', text: 'Avgust va sentyabr uchun, ijrochi imzolagan. 24.09.2012 dagi xat bilan birga buyurtmachi vakili shaxsan qabul qilib olgan.' },
      { id: 'e-logs', title: 'Topshirish-qabul jurnallari', text: 'Bino va omborlarni topshirish-qabul qilish daftarlari: ikki taraf rahbari va xodimlari imzolagan.' },
      { id: 'e-claim', title: '24-son va 114-son xatlar', text: 'Buyurtmachining eʼtirozlari va ijrochining javobi.' },
      { id: 'e-order', title: '138-son toʻlov topshiriqnomasi', text: 'Avgust uchun 8 700 000 soʻm.' },
    ],
    timeline: [
      { date: '02.07.2012', text: 'Shartnoma tuzildi.' },
      { date: '31.07.2012', text: 'Avgust uchun avans toʻlandi.' },
      { date: '13.08.2012', text: 'Buyurtmachining eʼtiroz xati (24-son).' },
      { date: '18.09.2012', text: 'Ijrochi eʼtirozlarni rad etdi (114-son).' },
      { date: '24.09.2012', text: 'Ijrochi bekor qilish va sentyabr dalolatnomasini imzolashni taklif qildi.' },
    ],
    side: {
      claimant: {
        task: ['Xizmat koʻrsatilganini isbotlang - imzolanmagan dalolatnomadan tashqari nima bor?', 'Qarshi daʼvoga javob bering.', POLITE],
        confidential: ['Jurnallarni imzolagan xodimlar guvoh boʻlishi mumkin - ularni chaqirishni soʻrash huquqingiz bor.', 'Buyurtmachi vakili dalolatnomalarni va xatni shaxsan qabul qilgan.'],
      },
      respondent: {
        task: ['Shartnomaning 4.5-bandiga tayanib, talabga eʼtiroz bildiring.', 'Qarshi talablaringizni asoslang.', POLITE],
        confidential: ['Mijozingiz xizmat sifatidan norozi edi - 24-son xatda eʼtirozlar bor.', 'Qarshi daʼvo sudga berilgan, lekin sud uni ish yuritishga qabul qilgani haqida ajrim yoʻq.'],
      },
    },
    points: {
      claimant: [['jurnal', 'daftar'], ['guvoh', 'xodim'], ['shaxsan', 'qabul qilib olgan', 'vakil'], ['yuborilgan', 'dalolatnoma'], ['703', '705', 'haq toʻla'], ['qarshi daʼvo', 'qabul qilinmagan'], ['avgust', 'koʻrsatilgan']],
      respondent: [['4.5', 'ikki taraf', 'imzolangan dalolatnoma'], ['imzolanmagan'], ['24-son', 'eʼtiroz'], ['avans', '8 700 000', 'qaytar'], ['sentyabr', 'toʻlanmagan'], ['shartnoma erkinligi', 'kelishgan'], ['sifat']],
    },
    disclaimer: UZ,
    topic: 'Dalolatnoma',
    level: 2,
    skills: ['dalil', 'protsess'],
    norms: [{ doc: 'FK', n: '236-modda' }, { doc: 'FK2', n: '703-modda' }, { doc: 'FK2', n: '705-modda' }, { doc: 'IPK', n: '68-modda' }, { doc: 'IPK', n: '88-modda' }, { doc: 'IPK', n: '160-modda' }, { doc: 'IPK', n: '161-modda' }, { doc: 'PLENUM-OXS-306', n: '9-band' }],
    basis: { ruling: 'Oliy xoʻjalik sudi sudlov hayʼatining 2013-yil 28-oktabrdagi 10-1304/10764-son qarori', url: 'https://lex.uz/docs/2875644', mark: 'T', adapted: 'Supermarket manzili olib tashlandi. Qarorda 24.09.2012 dagi xat bir joyda 19-son, boshqa joyda 16-9-son deb yozilgan - shuning uchun raqamsiz berildi.' },
    outcome: [
      'Birinchi instansiya va apellyatsiya: imzolangan dalolatnoma yoʻq - xizmat isbotlanmagan. Daʼvo rad etildi (sentyabr uchun 6 960 000 soʻm ham), penya ham rad.',
      'Qarshi daʼvo qisman: avgust avansi 8 700 000 soʻm qaytarildi. Foiz rad etildi: buyurtmachi tayangan FK normasi xizmat koʻrsatish shartnomasiga tatbiq etilmaydi. Zarar isbotlanmagan.',
      'Kassatsiya (28.10.2013) qarorlarni bekor qilib, ishni qayta koʻrishga yubordi: yuborilgan dalolatnomalar, xatlar va ikki taraf imzolagan jurnallarga baho berilmagan, ularni imzolagan shaxslar chaqirilmagan; birinchi instansiya qarshi daʼvoni ish yuritishga rasman qabul qilmagan.',
      'Qayta koʻrilgandan keyingi yakuniy natija manbada yoʻq.',
    ],
    lessons: [
      '«Ikki tomonlama dalolatnoma» sharti boʻlsa ham, xizmat boshqa dalillar bilan isbotlanishi mumkin: yuborilgan dalolatnomalar, qabul belgisi, jurnallar, guvohlar (IPK 68, 88-moddalar). Pudrat va ijarada bu qoida Plenumda yozilgan (306-son qarori, 9-band; 234-son qarori, 9-band).',
      'Qarshi daʼvo rasmiy berilishi va ish yuritishga qabul qilinishi kerak (IPK 160, 161-moddalar).',
      'Tipik xato: ijrochi «xizmat koʻrsatildi» deydi-yu, dalil keltirmaydi; buyurtmachi faqat imzo yoʻqligiga tayanadi.',
    ],
  },

  /* ───────────── 7. Ijara: qaytarish dalolatnomasi ───────────── */
  'ijara-qaytarish': {
    id: 'ijara-qaytarish',
    title: 'Uch yillik sukut: qaytarish dalolatnomasi yoʻq - ijara davom etadimi?',
    court: HALL(2),
    summary: 'Angar besh oyga ijaraga berilgan. Ijarachi muddat uchun toʻlab, chiqib ketgan, lekin qaytarish dalolatnomasi imzolanmagan. Uch yildan keyin ijaraga beruvchi shu uch yil uchun ijara haqini talab qiladi.',
    parties: { claimant: '«A» yakka tartibdagi tadbirkor (ijaraga beruvchi)', respondent: '«B» MChJ (ijarachi)' },
    claim: '2015-yil iyunidan 2018-yil iyunigacha boʻlgan davr uchun taxminan 3,9 mln rubl ijara haqi undirish (asl ish summasi saqlangan).',
    facts: [
      { id: 'lease', title: 'Shartnoma', text: '2015-yil yanvarda metall angar 2015-yil maygacha ijaraga berilgan, oyiga 113 000 rubl.' },
      { id: 'terms', title: 'Qaytarish sharti', text: 'Shartnoma ijarachidan chiqib ketishdan bir oy oldin yozma xabar berishni va angarni qaytarish dalolatnomasi bilan topshirishni talab qiladi.' },
      { id: 'start', title: 'Boshida', text: 'Ijara boshida topshirish dalolatnomasi ham imzolanmagan.' },
      { id: 'paid', title: 'Toʻlov', text: '2015-yil iyunda ijarachi butun muddat uchun haqni toʻlagan.' },
      { id: 'demand', title: 'Talab', text: '2018-yil mayda ijaraga beruvchi: qaytarish dalolatnomasi yoʻq, demak shartnoma nomaʼlum muddatga uzaygan.' },
    ],
    evidence: [
      { id: 'e-lease', title: 'Ijara shartnomasi', text: 'Muddat, narx, xabar berish va qaytarish dalolatnomasi sharti.' },
      { id: 'e-pay', title: '2015-yil iyundagi toʻlov', text: 'Butun muddat uchun.' },
      { id: 'e-demand', title: '2018-yil maydagi talab', text: 'Taxminan 3,9 mln rubl.' },
    ],
    timeline: [
      { date: 'yanvar 2015', text: 'Angar ijaraga berildi (topshirish dalolatnomasisiz).' },
      { date: 'may 2015', text: 'Ijara muddati tugadi.' },
      { date: 'iyun 2015', text: 'Ijarachi butun muddat uchun toʻladi.' },
      { date: '2015-2018', text: 'Taraflar oʻrtasida yozishma yoʻq.' },
      { date: 'may 2018', text: 'Ijaraga beruvchining uch yillik talabi.' },
    ],
    side: {
      claimant: {
        task: ['Shartnoma davom etganini va haq toʻlanishi kerakligini asoslang.', 'Ijarachining «chiqib ketganmiz» degan vajiga javob bering.', POLITE],
        confidential: ['Ijarachi yozma xabar bermagan va qaytarish dalolatnomasini taklif qilmagan.', 'Angardan 2015-yildan keyin kim foydalangani haqida mijozingizda hujjat yoʻq.'],
      },
      respondent: {
        task: ['Muddatdan keyin mulkdan foydalanilmaganini koʻrsating.', 'Talabning asossizligini dalillar bilan koʻrsating.', POLITE],
        confidential: ['Mijozingiz angarni 2015-yil maydan keyin ishlatmagan.', 'Yozma xabar yuborilmagan - bu sizning zaif joyingiz.'],
      },
    },
    points: {
      claimant: [['qaytarish dalolatnoma'], ['yozma xabar', 'bir oy'], ['553', 'nomaʼlum muddat', 'uzaygan'], ['eʼtiroz bildirmagan', 'foydalanishni davom'], ['113 000'], ['shartnoma'], ['majburiyat', 'bajarmagan']],
      respondent: [['foydalanmagan', 'foydalanish yoʻq'], ['toʻlagan', 'butun muddat'], ['topshirish dalolatnoma', 'boshida'], ['uch yil', 'sukut'], ['553', 'ikki shart', '12-band'], ['9-modda', 'suiisteʼmol', 'vijdon'], ['dalil']],
    },
    disclaimer: ABROAD,
    topic: 'Ijara',
    level: 2,
    skills: ['dalil', 'tavsif'],
    norms: [{ doc: 'FK2', n: '541-modda' }, { doc: 'FK2', n: '553-modda' }, { doc: 'PLENUM-OXS-234', n: '9-band' }, { doc: 'PLENUM-OXS-234', n: '12-band' }, { doc: 'FK', n: '9-modda' }, { doc: 'IPK', n: '68-modda' }],
    basis: { ruling: 'Rossiya Federatsiyasi Oliy sudi Iqtisodiy nizolar boʻyicha sudlov hayʼatining 2020-yil 15-maydagi 310-ЭС19-26908-son ajrimi (А35-6435/2018)', url: 'https://www.advgazeta.ru/novosti/vs-zashchitil-arendatora-ne-podpisavshego-akt-o-vozvrate-imushchestva-ego-vladeltsu-posle-okonchaniya-arendy/', mark: 'I', adapted: 'Faktlar yuridik nashr bayonidan. Rossiya FKning tegishli normasi oʻrniga Oʻzbekiston FK 553-moddasi va OXS Plenumining 234-son qarori qoʻllanadi.' },
    outcome: [
      'Birinchi instansiya va apellyatsiya: daʼvo rad etildi - ijarachi angardan faqat muddat davomida foydalangan, toʻliq toʻlagan va keyin foydalanmagan.',
      'Kassatsiya bekor qilib, qayta koʻrishga yubordi: shartnomani bekor qilmasdan va dalolatnomasiz chiqib ketish ijarachini toʻlovdan ozod qilmaydi.',
      'Oliy sud kassatsiyani bekor qilib, rad etish haqidagi qarorni tikladi: xabar va dalolatnomaning yoʻqligi «foydalanish davom etganidan dalolat berishi mumkin, lekin soʻzsiz dalil emas». Boshida dalolatnoma boʻlmagani uchun oxirida uning yoʻqligi hal qiluvchi emas.',
    ],
    lessons: [
      'Oʻzbekistonda shartnoma nomaʼlum muddatga qayta tuzilgan hisoblanishi uchun ikki shart birga kerak: ijarachi foydalanishni davom ettirgan VA ijaraga beruvchi eʼtiroz bildirmagan (FK 553-modda, 4-qism; 234-son qarori, 12-band).',
      'Haqiqiy munosabatlar dalolatnomasiz ham boshqa dalillar bilan isbotlanadi (234-son qarori, 9-band) - bu qoida ikki tomonga ham xizmat qiladi.',
      'Tipik xato: hujjatni mazmundan ustun qoʻyish - «dalolatnoma yoʻq, demak ijara davom etadi».',
    ],
  },

  /* ───────────── 8. Qurilish: qabul qilinmagan ish ───────────── */
  'qurilish-qabul': {
    id: 'qurilish-qabul',
    title: 'Bar qurildi, foydalanildi - ish qabul qilinganmi?',
    court: HALL(3),
    summary: 'Dam olish parkida bar va uychalar qurilishi. Pudratchi qolgan toʻlovni talab qiladi: ish bajarilgan, buyurtmachi bardan foydalangan. Buyurtmachi kamchiliklar roʻyxatini yuborgan va narxni mutanosib kamaytirishni soʻrab qarshi daʼvo bergan.',
    parties: { claimant: '«A» MChJ (pudratchi)', respondent: '«B» MChJ (buyurtmachi)' },
    claim: '8 000 000 tenge (narxning qolgan qismi) undirish. Qarshi daʼvo: kamchiliklar uchun narxni mutanosib kamaytirish.',
    facts: [
      { id: 'contract', title: 'Shartnoma', text: '2025-yil 2-maydagi shartnoma: «bar va uychalar» obyekti. Narx 18 000 000 tenge: 10 000 000 - 06.05.2025 da toʻlangan, 8 000 000 - ish qabul qilinganda (3.2-band). Muddat - 40 kun.' },
      { id: 'scope', title: 'Ish hajmi', text: '1-ilova: «texnik topshiriq boʻyicha batafsil koʻrsatmalarni buyurtmachi tomonidan muhandis beradi». 2-ilova: spetsifikatsiya (rasm va oʻlchamlar bilan).' },
      { id: 'form', title: '8.1-band', text: 'Shartnomaga oʻzgartishlar faqat yozma va imzolangan holda kiritiladi.' },
      { id: 'use', title: 'Foydalanish', text: 'Buyurtmachi barda tadbirlar va festivallar oʻtkazgan.' },
    ],
    evidence: [
      { id: 'e-media', title: 'Pudratchining foto, video va audioyozuvlari', text: 'Pudratchi aytishicha, audioyozuvda buyurtmachining bosh muhandisi ishni «qabul qilgani» eshitiladi. Guvoh koʻrsatmalari belgilangan muddatdan kech topshirilgan.' },
      { id: 'e-claims', title: 'Buyurtmachining 1 va 2-son eʼtirozlari', text: '23.06.2025: kamchiliklar va kechikish. 15.07.2025: birgalikdagi koʻrikdan keyin asosli rad javobi.' },
      { id: 'e-defects', title: 'Koʻrik dalolatnomalari va kamchiliklar jadvali', text: 'Ochiq metall romlar, sifatsiz yogʻoch, «1-nav qaragʻay» oʻrniga DSP, sunʼiy toshdan stol usti yoʻq, pardozlash sifatsiz.' },
      { id: 'e-estimates', title: 'Tuzatish smetalari', text: 'Buyurtmachining ikki smetasi: 7 200 000 va 6 500 000 tenge (bardan foydalanilgandan keyin tuzilgan).' },
    ],
    timeline: [
      { date: '02.05.2025', text: 'Shartnoma tuzildi.' },
      { date: '06.05.2025', text: '10 000 000 tenge toʻlandi.' },
      { date: '13.06.2025', text: 'Buyurtmachi obyektni koʻrib, suratga oldi.' },
      { date: '23.06.2025', text: '1-son eʼtiroz: kamchiliklar va kechikish.' },
      { date: '24.06.2025', text: 'Pudratchining talabnomasi: dalolatnomani imzolash va 8 000 000 tenge.' },
      { date: '15.07.2025', text: 'Birgalikdagi koʻrik; shu kuni 2-son asosli rad javobi.' },
      { date: '07.11.2025', text: 'Daʼvo berildi.' },
      { date: '27.02.2026', text: 'Qarshi daʼvo: tuzatish oʻrniga narxni mutanosib kamaytirish.' },
    ],
    side: {
      claimant: {
        task: ['Ish bajarilgani va qabul qilinganini isbotlang.', 'Buyurtmachining kamchiliklar roʻyxati va smetalariga javob bering.', POLITE],
        confidential: ['Muhandis joyida koʻp tafsilotni ogʻzaki maʼqullagan.', 'Buyurtmachi ishni toʻrt marta toʻxtatgan, lekin bu haqda rasmiy talab yozmagansiz.'],
      },
      respondent: {
        task: ['Ish qabul qilinmaganini va rad etish asosli ekanini koʻrsating.', 'Narxni qancha kamaytirish kerakligini asoslang.', POLITE],
        confidential: ['Muhandisda shartnomani oʻzgartirish vakolati yoʻq edi.', 'Bardan foydalanish zararni kamaytirish uchun edi - mavsum oʻtib ketmasligi kerak edi.'],
      },
    },
    points: {
      claimant: [['foydalan', 'tadbir', 'festival'], ['muhandis', 'maʼqulla', 'koʻrsatma'], ['1-ilova'], ['audio', 'video', 'foto'], ['ekspertiza'], ['asossiz', 'rad etish asos'], ['8 000 000']],
      respondent: [['23.06', '15.07', 'rad javob'], ['kamchilik', 'DSP', 'qaragʻay'], ['vakolat', 'muhandis'], ['8.1', 'yozma'], ['zararni kamaytir', 'foydalanish qabul emas'], ['mutanosib', 'kamaytir', 'narx'], ['ekspertiza']],
    },
    disclaimer: ABROAD,
    topic: 'Dalolatnoma',
    level: 3,
    skills: ['dalil', 'protsess', 'hisob'],
    norms: [{ doc: 'FK2', n: '646-modda' }, { doc: 'FK2', n: '680-modda' }, { doc: 'FK', n: '384-modda' }, { doc: 'PLENUM-OXS-306', n: '9-band' }, { doc: 'PLENUM-OXS-306', n: '10-band' }, { doc: 'PLENUM-OXS-306', n: '11-band' }, { doc: 'IPK', n: '80-modda' }],
    basis: { ruling: 'AIFC Kichik daʼvolar sudi, Samruk Service Group LLP v Tethys Aktau II LLP, AIFC-C/SCC/2025/0063, hukm 10.08.2026', url: 'https://court.aifc.kz/wp-content/uploads/2026/08/AIFC-Court-Case-No.-63-of-2025-Judgment_ENG.pdf', mark: 'T', adapted: 'Qozogʻiston FK pudrat moddalari oʻrniga Oʻzbekiston FK va OXS Plenumining 306-son qarori qoʻllanadi. Hukmda shartnoma raqami ikki xil yozilgan (TA-0237 va TA-2037) - raqamsiz berildi.' },
    outcome: [
      'Ish asosan bajarilgan, lekin ayrim qismlari shartnomaga mos emas.',
      'Muhandis maʼqullagan tafsilotlar 1-ilovadagi «batafsil koʻrsatmalar» hisoblanadi, shartnomani oʻzgartirish emas - ular yuzasidan eʼtiroz bildirib boʻlmaydi.',
      'Ish qabul qilinmagan: 23.06 va 15.07 dagi asosli rad javoblari sababli imzolashni rad etish oʻrinli. Ekspertiza tayinlamaslik qabul emas; bardan foydalanish - zararni oqilona kamaytirish, qabul emas.',
      'Buyurtmachining smetalari 18 mln tengelik narxga nisbatan oshirilgan va foydalanishdan keyingi eskirishdan soʻng tuzilgan. Ekspertiza boʻlmagani uchun sud kamaytirishni oʻzi 3 500 000 tenge deb baholadi.',
      'Natija: buyurtmachi 4 500 000 tenge va 132 000 tenge sud yigʻimini (jami 4 632 000) 28 kun ichida toʻlaydi. Har ikki tomonning yuridik xarajatlari undirilmadi.',
    ],
    lessons: [
      'Oʻzbekistonda farq: sifat boʻyicha nizoda ekspertiza istagan tarafning talabi bilan tayinlanishi shart (FK 646-modda, 5-qism; 306-son qarori, 9-band). Shuning uchun bu yerda ekspertiza iltimosi - markaziy taktik qadam.',
      'Bir tomonlama dalolatnoma faqat sud rad etish sabablarini asosli deb topsa haqiqiy emas (FK 680-modda; 306-son qarori, 9-band).',
      'Vakolatsiz vakil imzolagan dalolatnoma qabul hisoblanmaydi, lekin dalillardan biri boʻlishi mumkin (306-son qarori, 11-band).',
      'Tipik xatolar: pudratchi - audiodagi ogʻzaki «qabul»ga tayanish va guvohlarni kech topshirish; buyurtmachi - smetani oshirib yuborish.',
    ],
  },

  /* ───────────── 9. Video: natijasiz dalolatnoma ───────────── */
  'video-natija': {
    id: 'video-natija',
    title: 'Dalolatnoma yuborilgan, video yoʻq',
    court: HALL(2),
    summary: 'Video tayyorlash shartnomasi. Buyurtmachi avans toʻlamagan; pudratchi videoni baribir tayyorlagan va bir tomonlama dalolatnoma yuborgan, lekin videoning oʻzini yoki havolasini bermagan. Asosli rad javobi ham kelmagan.',
    parties: { claimant: '«A» MChJ (pudratchi)', respondent: '«B» savdo uyi MChJ (buyurtmachi)' },
    claim: 'Ish bahosi va avans hamda yakuniy toʻlov kechiktirilgani uchun penya undirish (summalar manbada koʻrsatilmagan).',
    facts: [
      { id: 'contract', title: 'Shartnoma', text: '2023-yil sentyabrda ramkaviy shartnoma va qoʻshimcha kelishuv: video tayyorlash. Ish muddati - 03.11.2023. Avans kechiksa, muddat shuncha kunga suriladi.' },
      { id: 'advance', title: 'Avans', text: 'Buyurtmachi avansni umuman toʻlamagan.' },
      { id: 'act', title: '6.5-band', text: 'Buyurtmachi 5 ish kuni ichida dalolatnomani imzolashi yoki asosli rad javobi berishi kerak. Shartnoma natijaga havolani dalolatnoma va hisob-faktura bilan birga topshirishni talab qiladi.' },
      { id: 'work', title: 'Natija', text: 'Pudratchi 1 daqiqa 17 soniyalik video tayyorlagan va uni 16.11.2023 da koʻrsatganini aytadi.' },
    ],
    evidence: [
      { id: 'e-contract', title: 'Shartnoma va qoʻshimcha kelishuv', text: 'Muddat, avans, 6.5-band.' },
      { id: 'e-act', title: '16.11.2023 sanali dalolatnoma', text: '01.12.2023 da yuborilgan, 22.12.2023 da olingan. Imzolanmagan, videoga havola yoʻq.' },
      { id: 'e-link', title: 'Videoga havola', text: 'Birinchi marta 10.06.2024 dagi sud majlisida berilgan.' },
    ],
    timeline: [
      { date: 'sentyabr 2023', text: 'Shartnoma va qoʻshimcha kelishuv.' },
      { date: '03.11.2023', text: 'Ish muddati (avans toʻlanmagan).' },
      { date: '16.11.2023', text: 'Pudratchi videoni koʻrsatganini aytadi; dalolatnoma shu sana bilan.' },
      { date: '01.12.2023', text: 'Dalolatnoma yuborildi.' },
      { date: '22.12.2023', text: 'Dalolatnoma olindi - javob yoʻq.' },
      { date: '31.12.2023', text: 'Shartnoma muddati tugadi.' },
      { date: '10.06.2024', text: 'Videoga havola birinchi marta - sud majlisida.' },
    ],
    side: {
      claimant: {
        task: ['Ish bajarilgani va haq toʻlanishi kerakligini asoslang.', 'Buyurtmachi 5 ish kunida asosli rad javobi bermaganiga eʼtibor qarating.', POLITE],
        confidential: ['Avans toʻlanmagani uchun ishni boshlashga majbur emas edingiz, lekin baribir qildingiz.', 'Dalolatnoma bilan birga havola yuborilmagan.'],
      },
      respondent: {
        task: ['Toʻlov uchun asos yoʻqligini koʻrsating.', 'Pudratchining «rad javobi bermagansiz» degan vajiga javob bering.', POLITE],
        confidential: ['Mijozingiz videoni hech qachon olmagan va koʻrmagan.', 'Avans toʻlanmagan - bu sizning zaif joyingiz boʻlishi mumkin.'],
      },
    },
    points: {
      claimant: [['6.5', '5 ish kuni'], ['rad javob', 'asosli rad'], ['16.11', 'koʻrsat'], ['avans', 'toʻlanmagan'], ['bir tomonlama', 'dalolatnoma'], ['bajarilgan', 'video'], ['muddat surildi', 'surilgan']],
      respondent: [['havola', 'natija yoʻq', 'topshirilmagan'], ['10.06.2024', 'sudda'], ['22.12', '01.12', 'kech'], ['31.12.2023', 'tugagan'], ['qiziqish', 'yoʻqot'], ['hajm', 'sifat', 'tekshirib boʻlmaydi'], ['dalolatnoma']],
    },
    disclaimer: ABROAD,
    topic: 'Dalolatnoma',
    level: 2,
    skills: ['dalil', 'tavsif'],
    norms: [{ doc: 'FK', n: '236-modda' }, { doc: 'FK2', n: '642-modda' }, { doc: 'FK2', n: '646-modda' }, { doc: 'PLENUM-OXS-306', n: '9-band' }, { doc: 'IPK', n: '68-modda' }],
    basis: { ruling: 'Rossiya Federatsiyasi Oliy sudi Iqtisodiy nizolar boʻyicha sudlov hayʼatining 2025-yil 3-oktabrdagi 305-ЭС25-5342-son ajrimi (А40-70779/2024)', url: 'https://www.eg-online.ru/article/500058/', mark: 'I', adapted: 'Faktlar yuridik nashr bayonidan; summalar manbada yoʻq. Oʻzbekiston FK va 306-son Plenum qarori qoʻllanadi (qurilish qoidasi analogiya boʻyicha).' },
    outcome: [
      'Birinchi instansiya: daʼvo rad etildi - avans toʻlanmagani uchun pudratchi ishni boshlashga majbur emas edi; natija oylab kech topshirilgan, buyurtmachi qiziqishini yoʻqotgan.',
      'Apellyatsiya va kassatsiya: daʼvo qanoatlantirildi - asosli rad javobi berilmagan.',
      'Oliy sud ikkalasini bekor qilib, birinchi instansiya qarorini tikladi: shartnoma natijaga havolani dalolatnoma bilan birga topshirishni talab qilgan; natija boʻlmasa, hajm va sifatni tekshirib boʻlmaydi. Rad javobi yoʻqligining oʻzi bir tomonlama dalolatnomani toʻlovga asos qilmaydi.',
    ],
    lessons: [
      'Oʻzbekistonda bir tomonlama dalolatnomani rad etish asoslari tor (306-son qarori, 9-band) - pudratchi tomoni kuchliroq koʻrinadi. Buyurtmachining kuchli dalili: natija topshirilmagan boʻlsa, qabul qilinadigan narsaning oʻzi yoʻq.',
      'Kechikish tufayli qiziqish yoʻqotilganini buyurtmachi isbotlashi kerak (FK 642-modda, 2-qism).',
      'Sanalar zanjiri hal qiladi: 03.11, 16.11, 01.12, 22.12, 31.12, 10.06.',
    ],
  },

  /* ───────────── 10. Penya shartnoma bekor qilingandan keyin ───────────── */
  'penya-bekor': {
    id: 'penya-bekor',
    title: 'Kunlik 0,1 foiz: penya qachongacha hisoblanadi?',
    court: HALL(1),
    summary: 'Energetika kompaniyasi uchun savdo dasturi. Pudratchi kechikkan, keyin buyurtmachi shartnomani bekor qilgan. Buyurtmachi bekor qilingan kungacha penya va zararni, pudratchi esa toʻlanmagan hisob-fakturalarni talab qiladi.',
    parties: { claimant: '«A» kompaniyasi (buyurtmachi)', respondent: '«B» kompaniyasi (dasturiy taʼminot pudratchisi)' },
    claim: 'Shartnoma bekor qilingan kungacha kunlik 0,1 foiz penya va oʻrnini bosuvchi tizim xarajatlari hamda behuda xarajatlarni undirish.',
    facts: [
      { id: 'contract', title: 'Shartnoma', text: '2013-yil 8-fevral: tovar savdosi tizimini loyihalash, oʻrnatish va qoʻllab-quvvatlash. 1-bosqich narxi 6 920 000 AQSh dollari, bosqichlar boʻyicha toʻlanadi.' },
      { id: 'delay', title: 'Kechikish', text: '1-bosqichning 1-2-qismlari 19.03.2014 da, 149 kun kech topshirilgan; buyurtmachi toʻlagan. Keyingi qismlar topshirilmagan.' },
      { id: 'c53', title: '5.3-band', text: '«Pudratchi ishni belgilangan muddatda topshirmasa va kechikish buyurtmachi sababli boʻlmasa, topshirilmagan ishning 0,1 foizi miqdorida har bir kechikkan kun uchun, topshirish muddatidan BUYURTMACHI ISHNI QABUL QILGAN KUNGACHA penya toʻlaydi.»' },
      { id: 'c123', title: '12.3-band', text: 'Pudratchining umumiy javobgarligi u olgan shartnoma narxi bilan cheklanadi. Bu cheklov firibgarlik, ehtiyotsizlik, qoʻpol ehtiyotsizlik yoki qasddan qilingan qilmish uchun javobgarlikka tatbiq etilmaydi.' },
    ],
    evidence: [
      { id: 'e-contract', title: 'Shartnoma (toʻliq matni)', text: '5.3 va 12.3-bandlar.' },
      { id: 'e-delivery', title: '1-2-qismlarni topshirish hujjatlari', text: '19.03.2014, 149 kun kechikish.' },
      { id: 'e-termination', title: 'Bekor qilish haqidagi xat', text: '23.03.2015.' },
      { id: 'e-paid', title: 'Buyurtmachi toʻlovlari', text: 'Bekor qilishgacha 1 038 000 AQSh dollari.' },
    ],
    timeline: [
      { date: '08.02.2013', text: 'Shartnoma tuzildi.' },
      { date: '19.03.2014', text: '1-2-qismlar 149 kun kech topshirildi.' },
      { date: '12.02.2015', text: 'Pudratchi toʻlanmagan hisob-fakturalar boʻyicha daʼvo qildi.' },
      { date: '23.03.2015', text: 'Buyurtmachi shartnomani bekor qildi va qarshi talab qoʻydi.' },
    ],
    side: {
      claimant: {
        task: ['Penya bekor qilingan kungacha hisoblanishini asoslang.', 'Zararni cheklovsiz undirish uchun asos keltiring.', POLITE],
        confidential: ['Topshirilmagan ishlar hech qachon tugallanmagan.', 'Mijozingiz bekor qilishgacha 1 038 000 AQSh dollari toʻlagan.'],
      },
      respondent: {
        task: ['Penya qaysi davr uchun va qaysi ish uchun hisoblanishini oʻz talqiningiz bilan koʻrsating.', 'Javobgarlik cheklovidan foydalaning.', POLITE],
        confidential: ['5.3-band «buyurtmachi qabul qilgan kungacha» deydi - qabul qilinmagan ish uchun qachon?', 'Cheklovdan istisno «ehtiyotsizlik»ni ham sanaydi - u har qanday sifatsiz ishni qamrab olsa, cheklov maʼnosiz boʻlib qoladi.'],
      },
    },
    points: {
      claimant: [['bekor qilingan kun', 'bekor qilinguncha', '23.03.2015'], ['149 kun', 'kechik'], ['0,1', '5.3'], ['ehtiyotsizlik', 'istisno'], ['zarar', 'oʻrnini bosuvchi'], ['260', 'neustoyka'], ['325', 'qoplanmagan qism']],
      respondent: [['qabul qilgan kun', 'qabul qilinmagan'], ['cheklov', '12.3', 'shartnoma narxi'], ['326', 'kamaytir'], ['nomutanosib'], ['14-modda', 'kamroq miqdor'], ['bitta band', 'butun band', 'kontekst'], ['penya']],
    },
    disclaimer: ABROAD,
    topic: 'Neustoyka',
    level: 3,
    skills: ['tavsif', 'qoida', 'hisob'],
    norms: [{ doc: 'FK', n: '14-modda' }, { doc: 'FK', n: '260-modda' }, { doc: 'FK', n: '261-modda' }, { doc: 'FK', n: '325-modda' }, { doc: 'FK', n: '326-modda' }, { doc: 'FK', n: '333-modda' }, { doc: 'PLENUM-OXS-163', n: '16-band' }],
    basis: { ruling: 'Buyuk Britaniya Oliy sudi, Triple Point Technology Inc v PTT Public Co Ltd [2021] UKSC 29, 16.07.2021', url: 'https://caselaw.nationalarchives.gov.uk/uksc/2021/29', mark: 'T', adapted: 'Ingliz huquqi oʻrniga Oʻzbekiston FK. Bekor qilingandan keyin penya hisoblanishi haqida Oʻzbekiston Plenumida aniq javob topilmadi - bu ochiq bahs nuqtasi.' },
    outcome: [
      'Birinchi instansiya: buyurtmachiga 4 497 278,40 AQSh dollari - penya cheklovsiz, boshqa zararlar 1 038 000 dollar (toʻlangan summa) bilan cheklangan.',
      'Apellyatsiya: penya faqat topshirilgan va qabul qilingan ish uchun; hamma summa cheklovga kiradi; «ehtiyotsizlik» faqat mustaqil deliktni anglatadi.',
      'Oliy sud: (1) bir ovozdan - ish hech qachon tugallanmagan boʻlsa ham, penya shartnoma bekor qilingungacha hisoblanadi; (2) 3-2 ovoz bilan - «ehtiyotsizlik» shartnomaviy ehtiyotkorlik majburiyatining buzilishini ham qamraydi, demak bu zararlar cheklovsiz; (3) bir ovozdan - penya umumiy cheklovga kiradi.',
    ],
    lessons: [
      '5.3-band - klassik penya (FK 260, 261-moddalar); Oʻzbekistonda uni FK 326-moddasi boʻyicha kamaytirish mumkin, Angliyada esa yoʻq.',
      'Zararni kamroq miqdorda qoplash shartnomada belgilanishi mumkin (FK 14-modda), lekin qasddan buzish uchun javobgarlikni oldindan cheklash haqiqiy emas (FK 333-modda, 4-qism).',
      'Penya va zarar nisbati: zararning penya bilan qoplanmagan qismi toʻlanadi (FK 325-modda).',
      'Tipik xato: «penya toʻlanadimi?» va «penya cheklovga kiradimi?» savollarini aralashtirish; istisno bandni butun banddan ajratib oʻqish.',
    ],
  },

  /* ───────────── 11. Fors-major va sababiyat ───────────── */
  'fors-major': {
    id: 'fors-major',
    title: 'Toʻgʻon buzildi - lekin yuk baribir yoʻq edi',
    court: HALL(3),
    summary: 'Uzoq muddatli tashish shartnomasi: Braziliyadan Malayziyaga temir ruda. Konda toʻgʻon buzilib, ishlab chiqarish toʻxtagan. Lekin undan oldin ham talab tushib ketgani sababli yuk berilmayotgan edi. Ijarachi fors-majorga tayanadi.',
    parties: { claimant: '«A» kemachilik kompaniyasi (kema egasi)', respondent: '«B» kompaniyasi (yuk joʻnatuvchi, ijarachi)' },
    claim: 'Berilmagan beshta yuk uchun zararni undirish.',
    facts: [
      { id: 'contract', title: 'Shartnoma', text: '29.06.2009 dagi qoʻshimcha kelishuv: Braziliya portlaridan Malayziyaga temir ruda tabletkalarini 7 marta tashish, 2015-yil iyuldan 2016-yil iyungacha.' },
      { id: 'dam', title: 'Hodisa', text: '05.11.2015: Braziliyada toʻgʻon buzildi, yagona yetkazib beruvchining ishlab chiqarishi toʻxtadi. Boshqa yetkazib beruvchi yuk bermas edi.' },
      { id: 'demand', title: 'Talab', text: '2015-yilning ikkinchi yarmida Malayziya zavodlarida talab keskin tushgan; yuklar toʻgʻon buzilishidan oldin ham berilmayotgan edi.' },
      { id: 'c32', title: '32-band (istisnolar)', text: '«Taraflar ... konda yoki ishlab chiqarish obyektidagi avariyalar ... yoki taraflar nazoratidan tashqaridagi boshqa sabablar NATIJASIDA yuk bermaslik uchun javob bermaydi; hamisha shu sharti bilanki, bunday hodisalar taraf majburiyatining bajarilishiga BEVOSITA taʼsir qilgan boʻlsin.»' },
    ],
    evidence: [
      { id: 'e-contract', title: 'Shartnoma va 32-band', text: '7 ta yuk jadvali.' },
      { id: 'e-dam', title: 'Toʻgʻon avariyasi haqidagi maʼlumot', text: '05.11.2015, ishlab chiqarish toʻxtagan.' },
      { id: 'e-mills', title: 'Malayziya zavodlari talabi', text: '2015-yil ikkinchi yarmida yuk berilmagan.' },
    ],
    timeline: [
      { date: '29.06.2009', text: 'Tashish shartnomasi (qoʻshimcha kelishuv).' },
      { date: 'iyul 2015', text: 'Tashishlar boshlanishi kerak edi.' },
      { date: '2015 ikkinchi yarmi', text: 'Talab tushdi, yuk berilmadi.' },
      { date: '05.11.2015', text: 'Toʻgʻon buzildi.' },
      { date: 'iyun 2016', text: 'Oxirgi yuk muddati.' },
    ],
    side: {
      claimant: {
        task: ['Ijarachi fors-majorga tayana olmasligini asoslang.', 'Zararni undirish uchun asos keltiring.', POLITE],
        confidential: ['Toʻgʻon buzilmasa ham, ijarachi yuk bermasligi aniq edi - talab yoʻq edi.', 'Zarar hisobi uchun oʻsha davrdagi fraxt bozorini tekshiring.'],
      },
      respondent: {
        task: ['Fors-major mijozingizni javobgarlikdan ozod qilishini asoslang.', 'Zarar boʻlsa, u qancha boʻlishi kerakligi haqida pozitsiya bildiring.', POLITE],
        confidential: ['Toʻgʻon buzilishi beshta yukni haqiqatan imkonsiz qilgan.', 'Mijozingiz talab tushgani haqida koʻp gapirmaslikni soʻraydi.'],
      },
    },
    points: {
      claimant: [['sababiyat', 'sabab', 'tufayli'], ['bevosita', '32-band'], ['talab tush', 'talab yoʻq'], ['baribir', 'oldin ham'], ['333', 'fors-major'], ['zarar', '14-modda', 'boy berilgan foyda'], ['mutlaq', 'majburiyat']],
      respondent: [['toʻgʻon', 'avariya'], ['imkonsiz'], ['nazoratdan tashqari', 'yengib boʻlmaydigan'], ['32-band', 'istisno'], ['zarar yoʻq', 'nominal'], ['324', 'tayyorgarlik'], ['beshta yuk']],
    },
    disclaimer: ABROAD,
    topic: 'Fors-major',
    level: 3,
    skills: ['tavsif', 'dalil'],
    norms: [{ doc: 'FK', n: '333-modda' }, { doc: 'FK', n: '14-modda' }, { doc: 'FK', n: '324-modda' }, { doc: 'PLENUM-OXS-163', n: '12-band' }],
    basis: { ruling: 'Angliya va Uels apellyatsiya sudi, Classic Maritime Inc v Limbungan Makmur Sdn Bhd [2019] EWCA Civ 1102, 27.06.2019', url: 'https://caselaw.nationalarchives.gov.uk/ewca/civ/2019/1102', mark: 'T', adapted: 'Ingliz huquqi oʻrniga Oʻzbekiston FK 333-moddasi (fors-major, sababiyat). Zararni baholash boʻyicha FKda toʻgʻridan-toʻgʻri qoida yoʻq - ochiq bahs nuqtasi.' },
    outcome: [
      'Birinchi instansiya: toʻgʻon beshta yukni imkonsiz qilgan, lekin toʻgʻonsiz ham ijarachi baribir shartnomani buzgan boʻlardi. Shuning uchun 32-band qoʻllanmadi, lekin zarar - har yuk uchun nominal 1 dollar.',
      'Apellyatsiya: javobgarlik boʻyicha qoʻshildi - «natijasida» va «bevosita» soʻzlari «agar ... boʻlmaganida» sababiyatini talab qiladi. Zarar boʻyicha kema egasining shikoyati qanoatlantirildi: yuk berish majburiyati mutlaq edi, kompensatsiya qarzdor nima sababdan buzganiga bogʻliq emas - 19 869 573 AQSh dollari undirildi.',
    ],
    lessons: [
      'Oʻzbekistonda tadbirkor bajarish fors-major TUFAYLI imkonsiz boʻlganini isbotlashi kerak (FK 333-modda, 3-qism) - bu sababiyat talabi.',
      'Hodisaning oʻzini isbotlash yetmaydi: ijarachi sababiyatni, kema egasi esa mustaqil sababni (talab tushgani) koʻrsatishi kerak.',
      'Boy berilgan foydada kreditor uni olish uchun koʻrgan choralari hisobga olinadi (FK 324-modda, 3-qism).',
      'Tipik xato: fors-major hodisasini isbotlab, sababiyatni unutish.',
    ],
  },

  /* ───────────── 12. Neustoykami yoki narx sharti ───────────── */
  'narx-sharti': {
    id: 'narx-sharti',
    title: '44 mln dollar: neustoykami yoki narx sharti?',
    court: HALL(3),
    summary: 'Yirik reklama guruhi aksiyalarining sotuvi. Sotuvchi raqobat qilmaslik majburiyatini buzgan; shartnomaga koʻra u kechiktirilgan narx qismlarini yoʻqotadi. Sotuvchi bu bandni neustoyka deb, kamaytirishni soʻraydi.',
    parties: { claimant: '«A» (aksiyalar sotuvchisi)', respondent: '«B» kompaniyasi (xaridor)' },
    claim: 'Oraliq va yakuniy toʻlovlarni undirish; 5.1-bandni neustoyka deb topib, FK 326-moddasi boʻyicha kamaytirish.',
    facts: [
      { id: 'deal', title: 'Bitim', text: '28.02.2008: ikki sotuvchi guruhning 47,4 foiz aksiyasini xaridorga sotgan. Shartnoma olti oy muzokara qilingan, har ikki tomonda yuridik firma bor edi.' },
      { id: 'price', title: 'Narx', text: '34 mln dollar dastlabki toʻlov; 31,5 mln dollar eskrou hisobiga; oraliq va yakuniy toʻlovlar foyda formulasi boʻyicha. Umumiy narx 147,5 mln dollar bilan cheklangan.' },
      { id: 'c112', title: '11.2-band', text: 'Raqobat qilmaslik va xodim hamda mijozlarni ogʻdirmaslik majburiyati - gudvilni himoya qilish uchun.' },
      { id: 'c51', title: '5.1 va 5.6-bandlar', text: '5.1: 11.2-bandni buzgan sotuvchi oraliq va yakuniy toʻlovlarni olmaydi - hisob boʻyicha 44 181 600 dollargacha kam. 5.6: xaridor buzgan sotuvchining qolgan aksiyalarini gudvilsiz narxda sotib olish huquqiga ega.' },
      { id: 'breach', title: 'Buzilish', text: 'Sotuvchi raqib kompaniyada ishtirok etganini va 01.07.2008 dan fidutsiar majburiyatni buzganini tan olgan.' },
    ],
    evidence: [
      { id: 'e-spa', title: 'Aksiyalar oldi-sotdi shartnomasi', text: '3.1, 5.1, 5.6 va 11.2-bandlar.' },
      { id: 'e-admission', title: 'Sotuvchining tan olishi', text: 'Raqib kompaniyadagi ishtirok, 01.07.2008 dan fidutsiar majburiyat buzilishi.' },
      { id: 'e-option', title: 'Opsion haqidagi bildirishnoma', text: '13.12.2010: xaridor 5.6-band boʻyicha aksiyalarni sotib olish huquqidan foydalandi.' },
      { id: 'e-settle', title: 'Kompaniya bilan kelishuv', text: 'Fidutsiar talab boʻyicha sudga 500 000 dollar toʻlangan.' },
    ],
    timeline: [
      { date: '28.02.2008', text: 'Shartnoma imzolandi.' },
      { date: '01.07.2008', text: 'Sotuvchi fidutsiar majburiyatni buza boshladi (oʻzi tan olgan).' },
      { date: '13.12.2010', text: 'Xaridor 5.6-band boʻyicha opsiondan foydalandi.' },
    ],
    side: {
      claimant: {
        task: ['5.1-band neustoyka ekanini va u nomutanosib ekanini asoslang.', 'Kamaytirish miqdori haqida taklif bering.', POLITE],
        confidential: ['Mijozingiz buzilishni inkor etmaydi.', 'Xaridor koʻrgan zararni raqam bilan koʻrsatishga hech kim urinmagan.'],
      },
      respondent: {
        task: ['5.1-band neustoyka emas, narx sharti ekanini asoslang.', 'Xaridorning qonuniy manfaatini koʻrsating.', POLITE],
        confidential: ['Narx foyda formulasiga bogʻlangan: sotuvchining sodiqligi narxning bir qismi edi.', 'Shartnoma teng huquqli taraflar oʻrtasida, yuristlar ishtirokida tuzilgan.'],
      },
    },
    points: {
      claimant: [['neustoyka', '260'], ['326', 'kamaytir'], ['nomutanosib'], ['44 181', '44 mln'], ['buzilish oqibat', 'zarar'], ['5.1'], ['jazo', 'qoʻrqitish']],
      respondent: [['narx sharti', 'narx'], ['gudvil'], ['qonuniy manfaat', 'manfaat'], ['teng', 'yurist', 'muzokara'], ['tan olgan', 'buzgan'], ['5.1', '5.6'], ['sodiq']],
    },
    disclaimer: ABROAD,
    topic: 'Neustoyka',
    level: 3,
    skills: ['tavsif', 'qoida'],
    norms: [{ doc: 'FK', n: '9-modda' }, { doc: 'FK', n: '260-modda' }, { doc: 'FK', n: '325-modda' }, { doc: 'FK', n: '326-modda' }, { doc: 'PLENUM-OXS-163', n: '2-band' }],
    basis: { ruling: 'Buyuk Britaniya Oliy sudi, Cavendish Square Holding BV v Talal El Makdessi [2015] UKSC 67, 04.11.2015', url: 'https://caselaw.nationalarchives.gov.uk/uksc/2015/67', mark: 'T', adapted: 'Ingliz huquqi oʻrniga Oʻzbekiston FK. Oʻzbek sudi 5.1-bandni umuman neustoyka deb hisoblamasligi mumkin (u «toʻlanadigan summa» emas) - bu tavsif bahsining oʻzi.' },
    outcome: [
      'Birinchi instansiya: bandlar haqiqiy.',
      'Apellyatsiya: anʼanaviy test boʻyicha ikkala band ham jarima - majburiy kuchga ega emas.',
      'Oliy sud birinchi instansiyani tikladi: test - band buzgan tarafga begunoh tarafning qonuniy manfaatiga «mutlaqo nomutanosib» zarar yetkazadimi. 5.1-band mohiyatan narxni oʻzgartiruvchi asosiy majburiyat; gudvil va sodiqlikdagi qonuniy manfaat uni oqlaydi. Jarimani qisman kamaytirib qoʻllash rad etildi.',
    ],
    lessons: [
      'Angliyada jarima sharti butunlay bekor qilinadi, kamaytirilmaydi. Oʻzbekistonda esa sud neustoykani kamaytiradi (FK 326-modda) - bir xil faktlar boshqa natijaga olib kelishi mumkin.',
      'Avval tavsif: 5.1-band FK 260-moddasi maʼnosidagi «pul summasi»mi yoki toʻlov sharti? Toʻlov sharti boʻlsa, FK 326-moddasi umuman qoʻllanmaydi.',
      'Tipik xato: «zararning oldindan bahosi emas, demak jarima» deyish yoki sud summani albatta kamaytiradi deb oʻylash.',
    ],
  },

  /* ───────────── 13. Vaziyatning jiddiy oʻzgarishi ───────────── */
  'vaziyat-ozgarishi': {
    id: 'vaziyat-ozgarishi',
    title: 'Brexit va 25 yillik ijara: vaziyat jiddiy oʻzgardimi?',
    court: HALL(2),
    summary: 'Xalqaro agentlik 25 yilga ofis ijaraga olgan, muddatidan oldin chiqish sharti yoʻq. Joylashgan davlat ittifoqdan chiqqani sababli agentlik koʻchirildi. Agentlik shartnomani vaziyatning jiddiy oʻzgarishi sababli bekor qilishni soʻraydi.',
    parties: { claimant: '«A» xalqaro agentligi (ijarachi)', respondent: '«B» MChJ (ijaraga beruvchi)' },
    claim: 'Ijara shartnomasini vaziyatning jiddiy oʻzgarishi sababli bekor qilish (FK 383-modda).',
    facts: [
      { id: 'lease', title: 'Shartnoma', text: '21.10.2014 dagi ikkilamchi ijara: 25 yil (01.07.2014 - 30.06.2039). Muddatidan oldin bekor qilish sharti yoʻq.' },
      { id: 'incentive', title: 'Ragʻbat', text: 'Agentlik 40 mln funtdan ortiq ragʻbatlantiruvchi toʻlov olgan. Kelajakdagi majburiyatlari - taxminan 500 mln funt (agentlikning oʻz dalili).' },
      { id: 'notice', title: 'Agentlikning xabari', text: '2011-yil apreldagi byudjet bildirishnomasida agentlik 25 yillik muddat va chiqish sharti yoʻqligini oʻzi koʻrsatgan.' },
      { id: 'alien', title: 'Boshqa shaxsga berish', text: 'Shartnomada ijara huquqini boshqa shaxsga berish va ikkilamchi ijaraga berish bandlari bor.' },
      { id: 'move', title: 'Koʻchish', text: 'Agentlikni koʻchirish toʻgʻrisidagi qarorni ittifoqning oʻzi qabul qilgan. 02.08.2017: agentlik chiqish yuz bersa, uni shartnomaning bajarib boʻlmas holga kelishi deb hisoblashini yozgan.' },
    ],
    evidence: [
      { id: 'e-lease', title: 'Ijara shartnomasi', text: 'Muddat, chiqish sharti yoʻqligi, boshqa shaxsga berish bandlari.' },
      { id: 'e-budget', title: '2011-yil apreldagi byudjet bildirishnomasi', text: '25 yil, chiqish sharti yoʻq.' },
      { id: 'e-letter', title: '02.08.2017 dagi xat', text: 'Agentlikning pozitsiyasi.' },
    ],
    timeline: [
      { date: 'aprel 2011', text: 'Agentlik muddat va shartlarni byudjet organiga bildirdi.' },
      { date: '21.10.2014', text: 'Ijara shartnomasi (01.07.2014 dan 25 yil).' },
      { date: '2016', text: 'Davlat ittifoqdan chiqish haqida referendum oʻtkazdi.' },
      { date: '02.08.2017', text: 'Agentlik shartnomani bajarib boʻlmas holga kelgan deb hisoblashini yozdi.' },
      { date: '30.06.2039', text: 'Ijara muddati tugaydi.' },
    ],
    side: {
      claimant: {
        task: ['FK 383-moddasidagi shartlar mavjudligini asoslang.', 'Ijaraga beruvchining «xavf sizda edi» degan vajiga javob bering.', POLITE],
        confidential: ['Agentlik oʻz binosidan doimiy bosh qarorgoh sifatida foydalanmoqchi edi.', 'Koʻchish qarori agentlikning oʻzidan emas, ittifoq organlaridan chiqqan.'],
      },
      respondent: {
        task: ['Xavf shartnomada agentlik zimmasiga taqsimlanganini koʻrsating.', 'Bekor qilish uchun shartlar yoʻqligini asoslang.', POLITE],
        confidential: ['Boshqa shaxsga berish bandlari agentlikning butunlay ketishini oldindan nazarda tutgan.', 'Mijozingiz 40 mln funtdan ortiq ragʻbat bergan - uzoq muddatga ishonib.'],
      },
    },
    points: {
      claimant: [['383'], ['oldindan koʻra', 'kutilmagan', 'bunday oʻzgarish'], ['yenga olmagan', 'vijdon', 'ehtiyotkor'], ['nisbat', 'mulkiy manfaat', 'zarar'], ['doimiy', 'bosh qarorgoh'], ['koʻchish', 'ittifoq qarori'], ['500 mln']],
      respondent: [['25 yil', 'chiqish sharti yoʻq'], ['boshqa shaxsga berish', 'ikkilamchi ijara'], ['xavf', 'tavakkal'], ['2011', 'byudjet'], ['40 mln', 'ragʻbat'], ['oʻzi keltirib', 'oʻzi yaratgan'], ['384', 'taklif', 'sudgacha']],
    },
    disclaimer: ABROAD,
    topic: 'Shartnoma',
    level: 3,
    skills: ['tavsif', 'qoida'],
    norms: [{ doc: 'FK', n: '383-modda' }, { doc: 'FK', n: '384-modda' }, { doc: 'FK', n: '9-modda' }],
    basis: { ruling: 'Angliya va Uels Oliy sudi, Canary Wharf (BP4) T1 Ltd v European Medicines Agency [2019] EWHC 335 (Ch)', url: 'https://caselaw.nationalarchives.gov.uk/ewhc/ch/2019/335', mark: 'T', adapted: 'Ingliz huquqidagi «frustration» oʻrniga Oʻzbekiston FK 383-moddasi. Keyinchalik taraflar kelishgani haqidagi xabarlar tekshirilmagan.' },
    outcome: [
      'Ijara bekor boʻlmadi: boshqa shaxsga berish bandlari agentlikning butunlay ketishini oldindan nazarda tutgan; agentlik 25 yil davomidagi oʻzgarish xavfini oʻz zimmasiga olgan.',
      'Shartnoma bajarib boʻlmas holga kelgan boʻlsa ham, buni agentlik tomoni oʻzi keltirib chiqargan boʻlardi - koʻchish qarorini ittifoqning oʻzi qabul qilgan.',
    ],
    lessons: [
      'FK 383-moddasi boʻyicha bekor qilish uchun toʻrt shart BIRGA kerak: oʻzgarish kutilmagan; manfaatdor taraf uni yenga olmagan; shartnomani oʻzgartirmasdan bajarish uning manfaatini jiddiy buzadi; xavf odat yoki shartnomaga koʻra unga yuklanmagan.',
      'Sudga borishdan oldin bekor qilish taklifi berilib, rad javobi yoki 30 kunlik muddat kutilishi kerak (FK 384-modda, 2-qism).',
      'Ijaraga beruvchi tomoni uchun ideal javob - xavfni taqsimlovchi bandlarni sanab chiqish. Tipik xato - faqat xarajat oshganiga tayanish.',
    ],
  },

  /* ───────────── 14. Ogʻzaki oʻzgartirish ───────────── */
  'ogzaki-ozgartirish': {
    id: 'ogzaki-ozgartirish',
    title: 'Telefonda kelishilgan jadval: ogʻzaki oʻzgartirish kuchgami?',
    court: HALL(1),
    summary: 'Ofis maydoni litsenziyasi: qarz yigʻilgan, direktor telefon orqali yangi toʻlov jadvalini taklif qilgan. Shartnomada barcha oʻzgartishlar faqat yozma va imzolangan boʻlishi shart. Ofis markazi qarzni undirmoqchi.',
    parties: { claimant: '«A» MChJ (ofis markazi, litsenziar)', respondent: '«B» MChJ (litsenziat)' },
    claim: 'Litsenziya haqi boʻyicha qarzni undirish.',
    facts: [
      { id: 'licence', title: 'Litsenziya', text: '12.08.2011: ofis maydoni, 12 oy, 01.11.2011 dan. Birinchi 3 oy oyiga 3 500 funt, keyin 4 333,34 funt.' },
      { id: 'c76', title: '7.6-band', text: '«Ushbu litsenziya taraflar kelishgan barcha shartlarni oʻz ichiga oladi. ... Litsenziyaga barcha oʻzgartishlar kuchga kirishidan oldin kelishilishi, yozma rasmiylashtirilishi va ikki taraf nomidan imzolanishi kerak.»' },
      { id: 'call', title: 'Telefon suhbati', text: '27.02.2012 ga kelib qarz 12 000 funtdan oshgan. Litsenziat direktori kredit nazoratchisiga telefon orqali yangi jadval taklif qilgan. Nazoratchi rozi boʻlmaganini aytadi, uning rahbari taklifni rad etgan.' },
      { id: 'lock', title: 'Natija', text: '30.03.2012: ofisga kirish yopildi; litsenziya 04.05.2012 dan bekor qilindi.' },
    ],
    evidence: [
      { id: 'e-licence', title: 'Litsenziya shartnomasi', text: 'Toʻlov jadvali va 7.6-band.' },
      { id: 'e-debt', title: 'Qarz hisobi', text: '27.02.2012 holatiga 12 000 funtdan ortiq.' },
      { id: 'e-witness', title: 'Guvohlar', text: 'Litsenziat direktori va ofis markazining kredit nazoratchisi - suhbat haqida qarama-qarshi koʻrsatuv beradi.' },
    ],
    timeline: [
      { date: '12.08.2011', text: 'Litsenziya imzolandi.' },
      { date: '01.11.2011', text: 'Muddat boshlandi.' },
      { date: '27.02.2012', text: 'Qarz 12 000 funtdan oshdi; telefon suhbati.' },
      { date: '30.03.2012', text: 'Kirish yopildi.' },
      { date: '04.05.2012', text: 'Litsenziya bekor qilindi.' },
    ],
    side: {
      claimant: {
        task: ['Qarzni undirishni asoslang.', 'Telefondagi «kelishuv» nima uchun kuchga ega emasligini koʻrsating.', POLITE],
        confidential: ['Kredit nazoratchisi kelishmaganini aytadi; uning rahbari taklifni rad etgan.', 'Yozma tasdiq yuborilmagan.'],
      },
      respondent: {
        task: ['Toʻlov jadvali oʻzgartirilganini asoslang.', 'Ofis markazining xatti-harakatidan foydalaning.', POLITE],
        confidential: ['Direktor kredit nazoratchisi telefonda rozi boʻlganiga ishonadi.', 'Yozma hujjat yoʻq.'],
      },
    },
    points: {
      claimant: [['7.6', 'yozma', 'imzolangan'], ['384', 'shakl'], ['rad etgan', 'rahbari'], ['12 000', 'qarz'], ['vakolat', 'nazoratchi'], ['ogʻzaki', 'telefon'], ['litsenziya']],
      respondent: [['ogʻzaki', 'telefon', 'kelishilgan'], ['rozi', 'nazoratchi'], ['xatti-harakat', 'xulq'], ['9-modda', 'vijdon', 'halol'], ['odat', 'ish muomalasi'], ['jadval'], ['guvoh']],
    },
    disclaimer: ABROAD,
    topic: 'Shartnoma',
    level: 1,
    skills: ['qoida', 'dalil'],
    norms: [{ doc: 'FK', n: '384-modda' }, { doc: 'FK', n: '9-modda' }, { doc: 'PLENUM-OXS-103', n: '3-band' }, { doc: 'IPK', n: '72-modda' }, { doc: 'IPK', n: '88-modda' }],
    basis: { ruling: 'Buyuk Britaniya Oliy sudi, MWB Business Exchange Centres Ltd v Rock Advertising Ltd [2018] UKSC 24', url: 'https://caselaw.nationalarchives.gov.uk/uksc/2018/24', mark: 'T', adapted: 'Ingliz huquqi oʻrniga Oʻzbekiston FK 384-moddasi: oʻzgartish shartnoma qaysi shaklda boʻlsa, oʻsha shaklda.' },
    outcome: [
      'Birinchi instansiya: ogʻzaki kelishuv boʻlgan va nazoratchida koʻrinadigan vakolat bor edi, lekin 7.6-band tufayli u haqiqiy emas - ofis markazi yutdi.',
      'Apellyatsiya: aksincha - ogʻzaki kelishuv 7.6-bandni ham bekor qilgan.',
      'Oliy sud birinchi instansiyani tikladi: «faqat yozma oʻzgartirish» bandlari kuchga ega; ular norasmiy oʻzgarishlar, shartlar haqidagi nizolar va ichki vakolatni nazorat qilishdan himoya qiladi. Litsenziatning harakatlari esa boshqa tarafni bogʻlash uchun yetarli emas edi.',
    ],
    lessons: [
      'Oʻzbekistonda bu savolga qonun javob beradi: shartnoma qanday shaklda tuzilgan boʻlsa, oʻzgartirish ham shunday shaklda (FK 384-modda, 1-qism) - shartnomada maxsus band boʻlmasa ham.',
      'Bahs uchun ochiq joy: taraflarning xatti-harakati va vijdonlilik (FK 9-modda); sud ish muomalasi odatlari va taraflarning amaliyotiga baho beradi (OXS Plenumining 103-son qarori, 3-band).',
      'Qonun muayyan dalil talab qilgan holatni boshqa dalil bilan isbotlab boʻlmaydi (IPK 72-modda) - guvohlar koʻrsatuvining chegarasi shu yerda.',
    ],
  },
};
