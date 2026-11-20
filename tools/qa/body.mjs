// QA: your own body — look down in each room (and stand up in court). Usage: node tools/qa/body.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'qa-shots';
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
page.on('console', (m) => m.type() === 'error' && logs.push(`[error] ${m.text().slice(0, 200)}`));
const look = async (dx, dy) => { await page.mouse.move(500, 300); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(500 + (dx * i) / 10, 300 + (dy * i) / 10); await page.mouse.up(); await page.waitForTimeout(1200); };
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
const fresh = (kind) => page.evaluate(async (kind) => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: true, kind }) })).json()).case.caseId, kind);
for (const [kind, stage] of [['labour', 'consult'], ['labour', 'filing'], ['labour', 'chamber'], ['labour', 'hearing']]) {
  const id = await fresh(kind);
  await page.goto(`${BASE}/ish/${id}/${stage}`);
  await page.waitForTimeout(8000);
  await look(0, 380);
  await page.screenshot({ path: `${OUT}/me-${stage}.png` });
  if (stage === 'hearing' || stage === 'filing') {
    await look(-330, 0);
    await page.screenshot({ path: `${OUT}/me-${stage}-side.png` });
  }
  if (stage === 'hearing') {
    await page.getByRole('button', { name: /Oʻrnidan turish/ }).click();
    await page.waitForTimeout(2500);
    await look(330, 380);
    await page.screenshot({ path: `${OUT}/me-hearing-standing.png` });
    await look(-330, 0);
    await page.screenshot({ path: `${OUT}/me-hearing-standing-side.png` });
  }
  console.log('shot', stage);
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
