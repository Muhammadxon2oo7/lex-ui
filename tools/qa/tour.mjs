// QA: a visual tour of every surface at desktop and phone sizes (for design review).
// Usage: node tools/qa/tour.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'qa-shots';
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const logs = [];
const SIZES = { d: { width: 1440, height: 900 }, m: { width: 390, height: 844 } };

for (const [tag, viewport] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: tag === 'm' ? 2 : 1, hasTouch: tag === 'm', isMobile: tag === 'm' });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && logs.push(`[${tag} error] ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => logs.push(`[${tag} pageerror] ${e.message.slice(0, 200)}`));
  const shot = async (name, wait = 2500) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${tag}-${name}.png` }); console.log('shot', tag, name); };

  await page.goto(`${BASE}/`);
  await shot('home-first');
  await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Madina Rahimova', avatar: 'woman', role: 'student' })));
  await page.goto(`${BASE}/`);
  await shot('home', 6000);
  await page.goto(`${BASE}/hub`);
  await shot('hub', 3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('hub-bottom', 800);
  await page.goto(`${BASE}/protsess`);
  await shot('protsess', 4000);
  await page.goto(`${BASE}/tools`);
  await shot('tools', 3000);
  const id = await page.evaluate(async () => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: true, kind: 'labour', level: 'beginner' }) })).json()).case.caseId);
  for (const stage of ['consult', 'draft', 'hearing']) {
    await page.goto(`${BASE}/ish/${id}/${stage}`);
    await shot(`ish-${stage}`, 7000);
  }
  // the economic court (court server): only when it answers
  const sid = await page.evaluate(async () => {
    const r = await fetch('/api/v1/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'sud-ijara-davogar', mode: 'tutorial', level: 'beginner' }) });
    return r.ok ? (await r.json()).snapshot.sessionId : null;
  });
  if (sid) {
    await page.goto(`${BASE}/sud/${sid}`);
    await shot('sud-briefing', 6000);
  }
  await ctx.close();
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
