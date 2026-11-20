// QA: levels in "Ish yoʻli" — advanced (own words only, no hints), intermediate (options hidden until opened, −10).
// Usage: node tools/qa/levels.mjs [outDir]
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
const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const own = page.getByLabel('Oʻz soʻzingiz bilan javob');
const until = async (loc) => { for (let i = 0; i < 60 && !(await loc.count()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(250); } await loc.first().waitFor({ timeout: 15000 }); };
const fail = (m) => { throw new Error(m); };

await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'QA', avatar: 'woman', role: 'student' })));
const start = (level) => page.evaluate(async (level) => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: true, kind: 'labour', level }) })).json()).case.caseId, level);

// advanced: the judge's question, answered in own words
let id = await start('advanced');
await page.goto(`${BASE}/ish/${id}/chamber`);
await page.waitForTimeout(5000);
await until(own);
if (await page.getByRole('group', { name: 'Javoblar' }).count()) fail('advanced shows options');
if (await page.getByRole('button', { name: /Maslahat/ }).count()) fail('advanced shows the hint button');
await shot('l1-advanced');
await own.fill('Hurmatli sud, daʼvogar 9–10-oktabr kunlari kasal boʻlgan, uzrsiz kelmagan deb boʻshatilgan. Ishga tiklashni soʻraymiz.');
await own.press('Enter');
await page.waitForTimeout(1500);
const said = await page.evaluate(async (id) => (await (await fetch(`/api/v1/cases/${id}`)).json()).case.lines.filter((l) => l.speaker === 'you').length, id);
if (said < 1) fail('own words were not understood');
await shot('l2-advanced-answered');
console.log('advanced: own words understood, no options, no hints ✓');

// intermediate: options hidden, then opened for −10
id = await start('intermediate');
await page.goto(`${BASE}/ish/${id}/chamber`);
await page.waitForTimeout(5000);
await until(own);
if (await page.getByRole('group', { name: 'Javoblar' }).count()) fail('intermediate shows options before opening');
await page.getByRole('button', { name: /Variantlar/ }).click();
await page.getByRole('group', { name: 'Javoblar' }).waitFor({ timeout: 10000 });
await shot('l3-intermediate-revealed');
console.log('intermediate: options opened on demand ✓');

console.log(logs.join('\n') || 'no console errors');
await browser.close();
