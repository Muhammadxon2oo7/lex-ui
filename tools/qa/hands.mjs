// QA: papers on the desk — appear when handed over, can be dragged and taken in hand. Usage: node tools/qa/hands.mjs [outDir] [phase] [x y]
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
const group = page.getByRole('group', { name: 'Javoblar' });
const until = async (loc = group) => { for (let i = 0; i < 40 && !(await loc.count()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(250); } await loc.first().waitFor({ timeout: 15000 }); };
const say = async (re) => { await until(); await group.getByRole('button', { name: re }).click(); await page.waitForTimeout(300); };
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
const id = await page.evaluate(async () => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"fresh":true}' })).json()).case.caseId);
await page.goto(`${BASE}/ish/${id}/consult`);
await page.waitForTimeout(6000);
for (const re of [/boshidan aytib/, /qanday hujjatlar/]) await say(re);
await until();
// look down at the desk
await page.mouse.move(400, 250); await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(400, 250 + 15 * i);
await page.mouse.up(); await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/h1-desk.png` });
const [x, y] = [Number(process.argv[3] ?? 0), Number(process.argv[4] ?? 0)];
if (x) {
  await page.mouse.move(x, y); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/h2-hover.png` });
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x - 18 * i, y - 8 * i);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/h3-dragging.png` });
  await page.mouse.up(); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/h4-dropped.png` });
  await page.mouse.click(x - 216, y - 96); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/h5-in-hand.png` });
  await page.keyboard.press('KeyF'); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/h6-flipped.png` });
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
