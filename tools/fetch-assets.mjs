#!/usr/bin/env node
/**
 * LexSim asset pipeline: Poly Haven (CC0) → optimized web assets.
 *
 *   node tools/fetch-assets.mjs            # download + optimize everything
 *   node tools/fetch-assets.mjs --force    # re-download even if cached
 *
 * Raw downloads live in `assets-src/` (git-ignored). Optimized output goes to
 * `public/assets/` together with `LICENSES.json` (source, author, license).
 *
 * Textures: 1k JPG → WebP (diffuse, OpenGL normal, ARM = AO/Roughness/Metal).
 * Models:   1k glTF → GLB with Meshopt geometry + WebP textures.
 * HDRI:     1k Radiance .hdr for image-based lighting.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets-src');
const OUT = join(ROOT, 'public', 'assets');
const FORCE = process.argv.includes('--force');
const API = 'https://api.polyhaven.com';
const UA = 'asset-fetch/1.0';

const TEXTURES = [
  'terrazzo_tiles',
  'laminate_floor_02',
  'painted_plaster_wall',
  'oak_veneer_01',
  'walnut_veneer',
  'ceiling_interior',
  'fabric_pattern_07',
  'brown_leather',
  // exterior
  'precast_stone_paving',
  'concrete_tile_facade',
  'leafy_grass',
];

const MODELS = [
  'modern_arm_chair_01',
  'dining_chair_02',
  'sofa_03',
  'potted_plant_04',
  'potted_plant_02',
  'wall_clock',
  'desk_lamp_arm_01',
  'binder_notebook',
  'book_encyclopedia_set_01',
  'drawer_cabinet',
  'modern_coffee_table_01',
  'Shelf_01',
  // exterior
  'street_lamp_01',
  'modular_street_seating',
  'planter_box_02',
  'shrub_02',
];

/** [id, resolution]: interiors only light the scene (1k); the sky is also seen, so 2k. */
const HDRIS = [['small_empty_room_1', '1k'], ['kloofendal_48d_partly_cloudy_puresky', '2k']];

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function download(url, dest) {
  if (!FORCE && existsSync(dest) && statSync(dest).size > 0) return;
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const licenses = [];

async function record(id, kind) {
  const info = await getJson(`${API}/info/${id}`);
  licenses.push({
    id,
    kind,
    name: info.name,
    authors: Object.keys(info.authors ?? {}),
    license: 'CC0 1.0',
    source: `https://polyhaven.com/a/${id}`,
  });
}

async function texture(id) {
  const files = await getJson(`${API}/files/${id}`);
  // Some assets ship colour variants (col_1, col_01…) instead of "Diffuse".
  const colourKey = Object.keys(files)
    .filter((k) => /^(diffuse|diff|col)/i.test(k))
    .sort()[0];
  const maps = { diff: files[colourKey], nor: files.nor_gl, arm: files.arm };
  for (const [key, entry] of Object.entries(maps)) {
    const url = entry?.['1k']?.jpg?.url;
    if (!url) throw new Error(`${id}: missing ${key} map`);
    const raw = join(SRC, 'textures', id, `${key}.jpg`);
    await download(url, raw);
    const out = join(OUT, 'textures', id, `${key}.webp`);
    mkdirSync(dirname(out), { recursive: true });
    await sharp(raw)
      .webp({ quality: key === 'nor' ? 90 : 82, effort: 5 })
      .toFile(out);
  }
  await record(id, 'texture');
  console.log(`  texture  ${id}`);
}

async function model(id) {
  const files = await getJson(`${API}/files/${id}`);
  const gltf = files.gltf['1k'].gltf;
  const dir = join(SRC, 'models', id);
  const entry = join(dir, `${id}.gltf`);
  await download(gltf.url, entry);
  for (const [rel, inc] of Object.entries(gltf.include ?? {})) {
    await download(inc.url, join(dir, rel));
  }
  const out = join(OUT, 'models', `${id}.glb`);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync(
    join(ROOT, 'node_modules', '.bin', 'gltf-transform'),
    [
      'optimize',
      entry,
      out,
      '--compress',
      'meshopt',
      '--texture-compress',
      'webp',
      '--texture-size',
      '1024',
    ],
    { stdio: 'pipe' },
  );
  await record(id, 'model');
  console.log(`  model    ${id}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
}

async function hdri([id, res]) {
  const files = await getJson(`${API}/files/${id}`);
  const out = join(OUT, 'env', `${id}_${res}.hdr`);
  await download(files.hdri[res].hdr.url, out);
  await record(id, 'hdri');
  console.log(`  hdri     ${id}`);
}

console.log('LexSim assets ← Poly Haven (CC0)');
for (const id of TEXTURES) await texture(id);
for (const id of HDRIS) await hdri(id);
for (const id of MODELS) await model(id);

mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, 'LICENSES.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), assets: licenses }, null, 2),
);
console.log(`done: ${licenses.length} assets, manifest → public/assets/LICENSES.json`);
