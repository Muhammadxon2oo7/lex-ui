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
const JPK_WANT = ['54', '55', '64', '96', '100', '106', '114', '117', '321', '322', '323', '324', '329', '331', '333', '338', '358', '375'];
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
