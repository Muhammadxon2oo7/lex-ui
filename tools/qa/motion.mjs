// QA: courtroom choreography frame by frame (rising, the judge walking in, the witness walking down the aisle, the judge leaving).
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
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const group = page.getByRole('group', { name: 'Javoblar' });
const btn = (re) => page.getByRole('button', { name: re });
const wait = async (loc, ms = 40000) => loc.first().waitFor({ timeout: ms });
const look = async (dx) => { await page.mouse.move(700, 300); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(700 + (dx * i) / 8, 300); await page.mouse.up(); };

await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
const id = await page.evaluate(async () => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"fresh":true}' })).json()).case.caseId);
await page.goto(`${BASE}/ish/${id}/hearing`);
await page.waitForTimeout(9000);
await shot('m1-hall-rises-before-you');
await wait(btn(/Oʻrnidan turish/)); await btn(/Oʻrnidan turish/).click();
await page.waitForTimeout(900); await shot('m2-judge-door');
await page.waitForTimeout(1600); await shot('m3-judge-walking');
await page.waitForTimeout(2200); await shot('m4-judge-at-bench');
await wait(btn(/Oʻtirish/)); await page.waitForTimeout(800); await shot('m5-hall-sits');
await btn(/Oʻtirish/).click();
for (const re of [/arizamiz yoʻq/, /kasallik varaqasi bor va/]) {
  await wait(group); await btn(/Oʻrnidan turish/).click(); await page.waitForTimeout(400);
  await group.getByRole('button', { name: re }).click();
}
await page.waitForTimeout(5500); await shot('m6-respondent-speaks');
await page.waitForTimeout(3500); await look(-260); await page.waitForTimeout(1500); await shot('m7-witness-walking');
await page.waitForTimeout(4000); await shot('m8-witness-arriving');
await look(260);
await wait(group); await page.waitForTimeout(500); await shot('m9-witness-at-lectern');
await btn(/Oʻrnidan turish/).click(); await page.waitForTimeout(400);
await group.getByRole('button', { name: /aytib bering/ }).click();
await wait(group); await btn(/Oʻrnidan turish/).click(); await page.waitForTimeout(400);
await group.getByRole('button', { name: /ishga tiklashingizni/ }).click();
await wait(btn(/Oʻrnidan turish/)); await btn(/Oʻrnidan turish/).click();
await page.waitForTimeout(2500); await shot('m10-judge-leaving');
console.log(logs.join('\n') || 'no console errors');
await browser.close();
