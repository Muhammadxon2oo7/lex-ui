// QA: every drawer and sheet in a room closes on a click beside it. Usage: node tools/qa/dismiss.mjs [outDir]
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
let failed = 0;
const check = async (name, open, locator) => {
  await open();
  await locator.waitFor({ timeout: 8000 });
  await page.waitForTimeout(500);
  await page.mouse.click(160, 420); // the room, left of any drawer
  await page.waitForTimeout(700);
  const gone = (await locator.count()) === 0;
  if (!gone) failed++;
  console.log(gone ? '✓' : '✗', name);
};

await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
const id = await page.evaluate(async () => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"fresh":true}' })).json()).case.caseId);
await page.goto(`${BASE}/ish/${id}/hearing`);
await page.waitForTimeout(6000);

await check('Ish papkasi (drawer)', () => page.getByRole('button', { name: /Ish papkasi/ }).click(), page.getByRole('complementary', { name: 'Ish papkasi' }));
await check('Kodeks (drawer)', () => page.getByRole('button', { name: /Kodeks/ }).click(), page.getByRole('complementary', { name: /protsessual kodeksi/ }));

console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close();
process.exit(failed ? 1 : 0);
