/**
 * "Ish yoʻli 2": Nodira K. — telefon oʻgʻirligi.
 *
 * SERVER ONLY. A fictional theft report followed by the student as the
 * victim's advocate through three rooms: the duty desk, the investigator's
 * office and the head of the investigation unit. Every article cited comes
 * from the Criminal Procedure Code (JPK) as published on lex.uz
 * (`law/jpk-case.json`). The Criminal Code (qualification of the theft,
 * sentences) is deliberately not cited — it is not in the verified pack.
 */
import type { StageId } from '@/contracts/case';
import type { CaseBookShape, CaseView, StageDef } from './ishga-tiklash';

export const CASE = {
  title: 'Nodira K. - telefon oʻgʻirligi',
  note: 'Ish holatlari, ismlar va sanalar oʻquv uchun toʻqilgan. Protsessual tartib va moddalar matni - Jinoyat-protsessual kodeksidan (lex.uz). Jinoyat kodeksi boʻyicha kvalifikatsiya bu mashqda baholanmaydi.',
  parties: [
    { role: 'you' as const, label: 'Jabrlanuvchining vakili (advokat)', name: 'Siz' },
    { role: 'client' as const, label: 'Arizachi, jabrlanuvchi', name: 'Nodira K.', voice: 'female' as const },
    { role: 'officer' as const, label: 'Namuna tumani IIB navbatchisi', name: 'kapitan J. Sobirov', voice: 'male' as const },
    { role: 'investigator' as const, label: 'Tergovchi', name: 'U. Rahimov', voice: 'male' as const },
    { role: 'chief' as const, label: 'Tergov boʻlinmasi boshligʻi', name: 'podpolkovnik A. Ergashev', voice: 'elder_m' as const },
  ],
};

export const FACTS: Record<string, { label: string; detail: string; key?: boolean }> = {
  signed: { label: 'Yozma ariza imzolangan', detail: 'Arizachi oʻz imzosi bilan yozma ariza berdi (JPK 324).', key: true },
  warned: { label: 'Yolgʻon xabar uchun ogohlantirildi', detail: 'Bayonnomada qayd etildi, arizachi imzoladi (JPK 324).', key: true },
  imei: { label: 'IMEI va xarid cheki taqdim etildi', detail: 'Telefon qutisi, chek, IMEI raqami.', key: true },
  rights: { label: 'Jabrlanuvchiga huquqlari tushuntirildi', detail: 'JPK 55, 64, 100.', key: true },
  record: { label: 'Soʻroq bayonnomasi tekshirildi', detail: 'Koʻrsatuv soʻzma-soʻz yozilgani tekshirildi, advokat arzi kiritildi (JPK 106, 114).', key: true },
  complaint: { label: 'Tergovchi harakatsizligi ustidan shikoyat', detail: 'Tergov boʻlinmasi boshligʻiga (JPK 358).', key: true },
};

export const EVIDENCE: Record<string, { label: string; detail: string; requires: string }> = {
  box: { label: 'Telefon qutisi va xarid cheki', detail: 'IMEI raqami qutida va chekda bor.', requires: 'imei' },
  talon: { label: 'Ariza qabul qilingani haqida maʼlumot', detail: 'Ariza roʻyxatga olingani toʻgʻrisida.', requires: 'signed' },
};

export const PREPARED = { known: ['signed', 'warned', 'imei'], draft: null };

const report: StageDef = {
  id: 'report',
  number: 1,
  title: 'Jinoyat toʻgʻrisida ariza berish',
  place: 'Namuna tumani IIB, navbatchi',
  goal: 'Arizani toʻgʻri rasmiylashtiring va roʻyxatga oldiring (JPK 323, 324, 329).',
  reflect: 'Arizani roʻyxatga olishda qaysi talab boʻlmasa, ish qoʻzgʻatilmay qolardi?',
  start: 'r-start',
  nodes: [
    {
      id: 'r-start',
      enter: [
        ['client', 'Kecha kechqurun bozorda sumkamdan telefonimni olib qoʻyishdi… Endi nima qilamiz?', { emotion: 'upset' }],
        ['officer', 'Navbatchi qism. Qanday masalada keldingiz?'],
      ],
      options: [
        { id: 'purpose', text: 'Assalomu alaykum. Men advokatman, Nodira K.ning vakiliman. Kecha uning telefoni oʻgʻirlangan - jinoyat toʻgʻrisida ariza bermoqchimiz.',
          reply: [['officer', 'Tushunarli. Ariza yozma boʻladimi yoki ogʻzaki? Ogʻzaki boʻlsa, bayonnomaga yozaman.']], next: 'r-form', tone: 'good', article: '324-modda' },
        { id: 'anonymous', text: 'Ismimizni yozmay qoʻya qoling, shunchaki xabar beramiz.',
          reply: [['officer', 'Imzosiz, anonim xabar jinoyat ishini qoʻzgʻatishga sabab boʻla olmaydi.', { emotion: 'impatient' }]],
          effect: { penalty: [15, 'Anonim xabar ishni qoʻzgʻatishga sabab boʻlmaydi'] }, tone: 'bad', article: '323-modda' },
      ],
    },
    {
      id: 'r-form',
      options: [
        { id: 'written', text: 'Yozma ariza tayyor - Nodira opa imzolagan. Shaxsini tasdiqlovchi hujjati ham shu yerda.',
          reply: [['officer', 'Yaxshi, qabul qilaman.']], effect: { learn: ['signed'] }, next: 'r-warn', tone: 'good', article: '324-modda' },
        { id: 'oral', text: 'Ogʻzaki aytamiz, bayonnomaga yozing.',
          reply: [['officer', 'Bayonnomada arizachi, yashash va ish joyi, shaxsiy hujjatlari koʻrsatiladi; holatlar uning nomidan, iloji boricha soʻzma-soʻz yoziladi.']], effect: { learn: ['signed'] }, next: 'r-warn', tone: 'good', article: '324-modda' },
        { id: 'unsigned', text: 'Arizani yozdik, imzo shart emas-ku.',
          reply: [['officer', 'Shart. Yozma ariza arz qiluvchi tomonidan imzolangan boʻlishi lozim.', { emotion: 'impatient' }]], effect: { penalty: [10, 'Yozma ariza imzolanishi shart'] }, tone: 'bad', article: '324-modda' },
      ],
    },
    {
      id: 'r-warn',
      enter: [['officer', 'Arizachi, bila turib yolgʻon xabar berganlik uchun jinoiy javobgarlik toʻgʻrisida ogohlantirilasiz. Bu bayonnomada qayd etiladi — imzolang.']],
      options: [
        { id: 'sign-warning', kind: 'act', text: 'Nodira opaga ogohlantirishni tushuntirib, imzolashiga yordam berish',
          reply: [['client', 'Tushundim. Imzolayman.', { emotion: 'calm' }], ['officer', 'Ariza roʻyxatga olindi. Mana, qabul qilingani haqida maʼlumot — raqami shunda.']], effect: { learn: ['warned', 'talon'] }, next: 'r-evidence', tone: 'good', article: '324-modda' },
        { id: 'skip-warning', text: 'Biz advokat bilan keldik, ogohlantirish shart emas.',
          reply: [['officer', 'Shart. Bu Kodeks talabi, advokatning ishtirokidan qatʼi nazar.', { emotion: 'impatient' }], ['client', 'Mayli, imzolayman.']], effect: { learn: ['warned', 'talon'], penalty: [10, 'Ogohlantirishni rad etishga urindingiz'] }, next: 'r-evidence', tone: 'bad', article: '324-modda' },
      ],
    },
    {
      id: 'r-evidence',
      enter: [['officer', 'Ariza roʻyxatga olindi va darhol koʻriladi; tekshiruv kerak boʻlsa — oʻn sutkadan kechiktirmay hal qilinadi. Qoʻshimcha nima taqdim etasiz?']],
      options: [
        { id: 'imei', text: 'Telefon qutisi va xarid cheki - IMEI raqami bor. Bozordagi doʻkonlarda kamera boʻlishi mumkin, shuni ham qayd eting.',
          reply: [['officer', 'Qabul qildim, ilova qilaman. Kamera boʻyicha topshiriq beriladi.']], effect: { learn: ['imei'] }, next: 'r-end', tone: 'good', article: '329-modda' },
        { id: 'vigilante', text: 'Gumondorni oʻzimiz topib, ushlab kelamiz.',
          reply: [['officer', 'Oʻzboshimchalik qilmang. Tekshiruvni vakolatli organ oʻtkazadi.', { emotion: 'impatient' }]], effect: { penalty: [15, 'Oʻzboshimchalikka ishora'] }, next: 'r-end', tone: 'bad' },
      ],
    },
    { id: 'r-end', enter: [['system', 'Ariza roʻyxatga olindi. Qabul qilingani haqidagi maʼlumot qoʻlingizda.']], end: true },
  ],
};

const interview: StageDef = {
  id: 'interview',
  number: 2,
  title: 'Jabrlanuvchini soʻroq qilish',
  place: 'Tergovchi kabineti',
  goal: 'Advokat sifatida soʻroqda jabrlanuvchining huquqlarini himoya qiling (JPK 55, 64, 100, 106, 114, 117).',
  reflect: 'Soʻroqning qaysi daqiqasida advokatning aralashuvi eng zarur boʻldi va nega?',
  start: 'i-start',
  nodes: [
    {
      id: 'i-start',
      enter: [['investigator', 'Jinoyat ishi qoʻzgʻatildi, Nodira K. jabrlanuvchi deb eʼtirof etildi. Vaqt kam — soʻroqni boshlaymiz. Qachon, qayerda boʻldi?']],
      options: [
        { id: 'rights-first', text: 'Kechirasiz, avval jabrlanuvchiga huquq va majburiyatlarini tushuntirishingizni soʻrayman.',
          reply: [['investigator', 'Toʻgʻri. Siz koʻrsatuv berish, dalil taqdim qilish, iltimosnoma berish, vakil olish, ona tilingizdan foydalanish huquqiga egasiz. Bila turib yolgʻon koʻrsatuv berganlik uchun javobgarlik toʻgʻrisida ogohlantirilasiz.'], ['client', 'Tushunarli.', { emotion: 'calm' }]],
          effect: { learn: ['rights'] }, next: 'i-story', tone: 'good', article: '64-modda' },
        { id: 'go-on', text: 'Mayli, boshlayvering.',
          reply: [['client', 'Kecha soat yettilarda bozorda edim…', { emotion: 'uncertain' }]],
          effect: { penalty: [20, 'Huquqlar tushuntirilmasdan soʻroq boshlandi — advokat eʼtiroz bildirmadi'] }, next: 'i-story', tone: 'bad', article: '100-modda',
          feedback: 'Soʻroq qilinuvchining shaxsi aniqlangach, unga huquq va majburiyatlari tushuntiriladi (JPK 100). Advokat buni talab qilishi kerak edi.' },
      ],
    },
    {
      id: 'i-story',
      enter: [
        ['client', 'Kecha soat yettilarda bozorda meva olayotgandim. Yonimda koʻk kurtkali yigit turgan edi, keyin sumkamning ochiq ekanini koʻrdim.', { emotion: 'uncertain' }],
        ['investigator', 'Advokat, sizda savol bormi?'],
      ],
      options: [
        { id: 'open', text: 'Nodira opa, oʻsha yigitning qiyofasini va qaysi tomonga ketganini eslay olasizmi?',
          reply: [['client', 'Baland boʻyli, qoʻlida qora sumka bor edi. Avtobus bekati tomonga ketdi.']], effect: { strength: 1 }, next: 'i-record', tone: 'good', article: '114-modda' },
        { id: 'leading', text: 'Oʻgʻri aynan oʻsha koʻk kurtkali yigit edi, toʻgʻrimi? Ha deng.',
          reply: [['investigator', 'Jabrlanuvchiga javobni oʻzingiz aytib bermang.', { emotion: 'impatient' }]], effect: { penalty: [15, 'Yoʻnaltiruvchi savol'] }, next: 'i-record', tone: 'bad', article: '114-modda' },
      ],
    },
    {
      id: 'i-record',
      enter: [['investigator', 'Soʻroq tugadi. Bayonnomani imzolang.']],
      options: [
        { id: 'read', text: 'Avval bayonnomani oʻqib chiqamiz. Koʻrsatuv soʻzma-soʻz yozilmagan joy bor - tuzatishni soʻraymiz va mening arzimni bayonnomaga kiriting.',
          reply: [['investigator', 'Haqlisiz, tuzatamiz. Arzingiz bayonnomaga kiritildi.']], effect: { learn: ['record'] }, next: 'i-end', tone: 'good', article: '106-modda' },
        { id: 'sign-blind', text: 'Oʻqimasdan imzolayveramiz, vaqt yoʻq.',
          reply: [['client', 'Nimani imzolayotganimni bilmayman…', { emotion: 'uncertain' }]], effect: { penalty: [20, 'Bayonnoma oʻqilmasdan imzolandi'] }, next: 'i-end', tone: 'bad', article: '106-modda' },
      ],
    },
    { id: 'i-end', enter: [['system', 'Soʻroq bayonnomasi imzolandi.']], end: true },
  ],
};

const complaint: StageDef = {
  id: 'complaint',
  number: 3,
  title: 'Tergovchi harakatsizligi ustidan shikoyat',
  place: 'Tergov boʻlinmasi boshligʻi',
  goal: 'Shikoyatni toʻgʻri manzilga, aniq talablar bilan bering (JPK 55, 358).',
  reflect: 'Shikoyatingiz boshliq qabul qilmasa, keyingi qadamingiz qanday boʻlardi (JPK 358)?',
  start: 'c-start',
  nodes: [
    {
      id: 'c-start',
      enter: [
        ['system', 'Oradan bir oy oʻtdi. Kamera yozuvlari soʻralmagan, IMEI boʻyicha qidiruv oʻtkazilmagan. Siz tergov boʻlinmasi boshligʻi qabulidasiz.'],
        ['chief', 'Eshitaman. Qanday shikoyat?'],
      ],
      options: [
        { id: 'precise', text: 'Tergovchi U. Rahimovning harakatsizligi ustidan shikoyat qilamiz: bir oy davomida kamera yozuvlari soʻralmagan, IMEI boʻyicha soʻrov yuborilmagan. Shu harakatlarni oʻtkazishni soʻraymiz.',
          reply: [['chief', 'Shikoyatingiz qabul qilindi. Tergovchiga koʻrsatma beraman, natijasini sizga yozma maʼlum qilamiz.', { emotion: 'calm' }]],
          effect: { learn: ['complaint'], strength: 1 }, next: 'c-end', tone: 'good', article: '358-modda' },
        { id: 'vague', text: 'Tergovchi ishlamayapti, uni ishdan oling!',
          reply: [['chief', 'Aniq qaysi harakat yoki qaror ustidan shikoyat qilyapsiz? Talabingizni aniq ayting.', { emotion: 'impatient' }]], effect: { penalty: [15, 'Shikoyat aniq emas'] }, tone: 'bad', article: '358-modda' },
        { id: 'court', text: 'Biz bu ish boʻyicha fuqarolik sudiga daʼvo beramiz.',
          reply: [['chief', 'Tergovchining harakatlari ustidan shikoyat tergov boʻlinmasi boshligʻiga yoki nazorat qiluvchi prokurorga beriladi.', { emotion: 'impatient' }]], effect: { penalty: [15, 'Notoʻgʻri manzil'] }, tone: 'bad', article: '358-modda' },
      ],
    },
    { id: 'c-end', enter: [['system', 'Shikoyat roʻyxatga olindi. Natija yozma ravishda maʼlum qilinadi.']], end: true },
  ],
};

export const STAGES: StageDef[] = [report, interview, complaint];

export const STAGE_ARTICLES: Partial<Record<StageId, string[]>> = {
  report: ['321-modda', '322-modda', '323-modda', '324-modda', '329-modda', '331-modda', '333-modda', '338-modda'],
  interview: ['54-modda', '55-modda', '64-modda', '96-modda', '100-modda', '106-modda', '114-modda', '117-modda'],
  complaint: ['55-modda', '358-modda', '375-modda'],
};

export const won = (c: CaseView) => c.knows('complaint');

export const BOOK: CaseBookShape = { kind: 'theft', CASE, FACTS, EVIDENCE, PREPARED, STAGES, STAGE_ARTICLES, won, verdict: (c) => (won(c) ? 'Shikoyat qabul qilindi — tergov harakatlari tiklanadi' : null) };
