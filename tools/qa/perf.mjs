// QA: frames per second on a weak device — Chromium's software GPU (SwiftShader) and a 4× slower CPU.
// Usage: node tools/qa/perf.mjs [label]     (dev server on :3000)
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const label = process.argv[2] ?? 'now';
// GPU=soft (default): software rendering, the weakest case; GPU=real: this machine's GPU (pair with CPU=4 for an office laptop)
const b = await chromium.launch({ args: process.env.GPU === 'real' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const Q = process.env.Q ? `?quality=${process.env.Q}` : '';
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU ?? 4) });
const fps = async (ms = 6000) => p.evaluate((ms) => new Promise((res) => {
  const t = []; const start = performance.now();
  const tick = (now) => { t.push(now); if (now - start < ms) requestAnimationFrame(tick); else {
    const d = t.slice(1).map((x, i) => x - t[i]); d.sort((a, b) => a - b);
    res({ fps: Math.round((t.length - 1) / ((t.at(-1) - t[0]) / 1000)), p95: Math.round(d[Math.floor(d.length * 0.95)]), worst: Math.round(d.at(-1)) });
  } };
  requestAnimationFrame(tick);
}), ms);
await p.goto(BASE + '/' + Q);
await p.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Perf', avatar: 'man', role: 'student' })));
const out = {};
// the court (court server)
const sid = await p.evaluate(async () => { const r = await fetch('/api/v1/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'sud-ijara-davogar', mode: 'tutorial', level: 'beginner' }) }); return r.ok ? (await r.json()).snapshot.sessionId : null; });
if (sid) {
  await p.goto(`${BASE}/sud/${sid}`); await p.waitForTimeout(9000);
  await p.getByRole('button', { name: 'Majlis zaliga kirish' }).click().catch(() => {});
  await p.waitForTimeout(8000); out.court = await fps();
}
// a case room
const cid = await p.evaluate(async () => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: true, kind: 'labour', level: 'beginner' }) })).json()).case.caseId);
await p.goto(`${BASE}/ish/${cid}/consult`); await p.waitForTimeout(14000); out.room = await fps();
// the campus
await p.goto(`${BASE}/`); await p.waitForTimeout(14000); out.campus = await fps();
console.log(label, JSON.stringify(out));
await b.close();
