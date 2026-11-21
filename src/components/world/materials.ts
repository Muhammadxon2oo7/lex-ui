'use client';
/**
 * PBR material library. One shared MeshStandardMaterial per surface, fed by
 * Poly Haven (CC0) texture sets: colour, OpenGL normal and a packed ARM map
 * (R = ambient occlusion, G = roughness, B = metalness).
 *
 * Geometry carries world-scaled UVs (see `tiledBox`), so textures keep a
 * constant texel density no matter how large the wall or floor is.
 */
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type SetId =
  | 'terrazzo_tiles'
  | 'laminate_floor_02'
  | 'painted_plaster_wall'
  | 'oak_veneer_01'
  | 'walnut_veneer'
  | 'ceiling_interior'
  | 'fabric_pattern_07'
  | 'brown_leather';

const SETS: SetId[] = [
  'terrazzo_tiles',
  'laminate_floor_02',
  'painted_plaster_wall',
  'oak_veneer_01',
  'walnut_veneer',
  'ceiling_interior',
  'fabric_pattern_07',
  'brown_leather',
];

/** Metres covered by one texture repeat. */
export const TILE: Record<string, number> = {
  terrazzo: 2.4,
  laminate: 2.2,
  plaster: 2.6,
  ceiling: 1.2,
  oak: 1.3,
  walnut: 1.3,
  fabric: 0.45,
  leather: 0.6,
  trim: 1,
};

const paths = SETS.flatMap((id) => ['diff', 'nor', 'arm'].map((m) => `/assets/textures/${id}/${m}.webp`));

export interface Materials {
  plaster: THREE.MeshStandardMaterial;
  terrazzo: THREE.MeshStandardMaterial;
  laminate: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  oak: THREE.MeshStandardMaterial;
  walnut: THREE.MeshStandardMaterial;
  fabric: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  darkPlastic: THREE.MeshStandardMaterial;
  whiteLaminate: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  paper: THREE.MeshStandardMaterial;
}

export function useMaterials(): Materials {
  const textures = useTexture(paths);
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());

  return useMemo(() => {
    const pbr = (index: number, opts: THREE.MeshPhysicalMaterialParameters = {}) => {
      const [map, normalMap, arm] = textures.slice(index * 3, index * 3 + 3);
      for (const t of [map, normalMap, arm]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        // full anisotropy: floors and desk tops are seen at a grazing angle, where 8× still smears
        t.anisotropy = Math.min(16, maxAniso);
      }
      map.colorSpace = THREE.SRGBColorSpace;
      normalMap.colorSpace = arm.colorSpace = THREE.NoColorSpace;
      // a lacquered surface (clearcoat) needs the physical material; everything else stays standard
      const Mat = opts.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      return new Mat({
        map,
        normalMap,
        aoMap: arm,
        roughnessMap: arm,
        metalnessMap: arm,
        roughness: 1,
        metalness: 1,
        ...opts,
      });
    };
    return {
      // Polished stone: let the windows and ceiling panels read in the floor.
      terrazzo: pbr(0, { roughness: 0.85, envMapIntensity: 1.1 }),
      // a sealed floor: a faint sheen that picks up the windows and the ceiling panels
      laminate: pbr(1, { clearcoat: 0.25, clearcoatRoughness: 0.4 }),
      // Warm off-white: the plaster set is tinted, never pure #fff (keeps highlights unclipped).
      // Painted wall: only the plaster's relief and roughness are used — the
      // scanned colour is a dull grey that makes an office read as a bunker.
      plaster: pbr(2, { map: null, color: '#e2ddd3', normalScale: new THREE.Vector2(0.45, 0.45) }),
      // furniture wood is lacquered: a clear coat over the grain is what makes a desk read as a desk
      // (a satin lacquer, not a mirror: under a ceiling of light panels a glossy coat washes the wood out)
      oak: pbr(3, { clearcoat: 0.3, clearcoatRoughness: 0.42 }),
      walnut: pbr(4, { clearcoat: 0.35, clearcoatRoughness: 0.4 }),
      ceiling: new THREE.MeshStandardMaterial({ map: ceilingGrid(), color: '#f3f1ec', roughness: 0.92, metalness: 0 }),
      fabric: pbr(6, { color: '#5f6b78' }),
      leather: pbr(7),
      trim: new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.55, metalness: 0.1 }),
      metal: new THREE.MeshStandardMaterial({ color: '#8d9299', roughness: 0.32, metalness: 1 }),
      darkPlastic: new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.42, metalness: 0.1 }),
      whiteLaminate: new THREE.MeshStandardMaterial({ color: '#ebe8e2', roughness: 0.38, metalness: 0 }),
      paper: new THREE.MeshStandardMaterial({ color: '#f3efe4', roughness: 0.9, metalness: 0 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#dfeef2',
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.16,
        envMapIntensity: 1.6,
        depthWrite: false,
      }),
    };
  }, [textures, maxAniso]);
}

/** Suspended ceiling: 60 × 60 cm mineral tiles with a thin shadow gap (one repeat = 1.2 m). */
function ceilingGrid(): THREE.CanvasTexture {
  const tex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    // faint speckle so the tiles are not a flat fill
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    ctx.strokeStyle = 'rgba(70,70,70,0.55)';
    ctx.lineWidth = 3;
    for (const p of [0, w / 2, w]) {
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * A box whose UVs are in "repeats" of `tile` metres on every face — with softly rounded edges.
 * Nothing built by people has a razor edge: a few millimetres of radius catch the light along
 * every corner, and that thin highlight is most of what separates furniture from a "3D box".
 * Walls, floors and paper-thin sheets stay plain boxes (nothing to round, and no seams at corners).
 */
export function tiledBox(w: number, h: number, d: number, tile: number): THREE.BufferGeometry {
  const min = Math.min(w, h, d);
  const max = Math.max(w, h, d);
  if (min < 0.018 || max > 5) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    // face order in BoxGeometry: +x, -x, +y, -y, +z, -z (4 vertices each)
    const spans: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let face = 0; face < 6; face++) {
      const [su, sv] = spans[face];
      for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, (uv.getX(i) * su) / tile, (uv.getY(i) * sv) / tile);
    }
    uv.needsUpdate = true;
    return geo;
  }
  const radius = Math.min(0.007, min * 0.16);
  const geo = new RoundedBoxGeometry(w, h, d, 2, radius);
  // tile the texture by position, per face (the dominant axis of the normal picks the projection)
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const x = pos.getX(i) + w / 2;
    const y = pos.getY(i) + h / 2;
    const z = pos.getZ(i) + d / 2;
    if (ax >= ay && ax >= az) uv.setXY(i, z / tile, y / tile);
    else if (ay >= az) uv.setXY(i, x / tile, z / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Crisp signage / screens drawn on a 2D canvas (no font files, no network). */
export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export const UI_FONT = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Geometric tile band in the manner of Uzbek majolica (koshin): eight-point
 * stars (khatam) on lapis, turquoise and white. Repeats horizontally.
 */
let ornament: THREE.CanvasTexture | null = null;
export function ornamentTexture(): THREE.CanvasTexture {
  if (ornament) return ornament;
  ornament = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#123a6b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e9e3d3';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 14, w, 14);
    ctx.fillStyle = '#1aa3a8';
    ctx.fillRect(0, 14, w, 6);
    ctx.fillRect(0, h - 20, w, 6);
    const star = (cx: number, cy: number, r: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Math.PI / 8;
        const rr = i % 2 ? r * 0.62 : r;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    };
    for (let i = 0; i < 2; i++) {
      const cx = 128 + i * 256;
      star(cx, h / 2, 86, '#e9e3d3');
      star(cx, h / 2, 64, '#1aa3a8');
      star(cx, h / 2, 40, '#123a6b');
      ctx.fillStyle = '#e8b33f';
      ctx.beginPath();
      ctx.arc(cx, h / 2, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    // half-stars joining the repeats, and small cross tiles between them
    for (const cx of [0, 256, 512]) {
      star(cx, h / 2, 40, '#1aa3a8');
      ctx.fillStyle = '#e9e3d3';
      ctx.fillRect(cx - 6, 30, 12, 34);
      ctx.fillRect(cx - 6, h - 64, 12, 34);
    }
  });
  ornament.wrapS = THREE.RepeatWrapping;
  return ornament;
}
