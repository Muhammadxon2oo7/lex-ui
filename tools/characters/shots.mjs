#!/usr/bin/env node
/**
 * Visual QA for the character GLBs.
 *   node tools/characters/shots.mjs [outDir] [script.mjs]
 * Starts a throw-away static server for the lexsim-web folder (port 4871),
 * opens tools/characters/preview.html in Chromium and saves screenshots.
 * An optional second argument is a module exporting `default async (ctx) => {}`
 * with ctx = { page, shot, api } for ad-hoc experiments.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'assets-src', 'characters', '_shots'));
const PORT = 4871;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm' };
mkdirSync(OUT, { recursive: true });

const server = createServer((req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(ROOT) || !existsSync(p) || !statSync(p).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/** Seated pose shared by all three characters: Euler XYZ deltas (rad), bone.quaternion = rest * delta. */
/**
 * Seated pose shared by all three characters. Euler XYZ deltas in radians, applied
 * as `bone.quaternion = rest * delta` (see api.pose in preview.html).
 * Right side = left side with x and y negated.
 */
const SEATED = {
  Bip01_L_Thigh: [0.2, 0, 1.53], Bip01_R_Thigh: [-0.2, 0, 1.53],
  Bip01_L_Calf: [0, 0, -1.45], Bip01_R_Calf: [0, 0, -1.45],
  Bip01_L_UpperArm: [0, 0.68, -0.25], Bip01_R_UpperArm: [0, -0.68, -0.25],
  Bip01_L_Forearm: [0.5, 0, -0.6], Bip01_R_Forearm: [-0.5, 0, -0.6],
};
/** root y offset that puts the soles on y = 0 in the seated pose */
const SEATED_ROOT_Y = { elder_man: -0.409, man: -0.409, woman: -0.386 };

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/tools/characters/preview.html`);
  await page.waitForFunction('window.ready === true');
  const shot = async (name) => { await page.waitForTimeout(150); await page.screenshot({ path: join(OUT, `${name}.png`) }); };
  const api = (method, ...args) => page.evaluate(([m, a]) => window.api[m](...a), [method, args]);
  const ctx = { page, shot, api, OUT };

  if (process.argv[3]) {
    await (await import(pathToFileURL(resolve(process.argv[3])).href)).default(ctx);
  } else {
    for (const id of ['elder_man', 'woman', 'man']) {
      const info = await api('load', `/public/assets/characters/${id}.glb`);
      writeFileSync(join(OUT, `${id}.info.json`), JSON.stringify(info, null, 2));
      await api('view', 'front'); await shot(`${id}_front`);
      await api('view', 'side'); await shot(`${id}_side`);
      await api('view', 'q3', [0, 1.62, 0], 1.1); await shot(`${id}_face`);
      await api('view', 'back', [0, 1.62, 0], 1.1); await shot(`${id}_head_back`);
      await api('pose', SEATED); await api('setRoot', SEATED_ROOT_Y[id]);
      info.seated = { rootY: SEATED_ROOT_Y[id], thighUndersideY: await api('minY', 0.12, 0.25), buttocksY: await api('minY', -0.3, 0), toe: await api('pos', 'Bip01_L_Toe0'), pelvis: await api('pos', 'Bip01_Pelvis'), head: await api('pos', 'Bip01_Head'), hand: await api('pos', 'Bip01_L_Hand'), knee: await api('pos', 'Bip01_L_Calf') };
      writeFileSync(join(OUT, `${id}.info.json`), JSON.stringify(info, null, 2));
      await api('view', 'q3', [0, 0.6, 0.2], 4.2); await shot(`${id}_seated_q3`);
      await api('view', 'side', [0, 0.6, 0.2], 4.2); await shot(`${id}_seated_side`);
      await api('view', 'front', [0, 0.6, 0.2], 4.2); await shot(`${id}_seated_front`);
    }
  }
  if (errors.length) console.log('console:', errors.join('\n'));
} finally {
  await browser.close();
  server.close();
}
console.log('screenshots →', OUT);
