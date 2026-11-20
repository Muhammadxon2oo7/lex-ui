// QA: preside over the civil hearing end to end. Usage: node tools/qa/court.mjs [outDir]
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
const group = page.getByRole('group', { name: 'Protsessual harakatlar' });
const ready = async () => { for (let i = 0; i < 12 && !(await group.count()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(350); } await group.waitFor(); };

await page.goto(`${BASE}/hub`);
await page.getByRole('button', { name: 'Majlis zaliga kirish' }).click();
await page.waitForURL(/court\/crt_/);
await ready();
await page.waitForTimeout(4000);
await shot('c1-bench');
// a deliberate mistake, twice → the article is offered
const wrong = group.getByRole('button').filter({ hasNotText: 'Sud majlisini ochiq deb' }).first();
await wrong.click(); await page.waitForTimeout(500);
await group.getByRole('button').filter({ hasNotText: 'Sud majlisini ochiq deb' }).first().click(); await page.waitForTimeout(700);
await shot('c2-mistake');
await page.getByRole('button', { name: 'Moddani ochish' }).click();
await shot('c3-code');
await page.keyboard.press('Escape');
const order = ['Sud majlisini ochiq deb', 'Sud majlisi kotibi', 'Guvoh, soʻroq qilingunga', 'Sud tarkibini eʼlon', 'Ishda ishtirok etuvchi shaxslarga', 'Ishni muhokama qilish bilan', 'Ish toʻgʻrisida maʼruza', 'Tushuntirishlarni eshitamiz', 'Sud dalillarni tekshirish', 'Guvohni zalga taklif', 'Barcha dalillar tekshirildi', 'Sud muzokaralarini eshitishga', 'Sud hal qiluv qarorini qabul', 'Sudning hal qiluv qarorini oʻqib'];
for (const [i, text] of order.entries()) {
  await ready();
  await group.getByRole('button', { name: new RegExp(text) }).click();
  if ([0, 1, 7, 9, 12].includes(i)) { await page.waitForTimeout(i === 0 ? 4200 : 2600); await shot(`c4-step-${i + 1}`); }
}
await page.getByRole('dialog').waitFor({ timeout: 60000 }).catch(async () => { for (let i = 0; i < 6; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(300); } });
await page.getByRole('dialog').waitFor();
await shot('c5-result');
console.log(logs.join('\n') || 'no console errors');
await browser.close();
