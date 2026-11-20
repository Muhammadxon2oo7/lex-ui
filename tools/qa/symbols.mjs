// QA: the State symbols in every room that shows them (hearing, judge's chamber). Usage: node tools/qa/symbols.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'qa-shots';
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on('console', (m) => m.type() === 'error' && logs.push(`[error] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
const shot = async (name) => { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
/** Turn the seat camera by dragging on the 3D view. */
const look = async (dx, dy = 0) => {
  const c = await page.locator('canvas').first().boundingBox();
  const x = c.x + c.width * 0.35, y = c.y + c.height * 0.5;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x + (dx * i) / 12, y + (dy * i) / 12);
  await page.mouse.up(); await page.waitForTimeout(900);
};

await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
const id = await page.evaluate(async () => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"fresh":true}' })).json()).case.caseId);

await page.goto(`${BASE}/ish/${id}/hearing`);
await page.waitForTimeout(7000);
await shot('s1-hearing');
await look(-260, -40);
await shot('s2-hearing-bench');
await look(-120, -60);
await shot('s3-hearing-emblem');

await page.goto(`${BASE}/ish/${id}/chamber`);
await page.waitForTimeout(7000);
await shot('s4-chamber');
await look(0, -80);
await shot('s5-chamber-emblem');

console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close();
