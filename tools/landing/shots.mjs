// Stills for the landing cards, taken inside the simulator itself (UI hidden, only the 3D canvas).
//   node tools/landing/shots.mjs      → public/landing/<id>.png (then converted to webp)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = 'public/landing';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' }));
  localStorage.setItem('lexsim.settings.v1', JSON.stringify({ quality: 'high', autoQuality: false, volume: 0 }));
});
const page = await ctx.newPage();
const api = (path, body) => page.evaluate(async ([p, b]) => (await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b ?? {}) })).json(), [path, body]);
const still = async (id, url, wait = 9000) => {
  await page.goto(`${BASE}${url}`);
  await page.locator('canvas').first().waitFor({ timeout: 40000 });
  await page.waitForTimeout(wait);
  await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' });
  await page.waitForTimeout(400);
  await page.locator('canvas').first().screenshot({ path: `${OUT}/${id}.png` });
  console.log('still', id);
};
await page.goto(`${BASE}/hub`);
const labour = (await api('/api/v1/cases', { fresh: true, kind: 'labour' })).case.caseId;
const theft = (await api('/api/v1/cases', { fresh: true, kind: 'theft' })).case.caseId;
await still('advokat', `/ish/${labour}/consult`);
await still('tergov', `/ish/${theft}/interview`);
await still('hujjatlar', `/ish/${labour}/draft`);
await still('majlis', `/ish/${labour}/hearing`, 14000);
const hearing = (await api('/api/v1/hearings')).hearing.hearingId;
await still('sudya', `/court/${hearing}`, 12000);
const dxm = (await api('/api/v1/sessions', { scenarioId: 'dxm-yoqolgan-staj', mode: 'tutorial' }));
const sid = dxm.snapshot?.sessionId;
if (sid) await still('dxm', `/simulation/${sid}`, 10000);
else console.log('dxm session failed', JSON.stringify(dxm).slice(0, 200));
await browser.close();
