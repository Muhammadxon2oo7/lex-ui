// QA: speech-to-text timing, 20 clips — straight to the court server and through our own server,
// with the court server's own stage timings (convert / upload / model / total).
// Usage: node tools/qa/stt-timing.mjs <dir with w1.wav … w20.wav>
import { readFileSync, readdirSync } from 'node:fs';
const dir = process.argv[2];
const REMOTE = process.env.REMOTE ?? 'https://lex-api.e-investment.uz/api/v1';
const LOCAL = (process.env.BASE ?? 'http://localhost:3000') + '/api/v1';
const files = readdirSync(dir).filter((f) => /^w\d+\.wav$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
const session = async (base) => {
  const r = await fetch(base + '/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'sud-ijara-davogar', mode: 'tutorial', level: 'beginner' }) });
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
};
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const rows = [];
const rc = await session(REMOTE);
const lc = await session(LOCAL);
for (const f of files) {
  const wav = readFileSync(`${dir}/${f}`);
  const secs = (wav.length - 44) / 32000;
  let t = Date.now();
  const d = await (await fetch(REMOTE + '/voice/stt', { method: 'POST', headers: { 'Content-Type': 'audio/wav', Cookie: rc }, body: wav })).json();
  const direct = Date.now() - t;
  t = Date.now();
  const l = await (await fetch(LOCAL + '/voice/stt', { method: 'POST', headers: { 'Content-Type': 'audio/wav', Cookie: lc }, body: wav })).json();
  const ours = Date.now() - t;
  rows.push({ f, secs: secs.toFixed(1), direct, ours, ...d.timings, engine: d.engine, conf: d.confidence, low: d.lowConfidence, text: (d.text ?? '').slice(0, 40), oursConf: l.confidence });
}
console.table(rows.map(({ f, secs, direct, ours, convert, upload, model, total, engine, conf, low }) => ({ f, secs, direct, ours, convert, upload, model, total, engine, conf, low })));
for (const k of ['direct', 'ours', 'total', 'model', 'upload']) {
  const v = rows.map((r) => r[k]).filter((x) => typeof x === 'number');
  if (v.length) console.log(`${k.padEnd(7)} p50 ${pct(v, 0.5)} ms   p95 ${pct(v, 0.95)} ms`);
}
