/**
 * Case files for the moot court. A case is what both sides study before the hearing: the facts
 * everyone knows, each side's own task and confidential facts, and the evidence in the file.
 * There are no scripted answers - people argue it.
 *
 * Facts come from the court server's published scenario (ijara, both briefings). Nothing is
 * invented here: no sums, dates or articles beyond what that scenario states. New cases are
 * written and signed off by a lawyer (see docs/BACKEND_TASKS.md) - never made up in code.
 */
import type { LibCase } from '@/contracts/library';
import type { MootSide } from '@/contracts/moot';

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
  },
};

export const DEFAULT_CASE = 'ijara';

/**
 * A case approved on the court server (GET /moot/cases/{id}) as a room's case file. Its own `points`
 * are used when it has them; otherwise the reference scorer looks for the titles of its facts and
 * evidence (one word stem each). Nothing is added to the case.
 */
export function fromLibrary(c: LibCase): MootCase {
  const stems = (items: { title: string }[]) => items.map((i) => (i.title.split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? '').toLowerCase().slice(0, 6)).filter((w) => w.length >= 4).map((w) => [w]);
  const points = c.points?.claimant?.length && c.points?.respondent?.length ? { claimant: c.points.claimant, respondent: c.points.respondent } : { claimant: stems([...c.facts, ...c.evidence]), respondent: stems([...c.facts, ...c.evidence]) };
  return {
    id: c.id, title: c.title, court: c.court || 'Oʻquv sudi', summary: c.summary, parties: c.parties, claim: c.claim,
    facts: c.facts, evidence: c.evidence, side: c.side, points, disclaimer: c.disclaimer,
  };
}
