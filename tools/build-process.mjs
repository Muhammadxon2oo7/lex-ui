#!/usr/bin/env node
/**
 * Builds the procedure map shown in the app (public/data/process-map.json)
 * from the verified research pack in ../legal/sources (verbatim lex.uz).
 *
 *   node tools/build-process.mjs
 *
 * Sources, in order of preference:
 *   - legal/sources/process-map.json  (full life of a case, per code)
 *   - legal/sources/hearing-order.json (hearing stages only) as a fallback
 * plus the administrative track (state body → appeal) defined below from
 * the MTT and MUROJAAT laws. Every referenced article must exist in the
 * pack, otherwise the build fails — nothing is typed by hand.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = join(ROOT, '..', 'legal', 'sources');
const read = (f) => JSON.parse(readFileSync(join(PACK, f), 'utf8'));

const docs = {};
const doc = (id) => (docs[id] ??= read(`${id}.json`));
const used = new Map(); // "ID:number" → article

function ref(src, number) {
  const n = /modda$/.test(number) ? number : `${number}-modda`;
  const a = doc(src).articles.find((x) => x.number === n || x.number === number);
  if (!a || !a.text?.trim()) throw new Error(`${src} ${number}: not in the verified pack`);
  const key = `${src}:${a.number}`;
  used.set(key, { key, source: src, number: a.number, title: a.title, text: a.text, url: a.url });
  return key;
}

/* ── track 0: a state body (one-stop shop / DXM) — administrative procedure ── */
const ADMIN = {
  id: 'ADMIN',
  short: 'Davlat organi',
  title: 'Davlat organida: ariza, murojaat va ma’muriy tartib-taomil',
  sources: ['MTT', 'MUROJAAT'],
  phases: [
    { id: 'filing', label: 'Ariza va murojaat berish', stages: [
      { id: 'grounds', label: 'Ma’muriy ish yuritishni boshlash', actor: 'Fuqaro / tashkilot', output: 'Ariza', articles: [['MTT', '41'], ['MUROJAAT', '5']] },
      { id: 'form', label: 'Ariza va murojaatga qo‘yiladigan talablar', actor: 'Fuqaro', output: 'To‘g‘ri rasmiylashtirilgan ariza', articles: [['MTT', '42'], ['MUROJAAT', '6'], ['MUROJAAT', '21']] },
      { id: 'register', label: 'Arizani ro‘yxatdan o‘tkazish', actor: 'Ma’muriy organ', output: 'Ro‘yxat raqami', articles: [['MTT', '43'], ['MUROJAAT', '23']] },
      { id: 'fix', label: 'Kamchiliklarni bartaraf etish, taalluqlilik bo‘yicha yuborish', actor: 'Ma’muriy organ / arizachi', output: 'Tuzatilgan ariza yoki boshqa organga yuborish', articles: [['MTT', '45'], ['MTT', '46']] },
    ] },
    { id: 'consideration', label: 'Ko‘rib chiqish', stages: [
      { id: 'procedure', label: 'Murojaatni ko‘rib chiqish tartibi', actor: 'Ma’muriy organ', output: '—', articles: [['MUROJAAT', '24'], ['MUROJAAT', '18']] },
      { id: 'hear', label: 'Arizachini eshitish', actor: 'Mansabdor shaxs', output: 'Tushuntirishlar', articles: [['MUROJAAT', '26'], ['MTT', '9']] },
      { id: 'terms', label: 'Ko‘rib chiqish muddatlari', actor: 'Ma’muriy organ', output: '—', articles: [['MUROJAAT', '28'], ['MTT', '36']] },
    ] },
    { id: 'decision', label: 'Qaror', stages: [
      { id: 'act', label: 'Ma’muriy hujjat: shakli, mazmuni, asosliligi', actor: 'Ma’muriy organ', output: 'Ma’muriy hujjat', articles: [['MTT', '52'], ['MTT', '53'], ['MTT', '54']] },
      { id: 'answer', label: 'Murojaatga javob', actor: 'Ma’muriy organ', output: 'Yozma javob', articles: [['MUROJAAT', '27'], ['MUROJAAT', '31']] },
      { id: 'issue', label: 'Hujjatni berish', actor: 'Ma’muriy organ', output: 'Hujjat / dublikat', articles: [['MTT', '57']] },
    ] },
    { id: 'appeal', label: 'Shikoyat', stages: [
      { id: 'admin-appeal', label: 'Ma’muriy shikoyat', actor: 'Manfaatdor shaxs', output: 'Shikoyat', articles: [['MTT', '62'], ['MTT', '63'], ['MTT', '64']] },
    ] },
  ],
};

const CODES = [
  ['FPK', 'Fuqarolik ishi', 'FPK'],
  ['IPK', 'Iqtisodiy ish', 'IPK'],
  ['MSIYK', 'Ma’muriy sud ishi', 'MSIYK'],
  ['JPK', 'Jinoyat ishi', 'JPK'],
  ['MJtK', 'Ma’muriy huquqbuzarlik', 'MJtK'],
];

/** Simulations that let the student practise a phase. */
const PRACTICE = {
  'ADMIN:filing': 'dxm', 'ADMIN:consideration': 'dxm', 'ADMIN:decision': 'dxm',
  // the single case ("Ish yo‘li") walks the civil track from the claim to the judgment
  'FPK:filing': 'case', 'FPK:preparation': 'case', 'FPK:hearing': 'case', 'FPK:decision': 'case', 'FPK:trial': 'case',
};

const map = existsSync(join(PACK, 'process-map.json')) ? read('process-map.json') : null;
const hearing = read('hearing-order.json');

const tracks = [];
const finish = (t) => {
  for (const ph of t.phases) {
    ph.practice = PRACTICE[`${t.id}:${ph.id}`] ?? null;
    for (const st of ph.stages) st.articles = st.articles.map((a) => (Array.isArray(a) ? ref(a[0], a[1]) : ref(t.id, a)));
  }
  return t;
};

tracks.push(finish(structuredClone(ADMIN)));
for (const [id, short] of CODES) {
  const d = doc(id);
  const base = { id, short, title: d.title, lexUrl: d.lexUrl, edition: d.editionSelected ?? null, sources: [id] };
  if (map?.[id]?.phases?.length) {
    tracks.push(finish({ ...base, phases: structuredClone(map[id].phases) }));
  } else {
    // fallback: only the hearing is mapped
    tracks.push(finish({
      ...base,
      partial: true,
      phases: [{ id: 'hearing', label: 'Sud majlisi', stages: hearing[id].map((s) => ({ id: s.stage, label: s.label, actor: 'Sud', output: '—', articles: s.articles })) }],
    }));
  }
}

const sources = {};
for (const t of tracks) for (const s of t.sources) {
  const d = doc(s);
  sources[s] = { id: s, title: d.title, lexUrl: d.lexUrl, edition: d.editionSelected ?? null, retrievedAt: d.retrievedAt };
}

const out = { builtAt: new Date().toISOString(), complete: Boolean(map), tracks, sources, articles: Object.fromEntries(used) };
writeFileSync(join(ROOT, 'public', 'data', 'process-map.json'), JSON.stringify(out));
console.log(`process map: ${tracks.length} tracks, ${used.size} articles, full pack: ${Boolean(map)}`);
for (const t of tracks) console.log(`  ${t.id.padEnd(6)} ${t.phases.length} phases, ${t.phases.reduce((n, p) => n + p.stages.length, 0)} stages${t.partial ? ' (hearing only)' : ''}`);
