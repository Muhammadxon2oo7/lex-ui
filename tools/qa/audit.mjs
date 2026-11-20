// QA: look around every case room (left / centre / right / down) for layout problems. Usage: node tools/qa/audit.mjs [outDir] [stages]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'qa-shots';
const STAGES = (process.argv[3] ?? 'consult,draft,filing,chamber,hearing').split(',');
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
page.on('console', (m) => m.type() === 'error' && logs.push(`[error] ${m.text().slice(0, 200)}`));
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
const drag = async (dx, dy = 0) => {
  await page.mouse.move(720, 300); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(720 + (dx * i) / 10, 300 + (dy * i) / 10);
  await page.mouse.up(); await page.waitForTimeout(1200);
};
for (const stage of STAGES) {
  const kind = ['report', 'interview', 'complaint'].includes(stage) ? 'theft' : 'labour';
  const id = await page.evaluate(async (kind) => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: true, kind }) })).json()).case.caseId, kind);
  await page.goto(`${BASE}/ish/${id}/${stage}`);
  await page.waitForTimeout(8000);
  if (stage === 'draft') { await page.screenshot({ path: `${OUT}/${stage}-editor.png` }); console.log('shot', stage); continue; }
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${stage}-a-centre.png` });
  await drag(330); await page.screenshot({ path: `${OUT}/${stage}-b-left.png` });
  await drag(-660); await page.screenshot({ path: `${OUT}/${stage}-c-right.png` });
  await drag(330, -120); await page.screenshot({ path: `${OUT}/${stage}-d-down.png` });
  console.log('shot', stage);
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
