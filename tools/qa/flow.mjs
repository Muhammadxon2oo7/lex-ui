// End-to-end QA: 3D session → dialogue → bribe → document → finish → report, then the 2D fallback.
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
await page.addInitScript(() => { localStorage.setItem('lexsim.debug', '1'); localStorage.setItem('lexsim.settings.v1', JSON.stringify({ quality: 'high', autoQuality: false })); });
const shot = async (name, opts = {}) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log('shot', name); };
const game = (fn) => page.evaluate(fn);
const idle = async () => {
  // wait until the citizen has finished speaking and replies are on screen
  await page.getByRole('group', { name: 'Javob variantlari' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(250);
};
const pick = async (startsWith) => {
  await idle();
  for (let i = 0; i < 8; i++) {
    const btn = page.getByRole('button', { name: new RegExp(startsWith) });
    if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(500); return; }
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(250);
  }
  throw new Error('option not offered: ' + startsWith);
};
const bribePending = () => game(() => window.__lexsimDebug.game.getState().snapshot.objects.envelope === 'active');

await page.goto(`${BASE}/hub`);
await shot('10-hub');
await page.getByRole('button', { name: 'Boshlash' }).click();
await page.getByRole('button', { name: 'Ishni boshlash' }).click({ timeout: 90000 });
await page.waitForTimeout(1200);
await game(() => window.__lexsimDebug.game.setState({ mode: 'exploring' }));
await game(() => window.__lexsimDebug.teleport(5.2, 4.35, -Math.PI / 2, -0.35));
await page.waitForTimeout(600);
await shot('10c-seat-prompt');
await page.keyboard.press('KeyE');
await page.waitForTimeout(1500);
await shot('10d-resting');
await page.keyboard.press('KeyG');
await page.waitForTimeout(800);
await game(() => window.__lexsimDebug.game.setState({ mode: 'exploring' })); // headless Chromium refuses pointer lock
await game(() => window.__lexsimDebug.teleport(2.95, 1.6, 0, -0.05));
await page.waitForTimeout(600);
await shot('10a-door-closed');
await page.keyboard.press('KeyE');
await page.waitForTimeout(1300);
await shot('10b-door-open');
await game(() => window.__lexsimDebug.teleport(3.4, -2.6, -0.5, -0.2));
await page.waitForTimeout(500);
await page.keyboard.press('KeyE');
await idle();
await shot('11-choices');

const script = ['Assalomu alaykum', 'Qaysi yillarda', 'Qoʻlingizda qanday', 'Oʻsha xoʻjalik', 'Bu masala bilan avval', 'Demak, gap hisob-kitobda', 'Buning uchun pasportingiz', 'Soʻrov bugun', 'Javob tayyor'];
let shotBribe = false;
for (const [i, line] of script.entries()) {
  await idle();
  if (await bribePending()) {
    if (!shotBribe) { await shot('12-bribe'); shotBribe = true; }
    await pick('Rustam aka, rahmat, lekin');
  }
  await pick(line);
  if (i === 2) { await page.waitForTimeout(1500); await shot('12a-phone-gesture'); await idle(); await page.keyboard.press('KeyR'); await page.waitForTimeout(900); await shot('12b-exhibit'); await page.keyboard.press('Escape'); }
}
await idle();
if (await bribePending()) await pick('Rustam aka, rahmat, lekin');
await idle();
// handle the tools of the trade
await page.keyboard.press('KeyB');
await page.waitForTimeout(500);
await shot('13a-tray');
for (const [name, file, useIt] of [['Muhr', 'stamp', true], ['Ish yuritish jildi', 'folder', true], ['Normativ hujjatlar', 'book', true], ['ID-karta', 'idcard', false]]) {
  await page.waitForTimeout(600);
  if (!(await page.getByRole('list', { name: 'Stol ustidagi buyumlar' }).count())) await page.keyboard.press('KeyB');
  await page.getByRole('list', { name: 'Stol ustidagi buyumlar' }).getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('dialog', { name: /qoʻlda koʻrish/ }).waitFor();
  await page.waitForTimeout(1500);
  await shot(`13b-hand-${file}`);
  if (useIt) { await page.keyboard.press('Space'); await page.waitForTimeout(1600); await shot(`13c-hand-${file}-used`); }
  else { await page.keyboard.press('KeyF'); await page.waitForTimeout(900); await shot(`13c-hand-${file}-back`); }
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: /qoʻlda koʻrish/ }).waitFor({ state: 'hidden' });
}
await page.keyboard.press('KeyV');
await shot('13-notebook');
await page.keyboard.press('KeyV');

await page.keyboard.press('KeyF');
await page.getByRole('dialog', { name: /operator ish joyi/ }).waitFor();
await page.getByRole('button', { name: 'ID-kartani skanerlash' }).click();
await page.waitForTimeout(1700);
await shot('14-ws-applicant');
await page.getByRole('button', { name: 'Keyingi' }).click();
await page.getByRole('searchbox').fill('arxiv');
await page.getByRole('button', { name: /AR-014/ }).click();
await shot('14b-ws-service');
await page.getByRole('button', { name: 'Keyingi' }).click();
await page.getByLabel(/boshlanishi/).fill('1991');
await page.getByLabel(/tugashi/).fill('1998');
await page.getByLabel(/Ish joyi/).fill('Jamoa xoʻjaligi (tugatilgan, hujjatlari arxivda)');
await shot('14c-ws-details');
await page.getByRole('button', { name: 'Keyingi' }).click();
await page.getByRole('button', { name: /Mehnat daftarchasi/ }).click();
await page.getByRole('button', { name: /Ish joyi va davr/ }).click();
await page.getByRole('button', { name: 'Keyingi' }).click();
await page.getByLabel(/keyingi qadam/).fill('Arxivdan javob kelgach, staj qayta hisoblanishi uchun vakolatli organga murojaat qilinadi.');
await page.getByLabel(/Natija haqida/).selectOption('sms');
await shot('14d-ws-review');
await page.getByRole('button', { name: 'Imzolash va tilxat chiqarish' }).click();
await page.getByRole('dialog', { name: /operator ish joyi/ }).waitFor({ state: 'hidden' });
await idle();
await shot('14e-receipt');
await page.getByRole('button', { name: 'Qabulni yakunlash' }).click();
await page.getByRole('button', { name: 'Ha, yakunlash' }).click();
await page.getByRole('link', { name: 'Hisobotni koʻrish' }).waitFor();
await page.waitForTimeout(1200);
await shot('15-outcome');
await page.getByRole('link', { name: 'Hisobotni koʻrish' }).click();
await page.getByRole('heading', { name: 'Mezonlar boʻyicha' }).waitFor();
await shot('16-report', { fullPage: true });

// 2D fallback + refresh recovery
await page.goto(`${BASE}/hub`);
await page.getByRole('radio', { name: '2D' }).click();
await page.getByRole('button', { name: 'Boshlash' }).click();
await page.getByRole('button', { name: 'Ishni boshlash' }).click();
await page.getByRole('group', { name: 'Javob variantlari' }).waitFor();
await page.getByRole('group', { name: 'Javob variantlari' }).getByRole('button').first().click();
await page.waitForTimeout(1500);
await page.reload();
await page.getByRole('group', { name: 'Javob variantlari' }).waitFor();
await shot('17-2d-after-refresh');
await page.setViewportSize({ width: 390, height: 800 });
await shot('18-2d-phone');
console.log(logs.join('\n') || 'no console errors');
await browser.close();
