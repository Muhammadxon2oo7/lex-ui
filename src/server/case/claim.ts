/**
 * Checks a claim drafted in the documents room (written by the student, not picked) against
 * FPK 189-191 and decides what the judge does with it when it is filed (193 accept / 195 return).
 * SERVER ONLY - the student learns the defects from the ruling, as in life.
 *
 * Sources (legal/sources, verbatim from lex.uz):
 *   FPK 26, 28, 33, 68, 72, 189, 190, 191, 193, 195 · MK 174, 313, 560 · «Davlat boji toʻgʻrisida» 8-modda
 *   · «Advokatlik faoliyatining kafolatlari…» 4-modda · Adliya vazirining 31.01.2023 1-mh-son buyrugʻi (order shakli)
 *
 * What the student wrote is read by words (names, addresses, the key facts). It does not judge style;
 * it checks that what FPK 189 requires is there and matches the papers in the folder.
 */
import type { ClaimDraft, OrderDraft, Ruling } from '@/contracts/case';
import { DISTRICTS, norm, PEOPLE } from '@/lib/labourCase';
import { ATTACHMENTS } from './ishga-tiklash';

export interface Defect {
  /** Ground for returning the claim (FPK 195), or null if it only weakens the claim. */
  ground: string | null;
  article: string;
  message: string;
  penalty: number;
}

const has = (text: string, ...any: string[]) => any.some((w) => norm(text).includes(norm(w)));
const all = (text: string, ...words: string[]) => words.every((w) => norm(text).includes(norm(w)));

/** What a fact looks like in the student's own words: any one group of stems is enough. */
const FACT_WORDS: Record<string, { label: string; any: string[][] }> = {
  dismissal: { label: 'boʻshatish buyrugʻi (14-oktabr, 47-k)', any: [['47-k'], ['buyruq', '14'], ['boʻshat', '14-oktabr']] },
  sick: { label: '9-10-oktabr kunlari kasal boʻlgani', any: [['kasal'], ['layoqatsiz']] },
  notified: { label: 'boshligʻiga telefonda xabar bergani', any: [['telefon'], ['qoʻngʻiroq'], ['xabar bergan']] },
  refused: { label: 'kasallik varaqasi qabul qilinmagani', any: [['qabul qilinmagan'], ['qabul qilmagan'], ['qabul qilishdan bosh tort']] },
  explanation: { label: 'yozma tushuntirish talab qilinmagani (MK 313)', any: [['tushuntirish']] },
  witness: { label: 'guvoh (hamkasbi Bahodir R.)', any: [['guvoh'], ['bahodir']] },
};

export function factsWritten(circumstances: string): string[] {
  return Object.entries(FACT_WORDS).filter(([, f]) => f.any.some((g) => all(circumstances, ...g))).map(([id]) => id);
}

/** The order (Adliya vazirining 1-mh-son buyrugʻi, ilova; izoh 6: an incomplete order is not valid). */
export function checkOrder(o: OrderDraft | null): string[] {
  if (!o) return ['order rasmiylashtirilmagan'];
  const out: string[] = [];
  if (!o.number.trim()) out.push('order raqami (1-band) yoʻq');
  if (!has(o.firm, 'namuna')) out.push('advokatlik tuzilmasining nomi (2-band) notoʻgʻri');
  if (!o.firmAddress.trim() || !/\d{2}/.test(o.firmAddress)) out.push('tuzilma manzili va telefon raqami (3-band) toʻliq emas');
  if (o.advocate.trim().split(/\s+/).length < 2) out.push('advokatning familiyasi, ismi, otasining ismi (4-band) toʻliq emas');
  if (!has(o.license, PEOPLE.license.number)) out.push('advokatlik guvohnomasi rekvizitlari (5-band) notoʻgʻri');
  if (o.specialty !== 'civil-economic') out.push('litsenziya boʻyicha ixtisoslik (6-band): fuqarolik ishi uchun «fuqarolik va iqtisodiy sud ishlarini yuritish»');
  if (o.basis !== 'contract') out.push('order berishga asos (7-band): mijoz bilan shartnoma tuzilgan');
  if (!o.basisDate.trim()) out.push('asos hujjat sanasi (8-band) yoʻq');
  if (!all(o.client, 'nurmatov', 'sardor')) out.push('ishonch bildiruvchi shaxs (9-band) - mijozning familiyasi, ismi, otasining ismi');
  if (o.caseType !== 'civil') out.push('ish turi (10-band): fuqarolik ishi');
  if (!o.issued.trim()) out.push('order berilgan sana (11-band) yoʻq');
  if (!o.signed) out.push('advokat imzosi va tuzilma muhri (12-band) yoʻq');
  return out;
}

export function checkClaim(d: ClaimDraft, knows: (id: string) => boolean): Defect[] {
  const out: Defect[] = [];
  const ret = (band: string, article: string, penalty: number, message: string) => out.push({ ground: `195-modda 1-qism ${band}`, article, penalty, message });
  const weak = (article: string, penalty: number, message: string) => out.push({ ground: null, article, penalty, message });

  // 1 · the court (FPK 26, 28, 33; 189 p.1)
  if (!d.court.type || !d.court.district) ret('4-band', '189-modda', 6, 'Ariza berilayotgan sudning nomi koʻrsatilmagan (189-modda 1-band).');
  else if (d.court.type !== 'civil') {
    const why: Record<string, string> = {
      economic: 'Fuqaro ishtirok etgan mehnat nizosi fuqarolik ishlari boʻyicha sudga taalluqli (26-modda), iqtisodiy sudga emas',
      administrative: 'Mehnat nizosi maʼmuriy sudga emas, fuqarolik ishlari boʻyicha sudga taalluqli (26-modda)',
      criminal: 'Mehnat nizosi jinoyat ishlari boʻyicha sudga emas, fuqarolik ishlari boʻyicha sudga taalluqli (26-modda)',
      regional: 'Bunday ishlar birinchi instansiyada fuqarolik ishlari boʻyicha tumanlararo, tuman (shahar) sudida koʻriladi (28-modda)',
      supreme: 'Bunday ishlar birinchi instansiyada fuqarolik ishlari boʻyicha tumanlararo, tuman (shahar) sudida koʻriladi (28-modda)',
    };
    ret('3-band', d.court.type === 'regional' || d.court.type === 'supreme' ? '28-modda' : '26-modda', 6, `${why[d.court.type]} - ish mazkur sudning sudloviga tegishli emas.`);
  } else if (norm(d.court.district) !== norm(PEOPLE.employer.registered.replace(' tumani', ''))) {
    ret('3-band', '33-modda', 6, `Tashkilotga nisbatan ariza u davlat roʻyxatidan oʻtgan joydagi sudga beriladi (33-modda). Javobgar ${PEOPLE.employer.registered}da roʻyxatdan oʻtgan, ariza esa ${d.court.district} sudiga yozilgan.`);
  }

  // 2 · claimant and representative (189 p.2)
  if (!all(d.claimant.name, 'nurmatov', 'sardor', 'akmal')) ret('4-band', '189-modda', 4, 'Daʼvogarning familiyasi, ismi, otasining ismi toʻliq koʻrsatilmagan (189-modda 2-band).');
  if (!all(d.claimant.address, 'namuna', 'bogʻbon', '12')) ret('4-band', '189-modda', 4, 'Daʼvogarning yashash joyi toʻliq yoki toʻgʻri koʻrsatilmagan (189-modda 2-band).');
  if (!d.representative.name.trim() || !d.representative.address.trim())
    ret('4-band', '189-modda', 4, 'Ariza vakil tomonidan berilmoqda, ammo vakilning familiyasi, ismi, otasining ismi va manzili koʻrsatilmagan (189-modda 2-band).');

  // 3 · respondent (189 p.3)
  const company = has(d.respondent.name, 'namuna savdo');
  if (!d.respondent.name.trim()) ret('4-band', '189-modda', 6, 'Javobgar koʻrsatilmagan (189-modda 3-band).');
  else if (!company) weak('189-modda', 4, 'Javobgar notoʻgʻri: mehnat shartnomasidagi ish beruvchi - «Namuna Savdo» MChJ, direktor shaxsan emas (189-modda 3-band).');
  if (company && !all(d.respondent.address, 'ipak', '5')) ret('4-band', '189-modda', 3, 'Javobgar tashkilotning joylashgan yeri (pochta manzili) koʻrsatilmagan (189-modda 3-band).');

  // 4 · the demand (189 p.4) - what restores the right: reinstatement and pay for the forced absence (MK 174)
  if (!d.demand.trim()) ret('4-band', '189-modda', 6, 'Daʼvogarning talabi koʻrsatilmagan (189-modda 4-band).');
  else {
    if (!has(d.demand, 'tiklash', 'tiklansin')) weak('189-modda', 6, 'Talabda ishga (avvalgi lavozimga) tiklash soʻralmagan - buzilgan huquq shu bilan tiklanadi (MK 174-modda).');
    if (!has(d.demand, 'progul', 'oʻrtacha ish haqi', 'ish haqi')) weak('189-modda', 3, 'Majburiy progul vaqti uchun haq undirish soʻralmagan (MK 174-modda).');
    if (has(d.demand, 'javobgarlikka tort', 'uzr')) weak('189-modda', 3, 'Talabda fuqarolik sudi hal qilmaydigan narsa bor (direktorni javobgarlikka tortish, uzr soʻratish).');
  }

  // 6 · circumstances and their evidence (189 p.6)
  const written = factsWritten(d.circumstances);
  if (d.circumstances.trim().split(/\s+/).length < 12 || d.evidence.length === 0)
    ret('4-band', '189-modda', 6, 'Talabga asos boʻlgan holatlar va ularni tasdiqlovchi dalillar koʻrsatilmagan (189-modda 6-band).');
  for (const [id, f] of Object.entries(FACT_WORDS))
    if (knows(id) && !written.includes(id)) weak('189-modda', 2, `Muhim holat arizada yoʻq: ${f.label}.`);

  // 7 · contact (189, last part): an e-mail must be one
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) weak('189-modda', 1, 'Elektron manzil notoʻgʻri yozilgan - sud xabarnomalari yetib bormaydi.');

  // signature (189, part 2) and authority (189 part 2; 191 p.4; FPK 68; Advokatlik kafolatlari 4-modda; order shakli)
  if (!d.signed) ret('4-band', '189-modda', 6, 'Ariza imzolanmagan - 189-moddaga koʻra ariza daʼvogar yoki uning vakili tomonidan imzolanadi.');
  const orderFaults = checkOrder(d.order);
  if (!d.attachments.includes('warrant'))
    ret('2-band', '191-modda', 6, 'Arizani vakil imzolagan, lekin vakolatni tasdiqlovchi hujjat - advokat orderi ilova qilinmagan (189-modda ikkinchi qismi, 191-modda 4-band).');
  else if (orderFaults.length)
    ret('2-band', '191-modda', 6, `Ilova qilingan advokat orderi haqiqiy emas: ${orderFaults.join('; ')}. Order shaklining 1-12-bandlari toʻliq toʻldirilmagan boʻlsa, u haqiqiy hisoblanmaydi (Adliya vazirining 2023-yil 31-yanvardagi 1-mh-son buyrugʻi, izohning 6-bandi).`);

  // 191 p.3: postage is paid; the worker is exempt from the state duty
  if (!d.attachments.includes('receipt'))
    ret('7-band', '191-modda', 6, 'Pochta xarajatlari toʻlanganligini tasdiqlovchi hujjat ilova qilinmagan (191-modda 3-band). Davlat bojidan esa xodim ozod («Davlat boji toʻgʻrisida»gi Qonun, 8-modda 1-band).');

  // 190: a copy for the respondent; 191 p.1: the main evidence
  if (d.copies < 1) weak('190-modda', 2, 'Javobgar uchun ariza nusxasi tayyorlanmagan (190-modda).');
  if (knows('sickleave') && !d.attachments.includes('sickleave')) weak('191-modda', 3, 'Asosiy dalil - kasallik varaqasi nusxasi ilova qilinmagan (191-modda 1-band).');
  for (const id of d.attachments) {
    const trap = ATTACHMENTS[id]?.trap;
    if (trap) weak('191-modda', 1, trap);
  }

  // MK 560: three months from the day the order was handed over (14.10.2026). Not a ground to return
  // the claim - the court decides it at the hearing (Plenum 2023-26, 8-band).
  const date = Date.parse(d.date);
  if (Number.isFinite(date) && date > Date.parse('2027-01-14')) weak('MK 560-modda', 6, 'Ishga tiklash nizosi boʻyicha sudga murojaat muddati - buyruq nusxasi topshirilgan kundan uch oy (MK 560-modda). Ariza sanasi bu muddatdan keyin.');
  if (Number.isFinite(date) && date < Date.parse('2026-10-14')) weak('189-modda', 1, 'Ariza sanasi boʻshatish buyrugʻidan oldingi kun - sana notoʻgʻri.');
  return out;
}

/** Districts the drafting room offers (for the client's select). */
export const COURT_DISTRICTS = DISTRICTS;

export function filingRuling(defects: Defect[], filingNo: number): Ruling {
  const returning = defects.filter((d) => d.ground);
  if (returning.length) {
    return {
      kind: 'returned',
      title: `Arizani qaytarish toʻgʻrisida AJRIM (${filingNo}-murojaat)`,
      body: [
        'Sudya daʼvo arizasini va unga ilova qilingan hujjatlarni oʻrganib chiqib, quyidagilarni aniqladi:',
        ...returning.map((d) => `• ${d.message}`),
        `Yuqoridagilarga asosan, FPKning ${[...new Set(returning.map((d) => d.ground!.replace(' 1-qism', '')))].join(', ')}ga muvofiq ariza qaytarilsin.`,
        'Arizaning qaytarilishi yoʻl qoʻyilgan kamchiliklar bartaraf etilganidan keyin sudga umumiy tartibda takroran murojaat qilishga toʻsqinlik qilmaydi (195-modda). Ajrim ustidan shikoyat qilinishi (protest keltirilishi) mumkin.',
      ],
      articles: [...new Set(['195-modda', ...returning.map((d) => d.article)])],
    };
  }
  return {
    kind: 'accepted',
    title: 'Arizani ish yuritishga qabul qilish va fuqarolik ishini qoʻzgʻatish toʻgʻrisida AJRIM',
    body: [
      'Ariza FPKda nazarda tutilgan talablarga rioya etgan holda berilgan.',
      'Ariza ish yuritishga qabul qilinsin va fuqarolik ishi qoʻzgʻatilsin. Ish sud muhokamasiga tayyorlansin.',
      ...(defects.length ? ['Sudya eʼtibori (arizani qaytarishga asos emas, lekin ish sifatiga taʼsir qiladi):', ...defects.map((d) => `• ${d.message}`)] : []),
    ],
    articles: ['192-modda', '193-modda', '201-modda'],
  };
}
