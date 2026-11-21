/**
 * «Manba boʻlmasa, modda yoʻq»: every article the practice names must exist in the verified pack
 * (src/data/sources.json ← legal/sources ← lex.uz). A citation typed from memory fails here.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIRECTION_SOURCES, SOURCE_DOCS } from './directions';

const has = (doc: string, number: string) => Boolean(SOURCE_DOCS.find((d) => d.id === doc)?.articles.some((a) => a.number === number));
const all = (doc: string) => SOURCE_DOCS.find((d) => d.id === doc)!;

describe('normative basis of each line of practice', () => {
  it('every document and article listed exists in the pack', () => {
    for (const dir of DIRECTION_SOURCES)
      for (const u of dir.uses) {
        expect(all(u.doc), `${dir.id}: ${u.doc}`).toBeTruthy();
        for (const a of u.articles) expect(has(u.doc, a), `${dir.id}: ${u.doc} ${a}`).toBe(true);
      }
  });

  it('every document links to lex.uz and states its edition and retrieval date', () => {
    for (const d of SOURCE_DOCS) {
      expect(d.url, d.id).toMatch(/^https:\/\/lex\.uz\/docs\/-\d+$/);
      expect(d.retrievedAt, d.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

/** Which code a bare «N-modda» in a file belongs to, and which markers switch it. */
const FILES: [string, string][] = [
  ['src/server/case/ishga-tiklash.ts', 'FPK'],
  ['src/server/case/claim.ts', 'FPK'],
  ['src/server/case/engine.ts', 'FPK'],
  ['src/components/case/ClaimEditor.tsx', 'FPK'],
  ['src/server/hearing/civil.ts', 'FPK'],
  ['src/server/case/ogirlik.ts', 'JPK'],
];
const MARKERS: [RegExp, string][] = [
  [/Mehnat kodeks\S*\s*$|MK\s*$|MKning\s*$|MK\s+\d+-moddasi.*$/, 'MK'],
  [/Jinoyat kodeks\S*\s*$/, 'JK'],
  [/Davlat boji[^.]*$/, 'DAVLATBOJI'],
  [/kafolatlari[^.]*$/, 'ADVKAFOLAT'],
  [/Sudlar toʻgʻrisida[^.]*$/, 'SUDLAR'],
  [/JPK\S*\s*$/, 'JPK'],
  [/FPK\S*\s*$/, 'FPK'],
  [/IPK\S*\s*$/, 'IPK'],
];

describe('citations in the scenarios', () => {
  for (const [file, base] of FILES) {
    it(`${file}: every «N-modda» is in the pack`, () => {
      const src = readFileSync(file, 'utf8');
      const bad: string[] = [];
      for (const m of src.matchAll(/(\d+[¹²³]?)-modda/g)) {
        const before = src.slice(Math.max(0, m.index! - 70), m.index);
        const tail = before.split(/[;(\n]|\. /).at(-1) ?? '';
        const code = MARKERS.find(([r]) => r.test(tail))?.[1] ?? base;
        if (!has(code, `${m[1]}-modda`)) bad.push(`${code} ${m[1]}-modda … ${before.slice(-50).replace(/\s+/g, ' ')}`);
      }
      expect(bad).toEqual([]);
    });
  }
});
