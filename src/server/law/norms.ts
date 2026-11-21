/**
 * The norms handed out with a «Bahs» case file: label, title and lex.uz link for the file, the
 * verbatim text on request. Everything comes from ./econ.json (built by tools/build-law.mjs from
 * legal/sources ← lex.uz); a norm that is not there is an error, never a guess.
 */
import type { NormRef, NormText } from '@/contracts/moot';
import type { CaseNorm } from '@/server/moot/cases';
import econ from './econ.json';

interface Doc { id: string; title: string; edition: string | null; retrievedAt: string; url: string; articles: { number: string; title: string | null; text: string; url: string }[] }
const DOCS = (econ as { docs: Doc[] }).docs;

const PLENUM: Record<string, string> = {
  'PLENUM-OXS-163': '163-son',
  'PLENUM-OXS-234': '234-son',
  'PLENUM-OXS-306': '306-son',
  'PLENUM-OXS-103': '103-son',
};
/** Short names for a whole document (a Plenum band has no title of its own). */
const SHORT: Record<string, string> = {
  'PLENUM-OXS-163': 'Mulkiy javobgarlik toʻgʻrisidagi qonun hujjatlarini qoʻllash',
  'PLENUM-OXS-234': 'Mulk ijarasi shartnomasiga oid normalarni qoʻllash',
  'PLENUM-OXS-306': 'Qurilish pudrati shartnomasidan kelib chiqadigan nizolar',
  'PLENUM-OXS-103': '«Shartnomaviy-huquqiy baza toʻgʻrisida»gi Qonunni qoʻllash',
};

/** How the document is named under a norm's text. */
const NAME: Record<string, string> = {
  FK: 'Fuqarolik kodeksi (1-qism)',
  FK2: 'Fuqarolik kodeksi (2-qism)',
  IPK: 'Iqtisodiy protsessual kodeks',
  SHARTNOMAVIY: '«Xoʻjalik yurituvchi subyektlar faoliyatining shartnomaviy-huquqiy bazasi toʻgʻrisida»gi Qonun (670-I)',
  'PLENUM-OXS-163': 'Oliy xoʻjalik sudi Plenumining 15.06.2007 dagi 163-son qarori',
  'PLENUM-OXS-234': 'Oliy xoʻjalik sudi Plenumining 01.12.2011 dagi 234-son qarori',
  'PLENUM-OXS-306': 'Oliy xoʻjalik sudi Plenumining 23.12.2016 dagi 306-son qarori',
  'PLENUM-OXS-103': 'Oliy xoʻjalik sudi Plenumining 04.03.2002 dagi 103-son qarori',
};

function label(doc: string, n: string): string {
  if (doc === 'FK' || doc === 'FK2') return `FK ${n}`;
  if (doc === 'IPK') return `IPK ${n}`;
  if (doc === 'SHARTNOMAVIY') return `670-I-son Qonun, ${n}`;
  return `OXS Plenumi ${PLENUM[doc]} qarori, ${n}`;
}

function find(doc: string, n: string) {
  const d = DOCS.find((x) => x.id === doc);
  const a = d?.articles.find((x) => x.number === n);
  return d && a ? { d, a } : null;
}

export function normRef(norm: CaseNorm): NormRef {
  const hit = find(norm.doc, norm.n);
  if (!hit) throw new Error(`${norm.doc} ${norm.n} is not in the verified pack`);
  return { ref: `${norm.doc}:${norm.n}`, label: label(norm.doc, norm.n), title: hit.a.title ?? SHORT[norm.doc] ?? '', url: hit.a.url };
}

/** `FK:326-modda` → the verbatim text; null when the pack has no such norm. */
export function normText(ref: string): NormText | null {
  const i = ref.indexOf(':');
  if (i < 1) return null;
  const doc = ref.slice(0, i);
  const n = ref.slice(i + 1);
  const hit = find(doc, n);
  if (!hit) return null;
  return {
    ref, label: label(doc, n), title: hit.a.title ?? SHORT[doc] ?? '', url: hit.a.url, text: hit.a.text,
    document: NAME[doc] ?? hit.d.title, edition: hit.d.edition, retrievedAt: hit.d.retrievedAt,
  };
}
