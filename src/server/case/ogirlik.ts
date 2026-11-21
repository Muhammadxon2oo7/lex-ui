/**
 * "Ish yoʻli 2": Nodira K. — telefon oʻgʻirligi.
 *
 * SERVER ONLY. A fictional theft report followed by the student as the
 * victim's advocate through four rooms: the duty desk, the investigator's
 * office, the head of the investigation unit and the criminal court (trial:
 * JPK 424-473, with the state prosecutor, the defence counsel and the defendant). Every article cited comes
 * from the Criminal Procedure Code (JPK) as published on lex.uz
 * (`law/jpk-case.json`). The Criminal Code (qualification of the theft,
 * sentences) is deliberately not cited — it is not in the verified pack.
 */
import type { Ruling, StageId } from '@/contracts/case';
import type { CaseBookShape, CaseView, Line, StageDef } from './ishga-tiklash';

export const CASE = {
  title: 'Nodira K. - telefon oʻgʻirligi',
  note: 'Ish holatlari, ismlar va sanalar oʻquv uchun toʻqilgan. Protsessual tartib va moddalar matni - Jinoyat-protsessual kodeksidan (lex.uz). Jinoyat kodeksi boʻyicha kvalifikatsiya bu mashqda baholanmaydi.',
  parties: [
    { role: 'you' as const, label: 'Jabrlanuvchining vakili (advokat)', name: 'Siz' },
    { role: 'client' as const, label: 'Arizachi, jabrlanuvchi', name: 'Nodira K.', voice: 'female' as const },
    { role: 'officer' as const, label: 'Namuna tumani IIB navbatchisi', name: 'kapitan J. Sobirov', voice: 'male' as const },
    { role: 'investigator' as const, label: 'Tergovchi', name: 'U. Rahimov', voice: 'male' as const },
    { role: 'chief' as const, label: 'Tergov boʻlinmasi boshligʻi', name: 'podpolkovnik A. Ergashev', voice: 'elder_m' as const },
    { role: 'judge' as const, label: 'Raislik qiluvchi sudya', name: 'M. Qodirov', voice: 'elder_m' as const },
    { role: 'secretary' as const, label: 'Sud majlisi kotibi', name: 'Dilfuza A.', voice: 'female' as const },
    { role: 'prosecutor' as const, label: 'Davlat ayblovchisi (prokuror)', name: 'R. Aliyev', voice: 'male' as const },
    { role: 'defender' as const, label: 'Himoyachi (advokat)', name: 'S. Usmonova', voice: 'female_alt' as const },
    { role: 'defendant' as const, label: 'Sudlanuvchi', name: 'T. Botirov', voice: 'male' as const },
    { role: 'witness' as const, label: 'Guvoh, bozordagi sotuvchi', name: 'O. Joʻrayev', voice: 'male' as const },
  ],
};

export const FACTS: Record<string, { label: string; detail: string; key?: boolean }> = {
  signed: { label: 'Yozma ariza imzolangan', detail: 'Arizachi oʻz imzosi bilan yozma ariza berdi (JPK 324).', key: true },
  warned: { label: 'Yolgʻon xabar uchun ogohlantirildi', detail: 'Bayonnomada qayd etildi, arizachi imzoladi (JPK 324).', key: true },
  imei: { label: 'IMEI va xarid cheki taqdim etildi', detail: 'Telefon qutisi, chek, IMEI raqami.', key: true },
  rights: { label: 'Jabrlanuvchiga huquqlari tushuntirildi', detail: 'JPK 55, 64, 100.', key: true },
  record: { label: 'Soʻroq bayonnomasi tekshirildi', detail: 'Koʻrsatuv soʻzma-soʻz yozilgani tekshirildi, advokat arzi kiritildi (JPK 106, 114).', key: true },
  complaint: { label: 'Tergovchi harakatsizligi ustidan shikoyat', detail: 'Tergov boʻlinmasi boshligʻiga (JPK 358).', key: true },
  motion: { label: 'Kamera yozuvini tekshirish iltimosi qanoatlantirildi', detail: 'Qaysi holatni aniqlash uchun zarurligi koʻrsatildi (JPK 438).', key: true },
  objection: { label: 'Ishora qiluvchi savolga eʼtiroz', detail: 'Himoyachining yoʻnaltiruvchi savoli olib tashlandi (JPK 102, 442).', key: true },
  speech: { label: 'Muzokarada ayblov quvvatlandi', detail: 'Faqat sud tergovida tekshirilgan dalillarga tayanildi (JPK 55, 449).', key: true },
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
  outcomes: [
    { text: 'Jinoyat toʻgʻrisidagi arizani toʻgʻri shaklda berish: imzo, ogohlantirish, anonim emas (JPK 323, 324)', articles: ['323-modda', '324-modda'], facts: ['signed', 'warned'] },
    { text: 'Dalillarni oʻz vaqtida taqdim etish va tekshiruvni tezlashtirish (JPK 329)', articles: ['329-modda'], facts: ['imei'] },
  ],
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
  outcomes: [
    { text: 'Soʻroqdan oldin jabrlanuvchiga huquqlari tushuntirilishini talab qilish (JPK 64, 100)', articles: ['64-modda', '100-modda'], facts: ['rights'] },
    { text: 'Soʻroqda ishora qiluvchi savolga yoʻl qoʻymaslik, ochiq savol berish (JPK 102, 114)', articles: ['102-modda', '114-modda'] },
    { text: 'Bayonnomani oʻqib tekshirish va advokat arzini kiritish (JPK 106)', articles: ['106-modda'], facts: ['record'] },
  ],
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
          reply: [['investigator', 'Jabrlanuvchiga javobni oʻzingiz aytib bermang.', { emotion: 'impatient' }]], effect: { penalty: [15, 'Ishora qiluvchi (yoʻnaltiruvchi) savol'] }, next: 'i-record', tone: 'bad', article: '102-modda',
          feedback: 'Kutilayotgan javobga yoʻnaltiruvchi (ishora qiluvchi) savollar berish taqiqlanadi (JPK 102).' },
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
  outcomes: [
    { text: 'Shikoyatni vakolatli organga aniq talab bilan berish (JPK 358)', articles: ['358-modda'], facts: ['complaint'] },
  ],
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


/** The trial (JPK 424-473): the student stays the victim's representative; the prosecutor leads the charge. */
const trial: StageDef = {
  id: 'trial',
  number: 4,
  title: 'Jinoyat ishi boʻyicha sud majlisi',
  place: 'Jinoyat ishlari boʻyicha sud',
  goal: 'Jabrlanuvchining vakili sifatida ayblovni quvvatlang: iltimos, soʻroq, muzokara (JPK 55, 438-451).',
  reflect: 'Qaysi dalil hukmga eng koʻp taʼsir qildi? Himoyachi oʻrnida boʻlsangiz, qaysi zaif joyga tayangan boʻlardingiz?',
  outcomes: [
    { text: 'Tayyorlov qismida jabrlanuvchi vakilining huquqlaridan foydalanish: rad qilish, huquqlar, asoslangan iltimos (JPK 431, 436, 438)', articles: ['431-modda', '436-modda', '438-modda'] },
    { text: 'Sud tergovida soʻroq: ochiq savol berish, ishora qiluvchi savolga eʼtiroz bildirish (JPK 102, 440, 442)', articles: ['102-modda', '440-modda', '442-modda'] },
    { text: 'Muzokara va oxirgi soʻz qoidalariga rioya qilish, ayblovni tekshirilgan dalillar bilan quvvatlash (JPK 424, 448, 449, 451)', articles: ['424-modda', '448-modda', '449-modda', '451-modda'], facts: ['speech'] },
  ],
  start: 't-brief',
  nodes: [
    {
      id: 't-brief',
      scene: { judgeIn: false, everyoneStands: false, witnessIn: false },
      enter: [
        ['system', 'Ikki oydan soʻng. Tergov tamomlandi: IMEI boʻyicha telefon T. Botirovdan topildi, unda boshqa SIM-karta ishlatilgan. Unga ayblov eʼlon qilindi, himoyachi ishtirok etdi. Ayblov xulosasi prokuror tomonidan tasdiqlanib, ish sudga yuborildi (JPK 379-388).'],
        ['secretary', 'Sud kelmoqda! Barchangizdan oʻrningizdan turishingizni soʻrayman.', { everyoneStands: true }],
      ],
      await: 'stand',
      then: 't-open',
    },
    {
      id: 't-open',
      // JPK 428: the presiding judge opens the session and names the case; JPK 429: the secretary reports who has appeared
      enter: [
        ['system', 'Sudya zalga kirib, oʻz oʻrniga oʻtdi.', { judgeIn: true }],
        ['judge', 'Sud majlisini ochiq deb eʼlon qilaman. T. Botirovni Nodira K.ga tegishli uyali telefonni yashirin ravishda talon-taroj qilishda ayblash toʻgʻrisidagi jinoyat ishi koʻriladi. Oʻtiring.'],
        ['system', 'Zaldagilar oʻtirdi.', { everyoneStands: false }],
        ['secretary', 'Hurmatli sud! Davlat ayblovchisi, sudlanuvchi T. Botirov va uning himoyachisi, jabrlanuvchi Nodira K. va uning vakili - advokat hozir. Guvoh O. Joʻrayev yoʻlakda kutmoqda.'],
      ],
      await: 'sit',
      then: 't-recusal',
    },
    {
      id: 't-recusal',
      // JPK 431: the court and the parties are named, the right to challenge is explained
      enter: [['judge', 'Ishda raislik qiluvchi - sudya M. Qodirov, davlat ayblovchisi - R. Aliyev, himoyachi - advokat S. Usmonova, jabrlanuvchi - Nodira K., uning vakili - advokat, sud majlisi kotibi - Dilfuza A. Taraflarga sudyani, sud tarkibini yoki taraflardan birortasini rad qilish huquqi tushuntiriladi. Jabrlanuvchi tomonida rad qilish toʻgʻrisida arz bormi?']],
      options: [
        { id: 'no-recusal', text: 'Hurmatli sud, rad qilish toʻgʻrisida arzimiz yoʻq.', next: 't-rights', tone: 'good', article: '431-modda' },
        { id: 'recuse-defender', text: 'Hurmatli sud, himoyachini rad qilamiz - u sudlanuvchini oqlamoqchi.',
          reply: [['judge', 'Himoyachining vazifasi - sudlanuvchini himoya qilish. Bu rad qilish uchun asos emas.', { emotion: 'impatient' }]],
          next: 't-rights', effect: { penalty: [10, 'Asossiz rad qilish'] }, tone: 'bad', article: '431-modda',
          feedback: 'Rad qilish uchun qonunda belgilangan asos kerak; himoyachining oʻz vazifasini bajarishi asos emas.' },
      ],
    },
    {
      id: 't-rights',
      // JPK 436 -> 55: the victim and the representative are told their rights at trial
      enter: [['judge', 'Jabrlanuvchi va uning vakiliga sud muhokamasidagi huquqlar tushuntiriladi: koʻrsatuv berish, dalillar taqdim qilish, iltimosnoma berish va rad qilish, shaxsan yoki vakil orqali sudda ayblovni quvvatlash, sud majlisi bayonnomasi bilan tanishish, sud harakatlari va qarorlari ustidan shikoyat keltirish. Tushunarlimi?']],
      options: [
        { id: 'understood', text: 'Hurmatli sud, huquqlar tushunarli.', next: 't-motions', tone: 'good', article: '436-modda' },
        { id: 'skip-rights', text: 'Hurmatli sud, tushuntirish shart emas - men advokatman.',
          reply: [['judge', 'Huquqlarni tushuntirish - sudning majburiyati. Jabrlanuvchi uchun ham tushuntiriladi.', { emotion: 'impatient' }]],
          next: 't-motions', effect: { penalty: [5, 'Huquqlarni tushuntirishni rad etishga urindingiz'] }, tone: 'bad', article: '436-modda' },
      ],
    },
    {
      id: 't-motions',
      // JPK 438: motions; the party must say which circumstance the extra evidence is meant to establish
      enter: [['judge', 'Taraflardan yangi guvohlar chaqirish, dalillar talab qilib olish toʻgʻrisida iltimoslar bormi? Jabrlanuvchi tomoni?']],
      options: [
        { id: 'motion-precise', text: 'Hurmatli sud, bozordagi doʻkon kamerasining 18:30-19:15 oraligʻidagi yozuvini talab qilib olishni soʻraymiz - u sudlanuvchining oʻsha vaqtda jabrlanuvchi yonida boʻlganini aniqlash uchun zarur.',
          reply: [['prosecutor', 'Hurmatli sud, iltimosni quvvatlayman.'], ['defender', 'Hurmatli sud, eʼtirozimiz yoʻq.'], ['judge', 'Iltimos ish uchun ahamiyatli holatni aniqlashga qaratilgan. Qanoatlantiriladi.']],
          next: 't-charge', effect: { learn: ['motion'], strength: 1 }, tone: 'good', article: '438-modda' },
        { id: 'motion-vague', text: 'Hurmatli sud, yana qandaydir dalillar topishni soʻraymiz.',
          reply: [['judge', 'Qaysi dalil va qaysi holatni aniqlash uchun? Iltimos qiluvchi taraf buni koʻrsatishi shart. Iltimos rad etiladi.', { emotion: 'impatient' }]],
          next: 't-charge', effect: { penalty: [10, 'Iltimos asoslanmadi'] }, tone: 'bad', article: '438-modda' },
        { id: 'no-motion', text: 'Hurmatli sud, iltimosimiz yoʻq.', next: 't-charge', tone: 'info' },
      ],
    },
    {
      id: 't-charge',
      // JPK 439: the state prosecutor reads out the charge; the defendant is asked whether it is clear and whether he pleads guilty
      enter: [
        ['judge', 'Sud tergovi boshlanadi. Soʻz davlat ayblovchisiga.'],
        ['prosecutor', 'Hurmatli sud! T. Botirov 2026-yil sentabr oyida Namuna tumani bozorida Nodira K.ning sumkasidan uyali telefonni yashirin ravishda olib, talon-taroj qilishda ayblanadi.'],
        ['judge', 'Sudlanuvchi, ayblovning mohiyati sizga tushunarlimi? Aybingizga iqrormisiz?'],
        ['defendant', 'Tushunarli. Aybimga iqror emasman. Telefonni bozorda yerdan topib oldim.', { emotion: 'uncertain' }],
        ['judge', 'Dalillarni tekshirish navbati boʻyicha taraflarning takliflarini eshitamiz. Jabrlanuvchi tomoni?'],
      ],
      options: [
        { id: 'order', text: 'Hurmatli sud, avval sudlanuvchini, soʻng jabrlanuvchini va guvohni soʻroq qilishni, keyin IMEI maʼlumotnomasi va kamera yozuvini tekshirishni taklif qilamiz.',
          reply: [['judge', 'Taklif qabul qilinadi. Sudlanuvchidan boshlaymiz.']], next: 't-defendant', tone: 'good', article: '440-modda' },
        { id: 'order-any', text: 'Hurmatli sud, navbatni oʻzingiz belgilang.',
          reply: [['judge', 'Sudlanuvchidan boshlaymiz.']], next: 't-defendant', effect: { penalty: [5, 'Taklif bildirish imkoniyatidan foydalanmadingiz'] }, tone: 'bad', article: '440-modda' },
      ],
    },
    {
      id: 't-defendant',
      // JPK 442: the defendant first gives his account; then the prosecutor, the victim and representatives, the defence ask
      enter: [
        ['judge', 'Sudlanuvchi, ishning sizga maʼlum holatlari boʻyicha koʻrsatuv bering.'],
        ['defendant', 'Oʻsha kuni bozorda edim. Telefonni yerda yotgan holda topdim, egasini qidirmoqchi edim.', { emotion: 'uncertain' }],
        ['prosecutor', 'Topgan boʻlsangiz, nega uni politsiyaga topshirmadingiz?'],
        ['defendant', 'Vaqtim boʻlmadi.'],
        ['judge', 'Jabrlanuvchining vakili, savollaringiz bormi?'],
      ],
      options: [
        { id: 'ask-sim', text: 'Hurmatli sud, sudlanuvchiga savol: telefonni egasiga qaytarmoqchi boʻlsangiz, nega ikki oy davomida unga oʻz SIM-kartangizni qoʻyib ishlatdingiz?',
          reply: [['defendant', '…Bilmayman. Shunchaki ishlatdim.', { emotion: 'upset' }]], next: 't-victim', effect: { strength: 1 }, tone: 'good', article: '442-modda' },
        { id: 'ask-leading', text: 'Siz telefonni sumkadan olgansiz, toʻgʻrimi? Ha deng.',
          reply: [['judge', 'Ishora qiluvchi savol berish taqiqlanadi. Savol olib tashlanadi.', { emotion: 'impatient' }]], next: 't-victim', effect: { penalty: [15, 'Ishora qiluvchi savol'] }, tone: 'bad', article: '102-modda' },
        { id: 'insult', text: 'Siz oddiy oʻgʻrisiz, uyalmaysizmi?',
          reply: [['judge', 'Jabrlanuvchining vakili, sud majlisida tartibga rioya qiling. Hukmni sud chiqaradi.', { emotion: 'impatient' }]], next: 't-victim', effect: { penalty: [15, 'Sud majlisida tartib buzildi'] }, tone: 'bad', article: '424-modda' },
      ],
    },
    {
      id: 't-victim',
      enter: [
        ['judge', 'Jabrlanuvchi, koʻrsatuv bering.'],
        ['client', 'Kechqurun bozorda meva olayotgandim. Yonimda baland boʻyli yigit turardi, keyin sumkam ochiq qolganini koʻrdim, telefon yoʻq edi.', { emotion: 'uncertain' }],
        ['defender', 'Siz sumkangizni oʻzingiz ochiq qoldirgansiz, shunday emasmi?'],
      ],
      options: [
        { id: 'object', text: 'Hurmatli sud, eʼtiroz bildiraman: himoyachi jabrlanuvchiga ishora qiluvchi savol bermoqda.',
          reply: [['judge', 'Eʼtiroz qabul qilinadi. Himoyachi, savolni boshqacha qoʻying.'], ['defender', 'Sumkangiz qanday holatda edi?'], ['client', 'Yopiq edi. Fermuarini oʻzim yopgandim.', { emotion: 'calm' }]],
          next: 't-witness', effect: { learn: ['objection'], strength: 1 }, tone: 'good', article: '102-modda' },
        { id: 'silent', kind: 'act', text: 'Indamaslik',
          reply: [['client', 'Ha… balki ochiq qolgandir…', { emotion: 'uncertain' }]], next: 't-witness',
          effect: { penalty: [10, 'Ishora qiluvchi savolga eʼtiroz bildirilmadi'] }, tone: 'bad', article: '102-modda',
          feedback: 'Ishora qiluvchi savollar taqiqlanadi (JPK 102); sudda soʻroq shu qoidalar boʻyicha olib boriladi (JPK 442). Vakil eʼtiroz bildirishi kerak edi.' },
      ],
    },
    {
      id: 't-witness',
      // JPK 441: identity, warning about liability, the public oath
      enter: [
        ['system', 'Guvoh zalga chaqirildi.', { witnessIn: true }],
        ['judge', 'Guvoh, koʻrsatuv berishdan bosh tortganlik yoki bila turib yolgʻon koʻrsatuv berganlik uchun javobgarlik toʻgʻrisida ogohlantirilasiz. Qasamyod qiling.'],
        ['witness', 'Ish yuzasidan oʻzimga maʼlum boʻlgan hamma narsani sudga aytib berishga qasamyod qilaman. Faqat haqiqatni, barcha haqiqatni gapirib beraman, haqiqatdan oʻzga narsani gapirmayman.'],
        ['witness', 'Oʻsha kuni bir ayol telefonim yoʻq deb qichqirdi. Undan sal oldin baland boʻyli, qora sumkali yigit shoshib ketayotganini koʻrgandim.'],
        ['judge', 'Jabrlanuvchining vakili, guvohga savollar?'],
      ],
      options: [
        { id: 'witness-open', text: 'Hurmatli sud, guvohga savol: oʻsha yigitni qayerda va qanday masofadan koʻrdingiz, u qaysi tomonga ketdi?',
          reply: [['witness', 'Doʻkonim yonida, uch-toʻrt qadam narida. Avtobus bekati tomonga ketdi. Hozir zalda oʻtirgan yigitga oʻxshaydi.']], next: 't-docs', effect: { strength: 1 }, tone: 'good', article: '442-modda' },
        { id: 'witness-leading', text: 'Bu aynan sudlanuvchi edi, toʻgʻrimi?',
          reply: [['judge', 'Ishora qiluvchi savol. Olib tashlanadi.', { emotion: 'impatient' }]], next: 't-docs', effect: { penalty: [15, 'Guvohga ishora qiluvchi savol'] }, tone: 'bad', article: '102-modda' },
      ],
    },
    {
      id: 't-docs',
      enter: (c) => [
        ['judge', 'Yozma dalillar oʻqib eshittiriladi: aloqa operatorining IMEI boʻyicha maʼlumotnomasi - Nodira K.ga tegishli telefon sentabr oyidan boshlab T. Botirov nomidagi SIM-karta bilan ishlatilgan.'],
        ...(c.knows('motion')
          ? ([['judge', 'Kamera yozuvi koʻzdan kechirildi: 18:52 da sudlanuvchiga oʻxshash shaxs jabrlanuvchining orqasida turgani va tez uzoqlashgani koʻrinadi.']] as Line[])
          : []),
        ['judge', 'Barcha dalillar tekshirildi. Taraflar sud tergovini toʻldirmoqchimi?'],
      ],
      options: [
        { id: 'no-more', text: 'Hurmatli sud, toʻldirishimiz yoʻq.', next: 't-debate', tone: 'good', article: '448-modda' },
        { id: 'save-for-speech', text: 'Hurmatli sud, yana bir guvohimiz bor, lekin uni muzokarada aytamiz.',
          reply: [['judge', 'Muzokarada sud tergovida koʻrib chiqilmagan dalillarni keltirish mumkin emas. Yangi dalil boʻlsa, hozir iltimos qiling.', { emotion: 'impatient' }]],
          next: 't-debate', effect: { penalty: [10, 'Dalilni muzokaraga qoldirmoqchi boʻldingiz'] }, tone: 'bad', article: '449-modda' },
      ],
    },
    {
      id: 't-debate',
      // JPK 449: the prosecutor speaks first, then the victim or the representative, then the defence and the defendant
      enter: [
        ['judge', 'Sud tergovi tamom boʻldi. Taraflar muzokarasiga oʻtamiz. Soʻz davlat ayblovchisiga.'],
        ['prosecutor', 'Hurmatli sud! Sud tergovida tekshirilgan dalillar sudlanuvchining aybini tasdiqlaydi. Jazo turi va meʼyori haqidagi fikrimni hamda hukmning taklif etiladigan mazmunini sudga yozma ravishda taqdim etaman.'],
        ['judge', 'Soʻz jabrlanuvchining vakiliga.'],
      ],
      options: [
        { id: 'speech-evidence', text: 'Hurmatli sud! Sud tergovida tekshirilgan dalillar - IMEI maʼlumotnomasi, guvoh koʻrsatuvi va jabrlanuvchining koʻrsatuvi - ayblovni tasdiqlaydi. Jabrlanuvchi tomoni ayblovni quvvatlaydi.',
          reply: [['defender', 'Hurmatli sud! Telefon yashirincha olinganini koʻrgan guvoh yoʻq. Aybsizlik prezumpsiyasini hisobga olishingizni soʻrayman.'], ['defendant', 'Men telefonni topib oldim, xolos.', { emotion: 'upset' }]],
          next: 't-last', effect: { learn: ['speech'], strength: 1 }, tone: 'good', article: '449-modda' },
        { id: 'speech-new', text: 'Hurmatli sud! Bundan tashqari, sudlanuvchining qoʻshnisi uni ilgari ham shunday ishlarda koʻrganini aytgan.',
          reply: [['judge', 'Taraflar nutqida sud tergovida koʻrib chiqilmagan dalillarni keltirishga haqli emas. Bu maʼlumot hisobga olinmaydi.', { emotion: 'impatient' }], ['defender', 'Hurmatli sud! Telefon yashirincha olinganini koʻrgan guvoh yoʻq. Aybsizlik prezumpsiyasini hisobga olishingizni soʻrayman.']],
          next: 't-last', effect: { penalty: [20, 'Muzokarada tekshirilmagan dalil'] }, tone: 'bad', article: '449-modda' },
      ],
    },
    {
      id: 't-last',
      // JPK 451: the defendant's last word; no questions may be put to him meanwhile
      enter: [['judge', 'Sudlanuvchiga oxirgi soʻz beriladi.'], ['defendant', 'Hurmatli sud, men oilam bilan yashayman, ishlayman. Adolatli qaror chiqarishingizni soʻrayman.', { emotion: 'upset' }]],
      options: [
        { id: 'listen', kind: 'act', text: 'Oxirgi soʻzni jim tinglash', next: 't-retire', tone: 'good', article: '451-modda' },
        { id: 'interrupt', text: 'Hurmatli sud, sudlanuvchiga bitta savolim bor…',
          reply: [['judge', 'Oxirgi soʻz vaqtida sudlanuvchiga savol berishga yoʻl qoʻyilmaydi.', { emotion: 'impatient' }]], next: 't-retire', effect: { penalty: [15, 'Oxirgi soʻz paytida savol'] }, tone: 'bad', article: '451-modda' },
      ],
    },
    {
      id: 't-retire',
      // JPK 453: after the last word the court retires at once to the deliberation room
      enter: [['judge', 'Sud hukm chiqarish uchun maslahatxonaga kiradi.'], ['secretary', 'Sud chiqmoqda! Oʻrningizdan turing.', { everyoneStands: true }]],
      await: 'stand',
      then: 't-out',
    },
    {
      id: 't-out',
      enter: [['system', 'Sudya maslahatxonaga chiqib ketdi.', { judgeIn: false, witnessIn: false }], ['system', 'Zaldagilar oʻtirdi. Hukm kutilmoqda.', { everyoneStands: false }]],
      await: 'sit',
      then: 't-back',
    },
    {
      id: 't-back',
      // JPK 473: everyone in the hall, the court included, hears the verdict standing
      enter: [['system', 'Bir soatdan soʻng.'], ['secretary', 'Sud kelmoqda! Hukm eʼlon qilinadi - oʻrningizdan turing.', { everyoneStands: true }], ['system', 'Sudya zalga qaytib kirdi.', { judgeIn: true }]],
      await: 'stand',
      then: 't-verdict',
    },
    {
      id: 't-verdict',
      enter: (c) => [
        ['judge', trialVerdict(c)],
        ['judge', 'Taraflarga hukmning mazmuni hamda hukm ustidan apellyatsiya yoki kassatsiya tartibida shikoyat berish muddati va tartibi tushuntiriladi. Sud majlisi yopildi.'],
      ],
      end: true,
    },
  ],
};

/** JPK 462-463: a guilty verdict rests only on evidence examined at trial; otherwise the presumption of innocence decides. */
function trialVerdict(c: CaseView): string {
  return convicted(c)
    ? 'Oʻzbekiston Respublikasi nomidan. Sud tergovida tekshirilgan dalillar bilan sudlanuvchining aybi isbotlandi. T. Botirov aybli deb topilsin; unga jazo tayinlansin.'
    : 'Oʻzbekiston Respublikasi nomidan. Sud tergovida tekshirilgan dalillar sudlanuvchining aybini shubhasiz isbotlamadi; ayblov hukmi taxminlarga asoslanishi mumkin emas. T. Botirov oqlansin.';
}
const convicted = (c: CaseView) => c.strength >= 3;

/** JPK 462-463, 473: the verdict as a court document (kind, grounds, announced standing, appeal explained). */
function judgment(c: CaseView): Ruling {
  const guilty = convicted(c);
  return {
      kind: 'judgment',
      title: 'HUKM',
      // JPK 462-463, 473: the kind of verdict, its grounds, announced standing; appeal explained
      body: [
        'Oʻzbekiston Respublikasi nomidan',
        '2026-yil noyabr, Namuna tumani. Jinoyat ishlari boʻyicha Namuna tuman sudi - raislik qiluvchi sudya M. Qodirov, sud majlisi kotibi Dilfuza A., davlat ayblovchisi R. Aliyev, himoyachi advokat S. Usmonova, jabrlanuvchi Nodira K. va uning vakili ishtirokida - T. Botirovga nisbatan jinoyat ishini ochiq sud majlisida koʻrib chiqdi.',
        guilty
          ? `Sud tergovida tekshirilgan dalillar: aloqa operatorining IMEI boʻyicha maʼlumotnomasi, jabrlanuvchi va guvoh koʻrsatuvlari${c.knows('motion') ? ', kamera yozuvi' : ''}. Ular sudlanuvchining aybini isbotladi (JPK 463).`
          : 'Ayblov hukmi taxminlarga asoslanishi mumkin emas va faqat aybi sud muhokamasida isbot qilingan taqdirda chiqariladi (JPK 463). Sud tergovida tekshirilgan dalillar bunga yetarli boʻlmadi; sud aybsizlik prezumpsiyasi talablariga amal qiladi (JPK 462).',
        guilty ? 'T. Botirov aybli deb topilsin; unga jazo tayinlansin (jazo turi va miqdori bu mashqda baholanmaydi).' : 'T. Botirov oqlansin.',
        'Hukm ustidan apellyatsiya yoki kassatsiya tartibida shikoyat berish muddati va tartibi taraflarga tushuntirildi (JPK 473).',
      ],
      articles: ['462-modda', '463-modda', '473-modda'],
    };
}


export const STAGES: StageDef[] = [report, interview, complaint, trial];

export const STAGE_ARTICLES: Partial<Record<StageId, string[]>> = {
  report: ['321-modda', '322-modda', '323-modda', '324-modda', '329-modda', '331-modda', '333-modda', '338-modda'],
  interview: ['54-modda', '55-modda', '64-modda', '96-modda', '100-modda', '106-modda', '114-modda', '117-modda'],
  complaint: ['55-modda', '358-modda', '375-modda'],
  trial: ['55-modda', '102-modda', '424-modda', '428-modda', '429-modda', '431-modda', '436-modda', '438-modda', '439-modda', '440-modda', '441-modda', '442-modda', '448-modda', '449-modda', '450-modda', '451-modda', '453-modda', '462-modda', '463-modda', '473-modda'],
};

export const won = (c: CaseView) => c.knows('complaint') && convicted(c);

export const BOOK: CaseBookShape = { standing: { rule: '424-modda', address: 'Jabrlanuvchining vakili' }, kind: 'theft', CASE, FACTS, EVIDENCE, PREPARED, STAGES, STAGE_ARTICLES, won, judgment, verdict: (c) => (convicted(c) ? 'Ayblov hukmi: sudlanuvchi aybli deb topildi' : 'Oqlov hukmi: dalillar aybni isbotlamadi') };
