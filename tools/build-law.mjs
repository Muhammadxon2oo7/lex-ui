#!/usr/bin/env node
/**
 * Copies the articles the hearing scenarios rely on out of the verified
 * research pack (../legal/sources, extracted verbatim from lex.uz) into the
 * app. Nothing is typed by hand: if an article is missing from the pack the
 * build fails.   node tools/build-law.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pack = JSON.parse(readFileSync(join(ROOT, '..', 'legal', 'sources', 'FPK.json'), 'utf8'));
const WANT = ['208', '210', '211', '212', '213', '214', '215', '216', '217', '218', '219', '225', '226', '227', '228', '229', '243', '244', '245', '246', '247', '248', '276'];

const pick = (want) => want.map((n) => {
  const a = pack.articles.find((x) => x.number === `${n}-modda`);
  if (!a || !a.text?.trim() || !a.url) throw new Error(`FPK ${n}-modda is not in the research pack`);
  return { number: a.number, title: a.title, text: a.text, url: a.url };
});
const write = (file, articles) => {
  writeFileSync(
    join(ROOT, 'src', 'server', 'law', file),
    JSON.stringify({ id: pack.id, title: pack.title, url: pack.lexUrl, edition: pack.editionSelected, retrievedAt: pack.retrievedAt, articles }, null, 2),
  );
  console.log(`${file}: ${articles.length} articles, edition ${pack.editionSelected}, retrieved ${pack.retrievedAt}`);
};

write('fpk-hearing.json', pick(WANT));
// "Ish yo‘li": one labour case from the consultation to the judgment and the appeal deadline.
write('fpk-case.json', pick([
  '17', '21', '22', '26', '28', '33', '44', '56', '65', '67', '68', '72', '188', '189', '190', '191', '192', '193', '195', '201', '202', '203', '204', '205', '207',
  '210', '212', '213', '216', '217', '219', '225', '226', '227', '228', '229', '233', '243', '244', '247', '248', '249', '253', '264', '266', '385', '385¹', '386', '446',
]));

// "Ish yo‘li 2": a theft report followed from the duty desk to a complaint about the investigator.
const jpk = JSON.parse(readFileSync(join(ROOT, '..', 'legal', 'sources', 'JPK.json'), 'utf8'));
const JPK_WANT = ['54', '55', '64', '96', '100', '102', '106', '114', '117', '321', '322', '323', '324', '329', '331', '333', '338', '358', '375',
  // the trial (JPK 424-473)
  '424', '428', '429', '431', '436', '438', '439', '440', '441', '442', '448', '449', '450', '451', '453', '462', '463', '473'];
const jpkArticles = JPK_WANT.map((n) => {
  const a = jpk.articles.find((x) => x.number === `${n}-modda`);
  if (!a || !a.text?.trim() || !a.url) throw new Error(`JPK ${n}-modda is not in the research pack`);
  return { number: a.number, title: a.title, text: a.text, url: a.url };
});
writeFileSync(
  join(ROOT, 'src', 'server', 'law', 'jpk-case.json'),
  JSON.stringify({ id: jpk.id, title: jpk.title, url: jpk.lexUrl, edition: jpk.editionSelected, retrievedAt: jpk.retrievedAt, articles: jpkArticles }, null, 2),
);
console.log(`jpk-case.json: ${jpkArticles.length} articles, edition ${jpk.editionSelected}, retrieved ${jpk.retrievedAt}`);

// ── The registry behind /manbalar and the citation test: every document of the pack, its edition,
//    and the number, title and link of each article taken. Titles only — texts stay in the pack.
const REGISTRY = ['FPK', 'JPK', 'IPK', 'MK', 'JK', 'DAVLATBOJI', 'ADVOKATURA', 'ADVKAFOLAT', 'ORDER', 'SUDLAR', 'PROKURATURA',
  'PENSIYA', 'VMQ592', 'VMQ612', 'MUROJAAT', 'MTT', 'KORRUPSIYA', 'DFX', 'VMQ595', 'PLENUM-2018-14', 'PLENUM-2023-26',
  // contested economic cases («Bahs»): Civil Code, the contractual-basis law, Higher Economic Court Plenums
  'FK', 'FK2', 'SHARTNOMAVIY', 'PLENUM-OXS-163', 'PLENUM-OXS-234', 'PLENUM-OXS-306', 'PLENUM-OXS-103'];
const docs = REGISTRY.map((id) => {
  const p = JSON.parse(readFileSync(join(ROOT, '..', 'legal', 'sources', `${id}.json`), 'utf8'));
  if (!p.lexUrl || !p.articles?.length) throw new Error(`${id}: no url or articles in the pack`);
  return {
    id,
    title: p.title,
    kind: p.kind,
    adopted: p.adopted ?? null,
    acceptingBody: p.acceptingBody ?? null,
    actForm: p.actForm ?? null,
    registration: p.registration ?? null,
    edition: p.editionSelected ?? null,
    inForceFrom: p.inForceFrom ?? null,
    retrievedAt: p.retrievedAt,
    url: p.lexUrl,
    total: p.totalArticlesInDocument ?? null,
    articles: p.articles.map((a) => ({ number: a.number, title: a.title, url: a.url })),
  };
});
writeFileSync(join(ROOT, 'src', 'data', 'sources.json'), JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), docs }, null, 1));
console.log(`sources.json: ${docs.length} documents, ${docs.reduce((n, d) => n + d.articles.length, 0)} articles`);

// ── «Bahs» economic cases: the verbatim texts handed out with a case file (server-only; served by
//    /api/v1/law). Whole documents of the economic pack, plus the IPK articles the cases cite.
const ECON = ['FK', 'FK2', 'SHARTNOMAVIY', 'PLENUM-OXS-163', 'PLENUM-OXS-234', 'PLENUM-OXS-306', 'PLENUM-OXS-103', 'IPK'];
const ECON_IPK = new Set(['33-modda', '68-modda', '72-modda', '80-modda', '88-modda', '160-modda', '161-modda']);
const econ = ECON.map((id) => {
  const p = JSON.parse(readFileSync(join(ROOT, '..', 'legal', 'sources', `${id}.json`), 'utf8'));
  const articles = p.articles.filter((a) => a.number !== 'kirish' && (id !== 'IPK' || ECON_IPK.has(a.number)));
  if (id === 'IPK' && articles.length !== ECON_IPK.size) throw new Error('IPK: an article the cases cite is not in the pack');
  for (const a of articles) if (!a.text?.trim() || !a.url) throw new Error(`${id} ${a.number}: no text or url`);
  return { id, title: p.title, edition: p.editionSelected ?? null, retrievedAt: p.retrievedAt, url: p.lexUrl,
    articles: articles.map((a) => ({ number: a.number, title: a.title, text: a.text, url: a.url })) };
});
writeFileSync(join(ROOT, 'src', 'server', 'law', 'econ.json'), JSON.stringify({ docs: econ }, null, 1));
console.log(`econ.json: ${econ.length} documents, ${econ.reduce((n, d) => n + d.articles.length, 0)} articles`);
