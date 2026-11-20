// QA walkthrough: fixed cameras → screenshots. Usage: node tools/qa/shots.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'qa-shots';
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
await page.addInitScript(() => { localStorage.setItem('lexsim.debug', '1'); localStorage.setItem('lexsim.settings.v1', JSON.stringify({ quality: 'high', autoQuality: false })); });

const shot = async (name) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const tp = (x, z, yaw, pitch = 0) => page.evaluate(([x, z, yaw, pitch]) => window.__lexsimDebug.teleport(x, z, yaw, pitch), [x, z, yaw, pitch]);

await page.goto(`${BASE}/hub`);
await page.getByRole('button', { name: 'Boshlash' }).click();
await page.waitForURL(/simulation\/sim_/);
await page.getByRole('button', { name: 'Ishni boshlash' }).waitFor({ timeout: 90000 });
await shot('01-briefing');
await page.getByRole('button', { name: 'Ishni boshlash' }).click();
await page.waitForTimeout(1500);
console.log('mode', await page.evaluate(() => window.__lexsimDebug.game.getState().mode), 'renderer', await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; }));
await page.evaluate(() => window.__lexsimDebug.game.setState({ mode: 'exploring' }));
await tp(0, 8.4, 0); await shot('02-spawn');
await tp(-2.5, 7.5, -0.9, -0.05); await shot('03-lobby-east');
await tp(4.5, 5, 0.9, -0.03); await shot('04-lobby-west');
await tp(-1.5, 4.5, Math.PI, 0); await shot('05-entrance');
await page.evaluate(() => window.__lexsimDebug.game.setState({ doorOpen: true }));
await tp(2.2, -0.9, -0.75, -0.12); await shot('06-room');
await tp(3.2, -4.6, -2.1, -0.15); await shot('07-npc-close');
await tp(5.6, -1.3, 0.55, -0.12); await shot('08-npc-front');
console.log(logs.slice(0, 15).join('\n'));
await browser.close();
