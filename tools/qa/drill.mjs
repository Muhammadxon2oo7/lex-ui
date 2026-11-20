import { chromium } from 'playwright';
const OUT = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('pageerror', (e) => logs.push(e.message.slice(0, 200)));
await page.addInitScript(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
// from the terminal, through door 4
await page.goto('http://localhost:3000/');
await page.getByRole('list', { name: 'Amaliyot xonalari' }).getByRole('button', { name: /Huquqiy kutubxona/ }).click({ timeout: 120000 });
await page.waitForURL(/protsess/, { timeout: 30000 });
await page.getByRole('heading', { name: /Davlat organida/ }).waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Mashq: tartibni tiklang' }).click();
await page.waitForTimeout(500);
// one wrong pick, then a right one
const items = page.getByRole('dialog', { name: /Davlat organida/ }).locator('ul button');
await items.nth(3).click();
await page.waitForTimeout(300);
await page.getByRole('dialog', { name: /Davlat organida/ }).locator('ul button', { hasText: 'Maʼmuriy ish yuritishni boshlash' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/d1-drill.png` });
console.log(logs.join('\n') || 'no page errors');
await browser.close();
