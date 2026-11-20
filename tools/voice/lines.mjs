// Every fixed spoken line of the "Ish yoʻli" cases, with the voice that says it —
// for the court backend's `/voice/prerender` (cached TTS, no wait in the room).
// Usage: node tools/voice/lines.mjs [out.json]   (default: tools/voice/lines.json)
// Lines that depend on the case so far (functions of the case view) are taken in
// every combination the books can produce: facts known / not known, strong / weak.
import { createJiti } from 'jiti';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { '@': `${root}src` } });
const books = [(await jiti.import(`${root}src/server/case/ishga-tiklash.ts`)).BOOK, (await jiti.import(`${root}src/server/case/ogirlik.ts`)).BOOK];
const OUT = process.argv[2] ?? `${root}tools/voice/lines.json`;

// the views a line can be spoken in (knows everything / nothing; each strength; with / without a draft)
const draft = { demand: 'reinstate', attachments: ['order', 'contract', 'sickleave', 'warrant', 'receipt'] };
const views = [true, false].flatMap((k) => [0, 1, 2, 3].flatMap((strength) => [draft, null].map((d) => ({ knows: () => k, strength, draft: d }))));
const linesOf = (src) => (typeof src === 'function' ? views.flatMap((v) => { try { return src(v) ?? []; } catch { return []; } }) : src ?? []);

const seen = new Map();
for (const book of books) {
  const voice = Object.fromEntries(book.CASE.parties.filter((p) => p.voice).map((p) => [p.role, p.voice]));
  for (const stage of book.STAGES)
    for (const node of stage.nodes)
      for (const [speaker, text] of [...linesOf(node.enter), ...(node.options ?? []).flatMap((o) => linesOf(o.reply))]) {
        if (!voice[speaker] || !text?.trim()) continue; // the student and system notes are not voiced
        const key = `${voice[speaker]}|${text}`;
        if (!seen.has(key)) seen.set(key, { voice: voice[speaker], text, speaker, case: book.kind, stage: stage.id });
      }
}
const lines = [...seen.values()];
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), count: lines.length, lines }, null, 2) + '\n');
const by = lines.reduce((m, l) => ((m[l.voice] = (m[l.voice] ?? 0) + 1), m), {});
console.log(`${lines.length} lines → ${OUT}`, by);
