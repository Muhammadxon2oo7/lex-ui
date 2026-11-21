'use client';
/**
 * Seated citizen - realistic rigged avatar (Microsoft Rocketbox, MIT) driven
 * entirely by code: no baked clips.
 *
 * Every frame the skeleton and the ARKit-style face morphs are composed from
 *  (a) the server-driven emotion (allow-listed enum + intensity),
 *  (b) one-shot gestures (allow-listed enum),
 *  (c) always-on life signs: breathing, blinking, gaze, weight shifts, speech.
 *
 * The backend decides WHAT the character feels; this file decides how that
 * looks. Bone conventions (measured on the rig): limb bones point along
 * local +X; legs/elbows bend around local Z; for spine/neck/head +X is yaw
 * to the character's left, +Z pitches forward, Y rolls.
 */
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Emotion, Gesture } from '@/contracts';
import { JAW, VISEMES, sampleTrack, type Viseme } from '@/lib/visemes';
import { accent, beats, breath, cueBlink, eyes, rng, stepEyes, type Beat } from '@/lib/liveliness';
import { useGame } from '@/game/store';
import { speech } from '@/game/voice';
import { audio } from '@/game/audio';

export type CharacterModel = 'elder_man' | 'woman' | 'man' | 'worker' | 'secretary' | 'lawyer' | 'client' | 'clerk' | 'investigator' | 'chief';
/** Female body type: its own rig proportions, recorded takes and seat travel. */
export const female = (model: CharacterModel) => model === 'woman' || model === 'secretary' || model === 'lawyer' || model === 'clerk';
const url = (model: CharacterModel) => `/assets/characters/${model}.glb`;
/** Motion-captured clips (Rocketbox, MIT), authored on each body type's own rig. */
/** Fetch a cast ahead of time, so nobody's model loads in the middle of a scene. */
export function preloadCast(models: CharacterModel[]) {
  for (const m of models) {
    useGLTF.preload(url(m));
    useGLTF.preload(animUrl(m));
  }
}
const animUrl = (model: CharacterModel) => `/assets/characters/${female(model) ? 'anims_f' : 'anims_m'}.glb`;
(['elder_man', 'woman', 'man'] as const).forEach((m) => {
  useGLTF.preload(url(m));
  useGLTF.preload(animUrl(m));
});

/**
 * Travel of the recorded transitions along the character's forward axis
 * (anims.json rootMotion.z) and the in-place walk speed of each set.
 */
const RISE = {
  m: { riseZ: 0.4229, lowerZ: 0.4606, walkSpeed: 1.4024 },
  f: { riseZ: 0.4007, lowerZ: 0.4534, walkSpeed: 1.2946 },
};

/** Seat height the recorded sitting takes assume (buttocks underside), per rig. */
const SEAT_OFFSET: Record<CharacterModel, number> = { elder_man: -0.454, man: -0.469, woman: -0.47, worker: -0.462, secretary: -0.47, lawyer: -0.47, client: -0.465, clerk: -0.47, investigator: -0.465, chief: -0.46 };

type V3 = [number, number, number];
/** Resting seated pose: thighs forward, shins down, hands on the lap. */
const SEATED: Record<string, V3> = {
  Bip01_L_Thigh: [0.2, 0, 1.53],
  Bip01_R_Thigh: [-0.2, 0, 1.53],
  Bip01_L_Calf: [0, 0, -1.45],
  Bip01_R_Calf: [0, 0, -1.45],
  Bip01_L_UpperArm: [0, 0.68, -0.25],
  Bip01_R_UpperArm: [0, -0.68, -0.25],
  Bip01_L_Forearm: [0.5, 0, -0.6],
  Bip01_R_Forearm: [-0.5, 0, -0.6],
};
const DRIVEN = [...Object.keys(SEATED), 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_Neck', 'Bip01_Head', 'Bip01_L_Hand', 'Bip01_R_Hand'] as const;

interface Pose {
  browDown: number;
  browUp: number;
  browTilt: number; // one brow higher (confusion)
  frown: number;
  smile: number;
  squint: number;
  lean: number; // spine pitch, + forward
  headPitch: number;
  headRoll: number;
  fidget: number; // 0..1 restless leg / fingers
  // FACS-based detail (the meshes carry the full ARKit 52 set)
  cheek: number; // cheek raiser - a felt (Duchenne) smile reaches the eyes
  sneer: number; // nose wrinkle - irritation, contempt
  press: number; // lips pressed - tension, holding back
  shrug: number; // lower lip pushed up - doubt
  wide: number; // upper lids raised - alarm, attention
}

const POSES: Record<Emotion, Pose> = {
  neutral: { browDown: 0.1, browUp: 0, browTilt: 0, frown: 0.15, smile: 0, squint: 0, lean: 0.03, headPitch: 0, headRoll: 0, fidget: 0.15, cheek: 0, sneer: 0, press: 0.06, shrug: 0, wide: 0 },
  impatient: { browDown: 0.55, browUp: 0, browTilt: 0, frown: 0.4, smile: 0, squint: 0.25, lean: 0.09, headPitch: 0.03, headRoll: 0, fidget: 1, cheek: 0, sneer: 0.12, press: 0.38, shrug: 0, wide: 0 },
  upset: { browDown: 1, browUp: 0, browTilt: 0, frown: 0.8, smile: 0, squint: 0.5, lean: 0.15, headPitch: 0.06, headRoll: 0, fidget: 0.7, cheek: 0, sneer: 0.32, press: 0.42, shrug: 0, wide: 0 },
  confused: { browDown: 0.2, browUp: 0.4, browTilt: 1, frown: 0.2, smile: 0, squint: 0.15, lean: 0.02, headPitch: 0, headRoll: 0.14, fidget: 0.2, cheek: 0, sneer: 0, press: 0, shrug: 0.28, wide: 0.12 },
  uncertain: { browDown: 0, browUp: 0.8, browTilt: 0.2, frown: 0.3, smile: 0, squint: 0, lean: -0.02, headPitch: 0.12, headRoll: 0.05, fidget: 0.4, cheek: 0, sneer: 0, press: 0.18, shrug: 0.38, wide: 0.08 },
  calm: { browDown: 0, browUp: 0.1, browTilt: 0, frown: 0, smile: 0.12, squint: 0, lean: -0.02, headPitch: -0.02, headRoll: 0, fidget: 0, cheek: 0.1, sneer: 0, press: 0, shrug: 0, wide: 0 },
  reassured: { browDown: 0, browUp: 0.25, browTilt: 0, frown: 0, smile: 0.4, squint: 0.1, lean: -0.04, headPitch: -0.03, headRoll: 0.03, fidget: 0, cheek: 0.36, sneer: 0, press: 0, shrug: 0, wide: 0.04 },
};

/** Gesture length in seconds. */
const DURATION: Record<Gesture, number> = {
  none: 0, nod: 1.3, 'shake-head': 1.5, sigh: 2.4, 'lean-in': 2.8, 'check-watch': 3,
  'show-phone': 4.4, 'offer-envelope': 2.6, 'withdraw-envelope': 2.2, stand: 1.6,
};

const damp = THREE.MathUtils.damp;
const clamp = THREE.MathUtils.clamp;
/** 0 → 1 → 0 envelope with eased attack and release. */
const envelope = (t: number, attack = 0.25, release = 0.3) =>
  THREE.MathUtils.smoothstep(t, 0, attack) * (1 - THREE.MathUtils.smoothstep(t, 1 - release, 1));

const _local = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _q2 = new THREE.Quaternion();

/**
 * Chust doʻppi: black, four-sided, white "qalampir" (pepper) motifs on each
 * side. Built in the head bone's frame (local +X points up out of the head).
 */
let doppiMaterials: THREE.Material[] | null = null;
function makeDoppi(): THREE.Group {
  if (!doppiMaterials) {
    const side = document.createElement('canvas');
    side.width = 256;
    side.height = 128;
    const c = side.getContext('2d')!;
    c.fillStyle = '#121214';
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#ece8dc';
    // the pepper motif: a curved almond with a small hook, one per face
    c.save();
    c.translate(128, 70);
    c.rotate(-0.5);
    c.beginPath();
    c.ellipse(0, 0, 54, 20, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#121214';
    c.beginPath();
    c.ellipse(4, 0, 40, 11, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ece8dc';
    c.beginPath();
    c.arc(-58, -10, 8, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.fillStyle = '#ece8dc';
    c.fillRect(0, 118, 256, 4);
    const tex = new THREE.CanvasTexture(side);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sides = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const top = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.85 });
    doppiMaterials = [sides, top, top];
  }
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.1, 0.065, 4, 1, false, Math.PI / 4), doppiMaterials);
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

/** Morph-target names on the Rocketbox heads (Oculus viseme set; note KK in capitals). */
const VISEME_MORPH: Record<Viseme, string> = Object.fromEntries(VISEMES.map((v) => [v, v === 'kk' ? 'viseme_KK' : v === 'sil' ? 'viseme_Sil' : `viseme_${v}`])) as Record<Viseme, string>;

// judges of general courts wear a very dark navy mantle (Senate resolution, Oct 2019): a short cape over
// the shoulders, wide sleeves with white national embroidery on the cuffs, a white shirt-front
const mantleMaterial = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.8, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#26304a') });
const MANTLE = new THREE.Color('#0d111c');
const CUFF = new THREE.Color('#cfd3dc');
const STITCH = new THREE.Color('#f4f5f7');
const SHIRT_FRONT = new THREE.Color('#eceae4');
const capeMaterial = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.8, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#26304a'), side: THREE.DoubleSide });
const badgeMaterial = new THREE.MeshStandardMaterial({ color: '#c9a24f', metalness: 0.85, roughness: 0.3 });

/** Bone that carries most of vertex i, and the vertex's position, read once. */
function readBody(src: THREE.SkinnedMesh) {
  const geo = src.geometry;
  const pos = geo.getAttribute('position');
  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  const names = src.skeleton.bones.map((b) => b.name);
  const n = pos.count;
  const dominant: string[] = new Array(n);
  const at: THREE.Vector3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    dominant[i] = names[si.getComponent(i, best)] ?? '';
    at[i] = new THREE.Vector3().fromBufferAttribute(pos, i);
  }
  const mean = (re: RegExp) => {
    const m = new THREE.Vector3();
    let c = 0;
    for (let i = 0; i < n; i++) if (re.test(dominant[i])) { m.add(at[i]); c++; }
    return c ? m.divideScalar(c) : null;
  };
  return { n, dominant, at, mean, si, sw };
}

/**
 * The short cape over the shoulders (with its stand collar) and the round
 * gilt badge at the neck. The cape is built round the body in the bind pose,
 * never closer than the clothes beneath it, and every point is skinned like
 * the nearest points of the body - so it lies over the shoulders and follows
 * the arms down instead of being pierced by them.
 */
function makeCape(src: THREE.SkinnedMesh, unit: number): THREE.SkinnedMesh[] {
  const b = readBody(src);
  const neck = b.mean(/Neck/), calf = b.mean(/Calf/), foot = b.mean(/Foot/), toe = b.mean(/Toe/);
  if (!neck || !calf || !foot || !toe) return [];
  const U = neck.clone().sub(calf).normalize();
  const F = toe.clone().sub(foot);
  F.addScaledVector(U, -F.dot(U)).normalize();
  const R = new THREE.Vector3().crossVectors(U, F).normalize();
  const M = unit; // local units per metre
  // body samples round the trunk, in cylinder co-ordinates about the neck axis
  const trunk: { h: number; th: number; rho: number }[] = [];
  let neckR = 0;
  let shoulder = 0;
  const d = new THREE.Vector3();
  for (let i = 0; i < b.n; i++) {
    const name = b.dominant[i];
    if (!/Spine|Neck|Clavicle|Pelvis|UpperArm/.test(name)) continue;
    d.copy(b.at[i]).sub(neck);
    const h = d.dot(U) / M, x = d.dot(R) / M, z = d.dot(F) / M;
    const rho = Math.hypot(x, z);
    if (/Neck/.test(name)) neckR = Math.max(neckR, rho);
    if (/Clavicle/.test(name)) shoulder = Math.max(shoulder, Math.abs(x));
    if (/UpperArm/.test(name) && Math.abs(x) > shoulder + 0.06) continue; // a T-posed arm is not the trunk
    trunk.push({ h, th: Math.atan2(z, x), rho });
  }
  neckR = Math.min(Math.max(neckR, 0.055), 0.08);
  shoulder = Math.min(Math.max(shoulder, 0.14), 0.22);
  const base = -0.06; // the root of the neck, below the neck bone's centroid
  const SEG = 64;
  // two rings of stand collar (lower at the front, under the chin), then the cape falling to mid-chest
  const levels = [base + 0.035, base + 0.0, base - 0.025, base - 0.055, base - 0.09, base - 0.125, base - 0.16, base - 0.195, base - 0.23, base - 0.26];
  const clear = (h: number, th: number) => {
    let m = 0;
    for (const t of trunk) {
      if (Math.abs(t.h - h) > 0.035) continue;
      const dt = Math.abs(THREE.MathUtils.euclideanModulo(t.th - th + Math.PI, Math.PI * 2) - Math.PI);
      if (dt < 0.28 && t.rho > m) m = t.rho;
    }
    return m;
  };
  const radii: number[][] = levels.map((h, k) => {
    const t = k < 2 ? 0 : (k - 1) / (levels.length - 2);
    const ease = 1 - Math.pow(1 - t, 2.4);
    const a = k < 2 ? neckR + 0.012 : neckR + 0.01 + (shoulder + 0.04 - neckR) * ease;
    const c = k < 2 ? neckR + 0.012 : neckR + 0.01 + (0.13 - neckR) * ease;
    const raw = Array.from({ length: SEG }, (_, j) => {
      const th = (j / SEG) * Math.PI * 2;
      const e = (a * c) / Math.hypot(c * Math.cos(th), a * Math.sin(th));
      // over the mantle beneath (which stands ~3 cm off the clothes), never through it
      return Math.max(e, clear(h, th) + (k < 2 ? 0.022 : 0.042));
    });
    // cloth has no corners: widen by the neighbours' maximum, then soften round the ring
    const peak = raw.map((_, j) => Math.max(raw[(j + SEG - 1) % SEG], raw[j], raw[(j + 1) % SEG]));
    return peak.map((_, j) => {
      let sum = 0;
      for (let o = -4; o <= 4; o++) sum += peak[(j + o + SEG) % SEG];
      return sum / 9;
    });
  });
  // a cape only ever falls outward
  for (let k = 3; k < levels.length; k++) for (let j = 0; j < SEG; j++) radii[k][j] = Math.max(radii[k][j], radii[k - 1][j]);
  const verts: THREE.Vector3[] = [];
  levels.forEach((h, k) => {
    for (let j = 0; j < SEG; j++) {
      const th = (j / SEG) * Math.PI * 2;
      const front = Math.max(0, Math.sin(th)) ** 2;
      const hh = k === 0 ? h - 0.035 * front : h; // the collar dips at the front
      const r = radii[k][j];
      verts.push(neck.clone().addScaledVector(U, hh * M).addScaledVector(R, Math.cos(th) * r * M).addScaledVector(F, Math.sin(th) * r * M));
    }
  });
  // skin each point like its nearest body points (inverse-distance blend of the six closest)
  const skin = (v: THREE.Vector3) => {
    const near: { i: number; d: number }[] = [];
    for (let i = 0; i < b.n; i++) {
      if (/Hand|Finger|Head|Foot|Toe|Calf|Thigh/.test(b.dominant[i])) continue;
      const dd = b.at[i].distanceToSquared(v);
      if (near.length < 6 || dd < near[5].d) {
        near.push({ i, d: dd });
        near.sort((x, y) => x.d - y.d);
        if (near.length > 6) near.pop();
      }
    }
    const acc = new Map<number, number>();
    for (const { i, d: dd } of near) {
      const w = 1 / (Math.sqrt(dd) + 1e-6);
      for (let k = 0; k < 4; k++) {
        const bw = b.sw.getComponent(i, k);
        if (bw > 0) acc.set(b.si.getComponent(i, k), (acc.get(b.si.getComponent(i, k)) ?? 0) + bw * w);
      }
    }
    const top = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const sum = top.reduce((s2, [, w]) => s2 + w, 0) || 1;
    return { idx: [0, 1, 2, 3].map((k) => top[k]?.[0] ?? 0), w: [0, 1, 2, 3].map((k) => (top[k]?.[1] ?? 0) / sum) };
  };
  const build = (points: THREE.Vector3[], index: number[], color: THREE.Color | null) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap((v) => [v.x, v.y, v.z]), 3));
    const sIdx: number[] = [], sW: number[] = [];
    for (const v of points) {
      const k = skin(v);
      sIdx.push(...k.idx);
      sW.push(...k.w);
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sW, 4));
    if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(points.flatMap(() => [color.r, color.g, color.b]), 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  };
  const index: number[] = [];
  for (let k = 0; k < levels.length - 1; k++)
    for (let j = 0; j < SEG; j++) {
      const a0 = k * SEG + j, a1 = k * SEG + ((j + 1) % SEG), b0 = a0 + SEG, b1 = a1 + SEG;
      index.push(a0, b0, a1, a1, b0, b1);
    }
  const cape = new THREE.SkinnedMesh(build(verts, index, MANTLE), capeMaterial);
  cape.name = 'MantleCape';
  // the badge: a gilt disc on the cape just under the collar, facing forward
  const centre = verts[3 * SEG + SEG / 4].clone().addScaledVector(F, 0.006 * M).addScaledVector(U, 0.008 * M);
  const disc = [centre.clone().addScaledVector(F, 0.004 * M)];
  const discIdx: number[] = [];
  for (let j = 0; j < 28; j++) {
    const th = (j / 28) * Math.PI * 2;
    disc.push(centre.clone().addScaledVector(R, Math.cos(th) * 0.028 * M).addScaledVector(U, Math.sin(th) * 0.028 * M));
    discIdx.push(0, 1 + j, 1 + ((j + 1) % 28));
  }
  const badge = new THREE.SkinnedMesh(build(disc, discIdx, null), badgeMaterial);
  badge.name = 'MantleBadge';
  return [cape, badge].map((mesh) => {
    mesh.position.copy(src.position);
    mesh.quaternion.copy(src.quaternion);
    mesh.scale.copy(src.scale);
    mesh.bind(src.skeleton, src.bindMatrix);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    src.parent!.add(mesh);
    return mesh;
  });
}

/**
 * A judge's mantle, built from the body mesh itself so it is skinned to the
 * same skeleton and follows every recorded movement (walking, sitting,
 * gesturing). Hands and shoes are left out; the cloth stands off the clothes
 * - a little at the shoulders, more at the sleeves and the skirt, where a
 * mantle hangs loose.
 */
function makeMantle(scene: THREE.Object3D): THREE.SkinnedMesh | null {
  let body: THREE.SkinnedMesh | null = null;
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.name.toLowerCase().includes('body')) body = o as THREE.SkinnedMesh;
  });
  if (!body) return null;
  const src = body as THREE.SkinnedMesh;
  scene.updateMatrixWorld(true);
  const geo = src.geometry;
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  if (!pos || !nor || !si || !sw) return null;
  const bones = src.skeleton.bones.map((b) => b.name);
  // local units → metres (meshopt quantisation folds a scale into the bind matrix)
  const unit = 1 / new THREE.Vector3().setFromMatrixScale(src.bindMatrix).x;
  const n = pos.count;
  const position = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const dominant: string[] = new Array(n);
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  // each wrist: the centre of that hand's points (fingers included, so ~7 cm past the wrist)
  const read = readBody(src);
  const handOf = { L: read.mean(/[ _]L[ _](Hand|Finger)/), R: read.mean(/[ _]R[ _](Hand|Finger)/) };
  const fromHand = (i: number, name: string) => {
    const h = /[ _]L[ _]/.test(name) ? handOf.L : /[ _]R[ _]/.test(name) ? handOf.R : null;
    return h ? read.at[i].distanceTo(h) / unit : Infinity;
  };
  for (let i = 0; i < n; i++) {
    let best = 0;
    for (let k = 0; k < 4; k++) {
      skinIndex[i * 4 + k] = si.getComponent(i, k);
      skinWeight[i * 4 + k] = sw.getComponent(i, k);
      if (skinWeight[i * 4 + k] > skinWeight[i * 4 + best]) best = k;
    }
    const name = bones[skinIndex[i * 4 + best]] ?? '';
    dominant[i] = name;
    // the cape stands off the shoulders, sleeves and skirt hang loose
    // sleeves widen toward the cuff (a mantle's sleeves are wide and open)
    const loose = /Thigh|Calf/.test(name) ? 0.034 : /Forearm/.test(name) ? 0.03 + 0.035 * THREE.MathUtils.clamp(1 - (fromHand(i, name) - 0.08) / 0.2, 0, 1) : /Clavicle|UpperArm/.test(name) ? 0.03 : /Spine2|Spine3/.test(name) ? 0.022 : 0.011;
    p.fromBufferAttribute(pos, i);
    q.fromBufferAttribute(nor, i).normalize();
    p.addScaledVector(q, loose * unit);
    position.set([p.x, p.y, p.z], i * 3);
    normal.set([q.x, q.y, q.z], i * 3);
  }
  const bare = (i: number) => /Hand|Finger|Foot|Toe/.test(dominant[i]);
  // per-vertex colour: navy; the embroidered cuff where the sleeve meets the hand; the shirt-front at the neck
  const colors = new Float32Array(n * 3);
  const handIdx = new Set(bones.map((b, k) => (/Hand|Finger/.test(b) ? k : -1)).filter((k) => k >= 0));
  for (let i = 0; i < n; i++) {
    let handW = 0;
    for (let k = 0; k < 4; k++) if (handIdx.has(skinIndex[i * 4 + k])) handW += skinWeight[i * 4 + k];
    const front = normal[i * 3 + 2] > 0.55 || normal[i * 3 + 1] > 0.55; // facing forward in the rest pose
    // the embroidered band: ~10 cm of white national pattern round each cuff
    const cuff = /Forearm/.test(dominant[i]) ? fromHand(i, dominant[i]) : Infinity;
    const band = handW > 0.08 || cuff < 0.175;
    const edge = cuff < 0.095 || (cuff > 0.155 && cuff < 0.175);
    const motif = Math.sin(position[i * 3] / unit * 260) * Math.sin(position[i * 3 + 1] / unit * 260 + position[i * 3 + 2] / unit * 180) > 0.1;
    const c = band ? (edge || motif ? STITCH : CUFF) : /Neck/.test(dominant[i]) && front ? SHIRT_FRONT : MANTLE;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const index: number[] = [];
  const tri = geo.index;
  const count = tri ? tri.count : n;
  for (let t = 0; t < count; t += 3) {
    const a = tri ? tri.getX(t) : t, b = tri ? tri.getX(t + 1) : t + 1, c = tri ? tri.getX(t + 2) : t + 2;
    if (!bare(a) && !bare(b) && !bare(c)) index.push(a, b, c);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  out.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  out.setIndex(index);
  const mantle = new THREE.SkinnedMesh(out, mantleMaterial);
  mantle.name = 'Mantle';
  mantle.position.copy(src.position);
  mantle.quaternion.copy(src.quaternion);
  mantle.scale.copy(src.scale);
  mantle.bind(src.skeleton, src.bindMatrix);
  mantle.castShadow = mantle.receiveShadow = true;
  mantle.frustumCulled = false;
  src.parent!.add(mantle);
  mantle.userData.extras = makeCape(src, unit);
  return mantle;
}

/**
 * Cheap skin: MeshPhysical with a faint warm sheen (light scattering at grazing
 * angles, as on real skin) and a little less specular. One conversion per source
 * material, shared by every clone.
 */
const skins = new WeakMap<THREE.Material, THREE.Material>();
function skinOf(src: THREE.MeshStandardMaterial): THREE.Material {
  const hit = skins.get(src);
  if (hit) return hit;
  if (!(src as THREE.MeshStandardMaterial).isMeshStandardMaterial || src.transparent || src.alphaTest > 0) return src;
  const m = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(m, src);
  m.sheen = 0.35;
  m.sheenRoughness = 0.55;
  m.sheenColor = new THREE.Color('#ffc2a8');
  m.specularIntensity = 0.55;
  m.roughness = Math.max(src.roughness, 0.55);
  skins.set(src, m);
  return m;
}

const phoneMaterial = new THREE.MeshStandardMaterial({ color: '#0b0c0f', roughness: 0.25, emissive: '#6f8fc8', emissiveIntensity: 0.5 });

interface Props {
  model: CharacterModel;
  position: [number, number, number];
  rotation: number;
  /** Height of the seat surface the character sits on. */
  seatTop: number;
  /** The scenario NPC reads emotion / gestures / speech from the store. */
  driven?: boolean;
  /** Ambient extras get a fixed mood and occasional autonomous gestures. */
  mood?: Emotion;
  seed?: number;
  /** For characters outside the desk simulation: are they the one speaking right now? */
  talking?: boolean;
  /** World point to look at (defaults to idle glances). */
  lookAt?: [number, number, number];
  /** Chust-style skullcap (doʻppi), as older Uzbek men commonly wear. */
  doppi?: boolean;
  /** Rise from the chair (recorded sit-to-stand), stay on one's feet, sit back down when false. */
  standing?: boolean;
  /**
   * Route out of the room (world x/z). The scenario NPC stands, turns and
   * walks it when the appointment is over, then is gone.
   */
  exitPath?: [number, number][];
  /**
   * Walk in instead of appearing: from the first point, through the rest,
   * to the spot in front of the seat; then turn and stand (or sit down).
   */
  enterPath?: [number, number][];
  /** Walk out along `exitPath` now (for characters not driven by the desk store). */
  leave?: boolean;
  /** A judge's black mantle over the clothes. */
  robe?: boolean;
  /** A gesture that belongs to what is being said right now (new `id` = play it once). */
  cue?: { id: string; clip: Gesture } | null;
  /** Seated at a desk with hands on it, working (a clerk keeping the record) instead of the plain chair idle. */
  atWork?: boolean;
  /**
   * Waiting-room behaviour: now and then checks the watch, sighs, looks round
   * the hall. Right for extras; wrong for someone in a conversation with you.
   */
  restless?: boolean;
  /** The student's own body seen from inside: the head and hair are not drawn. */
  firstPerson?: boolean;
  /** Receives the root's world position every frame (doors, cameras follow it). */
  track?: { current: THREE.Vector3 };
  /** Sit up straighter than the recording (radians of spine/neck correction). */
  upright?: number;
}

export function Character({ model, position, rotation, seatTop, driven = false, mood = 'neutral', seed = 1, talking = false, lookAt, doppi = false, standing = false, exitPath, enterPath, leave = false, robe = false, cue = null, atWork = false, restless = true, firstPerson = false, track, upright = 0 }: Props) {
  const live = useRef({ talking, lookAt, standing, exitPath, leave, cue });
  useEffect(() => {
    live.current = { talking, lookAt, standing, exitPath, leave, cue };
  }, [talking, lookAt, standing, exitPath, leave, cue]);
  // where an arriving character's body ends up: in front of the seat, by the recorded rise travel
  const [arrival] = useState(() => {
    if (!enterPath?.length) return null;
    const travel = female(model) ? RISE.f : RISE.m;
    return { path: enterPath, spot: [position[0] + Math.sin(rotation) * travel.riseZ, position[2] + Math.cos(rotation) * travel.riseZ] as [number, number] };
  });
  // The root is placed once; afterwards it is moved only by walking (a re-render must not snap it back).
  // An arriving character starts at the beginning of its route, facing along it - never at the seat.
  const [placed] = useState(() => {
    if (enterPath && enterPath.length) {
      const [a, b = enterPath[0]] = enterPath;
      const yaw = b[0] === a[0] && b[1] === a[1] ? rotation : Math.atan2(b[0] - a[0], b[1] - a[1]);
      return { position: [a[0], position[1], a[1]] as [number, number, number], rotation: [0, yaw, 0] as [number, number, number] };
    }
    return { position, rotation: [0, rotation, 0] as [number, number, number] };
  });
  const gltf = useGLTF(url(model));
  const takes = useGLTF(animUrl(model)).animations;
  const root = useRef<THREE.Group>(null);

  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
    const bones: Record<string, THREE.Bone> = {};
    const rest: Record<string, THREE.Quaternion> = {};
    const faces: THREE.SkinnedMesh[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        bones[o.name] = o as THREE.Bone;
        rest[o.name] = o.quaternion.clone();
      }
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        mesh.castShadow = mesh.receiveShadow = true;
        // alpha-tested hair cards: with MSAA, alpha-to-coverage gives soft strands instead of jagged edges
        for (const mat of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
          if (mat.alphaTest > 0 && !mat.alphaToCoverage) {
            mat.alphaToCoverage = true;
            mat.alphaTest = 0.3;
            mat.needsUpdate = true;
          }
        }
        mesh.frustumCulled = false; // bounds are for the A-pose, not the seated one
        // skin reads as skin, not plastic: a soft warm sheen and lower specular on the face
        if (/^Head/.test(mesh.name) && !Array.isArray(mesh.material)) mesh.material = skinOf(mesh.material as THREE.MeshStandardMaterial);
        if (mesh.morphTargetDictionary) faces.push(mesh);
      }
    });
    // The phone he holds up: parented to the right hand (limb axis = +X).
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.072, 0.009), phoneMaterial);
    phone.position.set(0.1, 0, 0.03);
    phone.visible = false;
    bones.Bip01_R_Hand?.add(phone);
    // The cap is placed in world space on the rest pose (top of the head mesh,
    // upright), then re-expressed in the head bone's frame so it follows the head.
    let cap: THREE.Group | null = null;
    const head = bones.Bip01_Head;
    const eyeL = bones.Bip01_LEye;
    const eyeR = bones.Bip01_REye;
    if (doppi && head && eyeL && eyeR) {
      scene.updateMatrixWorld(true);
      // Anchor on the eye bones (exact, unlike the skinned mesh's bounds): the
      // crown is ~10.5 cm above the eye line and ~7 cm behind it.
      const l = new THREE.Vector3().setFromMatrixPosition(eyeL.matrixWorld);
      const r = new THREE.Vector3().setFromMatrixPosition(eyeR.matrixWorld);
      const centre = l.add(r).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.095, -0.07));
      cap = makeDoppi();
      const inv = head.matrixWorld.clone().invert();
      cap.position.copy(centre.applyMatrix4(inv));
      const headQ = new THREE.Quaternion();
      head.getWorldQuaternion(headQ);
      // follow the skull's crown plane, which on this rig's rest pose leans ~13° forward
      cap.quaternion.copy(headQ.invert()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.2));
      // undo any scale baked into the hierarchy so the cap keeps its real size
      const s = new THREE.Vector3();
      head.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
      cap.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
      head.add(cap);
    }
    const mantle = robe ? makeMantle(scene) : null;
    if (firstPerson) scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && /^(Head|Hair)/.test(o.name)) o.visible = false;
    });
    return { scene, bones, rest, faces, phone, cap, mantle };
  }, [gltf.scene, doppi, robe, firstPerson]);

  useEffect(
    () => () => {
      rig.phone.geometry.dispose();
      rig.cap?.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      rig.mantle?.geometry.dispose();
      // dispose only (GPU buffers come back if the rig is shown again, e.g. StrictMode's re-run)
      for (const extra of (rig.mantle?.userData.extras ?? []) as THREE.Mesh[]) extra.geometry.dispose();
    },
    [rig],
  );

  type Mocap = {
    mixer: THREE.AnimationMixer;
    idle: THREE.AnimationAction;
    talks: THREE.AnimationAction[];
    talking: THREE.AnimationAction | null;
    nod: THREE.AnimationAction;
    shake: THREE.AnimationAction;
    thoughtful: THREE.AnimationAction;
    look: THREE.AnimationAction;
    rise: THREE.AnimationAction;
    lower: THREE.AnimationAction;
    standIdle: THREE.AnimationAction;
    standTalks: THREE.AnimationAction[];
    standTalking: THREE.AnimationAction | null;
    walk: THREE.AnimationAction;
  };
  const mocap = useRef<Mocap | null>(null);
  // The mixer lives with the effect (StrictMode-safe, like the student's avatar).
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(rig.scene);
    const action = (name: string, once = false) => {
      const clip = takes.find((c) => c.name === name);
      if (!clip) return null;
      const act = mixer.clipAction(clip, rig.scene);
      if (once) {
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = false;
      }
      return act;
    };
    // a clerk at work keeps her hands on the desk (the record is being kept); everyone else sits back
    const idle = (atWork ? action('sit_table_idle') : null) ?? action('sit_idle');
    const talks = ['sit_talk_1', 'sit_talk_2', 'sit_talk_3'].map((n) => action(n)).filter(Boolean) as THREE.AnimationAction[];
    const nod = action('sit_nod', true);
    const shake = action('sit_head_shake', true);
    const thoughtful = action('sit_shrug', true);
    const look = action('sit_look_around', true);
    const rise = action('sit_to_stand', true);
    const lower = action('stand_to_sit', true);
    const standIdle = action('stand_listen');
    const standTalks = ['stand_talk_1', 'stand_talk_2', 'stand_talk_3'].map((n) => action(n)).filter(Boolean) as THREE.AnimationAction[];
    const walk = action('walk');
    if (!idle || !talks.length || !nod || !shake || !thoughtful || !look || !rise || !lower || !standIdle || !standTalks.length || !walk) return;
    // transitions hold their last frame until we hand over to the next take
    rise.clampWhenFinished = true;
    lower.clampWhenFinished = true;
    idle.play();
    idle.time = (seed * 7.7) % idle.getClip().duration; // the extras are not in lockstep
    mocap.current = { mixer, idle, talks, talking: null, nod, shake, thoughtful, look, rise, lower, standIdle, standTalks, standTalking: null, walk };
    return () => {
      mocap.current = null;
      mixer.stopAllAction();
      mixer.uncacheRoot(rig.scene);
    };
  }, [rig, takes, seed, atWork]);

  const anim = useRef({
    pose: { ...POSES[mood] },
    yaw: 0,
    pitch: 0,
    blinkAt: 1 + seed,
    blink: 0,
    gesture: 'none' as Gesture,
    gestureId: 0,
    gestureT: 1,
    nextIdle: 6 + seed * 3,
    mouth: 0,
    silentFor: 99,
    playedGesture: 'none' as Gesture,
    cueId: '',
    visemes: {} as Partial<Record<Viseme, number>>,
    visemeW: {} as Partial<Record<Viseme, number>>,
    nextLook: 8 + seed * 4,
    posture: (enterPath?.length ? 'arriving' : 'seated') as 'seated' | 'rising' | 'standing' | 'lowering' | 'walking' | 'arriving' | 'settling' | 'gone',
    /** Forward offset of the body inside its seat frame (recorded transitions travel). */
    offsetZ: 0,
    waypoint: 0,
    walkYaw: 0,
    walkSpeed: 0,
    // the life layer (src/lib/liveliness.ts): own rhythm per character
    r: rng(seed * 31 + 7),
    eyes: eyes(rng(seed * 17 + 3)),
    beatsOf: -1,
    beats: [] as Beat[],
    beatIdx: 0,
    beatAt: -99,
    beatAmp: 0,
    nextNod: 4 + (seed % 5),
    nodAt: -99,
  });
  const body = useRef<THREE.Group>(null);

  // footsteps: one every ~0.7 m walked, quieter with distance from the listener
  const walked = useRef(0);
  const stride = (d: number, at: THREE.Vector3, ear: THREE.Vector3) => {
    walked.current += d;
    if (walked.current < 0.7) return;
    walked.current = 0;
    audio.footstep(false, Math.min(1, 1.6 / Math.max(1, at.distanceTo(ear))));
  };

  useFrame(({ camera, clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime + seed * 10;
    const a = anim.current;
    const game = useGame.getState();
    const reduced = game.settings.reducedMotion;
    const { bones, rest, faces } = rig;

    /** bone = rest ∘ euler(x, y, z) */
    const set = (name: string, x: number, y: number, z: number) => {
      const bone = bones[name];
      if (bone) bone.quaternion.copy(rest[name]).multiply(_q.setFromEuler(_e.set(x, y, z, 'XYZ')));
    };
    const morph = (name: string, value: number) => {
      for (const mesh of faces) {
        const i = mesh.morphTargetDictionary![name];
        if (i !== undefined) mesh.morphTargetInfluences![i] = clamp(value, 0, 1);
      }
    };

    /* ── inputs ── */
    let emotion: Emotion = mood;
    let intensity = 0.6;
    let speaking = live.current.talking;
    if (driven) {
      emotion = game.snapshot?.npc.emotion ?? mood;
      intensity = game.snapshot?.npc.intensity ?? 0.5;
      speaking = speech.active || performance.now() < game.stage.speakingUntil;
      const g = game.stage.gesture;
      if (g && g.id !== a.gestureId) {
        a.gestureId = g.id;
        a.gesture = g.clip;
        a.gestureT = 0;
      }
    } else if (live.current.cue && live.current.cue.id !== a.cueId) {
      // a gesture that goes with the line being spoken (nod on agreement, offering papers…)
      a.cueId = live.current.cue.id;
      a.gesture = live.current.cue.clip;
      a.gestureT = 0;
      a.nextIdle = t + 8;
    } else if (restless && t > a.nextIdle) {
      // extras: glance at the watch or sigh every so often
      a.gesture = seed % 2 ? 'check-watch' : 'sigh';
      a.gestureT = 0;
      a.nextIdle = t + 10 + ((seed * 7) % 9);
    }

    const target = POSES[emotion];
    const k = 0.35 + intensity * 0.65;
    const p = a.pose;
    for (const key of Object.keys(p) as (keyof Pose)[]) p[key] = damp(p[key], target[key] * k, 3, dt);

    /* ── gesture envelopes ── */
    let gNod = 0, gShake = 0, gSigh = 0, gLean = 0, gWatch = 0, gPhone = 0, gOffer = 0;
    if (a.gestureT < 1) {
      a.gestureT = Math.min(1, a.gestureT + dt / DURATION[a.gesture]);
      const e = envelope(a.gestureT);
      switch (a.gesture) {
        case 'nod': gNod = e; break;
        case 'shake-head': case 'stand': gShake = e; break;
        case 'sigh': gSigh = e; break;
        case 'lean-in': gLean = e; break;
        case 'check-watch': gWatch = e; break;
        case 'show-phone': gPhone = envelope(a.gestureT, 0.15, 0.15); break;
        case 'offer-envelope': case 'withdraw-envelope': gOffer = e; break;
      }
    }

    /* ── gaze: look at the player, within what a neck can do ── */
    let yaw = 0, pitch = 0;
    if (driven && root.current) {
      root.current.worldToLocal(_local.copy(camera.position));
      const dist = Math.hypot(_local.x, _local.z);
      if (dist < 9) {
        yaw = clamp(Math.atan2(_local.x, _local.z), -1.05, 1.05);
        pitch = clamp(-Math.atan2(_local.y - (seatTop + 0.78), dist), -0.35, 0.35);
      }
    } else if (live.current.lookAt && root.current) {
      root.current.worldToLocal(_local.set(...live.current.lookAt));
      yaw = clamp(Math.atan2(_local.x, _local.z), -1.05, 1.05);
      pitch = clamp(-Math.atan2(_local.y - (seatTop + 0.78), Math.hypot(_local.x, _local.z)), -0.35, 0.35);
    } else {
      // extras drift between the queue display, the floor and nothing in particular
      yaw = Math.sin(t * 0.17) * 0.35 + Math.sin(t * 0.07) * 0.2;
      pitch = 0.08 + Math.sin(t * 0.11) * 0.06;
    }
    a.yaw = damp(a.yaw, yaw * (1 - gWatch) + gWatch * 0.4, 3.5, dt);
    a.pitch = damp(a.pitch, pitch, 3.5, dt);

    /* ── body: motion capture underneath, intent on top ── */
    const m = mocap.current;
    // nobody is drawn before their recorded motion is ready (no T-pose, no pop at the seat)
    // your own body is hidden while it rises or sits down: the camera carries that motion,
    // and the recorded take would swing the torso through the lens
    const moving = firstPerson && (a.posture === 'rising' || a.posture === 'lowering');
    if (root.current) root.current.visible = Boolean(m) && a.posture !== 'gone' && !moving;
    if (track && root.current) {
      if (a.posture === 'gone') track.current.set(1e4, 0, 1e4);
      else root.current.getWorldPosition(track.current);
    }
    if (m) {
      const exiting = Boolean(live.current.exitPath && ((driven && game.mode === 'ended') || live.current.leave));
      const wantStand = live.current.standing || exiting;
      const travel = female(model) ? RISE.f : RISE.m;
      const done = (act: THREE.AnimationAction) => act.time >= act.getClip().duration - 0.02;

      /* posture: seated ⇄ standing, through the recorded transitions */
      if (a.posture === 'arriving' && root.current) {
        // walk the entry route, then the last leg to the spot in front of the seat
        const route = arrival!;
        if (a.waypoint === 0 && !m.walk.isRunning()) {
          root.current.position.set(route.path[0][0], position[1], route.path[0][1]);
          a.walkYaw = Math.atan2(route.path[1]?.[0] - route.path[0][0] || 0, route.path[1]?.[1] - route.path[0][1] || 1);
          root.current.rotation.y = a.walkYaw;
          m.idle.stop();
          m.standIdle.reset().setEffectiveWeight(0).play();
          m.walk.reset().setEffectiveWeight(1).play();
          a.waypoint = 1;
        }
        const target = a.waypoint < route.path.length ? route.path[a.waypoint] : route.spot;
        const dx = target[0] - root.current.position.x;
        const dz = target[1] - root.current.position.z;
        const dist = Math.hypot(dx, dz);
        const heading = Math.atan2(dx, dz);
        const turn = THREE.MathUtils.euclideanModulo(heading - a.walkYaw + Math.PI, Math.PI * 2) - Math.PI;
        a.walkYaw += turn * (1 - Math.exp(-5 * dt));
        const last = a.waypoint >= route.path.length;
        const want = Math.abs(turn) > 1.2 ? 0.25 : last ? Math.min(1.1, 0.35 + dist * 1.2) : 1.1;
        a.walkSpeed = damp(a.walkSpeed, want, 4, dt);
        root.current.rotation.y = a.walkYaw;
        root.current.position.x += Math.sin(a.walkYaw) * a.walkSpeed * dt;
        root.current.position.z += Math.cos(a.walkYaw) * a.walkSpeed * dt;
        stride(a.walkSpeed * dt, root.current.position, camera.position);
        m.walk.setEffectiveWeight(Math.min(1, a.walkSpeed / 0.5));
        m.standIdle.setEffectiveWeight(Math.max(0, 1 - a.walkSpeed / 0.5));
        m.walk.timeScale = Math.max(0.4, a.walkSpeed / travel.walkSpeed);
        if (dist < (last ? 0.06 : 0.3)) {
          if (last) a.posture = 'settling';
          else a.waypoint += 1;
        }
      } else if (a.posture === 'settling' && root.current) {
        // stop and turn to face the room the way the seat faces
        a.walkSpeed = damp(a.walkSpeed, 0, 6, dt);
        m.walk.setEffectiveWeight(Math.min(1, a.walkSpeed / 0.5));
        m.standIdle.setEffectiveWeight(1 - Math.min(1, a.walkSpeed / 0.5));
        const turn = THREE.MathUtils.euclideanModulo(rotation - a.walkYaw + Math.PI, Math.PI * 2) - Math.PI;
        a.walkYaw += turn * (1 - Math.exp(-5 * dt));
        root.current.rotation.y = a.walkYaw;
        if (Math.abs(turn) < 0.03 && a.walkSpeed < 0.05) {
          m.walk.stop();
          m.standIdle.setEffectiveWeight(1);
          // re-express the body in the seat frame: root on the seat, body forward by the rise travel
          root.current.position.set(position[0], position[1], position[2]);
          root.current.rotation.y = rotation;
          a.offsetZ = travel.riseZ;
          a.waypoint = 0;
          a.posture = 'standing';
        }
      } else if (a.posture === 'seated' && wantStand) {
        m.talking?.fadeOut(0.2);
        m.talking = null;
        m.idle.fadeOut(0.25);
        m.rise.reset().setEffectiveWeight(1).fadeIn(0.25).play();
        a.posture = 'rising';
      } else if (a.posture === 'rising' && done(m.rise)) {
        // hand over without a blend: the take ends where it started, offset by its own travel
        m.rise.stop();
        m.standIdle.reset().setEffectiveWeight(1).play();
        a.offsetZ = travel.riseZ;
        a.posture = exiting ? 'walking' : 'standing';
        if (exiting && root.current) {
          // from here the body moves in the world: fold the offset into the root
          const yaw0 = root.current.rotation.y;
          root.current.position.x += Math.sin(yaw0) * a.offsetZ;
          root.current.position.z += Math.cos(yaw0) * a.offsetZ;
          a.offsetZ = 0;
          a.walkYaw = yaw0;
          a.waypoint = 0;
        }
      } else if (a.posture === 'standing' && exiting) {
        if (root.current) {
          const yaw0 = root.current.rotation.y;
          root.current.position.x += Math.sin(yaw0) * a.offsetZ;
          root.current.position.z += Math.cos(yaw0) * a.offsetZ;
          a.walkYaw = yaw0;
        }
        a.offsetZ = 0;
        a.waypoint = 0;
        a.posture = 'walking';
      } else if (a.posture === 'standing' && !wantStand && !exiting) {
        m.standTalking?.stop();
        m.standTalking = null;
        m.standIdle.stop();
        m.lower.reset().setEffectiveWeight(1).play();
        a.offsetZ = travel.lowerZ; // so that the take lands exactly on the seat
        a.posture = 'lowering';
      } else if (a.posture === 'lowering' && done(m.lower)) {
        m.lower.stop();
        m.idle.reset().setEffectiveWeight(1).play();
        a.offsetZ = 0;
        a.posture = 'seated';
      }

      if (a.posture === 'seated') {
        // speaking ↔ listening: cross-fade between a seated talk take and the idle take
        if (speaking) a.silentFor = 0;
        else a.silentFor += dt;
        const wantTalk = speaking || a.silentFor < 0.7;
        if (wantTalk && !m.talking) {
          m.talking = m.talks[Math.floor(((t * 7.3) % 1) * m.talks.length)];
          m.talking.reset().setEffectiveWeight(1).fadeIn(0.6).play();
          m.talking.time = (t * 3.1) % m.talking.getClip().duration; // never start every line on the same frame
          m.idle.fadeOut(0.6);
        } else if (!wantTalk && m.talking) {
          m.talking.fadeOut(0.8);
          m.idle.reset().fadeIn(0.8).play();
          m.talking = null;
        }
        // one-shot gestures from the scenario map onto recorded takes
        if (a.gestureT === 0 && a.gesture !== a.playedGesture) {
          a.playedGesture = a.gesture;
          const take = a.gesture === 'nod' ? m.nod : a.gesture === 'shake-head' || a.gesture === 'stand' ? m.shake : a.gesture === 'sigh' ? m.thoughtful : null;
          if (take) take.reset().setEffectiveWeight(1).fadeIn(0.25).play();
        }
        if (a.gestureT >= 1) a.playedGesture = 'none';
        // extras: now and then they look around the hall
        if (!driven && restless && !reduced && t > a.nextLook) {
          a.nextLook = t + 14 + ((seed * 5) % 9);
          m.look.reset().setEffectiveWeight(1).fadeIn(0.5).play();
        }
      } else if (a.posture === 'standing') {
        // on one's feet: talk takes while speaking, attentive listening otherwise
        if (speaking) a.silentFor = 0;
        else a.silentFor += dt;
        const wantTalk = speaking || a.silentFor < 0.7;
        if (wantTalk && !m.standTalking) {
          m.standTalking = m.standTalks[Math.floor(((t * 5.1) % 1) * m.standTalks.length)];
          m.standTalking.reset().setEffectiveWeight(1).fadeIn(0.5).play();
          m.standTalking.time = (t * 2.3) % m.standTalking.getClip().duration;
          m.standIdle.fadeOut(0.5);
        } else if (!wantTalk && m.standTalking) {
          m.standTalking.fadeOut(0.7);
          m.standIdle.reset().fadeIn(0.7).play();
          m.standTalking = null;
        }
      } else if (a.posture === 'walking' && root.current) {
        // follow the exit route: turn toward the next point, walk, and leave
        const path = live.current.exitPath ?? [];
        const target = path[a.waypoint];
        if (!target) {
          root.current.visible = false;
          a.posture = 'gone';
        } else {
          const dx = target[0] - root.current.position.x;
          const dz = target[1] - root.current.position.z;
          const dist = Math.hypot(dx, dz);
          const heading = Math.atan2(dx, dz);
          const turn = THREE.MathUtils.euclideanModulo(heading - a.walkYaw + Math.PI, Math.PI * 2) - Math.PI;
          a.walkYaw += turn * (1 - Math.exp(-4.5 * dt));
          // slow down while turning hard, the way people do
          const want = Math.abs(turn) > 1.2 ? 0.25 : 1.15;
          a.walkSpeed = damp(a.walkSpeed, want, 4, dt);
          root.current.rotation.y = a.walkYaw;
          root.current.position.x += Math.sin(a.walkYaw) * a.walkSpeed * dt;
          root.current.position.z += Math.cos(a.walkYaw) * a.walkSpeed * dt;
          stride(a.walkSpeed * dt, root.current.position, camera.position);
          if (dist < 0.3) a.waypoint += 1;
          if (!m.walk.isRunning()) {
            m.walk.reset().setEffectiveWeight(0).play();
          }
          m.walk.setEffectiveWeight(Math.min(1, a.walkSpeed / 0.5));
          m.standIdle.setEffectiveWeight(Math.max(0, 1 - a.walkSpeed / 0.5));
          m.walk.timeScale = Math.max(0.4, a.walkSpeed / travel.walkSpeed);
        }
      }
      if (body.current) body.current.position.z = a.offsetZ;
      m.mixer.update(dt);
    }

    /** Adds a local rotation on top of whatever the recording put there. */
    const add = (name: string, x: number, y: number, z: number) => {
      const bone = bones[name];
      if (bone) bone.quaternion.multiply(_q.setFromEuler(_e.set(x, y, z, 'XYZ')));
    };
    /** Blends a bone toward an explicit pose (rest ∘ euler) by weight w. */
    const toward = (name: string, x: number, y: number, z: number, w: number) => {
      const bone = bones[name];
      if (!bone || w <= 0.001) return;
      _q2.copy(rest[name]).multiply(_q.setFromEuler(_e.set(x, y, z, 'XYZ')));
      bone.quaternion.slerp(_q2, w);
    };
    if (!m) {
      // no recording available: hold the authored seated pose
      for (const [name, [x, y, z]] of Object.entries(SEATED)) set(name, x, y, z);
    }

    // breathing: the chest rises and settles (faster when upset, slower when calm)
    if (a.posture !== 'walking' && a.posture !== 'gone') {
      const rate = emotion === 'upset' || emotion === 'impatient' ? 18 : emotion === 'calm' || emotion === 'reassured' ? 12 : 14;
      const chest = breath(t, speaking ? rate * 0.8 : rate) * (reduced ? 0.5 : 1);
      add('Bip01_Spine2', 0, 0, -chest * 0.012);
      add('Bip01_Neck', 0, 0, chest * 0.006);
    }
    if (a.posture === 'seated') {
      add('Bip01_Spine1', a.yaw * 0.1, 0, p.lean * 0.6 + gLean * 0.2 - gSigh * 0.04 + gOffer * 0.12 - upright);
      // straightening the back would tip the face up: give the head back what the spine took
      if (upright) add('Bip01_Neck', 0, 0, upright * 0.6);
    }
    const headYaw = a.yaw * 0.62 + (m ? 0 : gShake * Math.sin(a.gestureT * Math.PI * 6) * 0.3);
    // a listener gives a small back-channel nod now and then while someone else speaks
    a.nextNod -= dt;
    if (!speaking && speech.active && (live.current.lookAt || driven) && a.nextNod < 0 && a.gestureT >= 1) {
      a.nodAt = t;
      a.nextNod = 3.5 + a.r() * 4;
    }
    const listenNod = t - a.nodAt < 0.7 ? Math.sin(((t - a.nodAt) / 0.7) * Math.PI) * 0.06 * (reduced ? 0.5 : 1) : 0;
    const beatDip = accent(t - a.beatAt) * a.beatAmp * 0.035;
    const headPitch = a.pitch + p.headPitch + listenNod + beatDip + (m ? 0 : gNod * Math.sin(a.gestureT * Math.PI * 5) * 0.17) + gWatch * 0.4 + gPhone * 0.22;
    if (a.posture !== 'walking') {
      add('Bip01_Neck', a.yaw * 0.25, 0, headPitch * 0.3);
      add('Bip01_Head', headYaw, p.headRoll, headPitch * 0.7);
    }

    // scenario props need precise arms: blend from the recording into a held pose
    const [lax, lay, laz] = SEATED.Bip01_L_UpperArm;
    const [lfx, , lfz] = SEATED.Bip01_L_Forearm;
    toward('Bip01_L_UpperArm', lax, lay, laz - 0.42, gWatch);
    toward('Bip01_L_Forearm', lfx + 0.9, 0, lfz - 1.05, gWatch);
    const [rax, ray, raz] = SEATED.Bip01_R_UpperArm;
    const [rfx, , rfz] = SEATED.Bip01_R_Forearm;
    const hold = Math.max(gPhone, gOffer);
    const phoneMix = gPhone >= gOffer ? 1 : 0;
    toward('Bip01_R_UpperArm', rax, ray, raz - (phoneMix ? 0.4 : 0.85), hold);
    toward('Bip01_R_Forearm', rfx + (phoneMix ? 0.5 : 0), 0, rfz + (phoneMix ? -1.0 : 0.5), hold);
    rig.phone.visible = gPhone > 0.05;

    /* ── face ── */
    // eyes: saccades to the target (fast), micro-saccades while holding, glances away while speaking;
    // blinks: asymmetric, every few seconds, often on a big gaze shift; the lid follows the eye down
    const headYawNow = a.yaw * 0.97;
    const wantEye: [number, number] = [clamp(yaw - headYawNow, -0.6, 0.6), clamp(pitch - a.pitch, -0.35, 0.35)];
    const ey = stepEyes(a.eyes, dt, wantEye, { speaking, listening: !speaking && Boolean(live.current.lookAt || driven), r: a.r, calm: emotion === 'calm' || emotion === 'reassured' ? 1 : 0 });
    const lookingDown = Math.max(0, ey.pitch) / 0.35;
    const lookingUp = Math.max(0, -ey.pitch) / 0.35;
    const lid = Math.max(ey.blink, gSigh * 0.55, p.squint * 0.18 + lookingDown * 0.3);
    morph('eyeBlinkLeft', lid);
    morph('eyeBlinkRight', lid);
    morph('eyeWideLeft', p.wide + lookingUp * 0.15);
    morph('eyeWideRight', p.wide + lookingUp * 0.15);
    morph('cheekSquintLeft', p.cheek);
    morph('cheekSquintRight', p.cheek);
    morph('noseSneerLeft', p.sneer);
    morph('noseSneerRight', p.sneer);
    morph('mouthShrugLower', p.shrug * (speaking ? 0.4 : 1));
    morph('eyeSquintLeft', p.squint);
    morph('eyeSquintRight', p.squint);
    morph('browDownLeft', p.browDown);
    morph('browDownRight', p.browDown * (1 - p.browTilt * 0.7));
    // beats: the brows lift a little on stressed syllables (and more at the end of a phrase)
    const lift = accent(t - a.beatAt) * a.beatAmp;
    morph('browInnerUp', p.browUp + lift * 0.22 + lookingUp * 0.12);
    morph('browOuterUpLeft', lift * 0.14);
    morph('browOuterUpRight', p.browTilt * 0.8 + lift * 0.14);
    morph('mouthFrownLeft', p.frown * (speaking ? 0.5 : 1));
    morph('mouthFrownRight', p.frown * (speaking ? 0.5 : 1));
    morph('mouthSmileLeft', p.smile);
    morph('mouthSmileRight', p.smile);
    morph('mouthPressLeft', Math.max(gSigh * 0.4, p.press * (speaking ? 0.3 : 1)));
    morph('mouthPressRight', Math.max(gSigh * 0.4, p.press * (speaking ? 0.3 : 1)));
    // eyes carry the part of the gaze the neck does not (≈ full morph at 35°)
    const eyeYaw = ey.yaw * 1.6;
    morph('eyeLookOutLeft', eyeYaw);
    morph('eyeLookInRight', eyeYaw);
    morph('eyeLookInLeft', -eyeYaw);
    morph('eyeLookOutRight', -eyeYaw);
    const lookDown = Math.max(gWatch * 0.7 + gPhone * 0.5 + (emotion === 'uncertain' ? 0.25 : 0), lookingDown * 0.9);
    morph('eyeLookDownLeft', lookDown);
    morph('eyeLookDownRight', lookDown);
    morph('eyeLookUpLeft', lookingUp * 0.9);
    morph('eyeLookUpRight', lookingUp * 0.9);

    // speech: the mouth follows the line's viseme track (Uzbek is spelled as it
    // sounds, so the shapes come from the text, timed to the real voice); a real
    // voice also scales the opening by its loudness. Without a track, syllable-like motion.
    const voiced = speech.active && (driven || live.current.talking);
    const lip = speech.track;
    // the lips lead the sound a little (≈ 50 ms): we see a mouth shape before we hear it
    const progress = lip ? (performance.now() + 50 - lip.start) / lip.duration : -1;
    const shaped = Boolean(lip && speaking && progress >= 0 && progress <= 1);
    if (shaped) {
      if (a.beatsOf !== lip!.start) {
        a.beatsOf = lip!.start;
        a.beats = beats(lip!.segments);
        a.beatIdx = 0;
      }
      while (a.beatIdx < a.beats.length && a.beats[a.beatIdx].at <= progress) {
        const b = a.beats[a.beatIdx++];
        // not every word: phrase ends always, word ends now and then
        if (b.strength >= 1 || a.r() < 0.4) {
          a.beatAt = t;
          a.beatAmp = b.strength * (0.6 + a.r() * 0.4) * (reduced ? 0.5 : 1);
        }
        // people often blink at the end of a phrase
        if (b.strength >= 1 && a.r() < 0.35) cueBlink(a.eyes);
      }
      sampleTrack(lip!.segments, progress, a.visemes);
      const loud = voiced ? 0.55 + Math.min(1, speech.level * 1.4) * 0.6 : 1;
      let jaw = 0;
      for (const v of VISEMES) {
        const w = (a.visemes[v] ?? 0) * loud;
        a.visemeW[v] = damp(a.visemeW[v] ?? 0, w, 28, dt);
        jaw = Math.max(jaw, a.visemeW[v]! * JAW[v]);
      }
      a.mouth = damp(a.mouth, jaw, 24, dt);
      for (const v of VISEMES) if (v !== 'sil') morph(VISEME_MORPH[v], a.visemeW[v]! * 0.85);
      morph('jawOpen', a.mouth * 0.55 + gSigh * 0.12);
    } else {
      const open = voiced ? speech.level : speaking ? Math.max(0, Math.sin(t * 15.5) * 0.5 + Math.sin(t * 8.7) * 0.35 + 0.3) : 0;
      a.mouth = damp(a.mouth, open, 20, dt);
      const vowel = (Math.sin(t * 3.3) + 1) / 2;
      for (const v of VISEMES) {
        a.visemeW[v] = damp(a.visemeW[v] ?? 0, 0, 12, dt);
        if (v !== 'sil' && v !== 'aa' && v !== 'O' && v !== 'E') morph(VISEME_MORPH[v], a.visemeW[v]!);
      }
      morph('jawOpen', a.mouth * 0.42 + gSigh * 0.12);
      morph('viseme_aa', a.mouth * vowel * 0.6);
      morph('viseme_O', a.mouth * (1 - vowel) * 0.55);
      morph('viseme_E', speaking ? Math.max(0, Math.sin(t * 5.1)) * 0.25 : 0);
    }
  });

  // keep un-driven skeleton parts exactly at rest (clone starts in the A-pose)
  useEffect(() => {
    for (const name of DRIVEN) rig.bones[name]?.quaternion.copy(rig.rest[name]);
  }, [rig]);

  return (
    <group ref={root} position={placed.position} rotation={placed.rotation}>
      <group ref={body}>
        <primitive object={rig.scene} position={[0, seatTop + SEAT_OFFSET[model], 0]} />
      </group>
    </group>
  );
}
