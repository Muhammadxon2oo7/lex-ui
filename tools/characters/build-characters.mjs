#!/usr/bin/env node
/**
 * LexSim character pipeline: Microsoft Rocketbox avatars (MIT) → web-ready GLB.
 *
 *   node tools/characters/build-characters.mjs            # download + convert
 *   node tools/characters/build-characters.mjs --force    # re-download everything
 *
 * Source:  https://github.com/microsoft/Microsoft-Rocketbox (MIT, © 2020 Microsoft)
 * Only the files that are needed are fetched from raw.githubusercontent.com
 * (the repository itself is several GB, never clone it).
 *
 * Steps per character:
 *   1. download `<Avatar>_facial.fbx` (hipoly mesh + 175 facial blendshapes) and
 *      the colour / normal TGA textures into `assets-src/characters/` (git-ignored)
 *   2. FBX → GLB with FBX2glTF (godotengine build, downloaded on demand; the
 *      macOS binary is x86_64 and runs through Rosetta on Apple Silicon)
 *   3. post-process with glTF-Transform:
 *        - TGA → WebP textures, rebuilt PBR materials (FBX2glTF cannot find the
 *          3ds Max bitmap paths, so the GLB comes out untextured)
 *        - one mesh node per material: Body / Head / Hair
 *        - bake the Z-up mesh node rotation into the geometry (identity node)
 *        - keep 67 morph targets (52 ARKit + 15 visemes) on the meshes that
 *          actually deform, renamed to clean names
 *        - node names sanitised exactly like three.js does (spaces → "_")
 *        - Meshopt compression (EXT_meshopt_compression), no Draco
 *   4. write `public/assets/characters/<id>.glb` + `LICENSES.json`
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'assets-src', 'characters');
const OUT = join(ROOT, 'public', 'assets', 'characters');
const FORCE = process.argv.includes('--force');
const UA = 'asset-fetch/1.0';

const REPO = 'https://github.com/microsoft/Microsoft-Rocketbox';
const RAW = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master';
const FBX2GLTF_VERSION = 'v0.13.1';
const FBX2GLTF_PLATFORM = { darwin: 'macos-x86_64', linux: 'linux-x86_64', win32: 'windows-x86_64' };

/** id → Rocketbox avatar. `prefix` is the texture/material prefix used by the avatar. */
/** Max texture edge per map (source TGAs are 2048²). GPU cost of a 2048² map ≈ 22 MB, 1024² ≈ 5.6 MB. */
const TEX_HERO = { body: 2048, head: 2048, hair: 1024, normal: 1024 };
const TEX_EXTRA = { body: 1024, head: 1024, hair: 1024, normal: 1024 };

const CHARACTERS = [
  { id: 'elder_man', avatar: 'Male_Adult_03', prefix: 'm004', tex: TEX_HERO, label: 'Older man, grey hair, tweed jacket' },
  { id: 'woman', avatar: 'Female_Adult_09', prefix: 'f009', tex: TEX_EXTRA, label: 'Adult woman, cardigan and blouse' },
  { id: 'man', avatar: 'Male_Adult_08', prefix: 'm014', tex: TEX_EXTRA, label: 'Adult man, blue shirt' },
  { id: 'secretary', avatar: 'Female_Adult_02', prefix: 'f002', tex: TEX_EXTRA, label: 'Young woman, white blouse and skirt (court secretary)' },
  { id: 'lawyer', avatar: 'Female_Adult_05', prefix: 'f005', tex: TEX_EXTRA, label: 'Woman in a blazer (respondent’s counsel)' },
  { id: 'client', avatar: 'Male_Adult_07', prefix: 'm013', tex: TEX_EXTRA, label: 'Man in his thirties, dark jacket over a shirt (the claimant)' },
  { id: 'clerk', avatar: 'Female_Adult_07', prefix: 'f007', tex: TEX_EXTRA, label: 'Woman in a brown jacket (court office clerk)' },
  { id: 'investigator', avatar: 'Male_Adult_11', prefix: 'm001', tex: TEX_EXTRA, label: 'Man in a dark shirt (investigator)' },
  { id: 'chief', avatar: 'Male_Adult_13', prefix: 'm010', tex: TEX_EXTRA, label: 'Older man in a patterned sweater (head of the investigation unit)' },
  { id: 'worker', avatar: 'Male_Adult_05', prefix: 'm009', tex: TEX_EXTRA, label: 'Middle-aged man, work vest over green shirt (the witness)' },
];

/* ───────────────────────────── download helpers ───────────────────────────── */

async function download(url, dest) {
  if (!FORCE && existsSync(dest) && statSync(dest).size > 0) return;
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function ensureFbx2gltf() {
  const plat = FBX2GLTF_PLATFORM[process.platform];
  if (!plat) throw new Error(`no FBX2glTF build for ${process.platform}`);
  const dir = join(SRC, '_bin');
  const name = `FBX2glTF-${plat}`;
  const bin = join(dir, name, name + (process.platform === 'win32' ? '.exe' : ''));
  if (!existsSync(bin)) {
    const zip = join(dir, 'fbx2gltf.zip');
    await download(
      `https://github.com/godotengine/FBX2glTF/releases/download/${FBX2GLTF_VERSION}/${name}.zip`,
      zip,
    );
    execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
    if (process.platform !== 'win32') execFileSync('chmod', ['+x', bin]);
  }
  return bin;
}

/* ─────────────────────────────── TGA decoding ─────────────────────────────── */

/** Minimal TGA reader (type 2 uncompressed / type 10 RLE true-colour, 24 or 32 bpp). */
function decodeTga(buf) {
  const idLen = buf[0];
  const type = buf[2];
  const width = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  const bpp = buf[16];
  const topDown = (buf[17] & 0x20) !== 0;
  if ((type !== 2 && type !== 10) || (bpp !== 24 && bpp !== 32)) {
    throw new Error(`unsupported TGA (type ${type}, ${bpp} bpp)`);
  }
  const ch = bpp / 8;
  const n = width * height;
  const px = Buffer.alloc(n * ch);
  let p = 18 + idLen;
  if (type === 2) {
    buf.copy(px, 0, p, p + n * ch);
  } else {
    let o = 0;
    while (o < n * ch) {
      const h = buf[p++];
      const count = (h & 0x7f) + 1;
      if (h & 0x80) {
        for (let i = 0; i < count; i++) for (let c = 0; c < ch; c++) px[o++] = buf[p + c];
        p += ch;
      } else {
        buf.copy(px, o, p, p + count * ch);
        o += count * ch;
        p += count * ch;
      }
    }
  }
  // BGR(A) → RGB(A), bottom-up → top-down
  const out = Buffer.alloc(n * ch);
  const row = width * ch;
  for (let y = 0; y < height; y++) {
    const sy = topDown ? y : height - 1 - y;
    for (let x = 0; x < row; x += ch) {
      const s = sy * row + x;
      const d = y * row + x;
      out[d] = px[s + 2];
      out[d + 1] = px[s + 1];
      out[d + 2] = px[s];
      if (ch === 4) out[d + 3] = px[s + 3];
    }
  }
  return { data: out, width, height, channels: ch };
}

async function tgaToWebp(file, maxSize, { quality = 85, normal = false } = {}) {
  const { data, width, height, channels } = decodeTga(readFileSync(file));
  let img = sharp(data, { raw: { width, height, channels } });
  if (Math.max(width, height) > maxSize) {
    img = img.resize(maxSize, maxSize, { fit: 'inside', kernel: 'lanczos3' });
  }
  return img
    .webp(normal ? { quality: 92, effort: 5, smartSubsample: false } : { quality, alphaQuality: 95, effort: 5 })
    .toBuffer();
}

/* ───────────────────────────── glTF processing ───────────────────────────── */

/** Same rule as THREE.PropertyBinding.sanitizeNodeName (for ASCII names). */
const sanitize = (name) => name.replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');

/** Rocketbox blendshape → exported morph target name (null = dropped). */
function morphName(src) {
  const s = src.replace(/^blendShape\d*\./, '');
  let m = s.match(/^AK_\d+_(.+)$/); // ARKit 52 → standard lowerCamel names
  if (m) return m[1][0].toLowerCase() + m[1].slice(1);
  m = s.match(/^AA_VI_\d+_(.+)$/); // 15 Oculus-style visemes
  if (m) return `viseme_${m[1]}`;
  return null; // FACS (AU_), Vive (SR_/HB_) sets are redundant with ARKit
}

// column-major 4×4 helpers
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function invertRigid(m) {
  // rotation + translation only (unit scale), which is what the mesh node has
  const o = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
  o[12] = -(o[0] * m[12] + o[4] * m[13] + o[8] * m[14]);
  o[13] = -(o[1] * m[12] + o[5] * m[13] + o[9] * m[14]);
  o[14] = -(o[2] * m[12] + o[6] * m[13] + o[10] * m[14]);
  return o;
}
function applyMat(acc, m, w) {
  const v = [0, 0, 0];
  for (let i = 0; i < acc.getCount(); i++) {
    acc.getElement(i, v);
    const [x, y, z] = v;
    acc.setElement(i, [
      m[0] * x + m[4] * y + m[8] * z + m[12] * w,
      m[1] * x + m[5] * y + m[9] * z + m[13] * w,
      m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    ]);
  }
}

async function buildCharacter(io, fbx2gltf, ch) {
  const dir = join(SRC, ch.avatar);
  const base = `${RAW}/Assets/Avatars/Adults/${ch.avatar}`;
  const fbx = join(dir, `${ch.avatar}_facial.fbx`);
  const texNames = ['body_color', 'body_normal', 'head_color', 'head_normal'];
  await Promise.all([
    download(`${base}/Export/${ch.avatar}_facial.fbx`, fbx),
    ...texNames.map((t) =>
      download(`${base}/Textures/${ch.prefix}_${t}.tga`, join(dir, `${ch.prefix}_${t}.tga`)),
    ),
  ]);
  // short-haired / bald avatars have no hair-card (opacity) texture at all
  const hasOpacity = await download(`${base}/Textures/${ch.prefix}_opacity_color.tga`, join(dir, `${ch.prefix}_opacity_color.tga`)).then(
    () => true,
    () => false,
  );

  // 1. FBX → raw GLB
  const work = join(SRC, '_work');
  mkdirSync(work, { recursive: true });
  const rawBase = join(work, `${ch.id}_raw`);
  execFileSync(fbx2gltf, ['-b', '-i', fbx, '-o', rawBase], { stdio: 'pipe' });

  // 2. post-process
  const doc = await io.read(`${rawBase}.glb`);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  root.listAnimations().forEach((a) => a.dispose()); // 1-frame "Take 001"
  doc.createExtension(EXTTextureWebP).setRequired(true);

  const srcNode = root.listNodes().find((n) => n.getMesh());
  const srcMesh = srcNode.getMesh();
  const skin = srcNode.getSkin();
  const parent = srcNode.getParentNode() ?? scene;

  // bake the mesh node transform (Z-up → Y-up) into geometry + inverse bind matrices
  const M = Array.from(srcNode.getMatrix());
  const Minv = invertRigid(M);
  const done = new Set();
  const bake = (acc, w) => {
    if (!acc || done.has(acc)) return;
    done.add(acc);
    applyMat(acc, M, w);
  };
  for (const prim of srcMesh.listPrimitives()) {
    bake(prim.getAttribute('POSITION'), 1);
    bake(prim.getAttribute('NORMAL'), 0);
    for (const t of prim.listTargets()) bake(t.getAttribute('POSITION'), 0);
  }
  const ibm = skin.getInverseBindMatrices();
  for (let i = 0; i < ibm.getCount(); i++) {
    ibm.setElement(i, mul(ibm.getElement(i, new Array(16)), Minv));
  }

  // textures + materials
  const tex = async (name, size, opts) => {
    const image = await tgaToWebp(join(dir, `${ch.prefix}_${name}.tga`), size, opts);
    return doc.createTexture(name).setImage(image).setMimeType('image/webp');
  };
  const maps = {
    body: { color: await tex('body_color', ch.tex.body), normal: await tex('body_normal', ch.tex.normal, { normal: true }) },
    head: { color: await tex('head_color', ch.tex.head), normal: await tex('head_normal', ch.tex.normal, { normal: true }) },
    opacity: hasOpacity ? { color: await tex('opacity_color', ch.tex.hair, { quality: 88 }) } : null,
  };

  const srcTargetNames = srcMesh.getExtras().targetNames ?? [];
  const keep = srcTargetNames.map((n, i) => [i, morphName(n)]).filter(([, n]) => n);
  const report = { meshes: [] };

  for (const prim of srcMesh.listPrimitives()) {
    const kind = prim.getMaterial().getName().replace(/^.*_/, ''); // body | head | opacity
    const partName = { body: 'Body', head: 'Head', opacity: 'Hair' }[kind];
    if (!maps[kind]) continue; // no texture for this part (e.g. no hair cards)
    const mat = doc.createMaterial(`${ch.id}_${kind}`).setMetallicFactor(0).setBaseColorTexture(maps[kind].color);
    if (kind === 'body') mat.setRoughnessFactor(0.85).setNormalTexture(maps.body.normal);
    if (kind === 'head') mat.setRoughnessFactor(0.7).setNormalTexture(maps.head.normal);
    if (kind === 'opacity') {
      // hair cards / eyelashes: alpha lives in the base colour texture. Alpha-tested
      // (three.js: alphaTest 0.5) because BLEND shows glassy highlights on the cards.
      mat.setRoughnessFactor(1).setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
    }
    prim.setMaterial(mat);
    // some avatars carry vertex colours; three.js would multiply them into the base colour
    prim.setAttribute('COLOR_0', null);

    // morph targets: keep the curated set, only where this primitive really deforms
    const targets = prim.listTargets();
    let maxDelta = 0;
    for (const [i] of keep) {
      const arr = targets[i].getAttribute('POSITION').getArray();
      for (let k = 0; k < arr.length; k++) maxDelta = Math.max(maxDelta, Math.abs(arr[k]));
    }
    const kept = maxDelta > 1e-5 ? keep : [];
    const keptSet = new Set(kept.map(([i]) => targets[i]));
    for (const t of targets) if (!keptSet.has(t)) prim.removeTarget(t);
    // glTF-Transform writes `mesh.extras.targetNames` from the target names
    for (const [i, name] of kept) targets[i].setName(name);

    const mesh = doc.createMesh(partName).addPrimitive(prim);
    if (kept.length) mesh.setWeights(kept.map(() => 0));
    const node = doc.createNode(partName).setMesh(mesh).setSkin(skin);
    parent.addChild(node);
    report.meshes.push({
      name: partName,
      triangles: prim.getIndices().getCount() / 3,
      vertices: prim.getAttribute('POSITION').getCount(),
      morphTargets: kept.map(([, n]) => n),
    });
  }
  srcMesh.listPrimitives().forEach((p) => srcMesh.removePrimitive(p));
  srcNode.dispose();
  srcMesh.dispose();

  // three.js-safe node names
  for (const n of root.listNodes()) n.setName(sanitize(n.getName()));
  scene.setName(ch.id);
  root.getAsset().generator = 'FBX2glTF + glTF-Transform (LexSim character pipeline)';
  root.getAsset().copyright = 'Microsoft Rocketbox Avatar Library, © 2020 Microsoft, MIT License';

  await doc.transform(
    prune({ keepLeaves: true, keepAttributes: true }),
    dedup(),
    reorder({ encoder: MeshoptEncoder }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14 }),
  );

  const out = join(OUT, `${ch.id}.glb`);
  mkdirSync(OUT, { recursive: true });
  await io.write(out, doc);
  report.bytes = statSync(out).size;
  report.joints = root.listSkins()[0].listJoints().map((j) => j.getName());
  console.log(
    `  ${ch.id.padEnd(10)} ← ${ch.avatar}  ${(report.bytes / 1048576).toFixed(2)} MB  ` +
      report.meshes.map((m) => `${m.name}:${m.triangles}tri/${m.morphTargets.length}morph`).join(' '),
  );
  return report;
}

/* ─────────────────────────────────── main ─────────────────────────────────── */

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

console.log('LexSim characters ← Microsoft Rocketbox (MIT)');
const fbx2gltf = await ensureFbx2gltf();
const licenseText = await (await fetch(`${RAW}/LICENSE.md`, { headers: { 'User-Agent': UA } })).text();

const assets = [];
for (const ch of CHARACTERS) {
  const rep = await buildCharacter(io, fbx2gltf, ch);
  assets.push({
    file: `${ch.id}.glb`,
    description: ch.label,
    name: `Microsoft Rocketbox Avatar Library: ${ch.avatar}`,
    author: 'Microsoft (original avatars by Rocketbox Studios; facial blendshapes contributed by Matias Volonte and Fang Ma)',
    license: 'MIT',
    licenseUrl: `${REPO}/blob/master/LICENSE.md`,
    source: `${REPO}/tree/master/Assets/Avatars/Adults/${ch.avatar}`,
    sourceFiles: [
      `${RAW}/Assets/Avatars/Adults/${ch.avatar}/Export/${ch.avatar}_facial.fbx`,
      `${RAW}/Assets/Avatars/Adults/${ch.avatar}/Textures/${ch.prefix}_*.tga`,
    ],
    attribution: `"${ch.avatar}" from the Microsoft Rocketbox Avatar Library, Copyright (c) 2020 Microsoft, MIT License. ${REPO}`,
    modifications:
      'Converted FBX to glTF (FBX2glTF), textures resized and re-encoded as WebP, blendshapes reduced to ARKit + viseme sets and renamed, Meshopt compression.',
    bytes: rep.bytes,
  });
}

writeFileSync(
  join(OUT, 'LICENSES.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      generator: 'tools/characters/build-characters.mjs',
      citation:
        'Gonzalez-Franco M. et al. (2020) "The Rocketbox Library and the Utility of Freely Available Rigged Avatars." Frontiers in Virtual Reality 1:561558. doi:10.3389/frvir.2020.561558',
      assets,
      licenseText,
    },
    null,
    2,
  ),
);
console.log(`done: ${assets.length} characters → public/assets/characters/ (+ LICENSES.json)`);
