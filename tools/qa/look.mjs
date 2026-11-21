// QA: clean 3D frames (HUD hidden) of the court and two case rooms at a chosen tier — for judging the picture itself.
// Usage: node tools/qa/look.mjs <outDir> [tier=high]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'qa-shots/look';
const tier = process.argv[3] ?? 'high';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
const q = `?quality=${tier}`;
await p.goto('http://localhost:3000/' + q);
await p.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Madina', avatar: 'woman', role: 'student' })));
const bare = () => p.addStyleTag({ content: 'main > *:not(:first-child), header, section, aside, nextjs-portal { visibility: hidden !important }' });
const sid = await p.evaluate(async () => { const r = await fetch('/api/v1/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'sud-ijara-davogar', mode: 'tutorial', level: 'beginner' }) }); return r.ok ? (await r.json()).snapshot.sessionId : null; });
if (sid) {
  await p.evaluate(async (sid) => { for (const a of ['start', 'sit-at-desk']) await fetch(`/api/v1/sessions/${sid}/interactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientActionId: crypto.randomUUID(), action: a }) }); }, sid);
  await p.goto(`http://localhost:3000/sud/${sid}${q}`); await p.waitForTimeout(14000);
  for (let i = 0; i < 14; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(250); }
  await p.waitForTimeout(2500); await bare(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/court.png` });
}
const cid = await p.evaluate(async () => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: true, kind: 'labour', level: 'beginner' }) })).json()).case.caseId);
for (const st of ['consult', 'chamber']) { await p.goto(`http://localhost:3000/ish/${cid}/${st}${q}`); await p.waitForTimeout(12000); await bare(); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/room-${st}.png` }); }
console.log('tier at the end:', await p.evaluate(() => document.documentElement.dataset.quality));
await b.close();
