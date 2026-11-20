// The API contracts (Zod, src/contracts) as JSON Schema, for the court backend team.
// Usage: node tools/contracts/export.mjs [out.json]   (default: docs/contracts.schema.json)
import { createJiti } from 'jiti';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = fileURLToPath(new URL('../../', import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { '@': `${root}src` } });
const OUT = process.argv[2] ?? `${root}docs/contracts.schema.json`;

const defs = {};
const skipped = [];
for (const file of ['index.ts', 'case.ts']) {
  const mod = await jiti.import(`${root}src/contracts/${file}`);
  for (const [name, schema] of Object.entries(mod)) {
    if (!name.endsWith('Schema') || !(schema instanceof z.ZodType)) continue;
    try {
      defs[name.replace(/Schema$/, '')] = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' });
    } catch (e) {
      skipped.push(`${name}: ${e.message}`);
    }
  }
}
const doc = { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'LexSim API contracts', generated: new Date().toISOString(), $defs: defs };
writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
console.log(`${Object.keys(defs).length} schemas → ${OUT}`);
if (skipped.length) console.log('skipped:\n' + skipped.join('\n'));
