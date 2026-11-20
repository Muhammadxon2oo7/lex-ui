// QA: seated mocap in DXM + lobby, court, and coming back to the terminal by client-side navigation.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
await page.addInitScript(() => { localStorage.setItem('lexsim.debug', '1'); localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })); });
const shot = async (n, w = 1200) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };
const rooms = () => page.getByRole('list', { name: 'Amaliyot xonalari' });

await page.goto('http://localhost:3000/');
await rooms().waitFor({ timeout: 120000 });
await rooms().getByRole('button', { name: /Davlat xizmatlari markazi/ }).click();
await page.waitForURL(/simulation\/sim_/);
await page.getByRole('button', { name: 'Ishni boshlash' }).click({ timeout: 90000 });
await page.waitForTimeout(1200);
await page.evaluate(() => window.__lexsimDebug.game.setState({ mode: 'exploring' }));
await page.evaluate(() => window.__lexsimDebug.teleport(1.5, 5.2, -1.2, -0.05));
await shot('m1-lobby-extras', 4000);
await page.evaluate(() => window.__lexsimDebug.game.getState().sit());
await shot('m2-rustam-talking', 2600);
await shot('m3-rustam-talking-later', 1800);
// pick a reply that makes him show the phone
await page.getByRole('group', { name: 'Javob variantlari' }).waitFor({ timeout: 30000 });
for (let i = 0; i < 6; i++) {
  const b = page.getByRole('button', { name: /Qoʻlingizda qanday hujjatlar/ });
  if (await b.count()) { await b.click(); break; }
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(250);
}
await shot('m4-show-phone', 2200);

await page.getByRole('button', { name: 'Qabulni yakunlash' }).waitFor();
await page.keyboard.press('Escape');
await page.getByRole('link', { name: 'Yoʻlakka chiqish' }).click();
await page.waitForURL('http://localhost:3000/');
await rooms().waitFor({ timeout: 60000 });
await shot('m5-back-at-terminal-1', 2500);
await rooms().getByRole('button', { name: /Sud majlisi zali/ }).click();
await page.waitForURL(/court\/crt_/);
await page.getByRole('group', { name: 'Protsessual harakatlar' }).waitFor({ timeout: 90000 });
await shot('m6-court', 4000);
await page.getByRole('link', { name: 'Zaldan chiqish' }).click();
await page.waitForURL('http://localhost:3000/');
await rooms().waitFor({ timeout: 60000 });
await shot('m7-back-at-terminal-2', 2500);
console.log(logs.filter((l) => !/THREE\.Clock|deprecated parameters|PCFSoft/.test(l)).slice(0, 10).join('\n') || 'no console errors');
await browser.close();
