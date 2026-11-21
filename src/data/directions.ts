/**
 * Which normative acts each line of practice rests on, and which of their articles it actually uses.
 * Every article named here must be in src/data/sources.json (built from legal/sources, verbatim from
 * lex.uz) - src/data/sources.test.ts fails otherwise. `articles: []` means the act is listed as the
 * profession's ground rules, but nothing in the practice is scored against one of its articles.
 */
import fpkCase from '@/server/law/fpk-case.json';
import fpkHearing from '@/server/law/fpk-hearing.json';
import jpkCase from '@/server/law/jpk-case.json';
import sources from './sources.json';

export interface Use {
  doc: string;
  why: string;
  articles: string[];
}
export interface DirectionSources {
  id: string;
  role: string;
  title: string;
  /** Where the content comes from, said plainly. */
  note: string;
  uses: Use[];
}

const nums = (law: { articles: { number: string }[] }) => law.articles.map((a) => a.number);
const range = (from: number, to: number, unit: 'modda' | 'band') => Array.from({ length: to - from + 1 }, (_, i) => `${from + i}-${unit}`);
const all = (doc: string) => sources.docs.find((d) => d.id === doc)!.articles.map((a) => a.number);

export const DIRECTION_SOURCES: DirectionSources[] = [
  {
    id: 'advokat', role: 'Advokat', title: 'Ishga tiklash nizosi',
    note: 'Ish holatlari toʻqilgan. Protsessual tartib, arizaning mazmuni va ilovalari, sudning ajrimlari - FPK matni boʻyicha; ishga tiklash shartlari - Mehnat kodeksi va Oliy sud Plenumi qarori boʻyicha.',
    uses: [
      { doc: 'FPK', why: 'Maslahat, vakillik, daʼvo arizasi va uni qaytarish, ishni tayyorlash, sud majlisi, hal qiluv qarori va shikoyat muddati', articles: nums(fpkCase) },
      { doc: 'MK', why: 'Qonunga xilof boʻshatish oqibatlari va isbot yuki, intizomiy jazo tartibi (yozma tushuntirish), sudga murojaat muddati', articles: ['174-modda', '313-modda', '560-modda'] },
      { doc: 'PLENUM-2023-26', why: 'Sud amaliyoti: murojaat muddati oʻtkazib yuborilganda ariza qaytarilmaydi; boʻshatish asosliligini ish beruvchi isbotlaydi', articles: ['8-band', '62-band'] },
      { doc: 'ADVKAFOLAT', why: 'Advokatning muayyan ishni olib borishga vakolati order bilan tasdiqlanadi', articles: ['4-modda'] },
      { doc: 'ORDER', why: '«Hujjatlar» xonasidagi order shakli: 12 band va izohlar', articles: all('ORDER') },
      { doc: 'DAVLATBOJI', why: 'Mehnat munosabatlaridan kelib chiqadigan talab boʻyicha daʼvogar davlat bojidan ozod', articles: ['8-modda'] },
      { doc: 'SUDLAR', why: '«Hujjatlar» xonasida sud turini tanlash roʻyxati - sud tizimi', articles: ['2-modda'] },
      { doc: 'JK', why: 'Sud majlisida guvohni yolgʻon koʻrsatuv uchun javobgarlik haqida ogohlantirish', articles: ['238-modda'] },
      { doc: 'ADVOKATURA', why: 'Kasbning asosiy qonuni: advokatlik faoliyati, advokatning huquq va majburiyatlari (umumiy asos)', articles: [] },
    ],
  },
  {
    id: 'tergov', role: 'Jabrlanuvchi vakili', title: 'Telefon oʻgʻirligi: arizadan shikoyatgacha',
    note: 'Ish holatlari toʻqilgan. Arizani qabul qilish, jabrlanuvchini soʻroq qilish va tergovchi ustidan shikoyat - JPK matni boʻyicha. Jinoyatni kvalifikatsiya qilish bu mashqda baholanmaydi.',
    uses: [
      { doc: 'JPK', why: 'Jabrlanuvchining huquqlari, soʻroq tartibi va bayonnoma, jinoyat toʻgʻrisidagi arizalar, ish qoʻzgʻatish, shikoyat', articles: nums(jpkCase) },
      { doc: 'ADVOKATURA', why: 'Jabrlanuvchining vakili - advokat: kasbning asosiy qonuni (umumiy asos)', articles: [] },
      { doc: 'ADVKAFOLAT', why: 'Advokatning vakolati order bilan tasdiqlanadi', articles: ['4-modda'] },
      { doc: 'PROKURATURA', why: 'Tergov ustidan nazorat qiluvchi organ (maʼlumot uchun)', articles: [] },
    ],
  },
  {
    id: 'sudya', role: 'Sudya', title: 'Sud majlisida raislik qilish',
    note: 'Majlis bosqichlari va har bosqichdagi sudyaning harakati - FPK 208-248, 276-moddalar matni boʻyicha.',
    uses: [
      { doc: 'FPK', why: 'Sud majlisini ochish, zal tartibi, ishtirokchilarni tekshirish, rad qilish, huquqlarni tushuntirish, ishni mazmunan koʻrish, muzokaralar, hal qiluv qarori, bayonnoma', articles: nums(fpkHearing) },
      { doc: 'PLENUM-2018-14', why: 'Birinchi instansiya sudi tomonidan FPK normalarini qoʻllash amaliyoti (umumiy asos)', articles: [] },
      { doc: 'SUDLAR', why: 'Sud tizimi va odil sudlov prinsiplari: qonuniylik, sudyalarning mustaqilligi, tenglik, oshkoralik, til, himoya huquqi', articles: ['2-modda', ...range(8, 17, 'modda')] },
    ],
  },
  {
    id: 'iqtisodiy', role: 'Tomon vakili', title: 'Iqtisodiy sudda nizo',
    note: 'Ssenariylar (ish holatlari, sudya va raqib javoblari) sud serverida tuziladi va oʻsha yerda IPK moddalariga bogʻlanadi. Bu yerda - majlis tartibi tayanadigan IPK moddalari.',
    uses: [
      { doc: 'IPK', why: 'Iqtisodiy sudda majlis tartibi: ochish, ishtirokchilar, rad qilish, huquqlar, tushuntirishlar, dalillar, muzokaralar, hal qiluv qarori', articles: ['20-modda', '21-modda', '22-modda', '23-modda', '24-modda', '42-modda', '52-modda', '54-modda', '56-modda', '58-modda', '60-modda', '86-modda', '87-modda', '88-modda', '89-modda', '125-modda', '126-modda', '165-modda', '167-modda', '168-modda', '169-modda', '170-modda', '171-modda', '173-modda', '174-modda', '175-modda', '176-modda', '177-modda', '178-modda', '179-modda', '186-modda', '201-modda', '202-modda', '203-modda', '259-modda', '261-modda', '262-modda'] },
      { doc: 'SUDLAR', why: 'Tumanlararo iqtisodiy sudning tarkibi va vakolati', articles: ['2-modda', '39-modda', '40-modda'] },
    ],
  },
  {
    id: 'dxm', role: 'Davlat xizmatchisi', title: 'Yoʻqolgan staj: fuqaro murojaati',
    note: 'Fuqaro va uning holati toʻqilgan. Stajni tasdiqlash yoʻllari, xizmatlar va odob qoidalari - quyidagi hujjatlardan. Qaysi modda aynan shu holatga javob berishini mentor tasdiqlaydi.',
    uses: [
      { doc: 'PENSIYA', why: 'Ish stajini tasdiqlash: hujjatlar, mehnat daftarchasi boʻlmaganda, sud tartibida', articles: range(37, 42, 'modda') },
      { doc: 'VMQ592', why: 'Pensiya tayinlash nizomi: stajni tasdiqlovchi hujjatlar, maxsus komissiya', articles: [...range(52, 56, 'band'), ...range(70, 74, 'band')] },
      { doc: 'VMQ612', why: 'Davlat xizmati: «Ish haqi va ish stajini tasdiqlash haqida arxiv maʼlumotnomasi», mehnat daftarchasidagi yozuvlarni tasdiqlash', articles: ['18-ilova', '55-ilova'] },
      { doc: 'MUROJAAT', why: 'Fuqaro murojaatini qabul qilish va koʻrib chiqish', articles: [] },
      { doc: 'MTT', why: 'Maʼmuriy tartib-taomillar prinsiplari', articles: [] },
      { doc: 'DFX', why: 'Davlat fuqarolik xizmatchisining majburiyatlari va cheklovlari', articles: [] },
      { doc: 'VMQ595', why: 'Davlat fuqarolik xizmatchilari odob-axloqining namunaviy qoidalari', articles: [] },
      { doc: 'KORRUPSIYA', why: 'Pora taklifini rad etish: korrupsiyaga qarshi kurashish', articles: [] },
      { doc: 'JK', why: 'Pora olish, berish va vositachilik uchun javobgarlik', articles: range(210, 214, 'modda') },
    ],
  },
  {
    id: 'bahs', role: 'Jamoaviy bahs', title: 'Kursdoshlar bilan sudda',
    note: 'Bahs tartibi (14 qadam, vaqt chegaralari) - oʻquv tartibi: IPKdagi majlis tartibiga yaqinlashtirilgan, lekin uning oʻzi emas. Ish papkasi sud serveridagi ssenariydan olingan. Gʻolibni aniqlash - oʻquv bahosi, sud qarori emas.',
    uses: [
      { doc: 'IPK', why: 'Majlis tartibining asosi: tushuntirishlar, dalillar, sud muzokaralari va replika', articles: ['165-modda', '173-modda', '174-modda', '175-modda', '176-modda', '177-modda'] },
    ],
  },
];

export type SourceDoc = (typeof sources.docs)[number];
export const SOURCE_DOCS: SourceDoc[] = sources.docs;
export const SOURCES_BUILT_AT = sources.builtAt;
