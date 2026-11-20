#!/usr/bin/env node
/**
 * Visual QA for the animation GLBs.
 *   node tools/characters/anim-shots.mjs [outDir]
 * Static server for lexsim-web on 127.0.0.1:4873, tools/characters/anim-preview.html in
 * Chromium; binds every clip of both sets on all three characters (SkeletonUtils.clone +
 * AnimationMixer.clipAction(clip, root)), records console output, bone scans and mesh
 * metrics (report.json) and writes film-strip contact sheets (PNG).
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'assets-src', 'characters', '_shots', 'anims'));
const PORT = 4873;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm' };
mkdirSync(OUT, { recursive: true });
const manifest = JSON.parse(readFileSync(join(ROOT, 'public/assets/characters/anims.json'), 'utf8'));

const server = createServer((req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(ROOT) || !existsSync(p) || !statSync(p).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const W = 880, H = 300, COLS = 2, ROWS = 6;
const report = { console: [], combos: {} };
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  let ctxLabel = '';
  page.on('console', (m) => { if (m.type() !== 'log' && m.type() !== 'info' && m.type() !== 'debug') report.console.push(`[${ctxLabel}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => report.console.push(`[${ctxLabel}] pageerror: ${e}`));
  await page.goto(`http://127.0.0.1:${PORT}/tools/characters/anim-preview.html`);
  await page.waitForFunction('window.ready === true');
  const api = (method, ...args) => page.evaluate(([m, a]) => window.api[m](...a), [method, args]);

  const sheets = async (name, tiles) => {
    const per = COLS * ROWS, files = [];
    for (let s = 0; s * per < tiles.length; s++) {
      const part = tiles.slice(s * per, s * per + per);
      const file = join(OUT, `${name}_${String(s + 1).padStart(2, '0')}.png`);
      await sharp({ create: { width: W * COLS, height: H * Math.ceil(part.length / COLS), channels: 3, background: '#ffffff' } })
        .composite(part.map((input, i) => ({ input, left: (i % COLS) * W, top: Math.floor(i / COLS) * H })))
        .png().toFile(file);
      files.push(file);
    }
    return files;
  };

  for (const char of ['elder_man', 'man', 'woman']) {
    for (const set of ['m', 'f']) {
      const native = manifest.characters[char].nativeSet === set;
      // cross-rig: scale the Bip01 position track by the hip-height ratio (as documented in anims.json)
      const rootScale = native ? 1 : manifest.characters[char].hipHeight / manifest.sets[set].hipHeight;
      const combo = `${char}__anims_${set}`;
      ctxLabel = combo;
      const info = await api('loadChar', char);
      const clips = await api('loadAnims', manifest.sets[set].file);
      const out = (report.combos[combo] = { native, rootScale: +rootScale.toFixed(4), bonesInCharacter: info.bones, clips: {} });
      const q3 = [], side = [];
      for (const c of clips) {
        const m = manifest.clips[c.name][set];
        const b = await api('bind', c.name, { rootScale });
        const scan = await api('scan', c.duration);
        const seated = m.startsSeated || m.endsSeated;
        const d = c.duration, times = [0, d * 0.33, d * 0.66, d - 0.001];
        const label = `${char} × anims_${set} · ${c.name} (${d.toFixed(2)}s${m.loop ? ', loop' : ''})`;
        await api('chair', null);
        const metrics = await api('strip', times, 'q3', [0, 0.85, seated ? -0.2 : 0], 1.25, label);
        q3.push(await page.screenshot());
        if (seated) {
          // reference chair at the measured seat height, under the seated pelvis
          const end = m.endsSeated ? metrics[3] : metrics[0];
          await api('chair', { seatY: end.buttocksUndersideY, z: end.pelvis[2] - 0.04, x: end.pelvis[0] });
          await api('strip', times, 'side', [0, 0.8, -0.2], 1.15, label + ' · side, +Z to the left');
          side.push(await page.screenshot());
        }
        if (m.composedFrom?.layer === 'arms_head') {
          // composed clips: denser strip (8 time points) to check the arm blend
          await api('chair', { seatY: metrics[3].buttocksUndersideY, z: metrics[3].pelvis[2] - 0.04, x: 0 });
          for (const part of [0, 1]) {
            await api('strip', [0, 1, 2, 3].map((i) => d * (0.06 + 0.11 * (i + part * 4))), part ? 'side' : 'q3', [0, 0.8, -0.2], 1.15, label + ` · dense ${part + 1}/2`);
            side.push(await page.screenshot());
          }
        }
        out.clips[c.name] = { tracks: b.tracks, bound: b.bound, positionTracks: c.positionTracks, scan, first: metrics[0], last: metrics[3] };
      }
      out.sheets = [...(await sheets(`${combo}_q3`, q3)), ...(await sheets(`${combo}_seated_side`, side))];
      const unbound = Object.entries(out.clips).filter(([, v]) => v.bound !== v.tracks).map(([k]) => k);
      console.log(`${combo}: ${clips.length} clips, unbound tracks in: ${unbound.join(', ') || 'none'}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
// measured block for anims.json (picked up by build-animations.mjs on the next run)
const measured = { note: 'Measured by tools/characters/anim-shots.mjs from the rendered, skinned meshes (metres, character root at the origin, facing +Z, floor y = 0). Cross-rig rows use the Bip01 position track scaled by character.hipHeight / set.hipHeight.', seated: {}, transitions: {} };
for (const [combo, c] of Object.entries(report.combos)) {
  const s = c.clips.sit_idle.first, t = c.clips.sit_table_idle.first, a = c.clips.stand_to_sit, b = c.clips.sit_to_stand;
  measured.seated[combo] = {
    pelvisY: s.pelvis[1], buttocksUndersideY: s.buttocksUndersideY, thighUndersideY: s.thighUndersideY,
    kneeForwardZ: s.kneeL[2], footForwardZ: s.footL[2], headY: s.head[1],
    table: { pelvisY: t.pelvis[1], thighUndersideY: t.thighUndersideY, handY: Math.min(t.handL[1], t.handR[1]), handForwardZ: Math.max(t.handL[2], t.handR[2]) },
  };
  measured.transitions[combo] = {
    stand_to_sit: { pelvisStart: a.first.pelvis, pelvisEnd: a.last.pelvis, feetStartZ: a.first.footL[2], feetEndZ: a.last.footL[2] },
    sit_to_stand: { pelvisStart: b.first.pelvis, pelvisEnd: b.last.pelvis, feetStartZ: b.first.footL[2], feetEndZ: b.last.footL[2] },
  };
}
writeFileSync(join(ROOT, 'tools', 'characters', 'anims-measured.json'), JSON.stringify(measured, null, 2));
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
console.log(`console messages: ${report.console.length}`);
report.console.slice(0, 20).forEach((l) => console.log('  ' + l));
console.log('→', OUT);
