// QA: the economic-court case on the court server — hub → briefing → hall → answers → report.
// Needs LEXSIM_REMOTE_URL and the server reachable. Usage: node tools/qa/economic.mjs [outDir]
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
const box = page.getByLabel('Sudga javobingiz');
/** Skip the lines being presented until the answer box is open. */
const ready = async () => {
  for (let i = 0; i < 80; i++) {
    if (await box.isEnabled().catch(() => false)) return;
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
  }
  throw new Error('answer box never opened');
};
const answer = async (text) => { await ready(); await box.fill(text); await box.press('Enter'); await page.waitForTimeout(700); };

await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
await page.goto(`${BASE}/hub`);
const enterBtn = page.getByRole('region', { name: 'Iqtisodiy sud' }).getByRole('button', { name: 'Majlis zaliga kirish' });
await enterBtn.first().waitFor({ timeout: 15000 });
await shot('e1-hub');
await page.getByRole('listitem').filter({ hasText: 'Javobgar vakili' }).getByRole('button', { name: 'Majlis zaliga kirish' }).click();
await page.waitForURL(/\/sud\/rmt_/, { timeout: 30000 });
await page.getByRole('dialog', { name: /Ijara qarzi/ }).waitFor({ timeout: 30000 });
await page.waitForTimeout(5000);
await shot('e2-briefing');
await page.getByRole('button', { name: 'Majlis zaliga kirish' }).click();
await page.waitForTimeout(2500);
await shot('e3-secretary');
await page.waitForTimeout(6500);
await shot('e4-judge-in');
await ready();
await page.keyboard.press('KeyG');
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Maslahat/ }).click();
await page.getByRole('complementary', { name: 'Maslahat' }).waitFor({ timeout: 10000 });
await shot('e5-hint');
await page.getByRole('button', { name: 'Namunani javobga qoʻyish' }).click();
await box.press('Enter');
await page.waitForTimeout(800);
// beginner: options are on offer — pick one with the keyboard, then answer in own words
await ready();
const opts = page.getByRole('group', { name: 'Javob variantlari' });
await opts.waitFor({ timeout: 10000 });
await shot('e5b-options');
await page.keyboard.press('Digit1');
await page.waitForTimeout(900);
for (const t of ['Hurmatli sud, tushunarli.', 'Hurmatli sud, iltimosnomam yoʻq.']) await answer(t);
await ready();
await shot('e6-hall-answering');
await page.getByRole('button', { name: 'Yakunlash' }).click();
await page.waitForURL(/\/simulation\/rmt_.*\/report/, { timeout: 90000 });
await page.getByRole('heading', { name: /Tahlil/ }).waitFor({ timeout: 30000 });
await shot('e7-report');
await page.getByRole('heading', { name: /Tahlil/ }).scrollIntoViewIfNeeded();
await shot('e8-report-debrief');
// advanced: no options, no coach — own words only
await page.goto(`${BASE}/hub`);
await page.getByRole('radio', { name: 'Professional' }).click();
await page.getByRole('listitem').filter({ hasText: 'Javobgar vakili' }).getByRole('button', { name: 'Majlis zaliga kirish' }).click();
await page.waitForURL(/\/sud\/rmt_/, { timeout: 30000 });
await page.getByRole('dialog', { name: /Ijara qarzi/ }).waitFor({ timeout: 30000 });
await page.getByRole('button', { name: 'Majlis zaliga kirish' }).click();
await ready();
const adv = { options: await page.getByRole('group', { name: 'Javob variantlari' }).count(), hint: await page.getByRole('button', { name: /Maslahat/ }).count() };
if (adv.options || adv.hint) throw new Error(`advanced level shows help: ${JSON.stringify(adv)}`);
await shot('e9-advanced');
console.log('advanced: no options, no hints ✓');
console.log(logs.join('\n') || 'no console errors');
await browser.close();
