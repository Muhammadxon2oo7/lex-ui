/**
 * Checks a claim drafted in the documents room against FPK 189–191 and
 * decides what the judge does with it when it is filed (193 accept / 195 return).
 * SERVER ONLY — the student learns the defects from the ruling, as in life.
 */
import type { ClaimDraft, Ruling } from '@/contracts/case';
import { ATTACHMENTS } from './ishga-tiklash';

export interface Defect {
  /** Ground for returning the claim (FPK 195), or null if it only weakens the claim. */
  ground: string | null;
  article: string;
  message: string;
  penalty: number;
}

export function checkClaim(d: ClaimDraft, knows: (id: string) => boolean): Defect[] {
  const out: Defect[] = [];
  if (d.court === 'economic')
    out.push({ ground: '195-modda 1-qism 3-band', article: '26-modda', penalty: 6, message: 'Fuqaro ishtirok etgan mehnat nizosi fuqarolik ishlari boʻyicha sudga taalluqli (26-modda), iqtisodiy sudga emas — ish mazkur sudning sudloviga tegishli emas.' });
  if (d.court === 'regional')
    out.push({ ground: '195-modda 1-qism 3-band', article: '28-modda', penalty: 6, message: 'Bunday ishlar birinchi instansiyada fuqarolik ishlari boʻyicha tumanlararo, tuman (shahar) sudida koʻriladi (28-modda); javobgar tashkilot — u davlat roʻyxatidan oʻtgan joydagi sudga (33-modda).' });
  if (!d.signed)
    out.push({ ground: '195-modda 1-qism 4-band', article: '189-modda', penalty: 6, message: 'Ariza imzolanmagan — 189-moddaga koʻra ariza daʼvogar yoki uning vakili tomonidan imzolanadi.' });
  if (!d.representative)
    out.push({ ground: '195-modda 1-qism 4-band', article: '189-modda', penalty: 4, message: 'Ariza vakil tomonidan berilmoqda, ammo vakilning familiyasi, ismi, otasining ismi va manzili koʻrsatilmagan (189-modda 1-qism 2-band).' });
  if (!d.attachments.includes('warrant'))
    out.push({ ground: '195-modda 1-qism 2-band', article: '191-modda', penalty: 6, message: 'Arizani vakil imzolagan, lekin vakolatni tasdiqlovchi hujjat ilova qilinmagan (189-modda oxirgi qismi, 191-modda 4-band).' });
  if (!d.attachments.includes('receipt'))
    out.push({ ground: '195-modda 1-qism 7-band', article: '191-modda', penalty: 6, message: 'Pochta xarajatlari toʻlanganligini tasdiqlovchi hujjat ilova qilinmagan (191-modda 3-band). Davlat bojidan esa xodim ozod.' });
  if (d.facts.length === 0 || d.evidence.length === 0)
    out.push({ ground: '195-modda 1-qism 4-band', article: '189-modda', penalty: 6, message: 'Talabga asos boʻlgan holatlar va ularni tasdiqlovchi dalillar koʻrsatilmagan (189-modda 1-qism 6-band).' });

  // Weaknesses that do not stop the claim but hurt it later.
  if (d.respondent === 'director')
    out.push({ ground: null, article: '189-modda', penalty: 4, message: 'Javobgar notoʻgʻri: mehnat shartnomasidagi ish beruvchi — «Namuna Savdo» MChJ, direktor shaxsan emas (189-modda 1-qism 3-band).' });
  if (d.demand !== 'reinstate')
    out.push({ ground: null, article: '189-modda', penalty: 6, message: 'Daʼvogarning talabi buzilgan huquqni tiklashga qaratilmagan: ishga tiklash va majburiy progul vaqti uchun haq soʻralishi kerak edi (189-modda 1-qism 4-band).' });
  if (d.copies < 1)
    out.push({ ground: null, article: '190-modda', penalty: 2, message: 'Javobgar uchun ariza nusxasi tayyorlanmagan (190-modda).' });
  const MISSING: Record<string, string> = { sick: 'kasal boʻlgan', notified: 'boshligʻiga xabar bergan', refused: 'varaqa qabul qilinmagan', explanation: 'yozma tushuntirish talab qilinmagan' };
  for (const key of Object.keys(MISSING))
    if (knows(key) && !d.facts.includes(key))
      out.push({ ground: null, article: '189-modda', penalty: 2, message: `Muhim holat arizada yoʻq: «${MISSING[key]}».` });
  if (knows('sickleave') && !d.attachments.includes('sickleave'))
    out.push({ ground: null, article: '191-modda', penalty: 3, message: 'Asosiy dalil — kasallik varaqasi nusxasi ilova qilinmagan (191-modda 1-band).' });
  for (const id of d.attachments) {
    const trap = ATTACHMENTS[id]?.trap;
    if (trap) out.push({ ground: null, article: '191-modda', penalty: 1, message: trap });
  }
  return out;
}

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
        'Arizaning qaytarilishi kamchiliklar bartaraf etilganidan keyin sudga umumiy tartibda takroran murojaat qilishga toʻsqinlik qilmaydi (195-modda oxirgi qismi). Ajrim ustidan shikoyat qilinishi mumkin.',
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
