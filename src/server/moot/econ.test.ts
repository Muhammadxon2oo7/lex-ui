/**
 * The contested economic cases: «Manba boʻlmasa, modda yoʻq» - every norm handed out and every
 * «N-modda» / Plenum «N-band» written in the text is in the verified pack (econ.json ← legal/sources ←
 * lex.uz); each case is playable by both sides; what the real courts decided stays hidden until the verdict.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MootCatalogItemSchema, MootRoomSchema } from '@/contracts/moot';
import { normRef, normText } from '@/server/law/norms';
import { MOOT_CASES, mootCatalog } from './cases';
import { ECON_CASES } from './econ';
import { __expire, actRoom, createRoom, joinRoom, readRoom } from './engine';

const SRC = readFileSync('src/server/moot/econ.ts', 'utf8');
const has = (doc: string, n: string) => normText(`${doc}:${n}`) !== null;

describe('economic cases: sources', () => {
  it('every norm handed out with a file is in the pack', () => {
    for (const c of Object.values(MOOT_CASES)) for (const n of c.norms ?? []) expect(() => normRef(n), `${c.id}: ${n.doc} ${n.n}`).not.toThrow();
  });

  it('every «N-modda» in the text is in the pack (FK by default; IPK and 670-I-son Qonun when named)', () => {
    const bad: string[] = [];
    for (const m of SRC.matchAll(/(\d+[¹²³]?)-modda/g)) {
      const before = SRC.slice(Math.max(0, m.index - 40), m.index);
      const n = `${m[1]}-modda`;
      if (before.endsWith("n: '")) continue; // a structured norm - checked above
      const ok = /IPK[\s\d,-]*$|IPK \d+, $/.test(before) || /IPK\s+(\d+,\s*)*$/.test(before) ? has('IPK', n)
        : /670-I-son Qonun\s*$/.test(before) ? has('SHARTNOMAVIY', n)
        : has('FK', n) || has('FK2', n);
      if (!ok) bad.push(`${n} … ${before.replace(/\s+/g, ' ')}`);
    }
    // «IPK 68, 88-moddalar» and «FK 260, 261-moddalar»: each number of a list
    for (const m of SRC.matchAll(/(IPK|FK) ((?:\d+, )+\d+)-moddalar/g)) for (const n of m[2].split(', ')) if (!(m[1] === 'IPK' ? has('IPK', `${n}-modda`) : has('FK', `${n}-modda`) || has('FK2', `${n}-modda`))) bad.push(`${m[1]} ${n}-modda`);
    expect(bad).toEqual([]);
  });

  it('every Plenum band named in the text («163-son qarori, 4-band») is in the pack', () => {
    const bad: string[] = [];
    for (const m of SRC.matchAll(/(\d{3})-son qarori,? (\d+[¹²]?)-band/g)) if (!has(`PLENUM-OXS-${m[1]}`, `${m[2]}-band`)) bad.push(m[0]);
    expect(bad).toEqual([]);
  });

  it('short dashes and the Uzbek apostrophes only', () => {
    expect(SRC).not.toMatch(/[—–‘’]/);
  });
});

describe('economic cases: playable', () => {
  it('each case is complete for both sides and for the debrief', () => {
    for (const c of Object.values(ECON_CASES)) {
      expect(c.facts.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.evidence.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.timeline?.length, c.id).toBeGreaterThanOrEqual(3);
      for (const s of ['claimant', 'respondent'] as const) {
        expect(c.side[s].task.length, `${c.id} ${s}`).toBeGreaterThanOrEqual(2);
        expect(c.side[s].confidential.length, `${c.id} ${s}`).toBeGreaterThanOrEqual(2);
        expect(c.points[s].length, `${c.id} ${s}`).toBeGreaterThanOrEqual(6);
      }
      expect(c.norms?.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.basis?.url, c.id).toMatch(/^https:\/\//);
      expect(c.outcome?.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.lessons?.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.skills?.length, c.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('the catalogue carries no confidential facts', () => {
    const list = mootCatalog();
    expect(list.length).toBe(Object.keys(MOOT_CASES).length);
    for (const item of list) expect(MootCatalogItemSchema.safeParse(item).success).toBe(true);
    const text = JSON.stringify(list);
    for (const c of Object.values(MOOT_CASES)) for (const t of [...c.side.claimant.confidential, ...c.side.respondent.confidential]) expect(text).not.toContain(t);
  });

  it('a room on an economic case: norms in the file, the real outcome only after the verdict', async () => {
    const A = 'owner-econ-a-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const B = 'owner-econ-b-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const file = MOOT_CASES['kafillik-muddati'];
    const code = createRoom(A, { name: 'Aziza', avatar: 'woman', size: 1, assign: 'random' }, file).code;
    joinRoom(B, code, { name: 'Bobur', avatar: 'man' });
    actRoom(B, code, { type: 'ready', ready: true });
    let r = actRoom(A, code, { type: 'start' });
    expect(MootRoomSchema.safeParse(r).success).toBe(true);
    expect(r.case.norms.map((n) => n.ref)).toContain('FK:298-modda');
    expect(r.case.timeline.length).toBeGreaterThan(3);
    expect(r.case.debrief).toBeNull();
    expect(JSON.stringify(r)).not.toContain(file.outcome![0]);
    actRoom(A, code, { type: 'ready', ready: true });
    actRoom(B, code, { type: 'ready', ready: true });
    for (let i = 0; i < 40 && r.phase !== 'verdict'; i++) {
      __expire(code);
      await new Promise((ok) => setTimeout(ok, 20));
      r = await readRoom(A, code, null, 0);
    }
    expect(r.phase).toBe('verdict');
    expect(r.case.debrief?.outcome).toEqual(file.outcome);
    expect(r.case.debrief?.url).toBe(file.basis!.url);
  });
});

describe('economic cases: the sources page', () => {
  it('the «bahs» line on /manbalar lists exactly the norms the cases hand out', async () => {
    const { DIRECTION_SOURCES } = await import('@/data/directions');
    const listed = new Set(DIRECTION_SOURCES.find((d) => d.id === 'bahs')!.uses.flatMap((u) => u.articles.map((a) => `${u.doc}:${a}`)));
    for (const c of Object.values(MOOT_CASES)) for (const n of c.norms ?? []) expect(listed.has(`${n.doc}:${n.n}`), `${c.id}: ${n.doc} ${n.n}`).toBe(true);
  });
});

describe('economic cases in «Sohalar»', () => {
  it('every built-in case belongs to a domain, and its card hides confidential facts and the outcome', async () => {
    const { CASE_DOMAIN, builtinLibCases } = await import('./cases');
    const { LibCaseSchema } = await import('@/contracts/library');
    for (const id of Object.keys(MOOT_CASES)) expect(CASE_DOMAIN[id], id).toBeTruthy();
    const all = [...new Set(Object.values(CASE_DOMAIN))].flatMap((d) => builtinLibCases(d));
    expect(all.length).toBe(Object.keys(MOOT_CASES).length);
    for (const c of all) expect(LibCaseSchema.safeParse(c).success, c.id).toBe(true);
    const text = JSON.stringify(all);
    for (const c of Object.values(MOOT_CASES)) {
      for (const t of [...c.side.claimant.confidential, ...c.side.respondent.confidential]) expect(text).not.toContain(t);
      for (const t of c.outcome ?? []) expect(text).not.toContain(t);
    }
  });
});
