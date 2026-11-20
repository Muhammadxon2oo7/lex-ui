// QA: when the appointment ends, the citizen stands up and walks out of room 3.
import { chromium } from 'playwright';
const OUT = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
await page.addInitScript(() => localStorage.setItem('lexsim.debug', '1'));
await page.goto('http://localhost:3000/hub');
await page.getByRole('button', { name: 'Boshlash' }).first().click();
await page.getByRole('button', { name: 'Ishni boshlash' }).click({ timeout: 90000 });
await page.waitForTimeout(1200);
await page.evaluate(() => window.__lexsimDebug.game.getState().sit());
await page.waitForTimeout(3000);
await page.evaluate(() => window.__lexsimDebug.game.getState().finish());
for (const [i, w] of [[1, 1200], [2, 1500], [3, 1500], [4, 1600], [5, 2200]]) {
  await page.waitForTimeout(w);
  await page.screenshot({ path: `${OUT}/exit-${i}.png` });
}
console.log(logs.join('\n') || 'no page errors');
await browser.close();
