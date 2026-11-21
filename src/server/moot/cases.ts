/**
 * Case files for the moot court. A case is what both sides study before the hearing: the facts
 * everyone knows, each side's own task and confidential facts, and the evidence in the file.
 * There are no scripted answers - people argue it.
 *
 * «ijara» comes from the court server's published scenario (both briefings); the economic cases in
 * ./econ.ts come from published court rulings (lex.uz and others, named in each case's `basis`).
 * Nothing is invented: no sums, dates or articles beyond what the sources state, and every norm is
 * in the verified pack (legal/sources ← lex.uz). A lawyer signs them off before real use.
 */
import type { LibCase } from '@/contracts/library';
import { normRef } from '@/server/law/norms';
import type { MootCatalogItem, MootSide, MootSkill } from '@/contracts/moot';
import { ECON_CASES } from './econ';

/** A norm from the verified pack (legal/sources ← lex.uz): the document id and the article / band number. */
export interface CaseNorm {
  doc: 'FK' | 'FK2' | 'SHARTNOMAVIY' | 'PLENUM-OXS-163' | 'PLENUM-OXS-234' | 'PLENUM-OXS-306' | 'PLENUM-OXS-103' | 'IPK';
  n: string;
}

export interface MootCase {
  id: string;
  title: string;
  court: string;
  summary: string;
  parties: Record<MootSide, string>;
  claim: string;
  facts: { id: string; title: string; text: string }[];
  evidence: { id: string; title: string; text: string }[];
  side: Record<MootSide, { task: string[]; confidential: string[] }>;
  /**
   * What a side's argument is expected to touch (for the reference scorer): groups of word stems,
   * one hit per group. From the facts above only - the scorer measures coverage, not truth.
   */
  points: Record<MootSide, string[][]>;
  disclaimer: string;
  /** The case's id on the court server's case-lab (solutions and verdicts are bound to it); none for our own cases. */
  labId?: string;
  /** Catalogue: the subject, how hard, which of the five skills it trains. */
  topic?: string;
  level?: 1 | 2 | 3;
  skills?: MootSkill[];
  /** The chain of dates both sides see. */
  timeline?: { date: string; text: string }[];
  /** Norms handed out with the file (from the verified pack only). */
  norms?: CaseNorm[];
  /** Opened after the verdict: what the case is based on, what the real courts decided, what it teaches. */
  basis?: { ruling: string; url: string; mark: 'T' | 'I'; adapted: string };
  outcome?: string[];
  lessons?: string[];
}

export const MOOT_CASES: Record<string, MootCase> = {
  ijara: {
    id: 'ijara',
    title: 'Ijara qarzi va penya',
    court: 'Namuna tumanlararo iqtisodiy sudi · 2-sud majlislari zali',
    summary: 'Savdo markazidagi 9,5 m² joyning ijara haqi toʻlanmagan: asosiy qarz va penya undirish toʻgʻrisidagi daʼvo.',
    parties: { claimant: '«A» MChJ (ijaraga beruvchi)', respondent: 'Yakka tartibdagi tadbirkor «B» (ijarachi)' },
    claim: '25 620 433,19 soʻm asosiy qarz va 3 040 580,45 soʻm penya undirish.',
    facts: [
      { id: 'contract', title: 'Shartnoma', text: '2022-yil 1-apreldagi 32-P-sonli ijara shartnomasi: «A» MChJ savdo markazidagi 9,5 m² maydonni tadbirkor «B»ga ijaraga bergan.' },
      { id: 'debt', title: 'Talab', text: 'Daʼvogar ijara haqi toʻlanmaganini aytib, 25 620 433,19 soʻm asosiy qarz va 3 040 580,45 soʻm penya undirishni soʻraydi.' },
      { id: 'penalty', title: 'Penya sharti', text: 'Penya shartnomaning 8.5-bandida belgilangan.' },
    ],
    evidence: [
      { id: 'e-contract', title: 'Ijara shartnomasi № 32-P', text: 'Taraflar imzolagan shartnoma: ijara haqi va toʻlash tartibi, obyektni topshirish tartibi, penya (8.5-band).' },
      { id: 'e-invoices', title: 'Hisob-fakturalar', text: 'Ijara xizmati uchun hisob-fakturalar. Ijarachi tomonidan imzolangan.' },
      { id: 'e-act', title: 'Topshirish dalolatnomasi', text: 'Obyektni topshirish-qabul qilish dalolatnomasi ish materiallarida imzolanmagan holda turibdi.' },
    ],
    side: {
      claimant: {
        task: ['Daʼvo talablarini quvvatlang: qarz va penya nimaga asoslanganini dalillar bilan koʻrsating.', 'Raqibning eʼtirozlariga javob bering.', 'Sudga «Hurmatli sud!» deb murojaat qiling.'],
        confidential: ['Topshirish dalolatnomasi imzolanmagan - bu zaif joyingiz.', 'Lekin javobgar hisob-fakturalarni imzolagan va joydan foydalangan.'],
      },
      respondent: {
        task: ['Mijoz manfaatini himoya qiling: daʼvoga asosli eʼtiroz bildiring.', 'Penya boʻyicha iltimosnoma bering.', 'Sudga «Hurmatli sud!» deb murojaat qiling.'],
        confidential: ['Mijoz joydan taxminan uch oy foydalangan.', 'Topshirish dalolatnomasi imzolanmagan.', 'Mijozning moliyaviy ahvoli ogʻir.', 'Hisob-fakturalar imzolanganini inkor etib boʻlmaydi.'],
      },
    },
    points: {
      claimant: [['shartnoma', '32-p'], ['hisob-faktura', 'faktura'], ['imzola'], ['foydalan'], ['qarz', '25 620', 'asosiy'], ['penya', '8.5'], ['toʻlanma', 'tolanma', 'toʻlamagan']],
      respondent: [['dalolatnoma'], ['imzolanmagan', 'imzolanma'], ['topshiril'], ['uch oy', '3 oy'], ['penya'], ['kamaytir', 'nomutanosib'], ['moliyaviy', 'ahvol']],
    },
    disclaimer: 'Oʻquv ishi. Real iqtisodiy sud ishi asosida, sezilarli oʻzgartirilgan. Huquqiy maslahat emas.',
    labId: 's_ijara',
    topic: 'Ijara',
    level: 1,
    skills: ['dalil', 'qoida'],
    timeline: [{ date: '01.04.2022', text: '32-P-sonli ijara shartnomasi tuzildi (9,5 m²).' }],
    norms: [{ doc: 'FK2', n: '541-modda' }, { doc: 'PLENUM-OXS-234', n: '9-band' }, { doc: 'FK', n: '326-modda' }, { doc: 'PLENUM-OXS-163', n: '4-band' }],
  },
  ...ECON_CASES,
};

export const DEFAULT_CASE = 'ijara';

/** The built-in catalogue for the case picker: public fields only, easiest first. */
export function mootCatalog(): MootCatalogItem[] {
  return Object.values(MOOT_CASES)
    .map((c) => ({
      id: c.id, title: c.title, summary: c.summary, topic: c.topic ?? 'Boshqa', level: c.level ?? 2, skills: c.skills ?? [],
      abroad: Boolean(c.basis && !/lex\.uz|buxgalter\.uz/.test(c.basis.url)),
    }))
    .sort((a, b) => a.level - b.level);
}

/**
 * A case approved on the court server (GET /moot/cases/{id}) as a room's case file. Its own `points`
 * are used when it has them; otherwise the reference scorer looks for the titles of its facts and
 * evidence (one word stem each). Nothing is added to the case.
 */
export function fromLibrary(c: LibCase): MootCase {
  const stems = (items: { title: string }[]) => items.map((i) => (i.title.split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? '').toLowerCase().slice(0, 6)).filter((w) => w.length >= 4).map((w) => [w]);
  const points = c.points?.claimant?.length && c.points?.respondent?.length ? { claimant: c.points.claimant, respondent: c.points.respondent } : { claimant: stems([...c.facts, ...c.evidence]), respondent: stems([...c.facts, ...c.evidence]) };
  return {
    id: c.id, labId: c.id, title: c.title, court: c.court || 'Oʻquv sudi', summary: c.summary, parties: c.parties, claim: c.claim,
    facts: c.facts, evidence: c.evidence, side: c.side, points, disclaimer: c.disclaimer,
  };
}

/** Which line of practice («Sohalar», the court server's domain ids) each built-in case belongs to. */
export const CASE_DOMAIN: Record<string, string> = {
  ijara: 'lease',
  'penya-foiz': 'lease',
  'lizing-chegara': 'lease',
  'ijara-qaytarish': 'lease',
  'vaziyat-ozgarishi': 'lease',
  'ogzaki-ozgartirish': 'lease',
  'kam-yetkazish': 'supply',
  'kafillik-muddati': 'supply',
  'qurilish-kechikish': 'construction',
  'qurilish-qabul': 'construction',
  'video-natija': 'construction',
  'penya-bekor': 'construction',
  'qoriqlash-dalolatnoma': 'services',
  'fors-major': 'services',
  'narx-sharti': 'sale',
};

/**
 * The built-in cases of a domain as library cards (source «system», approved, mode «Bahs»).
 * Public view only: no side's confidential facts, no scorer points, no real outcome.
 */
export function builtinLibCases(domain: string): LibCase[] {
  return Object.values(MOOT_CASES)
    .filter((c) => CASE_DOMAIN[c.id] === domain)
    .sort((a, b) => (a.level ?? 2) - (b.level ?? 2))
    .map((c) => ({
      id: c.id, domain, source: 'system', status: 'approved', mine: false, modes: ['moot'],
      title: c.title, court: c.court, summary: c.summary, parties: c.parties, claim: c.claim, facts: c.facts, evidence: c.evidence,
      side: { claimant: { task: c.side.claimant.task, confidential: [] }, respondent: { task: c.side.respondent.task, confidential: [] } },
      legal: (c.norms ?? []).map((n) => { const r = normRef(n); return { normId: r.ref, label: r.label, url: r.url, why: r.title }; }),
      balance: null, questions: [], disclaimer: c.disclaimer, visibility: 'public', shareCode: null, solutions: 0, reviewNote: null, createdAt: null, updatedAt: null,
    }));
}
