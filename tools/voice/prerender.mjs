// Send the fixed lines (tools/voice/lines.json) to the court backend's pre-render queue and wait for it.
// Usage: node --env-file=.env.local tools/voice/prerender.mjs [lines.json]
// Needs LEXSIM_REMOTE_URL and LEXSIM_REMOTE_KEY (server only — never commit or print the key).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.LEXSIM_REMOTE_URL?.replace(/\/+$/, '');
const KEY = process.env.LEXSIM_REMOTE_KEY;
if (!BASE || !KEY) {
  console.error('LEXSIM_REMOTE_URL va LEXSIM_REMOTE_KEY .env.local da boʻlishi kerak');
  process.exit(1);
}
const file = process.argv[2] ?? fileURLToPath(new URL('./lines.json', import.meta.url));
const items = JSON.parse(readFileSync(file, 'utf8')).lines.map(({ text, voice }) => ({ text, voice }));
const headers = { 'X-LexSim-Key': KEY, 'Content-Type': 'application/json' };

const res = await fetch(`${BASE}/voice/prerender`, { method: 'POST', headers, body: JSON.stringify({ items }) });
const body = await res.json().catch(() => null);
if (res.status !== 202 || !body?.jobId) {
  console.error(`prerender: HTTP ${res.status}`, body);
  process.exit(1);
}
console.log(`${items.length} gap yuborildi, job ${body.jobId}`);
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const s = await (await fetch(`${BASE}/voice/prerender/${body.jobId}`, { headers })).json().catch(() => null);
  if (!s) continue;
  process.stdout.write(`\r${s.done}/${s.total}  xato: ${s.failed?.length ?? 0}   `);
  if (s.finished) {
    console.log();
    if (s.failed?.length) console.log('Render boʻlmaganlar:', s.failed);
    break;
  }
}
