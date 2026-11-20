// QA: DXM office — teleport around the room and look at the flag, desk and people. Usage: node tools/qa/dxm-audit.mjs [outDir]
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
await page.addInitScript(() => { localStorage.setItem('lexsim.debug', '1'); localStorage.setItem('lexsim.settings.v1', JSON.stringify({ quality: 'high', autoQuality: false })); });
const shot = async (name) => { await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const tp = (x, z, yaw, pitch = 0) => page.evaluate(([x, z, yaw, pitch]) => window.__lexsimDebug.teleport(x, z, yaw, pitch), [x, z, yaw, pitch]);
await page.goto(`${BASE}/hub`);
await page.getByRole('button', { name: 'Boshlash' }).click();
await page.waitForURL(/simulation\/sim_/);
await page.getByRole('button', { name: 'Ishni boshlash' }).waitFor({ timeout: 90000 });
await page.getByRole('button', { name: 'Ishni boshlash' }).click();
await page.waitForTimeout(1500);
await page.evaluate(() => window.__lexsimDebug.game.setState({ mode: 'exploring' }));
const views = [[0, 8.4, 0, 0, 'spawn'], [-2.1, 3.2, 0, 0.05, 'flag-front'], [0.2, 1.6, 1.2, 0.05, 'flag-side-e'], [-5.6, 2.4, -0.9, 0.05, 'flag-side-w'], [-2.5, 7.5, -0.9, -0.05, 'lobby-east'], [4.5, 5, 0.9, -0.03, 'lobby-west']];
for (const [x, z, yaw, pitch, name] of views) { await tp(x, z, yaw, pitch); await shot(`dxm-${name}`); }
console.log(logs.join('\n') || 'no console errors');
await browser.close();
