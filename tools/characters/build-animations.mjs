#!/usr/bin/env node
/**
 * LexSim animation pipeline: Microsoft Rocketbox animations (MIT) → web-ready GLB.
 *
 *   node tools/characters/build-animations.mjs            # download + convert + pack
 *   node tools/characters/build-animations.mjs --force    # re-download / re-convert everything
 *
 * Source:  https://github.com/microsoft/Microsoft-Rocketbox  (MIT, © 2020 Microsoft)
 *          Assets/Animations/all_animations_max_motextr_{static,xy,xyz}/<m|f>_<name>.max.fbx
 *
 * Output (public/assets/characters/):
 *   anims_m.glb   clips authored on the male Rocketbox rig   (elder_man, man)
 *   anims_f.glb   clips authored on the female Rocketbox rig (woman)
 *   anims.json    manifest (durations, loop flags, root motion, seated flags, chair geometry)
 *   LICENSES.json gets one entry per animation file (existing entries are kept)
 *
 * The GLBs contain only the Biped skeleton nodes (no mesh, no skin) and one glTF animation
 * per clip. three.js binds the tracks by node name ("Bip01_L_Thigh.quaternion"), so a clip
 * plays on any of the character GLBs: `mixer.clipAction(clip, characterRoot)`.
 *
 * What is done to the raw data, and why:
 *   - FBX → GLB with FBX2glTF, baked at 30 fps (the source frame rate)
 *   - node names sanitised like three.js does ("Bip01 L Thigh" → "Bip01_L_Thigh")
 *   - ONLY rotations are kept, plus the translation of the root `Bip01`. The source files
 *     key a position on every bone (= bone lengths of the rig the clip was authored on);
 *     keeping them would stretch a differently proportioned character.
 *   - face bones (everything below Bip01_Head), nubs, Footsteps and the helper nodes are
 *     dropped: the face is driven by blendshapes in the app.
 *   - every body bone gets a track in every clip (constant ones collapse to 2 keys), so
 *     cross-fades never blend against the bind pose.
 *   - `inPlace` clips: the linear travel of the root is removed (walk loop), speed is
 *     reported in the manifest.
 *   - `compose` clips: Rocketbox has no seated talking clips, so the arms / head of a
 *     standing clip are layered over the seated idle (legs, pelvis, spine).
 *   - quaternion + exponential filters and Meshopt compression (no Draco).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'assets-src', 'characters');
const OUT = join(ROOT, 'public', 'assets', 'characters');
const FORCE = process.argv.includes('--force');
const UA = 'asset-fetch/1.0';

const REPO = 'https://github.com/microsoft/Microsoft-Rocketbox';
const RAW = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master';
const ANIM_DIR = 'Assets/Animations';
const FBX2GLTF_VERSION = 'v0.13.1';
const FBX2GLTF_PLATFORM = { darwin: 'macos-x86_64', linux: 'linux-x86_64', win32: 'windows-x86_64' };
const FPS = 30;

/** Character whose skeleton (hierarchy + rest pose) is written into each animation file. */
const SETS = [
  { id: 'm', file: 'anims_m.glb', rig: 'elder_man', label: 'male clip set (authored on the male rig: elder_man, man)' },
  { id: 'f', file: 'anims_f.glb', rig: 'woman', label: 'female clip set (authored on the female rig: woman)' },
];

const S = 'all_animations_max_motextr_static';
const XY = 'all_animations_max_motextr_xy';
const XYZ = 'all_animations_max_motextr_xyz';

/** Bone groups used by `compose`. */
const isArm = (n) => /^Bip01_[LR]_(Clavicle|UpperArm|Forearm|Hand|Finger)/.test(n);
const isHead = (n) => n === 'Bip01_Neck' || n === 'Bip01_Head';
const LAYERS = {
  arms_head: (n) => isArm(n) || isHead(n),
  head: isHead,
};

/**
 * name      → clip name in the GLB (stable identifier used by the app)
 * src       → [folder, file name without the m_/f_ prefix]; `m` / `f` override per set
 * loop      → designed to loop (first pose == last pose)
 * inPlace   → remove the linear root travel (x/z)
 * compose   → { base: <clip name>, layer: 'arms_head' | 'head' }: bones of `layer` come
 *             from `src`, all other bones + root from the first seconds of `base`
 * seated    → [startsSeated, endsSeated]
 */
const CLIPS = [
  // ── seated on a chair (no table) ─────────────────────────────────────────
  { name: 'sit_idle', src: [S, 'sit_chair_idle_neutral_01'], loop: true, seated: [true, true], notes: 'Long neutral seated idle, hands on the thighs.' },
  { name: 'sit_breathe', src: [S, 'sit_chair_breathe_01'], loop: true, seated: [true, true], notes: 'Seated, breathing only (calmest seated loop).' },
  { name: 'sit_look_around', src: [S, 'sit_chair_idle_look_around'], loop: false, seated: [true, true], notes: 'Seated, looks around once.' },
  { name: 'sit_thoughtful', src: [S, 'sit_chair_gestic_thoughtful'], loop: false, seated: [true, true], notes: 'Seated, thoughtful gesture.' },
  { name: 'sit_shrug', src: [S, 'sit_chair_gestic_shrug_01'], loop: false, seated: [true, true], notes: 'Seated shrug.' },
  // ── seated at a table ───────────────────────────────────────────────────
  { name: 'sit_table_idle', src: [S, 'sit_table_idle_neutral_01'], loop: true, seated: [true, true], notes: 'Seated at a table, forearms on the table top.' },
  { name: 'sit_table_look_around', src: [S, 'sit_table_idle_look_around'], loop: false, seated: [true, true], notes: 'Seated at a table, looks around once.' },
  { name: 'sit_table_thoughtful', src: [S, 'sit_table_gestic_thoughtful'], loop: false, seated: [true, true], notes: 'Seated at a table, thoughtful gesture.' },
  // ── seated talking / reacting: composed (arms + head of a standing clip over sit_idle) ──
  { name: 'sit_talk_1', src: [S, 'gestic_talk_neutral_01'], compose: { base: 'sit_idle', layer: 'arms_head' }, loop: true, seated: [true, true], notes: 'Composed: arms + head of stand_talk_1 over the seated idle.' },
  { name: 'sit_talk_2', src: [S, 'gestic_talk_neutral_02'], compose: { base: 'sit_idle', layer: 'arms_head' }, loop: true, seated: [true, true], notes: 'Composed: arms + head of stand_talk_2 over the seated idle.' },
  { name: 'sit_talk_3', src: [S, 'gestic_talk_relaxed_01'], compose: { base: 'sit_idle', layer: 'arms_head' }, loop: true, seated: [true, true], notes: 'Composed: arms + head of stand_talk_3 over the seated idle.' },
  { name: 'sit_nod', src: [S, 'gestic_listen_accept_01'], compose: { base: 'sit_idle', layer: 'head' }, loop: false, seated: [true, true], notes: 'Composed: head nod over the seated idle.' },
  { name: 'sit_head_shake', src: [S, 'gestic_listen_deny_01'], compose: { base: 'sit_idle', layer: 'head' }, loop: false, seated: [true, true], notes: 'Composed: head shake over the seated idle.' },
  // ── transitions ─────────────────────────────────────────────────────────
  { name: 'stand_to_sit', src: [XYZ, 'sit_down_chair_01'], loop: false, seated: [false, true], notes: 'Sits down on a chair behind the character (root motion backwards and down).' },
  { name: 'sit_to_stand', src: [XYZ, 'sit_stand_up_chair_01'], loop: false, seated: [true, false], notes: 'Stands up from a chair (root motion forwards and up).' },
  // ── standing ────────────────────────────────────────────────────────────
  { name: 'stand_idle', src: [S, 'idle_neutral_01'], loop: true, seated: [false, false], notes: 'Neutral standing idle.' },
  { name: 'stand_look_around', src: [S, 'idle_look_around_01'], loop: false, seated: [false, false], notes: 'Standing, looks around once.' },
  { name: 'stand_talk_1', src: [S, 'gestic_talk_neutral_01'], loop: true, seated: [false, false], notes: 'Standing, talking with neutral gestures.' },
  { name: 'stand_talk_2', src: [S, 'gestic_talk_neutral_02'], loop: true, seated: [false, false], notes: 'Standing, talking with neutral gestures (variant).' },
  { name: 'stand_talk_3', src: [S, 'gestic_talk_relaxed_01'], loop: true, seated: [false, false], notes: 'Standing, talking, relaxed.' },
  { name: 'stand_talk_angry', m: [XYZ, 'gestic_talk_angry_01'], f: [S, 'gestic_talk_angry_01'], loop: true, seated: [false, false], notes: 'Standing, talking angrily.' },
  { name: 'stand_present_left', src: [S, 'gestic_presentation_left_01'], loop: false, seated: [false, false], notes: 'Standing, presenting / pointing to the left.' },
  { name: 'stand_present_right', src: [S, 'gestic_presentation_right_01'], loop: false, seated: [false, false], notes: 'Standing, presenting / pointing to the right.' },
  { name: 'stand_listen', src: [S, 'gestic_listen_neutral_01'], loop: true, seated: [false, false], notes: 'Standing, listening attentively.' },
  { name: 'stand_nod', src: [S, 'gestic_listen_accept_01'], loop: false, seated: [false, false], notes: 'Standing, nods (agreement).' },
  { name: 'stand_head_shake', src: [S, 'gestic_listen_deny_01'], loop: false, seated: [false, false], notes: 'Standing, shakes the head (disagreement).' },
  { name: 'stand_shrug', src: [S, 'gestic_shrug_01'], loop: false, seated: [false, false], notes: 'Standing shrug.' },
  { name: 'stand_thoughtful', src: [S, 'gestic_thoughtful_01'], loop: false, seated: [false, false], notes: 'Standing, thoughtful gesture.' },
  { name: 'stand_angry', src: [S, 'idle_angry_01'], loop: true, seated: [false, false], notes: 'Standing, angry / impatient idle.' },
  { name: 'stand_wave', src: [S, 'wave_01'], loop: false, seated: [false, false], notes: 'Raises the hand and waves.' },
  { name: 'stand_write_notes', src: [S, 'documents_note'], loop: false, seated: [false, false], notes: 'Standing, writes a note on documents held in the hand.' },
  { name: 'stand_documents_take', src: [S, 'documents_take'], loop: false, seated: [false, false], notes: 'Standing, takes / hands over a document.' },
  { name: 'work_table', src: [S, 'work_table'], loop: true, seated: [false, false], notes: 'Working at a table.' },
  // ── locomotion ──────────────────────────────────────────────────────────
  { name: 'walk', src: [XY, 'walk_neutral'], loop: true, inPlace: true, seated: [false, false], notes: 'Walk cycle, made in-place (source has root motion; see inPlaceSpeed).' },
  { name: 'turn_left_90', src: [XYZ, 'turn_left_90'], loop: false, seated: [false, false], notes: 'Turn 90° to the left on the spot (root rotation).' },
  { name: 'turn_right_90', src: [XYZ, 'turn_right_90'], loop: false, seated: [false, false], notes: 'Turn 90° to the right on the spot (root rotation).' },
];

/* ─────────────────────────────── helpers ─────────────────────────────── */

/** Same rule as THREE.PropertyBinding.sanitizeNodeName (for ASCII names). */
const sanitize = (name) => name.replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');

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
    await download(`https://github.com/godotengine/FBX2glTF/releases/download/${FBX2GLTF_VERSION}/${name}.zip`, zip);
    execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
    if (process.platform !== 'win32') execFileSync('chmod', ['+x', bin]);
  }
  return bin;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// quaternion helpers ([x, y, z, w])
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => { const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), qconj(q)); return [r[0], r[1], r[2]]; };
const qdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
function nlerp(a, b, t) {
  const s = qdot(a, b) < 0 ? -1 : 1;
  const o = [0, 1, 2, 3].map((i) => a[i] * (1 - t) + s * b[i] * t);
  const l = Math.hypot(...o) || 1;
  return o.map((v) => v / l);
}
const qangleDeg = (a, b) => (2 * Math.acos(Math.min(1, Math.abs(qdot(a, b)))) * 180) / Math.PI;
const smooth = (t) => t * t * (3 - 2 * t);

/* ───────────────────────── raw clip → sampled tracks ───────────────────────── */

/**
 * Read a converted GLB and sample it at FPS.
 * @returns {{ frames: number, duration: number, rot: Map<string, Float32Array>, rootPos: Float32Array }}
 */
async function readClip(io, file, bones) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  const anim = root.listAnimations()[0];
  if (!anim) throw new Error(`no animation in ${file}`);
  const channels = new Map(); // "node|path" → { times, values, size }
  let duration = 0;
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode();
    if (!node) continue;
    const s = ch.getSampler();
    const times = s.getInput().getArray();
    channels.set(`${sanitize(node.getName())}|${ch.getTargetPath()}`, {
      times,
      values: s.getOutput().getArray(),
      size: s.getOutput().getElementSize(),
    });
    duration = Math.max(duration, times[times.length - 1]);
  }
  const frames = Math.round(duration * FPS) + 1;
  duration = (frames - 1) / FPS;
  const rest = new Map(root.listNodes().map((n) => [sanitize(n.getName()), n]));

  const sample = (key, restValue, size) => {
    const out = new Float32Array(frames * size);
    const ch = channels.get(key);
    if (!ch) {
      for (let f = 0; f < frames; f++) out.set(restValue, f * size);
      return out;
    }
    const { times, values } = ch;
    let k = 0;
    for (let f = 0; f < frames; f++) {
      const t = f / FPS;
      while (k < times.length - 2 && times[k + 1] <= t) k++;
      const t0 = times[k];
      const t1 = times[Math.min(k + 1, times.length - 1)];
      const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
      const a = Array.from(values.subarray(k * size, k * size + size));
      const k1 = Math.min(k + 1, times.length - 1);
      const b = Array.from(values.subarray(k1 * size, k1 * size + size));
      out.set(size === 4 ? nlerp(a, b, u) : a.map((v, i) => v + (b[i] - v) * u), f * size);
    }
    return out;
  };

  const rot = new Map();
  for (const name of bones) {
    const node = rest.get(name);
    if (!node) throw new Error(`${file}: bone ${name} missing`);
    const arr = sample(`${name}|rotation`, node.getRotation(), 4);
    // keep neighbouring keys in the same hemisphere
    for (let f = 1; f < frames; f++) {
      const a = arr.subarray((f - 1) * 4, f * 4);
      const b = arr.subarray(f * 4, f * 4 + 4);
      if (qdot(a, b) < 0) for (let i = 0; i < 4; i++) b[i] = -b[i];
    }
    rot.set(name, arr);
  }
  const rootPos = sample('Bip01|translation', rest.get('Bip01').getTranslation(), 3);
  return { frames, duration, rot, rootPos };
}

/**
 * Layer `layer` bones of `top` over the first seconds of `base` (blended back to its first pose at the end).
 * Arms are gesture-weighted: while an arm of `top` just hangs (close to its pose in frame 0) the arm of
 * `base` is used instead (hands resting on the thighs), so the hands never dangle through the seat.
 */
function compose(top, base, layerFn, bones) {
  const frames = top.frames;
  const blend = Math.min(Math.round(0.6 * FPS), frames - 1);
  const rot = new Map();
  const baseFrame = (f) => f % (base.frames - 1);
  const w = (f) => (f < frames - 1 - blend ? 0 : smooth((f - (frames - 1 - blend)) / blend));
  const baseQ = (name, f) => {
    const src = base.rot.get(name);
    const b = baseFrame(f) * 4;
    const q = Array.from(src.subarray(b, b + 4));
    return w(f) > 0 ? nlerp(q, Array.from(src.subarray(0, 4)), w(f)) : q;
  };
  // per-side gesture weight (0 = arm hangs → seated arm, 1 = gesturing → arm of `top`)
  const gesture = {};
  for (const side of ['L', 'R']) {
    const g = new Float32Array(frames);
    for (const bone of [`Bip01_${side}_UpperArm`, `Bip01_${side}_Forearm`]) {
      const a = top.rot.get(bone);
      for (let f = 0; f < frames; f++) g[f] = Math.max(g[f], qangleDeg(a.subarray(0, 4), a.subarray(f * 4, f * 4 + 4)));
    }
    let cur = g.map((d) => smooth(Math.min(1, Math.max(0, (d - 12) / 20))));
    const win = (r, fn) => cur.map((_, f) => fn(cur.subarray(Math.max(0, f - r), Math.min(frames, f + r + 1))));
    cur = win(Math.round(0.25 * FPS), (a) => Math.max(...a)); // start the blend before the gesture
    for (let i = 0; i < 2; i++) cur = win(Math.round(0.3 * FPS), (a) => a.reduce((x, y) => x + y, 0) / a.length);
    gesture[side] = cur;
  }
  for (const name of bones) {
    const out = new Float32Array(frames * 4);
    const t = top.rot.get(name);
    const side = isArm(name) ? name[6] : null;
    for (let f = 0; f < frames; f++) {
      let q;
      if (!layerFn(name)) q = baseQ(name, f);
      else if (side) q = nlerp(baseQ(name, f), Array.from(t.subarray(f * 4, f * 4 + 4)), gesture[side][f]);
      else q = Array.from(t.subarray(f * 4, f * 4 + 4));
      if (f > 0 && qdot(q, out.subarray((f - 1) * 4, f * 4)) < 0) q = q.map((v) => -v);
      out.set(q, f * 4);
    }
    rot.set(name, out);
  }
  const rootPos = new Float32Array(frames * 3);
  for (let f = 0; f < frames; f++) {
    const b = baseFrame(f) * 3;
    for (let i = 0; i < 3; i++) rootPos[f * 3 + i] = base.rootPos[b + i] + (base.rootPos[i] - base.rootPos[b + i]) * w(f);
  }
  return { frames, duration: top.duration, rot, rootPos };
}

/** Remove the linear x/z travel of the root. Returns the removed displacement. */
function makeInPlace(clip) {
  const n = clip.frames - 1;
  const p = clip.rootPos;
  const dx = p[n * 3] - p[0];
  const dz = p[n * 3 + 2] - p[2];
  for (let f = 0; f <= n; f++) {
    p[f * 3] -= (dx * f) / n;
    p[f * 3 + 2] -= (dz * f) / n;
  }
  return { x: dx, z: dz };
}

/* ─────────────────────────────────── main ─────────────────────────────────── */

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

console.log('LexSim animations ← Microsoft Rocketbox (MIT)');
const fbx2gltf = await ensureFbx2gltf();
const work = join(SRC, '_work', 'anim');
mkdirSync(work, { recursive: true });

const r4 = (v) => +v.toFixed(4);
const manifest = {
  generatedAt: new Date().toISOString(),
  generator: 'tools/characters/build-animations.mjs',
  source: `${REPO}/tree/master/${ANIM_DIR}`,
  license: 'MIT',
  fps: FPS,
  rootNode: 'Bip01',
  conventions: {
    units: 'metres, Y up, character faces +Z at yaw 0',
    root: 'All root translation and root rotation is keyed on the node "Bip01" (parent of the bone "Bip01_Pelvis", which sits at the same position). Every other bone only has a rotation track.',
    rootMotion: 'Displacement of Bip01 (= pelvis) between the first and the last frame, in the character\'s local space. yawDeg = change of facing direction about +Y (positive = turns to its left, towards +X).',
    pelvisHeight: 'Y of Bip01 / Bip01_Pelvis above the floor. Values are those of the rig the set was authored on (hipHeight of the set). To play a set on another rig, scale the Bip01 position track by character.hipHeight / set.hipHeight.',
  },
  sets: {},
  characters: {},
  clips: {},
};

for (const set of SETS) {
  // skeleton of the reference rig
  const rigDoc = await io.read(join(OUT, `${set.rig}.glb`));
  const rigNodes = new Map(rigDoc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const bip = rigNodes.get('Bip01');
  const bones = []; // body bones (rotation tracks), parent before child
  const parentOf = new Map();
  (function walk(n) {
    for (const c of n.listChildren()) {
      parentOf.set(c.getName(), n.getName());
      bones.push(c.getName());
      if (c.getName() !== 'Bip01_Head') walk(c); // nothing below the head (face rig)
    }
  })(bip);
  const tracked = ['Bip01', ...bones];

  // resolve sources
  const srcOf = (c) => {
    const [dir, name] = c[set.id] ?? c.src;
    return { dir, base: `${set.id}_${name}` };
  };
  const sources = new Map();
  for (const c of CLIPS) {
    const s = srcOf(c);
    sources.set(`${s.dir}/${s.base}`, s);
  }
  await pool([...sources.values()], 6, async (s) => {
    const fbx = join(SRC, 'Animations', s.dir, `${s.base}.max.fbx`);
    await download(`${RAW}/${ANIM_DIR}/${s.dir}/${encodeURIComponent(s.base)}.max.fbx`, fbx);
    const glb = join(work, `${s.base}.glb`);
    if (FORCE || !existsSync(glb)) {
      execFileSync(fbx2gltf, ['-b', '--anim-framerate', `bake${FPS}`, '-i', fbx, '-o', join(work, s.base)], { stdio: 'pipe' });
    }
  });

  // sample
  const sampled = new Map();
  const read = async (s) => {
    const key = `${s.dir}/${s.base}`;
    if (!sampled.has(key)) sampled.set(key, await readClip(io, join(work, `${s.base}.glb`), tracked));
    return sampled.get(key);
  };
  const built = new Map();
  for (const c of CLIPS) {
    const s = srcOf(c);
    let clip = await read(s);
    // copy: sources are shared between clips
    clip = { ...clip, rot: new Map([...clip.rot].map(([k, v]) => [k, v.slice()])), rootPos: clip.rootPos.slice() };
    if (c.compose) {
      const baseClip = built.get(c.compose.base);
      if (!baseClip) throw new Error(`compose base ${c.compose.base} must be listed before ${c.name}`);
      clip = compose(clip, baseClip, LAYERS[c.compose.layer], tracked);
    }
    const removed = c.inPlace ? makeInPlace(clip) : null;
    built.set(c.name, clip);
    clip.meta = { source: `${s.dir}/${s.base}.max.fbx`, removed };
  }

  // ── write the document ──
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene(`anims_${set.id}`);
  const nodes = new Map();
  const rootNode = doc.createNode('RootNode');
  scene.addChild(rootNode);
  for (const name of tracked) {
    const src = rigNodes.get(name);
    const n = doc.createNode(name).setTranslation(src.getTranslation()).setRotation(src.getRotation());
    nodes.set(name, n);
    (name === 'Bip01' ? rootNode : nodes.get(parentOf.get(name))).addChild(n);
  }
  doc.getRoot().getAsset().generator = 'FBX2glTF + glTF-Transform (LexSim animation pipeline)';
  doc.getRoot().getAsset().copyright = 'Microsoft Rocketbox Avatar Library, © 2020 Microsoft, MIT License';

  const hipHeight = bip.getTranslation()[1];
  const restRootRot = bip.getRotation();
  const yawOf = (q) => {
    const fwd = qrot(qmul(q, qconj(restRootRot)), [0, 0, 1]);
    return (Math.atan2(fwd[0], fwd[2]) * 180) / Math.PI;
  };

  for (const c of CLIPS) {
    const clip = built.get(c.name);
    const { frames, duration } = clip;
    const anim = doc.createAnimation(c.name);
    const times = new Float32Array(frames);
    for (let f = 0; f < frames; f++) times[f] = f / FPS;
    const input = doc.createAccessor().setType('SCALAR').setArray(times);
    const input2 = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, duration]));
    const add = (name, path, arr, size) => {
      // constant track → 2 keys
      let constant = true;
      for (let i = size; i < arr.length && constant; i++) if (Math.abs(arr[i] - arr[i % size]) > 2e-5) constant = false;
      const values = constant ? new Float32Array([...arr.subarray(0, size), ...arr.subarray(0, size)]) : arr;
      const output = doc.createAccessor().setType(size === 4 ? 'VEC4' : 'VEC3').setArray(values);
      const sampler = doc.createAnimationSampler().setInput(constant ? input2 : input).setOutput(output).setInterpolation('LINEAR');
      anim.addSampler(sampler);
      anim.addChannel(doc.createAnimationChannel().setTargetNode(nodes.get(name)).setTargetPath(path).setSampler(sampler));
    };
    add('Bip01', 'translation', clip.rootPos, 3);
    for (const name of tracked) add(name, 'rotation', clip.rot.get(name), 4);

    // manifest
    const p = clip.rootPos;
    const n = frames - 1;
    const rootRot = clip.rot.get('Bip01');
    const q0 = Array.from(rootRot.subarray(0, 4));
    const q1 = Array.from(rootRot.subarray(n * 4, n * 4 + 4));
    let yaw = yawOf(q1) - yawOf(q0);
    yaw = ((yaw + 540) % 360) - 180;
    let jump = 0, jumpBone = '';
    for (const name of tracked) {
      const a = clip.rot.get(name);
      for (let f = 1; f < frames; f++) {
        const d = qangleDeg(a.subarray((f - 1) * 4, f * 4), a.subarray(f * 4, f * 4 + 4));
        if (d > jump) { jump = d; jumpBone = `${name}@${f}`; }
      }
    }
    if (jump > 25) console.log(`    note ${set.id}/${c.name}: fastest rotation ${jump.toFixed(1)}°/frame (${jumpBone})`);
    let seam = 0;
    for (const name of tracked) {
      const a = clip.rot.get(name);
      seam = Math.max(seam, qangleDeg(a.subarray(0, 4), a.subarray(n * 4, n * 4 + 4)));
    }
    const entry = {
      file: set.file,
      source: clip.meta.source,
      duration: r4(duration),
      frames,
      loop: c.loop,
      rootMotion: { x: r4(p[n * 3] - p[0]), y: r4(p[n * 3 + 1] - p[1]), z: r4(p[n * 3 + 2] - p[2]), yawDeg: +yaw.toFixed(1) },
      startsSeated: c.seated[0],
      endsSeated: c.seated[1],
      pelvisHeightStart: r4(p[1]),
      pelvisHeightEnd: r4(p[n * 3 + 1]),
      loopSeamDeg: +seam.toFixed(2),
      notes: c.notes,
    };
    if (clip.meta.removed) {
      const d = Math.hypot(clip.meta.removed.x, clip.meta.removed.z);
      entry.inPlace = true;
      entry.inPlaceTravel = { x: r4(clip.meta.removed.x), z: r4(clip.meta.removed.z) };
      entry.inPlaceSpeed = r4(d / duration);
    }
    if (c.compose) entry.composedFrom = { base: c.compose.base, layer: c.compose.layer };
    (manifest.clips[c.name] ??= {})[set.id] = entry;
  }

  await doc.transform(dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const out = join(OUT, set.file);
  await io.write(out, doc);
  const bytes = statSync(out).size;
  const total = CLIPS.reduce((a, c) => a + built.get(c.name).duration, 0);
  manifest.sets[set.id] = {
    file: set.file,
    description: set.label,
    authoredOnRig: set.rig,
    hipHeight: r4(hipHeight),
    bytes,
    clips: CLIPS.length,
    tracksPerClip: tracked.length + 1,
  };
  console.log(`  ${set.file}  ${CLIPS.length} clips  ${total.toFixed(1)} s  ${(bytes / 1048576).toFixed(2)} MB`);
}

for (const id of ['elder_man', 'woman', 'man']) {
  const f = join(OUT, `${id}.glb`);
  if (!existsSync(f)) continue;
  const d = await io.read(f);
  const bip = d.getRoot().listNodes().find((n) => n.getName() === 'Bip01');
  const female = Math.abs(bip.getTranslation()[1] - manifest.sets.f.hipHeight) < Math.abs(bip.getTranslation()[1] - manifest.sets.m.hipHeight);
  manifest.characters[id] = { file: `${id}.glb`, hipHeight: r4(bip.getTranslation()[1]), nativeSet: female ? 'f' : 'm' };
}

// optional hand-measured block (chair geometry etc.), kept across rebuilds
const measuredFile = join(dirname(fileURLToPath(import.meta.url)), 'anims-measured.json');
if (existsSync(measuredFile)) manifest.measured = JSON.parse(readFileSync(measuredFile, 'utf8'));

writeFileSync(join(OUT, 'anims.json'), JSON.stringify(manifest, null, 2));

// LICENSES.json: keep everything else, replace the animation entries
const licFile = join(OUT, 'LICENSES.json');
const lic = existsSync(licFile) ? JSON.parse(readFileSync(licFile, 'utf8')) : { assets: [] };
lic.assets = lic.assets.filter((a) => !/^anims(_[mf])?\.(glb|json)$/.test(a.file));
for (const set of SETS) {
  lic.assets.push({
    file: set.file,
    description: `Body animation clips, ${set.label}`,
    name: 'Microsoft Rocketbox Avatar Library: Animations',
    author: 'Microsoft (original animations by Rocketbox Studios)',
    license: 'MIT',
    licenseUrl: `${REPO}/blob/master/LICENSE.md`,
    source: `${REPO}/tree/master/${ANIM_DIR}`,
    sourceFiles: CLIPS.map((c) => {
      const [dir, name] = c[set.id] ?? c.src;
      return `${RAW}/${ANIM_DIR}/${dir}/${set.id}_${name}.max.fbx`;
    }).filter((v, i, a) => a.indexOf(v) === i),
    attribution: `Animations from the Microsoft Rocketbox Avatar Library, Copyright (c) 2020 Microsoft, MIT License. ${REPO}`,
    modifications:
      'Converted FBX to glTF (FBX2glTF, 30 fps), meshes removed, bone position tracks and face-bone tracks removed, clips renamed, walk cycle made in-place, seated talking clips composed from standing gestures and the seated idle, Meshopt compression.',
    bytes: manifest.sets[set.id].bytes,
  });
}
if (!lic.licenseText) lic.licenseText = await (await fetch(`${RAW}/LICENSE.md`, { headers: { 'User-Agent': UA } })).text();
lic.animationsGeneratedAt = manifest.generatedAt;
writeFileSync(licFile, JSON.stringify(lic, null, 2));
console.log('done → public/assets/characters/{anims_m.glb, anims_f.glb, anims.json, LICENSES.json}');
