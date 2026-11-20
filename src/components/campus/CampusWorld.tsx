'use client';
/**
 * The LexSim practice centre: plaza, building, foyer and the long corridor
 * whose doors lead to the training rooms. Everything here is generated from
 * `game/campus.ts`; the photographic surfaces are Poly Haven scans (CC0).
 */
import { Environment, useGLTF, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CORRIDOR, DOORS, DOOR_HEIGHT, DOOR_WIDTH, ENTRANCE, FACADE, FOYER, GLASS, INFO_BOARD, KIOSK, type DoorDef } from '@/game/campus';
import { useCampus } from '@/game/campusStore';
import { Prop } from '../world/Furniture';
import { TILE, UI_FONT, canvasTexture, ornamentTexture, tiledBox, useMaterials, type Materials } from '../world/materials';
import { rig } from './CampusPlayer';

const EXTERIOR = ['precast_stone_paving', 'concrete_tile_facade', 'leafy_grass'] as const;
const exteriorPaths = EXTERIOR.flatMap((id) => ['diff', 'nor', 'arm'].map((m) => `/assets/textures/${id}/${m}.webp`));
const OUTDOOR = ['street_lamp_01', 'modular_street_seating', 'planter_box_02', 'shrub_02'];
OUTDOOR.forEach((m) => useGLTF.preload(`/assets/models/${m}.glb`));

function useExterior() {
  const textures = useTexture(exteriorPaths);
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  return useMemo(() => {
    const make = (i: number, opts: THREE.MeshStandardMaterialParameters = {}) => {
      const [map, normalMap, arm] = textures.slice(i * 3, i * 3 + 3);
      for (const t of [map, normalMap, arm]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.min(8, maxAniso);
      }
      map.colorSpace = THREE.SRGBColorSpace;
      normalMap.colorSpace = arm.colorSpace = THREE.NoColorSpace;
      return new THREE.MeshStandardMaterial({ map, normalMap, aoMap: arm, roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1, ...opts });
    };
    return {
      paving: make(0),
      // light limestone panels: the scan's relief and roughness, not its dark colour
      facade: make(1, { map: null, color: '#d8d1c3', normalScale: new THREE.Vector2(0.8, 0.8) }),
      grass: make(2, { color: '#b7c99a' }),
    };
  }, [textures, maxAniso]);
}

/* ───────────────────────── helpers ───────────────────────── */

function Slab({ material, size, position, tile, rotation }: { material: THREE.Material; size: [number, number, number]; position: [number, number, number]; tile: number; rotation?: [number, number, number] }) {
  const geometry = useMemo(() => tiledBox(size[0], size[1], size[2], tile), [size, tile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} position={position} rotation={rotation} castShadow receiveShadow />;
}

/** Drawn once per mount (callers that depend on data are keyed by it). */
function useCanvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useMemo(() => canvasTexture(w, h, draw), []);
  useEffect(() => () => t.dispose(), [t]);
  return t;
}

const text = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, px: number, color: string, weight = 600, align: CanvasTextAlign = 'left', spacing = 0) => {
  ctx.font = `${weight} ${px}px ${UI_FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
  ctx.fillText(value, x, y);
};

const glassMaterial = new THREE.MeshPhysicalMaterial({ color: '#b9cdd6', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, envMapIntensity: 1.8, depthWrite: false });
const darkGlass = new THREE.MeshStandardMaterial({ color: '#1c2633', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.6 });
const mullion = new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.4, metalness: 0.7 });
const panelLight = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#fff4e2'), emissiveIntensity: 2.4, roughness: 0.6 });
const roomGlow = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#ffe2b8'), emissiveIntensity: 1.8 });

/* ───────────────────────── outside ───────────────────────── */

function Grounds({ ext }: { ext: ReturnType<typeof useExterior> }) {
  return (
    <group>
      <Slab material={ext.grass} size={[260, 0.1, 260]} position={[0, -0.06, 40]} tile={4} />
      <Slab material={ext.paving} size={[FACADE.width + 10, 0.08, 26]} position={[0, -0.02, 13.012]} tile={2.2} />
      <Slab material={ext.paving} size={[5, 0.08, 40]} position={[0, -0.02, 46]} tile={2.2} />
      {/* low granite steps up to the entrance */}
      <Slab material={ext.paving} size={[12, 0.12, 2.18]} position={[0, 0.04, 1.11]} tile={2.2} />
    </group>
  );
}

function Outdoor() {
  const lamp = (x: number, z: number) => <Prop key={`l${x}:${z}`} model={'street_lamp_01'} position={[x, 0, z]} rotation={x > 0 ? -Math.PI / 2 : Math.PI / 2} />;
  return (
    <group>
      {[-9, 9].flatMap((x) => [8, 18].map((z) => lamp(x, z)))}
      <Prop model={'modular_street_seating'} position={[-12, 0, 13]} rotation={Math.PI / 2} />
      <Prop model={'modular_street_seating'} position={[12, 0, 13]} rotation={-Math.PI / 2} />
      {[-16, -11, 11, 16].map((x) => (
        <Prop key={x} model={'planter_box_02'} position={[x, 0, 2.2]} />
      ))}
      {[-13, 13].map((x) => (
        <Prop key={x} model={'shrub_02'} position={[x, 0, 20]} rotation={x > 0 ? 0 : Math.PI} />
      ))}
    </group>
  );
}

function DoorPane({ width }: { width: number }) {
  return (
    <>
      <mesh material={glassMaterial} position={[0, ENTRANCE.height / 2, 0]}>
        <boxGeometry args={[width, ENTRANCE.height, 0.02]} />
      </mesh>
      <mesh material={mullion} position={[0, ENTRANCE.height / 2, 0]}>
        <boxGeometry args={[width - 0.08, 0.05, 0.036]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mullion} position={[s * (width / 2 - 0.02), ENTRANCE.height / 2, 0]}>
          <boxGeometry args={[0.04, ENTRANCE.height, 0.04]} />
        </mesh>
      ))}
    </>
  );
}

/** Automatic sliding glass doors: open as the student approaches. */
function SlidingDoors() {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const open = useRef(0);
  const width = ENTRANCE.x1 - ENTRANCE.x0;
  useFrame((_, dt) => {
    const near = Math.abs(rig.position.x) < 3 && Math.abs(rig.position.z) < 3.6;
    open.current = THREE.MathUtils.damp(open.current, near ? 1 : 0, 5, Math.min(dt, 0.05));
    const shift = open.current * (width / 2 - 0.05);
    if (left.current) left.current.position.x = -width / 4 - shift;
    if (right.current) right.current.position.x = width / 4 + shift;
  });
  return (
    <group position={[0, 0, 0.02]}>
      <group ref={left}>
        <DoorPane width={width / 2} />
      </group>
      <group ref={right}>
        <DoorPane width={width / 2} />
      </group>
    </group>
  );
}

function Facade({ m, ext }: { m: Materials; ext: ReturnType<typeof useExterior> }) {
  const W = FACADE.width;
  const H = FACADE.height;
  const sign = useCanvasTexture(2048, 420, (ctx, w, h) => {
    text(ctx, 'LEXSIM', w / 2, h * 0.38, 200, '#1a2233', 800, 'center', 24);
    text(ctx, 'HUQUQIY AMALIYOT MARKAZI', w / 2, h * 0.8, 68, '#1f6b4a', 600, 'center', 14);
  });
  const mullionsX = Array.from({ length: 11 }, (_, i) => GLASS.x0 + (i * (GLASS.x1 - GLASS.x0)) / 10);
  return (
    <group>
      {/* solid facade either side of the glazing, and above it */}
      {/* 1 cm short of the foyer's walls and ceiling, so their faces never share a plane */}
      <Slab material={ext.facade} size={[(W / 2) - GLASS.x1 - 0.01, H, 0.4]} position={[-(GLASS.x1 + 0.01 + (W / 2 - GLASS.x1 - 0.01) / 2), H / 2, -0.2]} tile={3} />
      <Slab material={ext.facade} size={[(W / 2) - GLASS.x1 - 0.01, H, 0.4]} position={[GLASS.x1 + 0.01 + (W / 2 - GLASS.x1 - 0.01) / 2, H / 2, -0.2]} tile={3} />
      <Slab material={ext.facade} size={[GLASS.x1 - GLASS.x0, H - GLASS.height - 0.01, 0.4]} position={[0, GLASS.height + 0.01 + (H - GLASS.height - 0.01) / 2, -0.2]} tile={3} />
      {/* upper-floor ribbon windows */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh material={darkGlass} position={[side * 12.5, 6.9, 0.01]}>
            <boxGeometry args={[9, 1.9, 0.04]} />
          </mesh>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} material={mullion} position={[side * 12.5 - 4.5 + i * 1.5, 6.9, 0.04]}>
              <boxGeometry args={[0.06, 1.9, 0.05]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh material={darkGlass} position={[0, 6.9, 0.01]}>
        <boxGeometry args={[12, 1.9, 0.04]} />
      </mesh>
      {/* sides, back, roof, cornice */}
      <Slab material={ext.facade} size={[0.4, H, FACADE.depth]} position={[-W / 2, H / 2, -FACADE.depth / 2]} tile={3} />
      <Slab material={ext.facade} size={[0.4, H, FACADE.depth]} position={[W / 2, H / 2, -FACADE.depth / 2]} tile={3} />
      <Slab material={ext.facade} size={[W, H, 0.4]} position={[0, H / 2, -FACADE.depth]} tile={3} />
      <Slab material={m.trim} size={[W + 0.6, 0.35, FACADE.depth + 0.6]} position={[0, H + 0.17, -FACADE.depth / 2]} tile={4} />

      {/* curtain wall with the entrance cut into it */}
      {[[GLASS.x0, ENTRANCE.x0], [ENTRANCE.x1, GLASS.x1]].map(([a, b]) => (
        <mesh key={a} material={glassMaterial} position={[(a + b) / 2, GLASS.height / 2, 0]}>
          <boxGeometry args={[b - a, GLASS.height, 0.03]} />
        </mesh>
      ))}
      <mesh material={glassMaterial} position={[0, (ENTRANCE.height + GLASS.height) / 2, 0]}>
        <boxGeometry args={[ENTRANCE.x1 - ENTRANCE.x0, GLASS.height - ENTRANCE.height, 0.03]} />
      </mesh>
      {mullionsX.map((x) => (
        <mesh key={x} material={mullion} position={[x, GLASS.height / 2, 0.03]} castShadow>
          <boxGeometry args={[0.07, GLASS.height, 0.12]} />
        </mesh>
      ))}
      <mesh material={mullion} position={[0, ENTRANCE.height, 0.03]}>
        <boxGeometry args={[GLASS.x1 - GLASS.x0, 0.08, 0.11]} />
      </mesh>
      <SlidingDoors />

      {/* entrance canopy on two slim columns, with downlights */}
      <Slab material={m.trim} size={[8.4, 0.24, 3.6]} position={[0, 3.75, 1.8]} tile={2} />
      {[-3.9, 3.9].map((x) => (
        <mesh key={x} material={mullion} position={[x, 1.87, 3.35]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 3.74, 16]} />
        </mesh>
      ))}
      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={x} material={panelLight} position={[x, 3.62, 1.8]}>
          <cylinderGeometry args={[0.12, 0.12, 0.02, 20]} />
        </mesh>
      ))}
      <mesh position={[0, 5.15, 0.02]}>
        <planeGeometry args={[9.4, 1.93]} />
        <meshStandardMaterial map={sign} transparent roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  );
}

/* ───────────────────────── inside ───────────────────────── */

function OrnamentBand({ width, position, rotation = 0 }: { width: number; position: [number, number, number]; rotation?: number }) {
  const texture = useMemo(() => {
    const t = ornamentTexture().clone();
    t.repeat.set(width / 1.2, 1);
    t.needsUpdate = true;
    return t;
  }, [width]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      <planeGeometry args={[width, 0.6]} />
      <meshStandardMaterial map={texture} roughness={0.35} envMapIntensity={1.2} />
    </mesh>
  );
}
export { OrnamentBand };

/** Freestanding orientation terminal: brushed steel body, slanted 32" screen. */
function Kiosk({ m }: { m: Materials }) {
  const screen = useCanvasTexture(1080, 1440, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0f1a2e');
    g.addColorStop(1, '#0a1220');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f8a5b';
    ctx.fillRect(0, 0, w, 10);
    text(ctx, 'LEXSIM', 70, 120, 44, '#9fb0cf', 700, 'left', 10);
    text(ctx, 'Yoʻnaltirish terminali', 70, 210, 64, '#ffffff', 700);
    text(ctx, 'Amaliyot xonasini tanlang', 70, 280, 36, '#9fb0cf', 500);
    DOORS.slice(0, 6).forEach((d, i) => {
      const y = 380 + i * 150;
      ctx.fillStyle = d.action ? '#16253f' : '#121b2c';
      ctx.fillRect(70, y, w - 140, 124);
      ctx.fillStyle = d.action ? '#1f8a5b' : '#3a4560';
      ctx.fillRect(70, y, 10, 124);
      text(ctx, `${d.number}`, 130, y + 62, 52, '#ffffff', 800, 'center');
      text(ctx, d.title, 190, y + 46, 38, '#ffffff', 600);
      text(ctx, d.action ? d.role : 'Tayyorlanmoqda', 190, y + 90, 28, d.action ? '#8fd3b0' : '#6b7690', 500);
    });
    text(ctx, 'Ekranga yaqinlashing', w / 2, h - 80, 30, '#6b7690', 500, 'center');
  });
  const [x, , z] = KIOSK.position;
  return (
    <group position={[x, 0, z]}>
      <mesh material={m.metal} position={[0, 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.06, 0.5]} />
      </mesh>
      <mesh material={m.trim} position={[0, 0.55, -0.02]} castShadow>
        <boxGeometry args={[0.46, 1.0, 0.26]} />
      </mesh>
      <group position={[0, 1.36, 0.02]} rotation={[-0.32, 0, 0]}>
        <mesh material={m.trim} castShadow>
          <boxGeometry args={[0.66, 0.92, 0.07]} />
        </mesh>
        <mesh position={[0, 0, 0.036]}>
          <planeGeometry args={[0.6, 0.8]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
      </group>
      <mesh material={m.metal} position={[0, 0.82, 0.13]}>
        <boxGeometry args={[0.2, 0.02, 0.03]} />
      </mesh>
    </group>
  );
}

function Foyer({ m }: { m: Materials }) {
  const board = useCanvasTexture(1200, 1500, (ctx, w, h) => {
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, w, h);
    text(ctx, 'XONALAR', 70, 110, 64, '#ffffff', 800, 'left', 6);
    text(ctx, 'Koʻrsatkich · Oʻquv-amaliyot majmuasi', 70, 180, 32, '#9fb0cf', 500);
    DOORS.forEach((d, i) => {
      const y = 290 + i * 128;
      ctx.fillStyle = d.action ? '#1f8a5b' : '#3a4560';
      ctx.fillRect(70, y - 42, 84, 84);
      text(ctx, d.number, 112, y, 52, '#ffffff', 800, 'center');
      text(ctx, d.title, 190, y - 14, 40, '#ffffff', 700);
      text(ctx, d.action ? d.subtitle : 'Tez orada', 190, y + 28, 28, d.action ? '#b7c4dc' : '#7d89a3', 500);
    });
    text(ctx, '[E] — batafsil', w - 70, h - 70, 30, '#ffcf6b', 600, 'right');
  });
  const W = FOYER.x1 - FOYER.x0;
  const D = FOYER.z1 - FOYER.z0;
  const H = FOYER.height;
  const zc = (FOYER.z0 + FOYER.z1) / 2;
  return (
    <group>
      <Slab material={m.terrazzo} size={[W, 0.1, D]} position={[0, -0.05, zc]} tile={TILE.terrazzo} />
      <Slab material={m.ceiling} size={[W, 0.1, D]} position={[0, H + 0.05, zc]} tile={TILE.ceiling} />
      <Slab material={m.plaster} size={[0.2, H, D]} position={[FOYER.x0 - 0.1, H / 2, zc]} tile={TILE.plaster} />
      <Slab material={m.plaster} size={[0.2, H, D]} position={[FOYER.x1 + 0.1, H / 2, zc]} tile={TILE.plaster} />
      {/* back wall with the corridor opening */}
      {[[FOYER.x0, CORRIDOR.x0], [CORRIDOR.x1, FOYER.x1]].map(([a, b]) => (
        <Slab key={a} material={m.plaster} size={[b - a, H, 0.2]} position={[(a + b) / 2, H / 2, FOYER.z0 - 0.1]} tile={TILE.plaster} />
      ))}
      <Slab material={m.plaster} size={[CORRIDOR.x1 - CORRIDOR.x0, H - CORRIDOR.height - 0.01, 0.2]} position={[0, CORRIDOR.height + 0.01 + (H - CORRIDOR.height - 0.01) / 2, FOYER.z0 - 0.1]} tile={TILE.plaster} />
      <Slab material={m.walnut} size={[W - 0.2, 0.12, 0.03]} position={[0, 0.06, FOYER.z0 + 0.02]} tile={TILE.walnut} />
      {[-3.5, 0, 3.5].flatMap((x) => [-2.5, -6.5].map((z) => (
        <mesh key={`${x}:${z}`} material={panelLight} position={[x, H - 0.012, z]}>
          <boxGeometry args={[1.2, 0.02, 0.6]} />
        </mesh>
      )))}
      <pointLight position={[0, H - 0.4, -4.5]} intensity={14} distance={14} decay={2} color="#fff1dc" />

      {/* reception */}
      <Slab material={m.oak} size={[3.2, 1.05, 0.8]} position={[4.2, 0.525, -4.8]} tile={TILE.oak} />
      <Slab material={m.whiteLaminate} size={[3.32, 0.04, 0.92]} position={[4.2, 1.07, -4.78]} tile={1} />
      <Prop model="potted_plant_02" position={[-6.2, 0, -0.9]} rotation={0.6} />
      <Prop model="potted_plant_02" position={[6.2, 0, -8.1]} rotation={2.2} />
      <Prop model="sofa_03" position={[-6.3, 0, -6.2]} rotation={Math.PI / 2} />

      <Kiosk m={m} />
      {/* koshin band along the foyer's back wall, above the corridor opening */}
      <OrnamentBand width={W - 0.4} position={[0, 3.75, FOYER.z0 + 0.012]} />

      {/* directory board — read it with E */}
      <group position={INFO_BOARD.position} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={m.trim} position={[0, 0, -0.03]}>
          <boxGeometry args={[1.32, 1.62, 0.04]} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.2, 1.5]} />
          <meshBasicMaterial map={board} toneMapped={false} color="#d8d8d8" />
        </mesh>
      </group>
    </group>
  );
}

function DoorUnit({ door, m }: { door: DoorDef; m: Materials }) {
  const leaf = useRef<THREE.Group>(null);
  const isOpen = door.action !== null;
  const plaque = useCanvasTexture(900, 520, (ctx, w, h) => {
    ctx.fillStyle = '#f7f6f2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = isOpen ? '#1f8a5b' : '#4a5568';
    ctx.fillRect(0, 0, 220, h);
    text(ctx, door.number, 110, h / 2 - 10, 190, '#ffffff', 800, 'center');
    text(ctx, door.title, 260, 150, 50, '#16213e', 800);
    text(ctx, door.subtitle, 260, 230, 32, '#4a5568', 500);
    ctx.fillStyle = isOpen ? '#1f8a5b' : '#a0a8b5';
    ctx.beginPath();
    ctx.arc(278, 380, 16, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, isOpen ? 'Ochiq · kirish mumkin' : 'Tez orada', 310, 382, 32, isOpen ? '#136443' : '#6b7280', 700);
  });

  useFrame((_, dt) => {
    if (!leaf.current) return;
    const opening = useCampus.getState().opening === door.id;
    leaf.current.rotation.y = THREE.MathUtils.damp(leaf.current.rotation.y, opening ? 1.35 : 0, 4.5, Math.min(dt, 0.05));
  });

  // local frame: door plane at z=0, corridor on +z, x along the wall
  const placement = useMemo(() => {
    if (door.side === 0) return { position: [0, 0, door.z + 0.1] as [number, number, number], rotation: 0 };
    const x = door.side === -1 ? CORRIDOR.x0 + 0.1 : CORRIDOR.x1 - 0.1;
    return { position: [x, 0, door.z] as [number, number, number], rotation: door.side === -1 ? Math.PI / 2 : -Math.PI / 2 };
  }, [door]);
  const w = DOOR_WIDTH;
  return (
    <group position={placement.position} rotation={[0, placement.rotation, 0]}>
      {/* lit room beyond (seen only when the door opens) */}
      <mesh material={roomGlow} position={[0, DOOR_HEIGHT / 2, -1.4]}>
        <planeGeometry args={[w + 0.6, DOOR_HEIGHT + 0.2]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.plaster} position={[s * (w / 2 + 0.05), DOOR_HEIGHT / 2, -0.7]}>
          <boxGeometry args={[0.1, DOOR_HEIGHT, 1.4]} />
        </mesh>
      ))}
      {/* frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.walnut} position={[s * (w / 2 + 0.03), DOOR_HEIGHT / 2, 0.01]} castShadow>
          <boxGeometry args={[0.07, DOOR_HEIGHT + 0.04, 0.24]} />
        </mesh>
      ))}
      <mesh material={m.walnut} position={[0, DOOR_HEIGHT + 0.035, 0.01]}>
        <boxGeometry args={[w + 0.12, 0.07, 0.236]} />
      </mesh>
      {/* leaf, hinged on the left */}
      <group ref={leaf} position={[-w / 2, 0, 0]}>
        <mesh material={m.oak} position={[w / 2, DOOR_HEIGHT / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w - 0.02, DOOR_HEIGHT - 0.02, 0.045]} />
        </mesh>
        <mesh material={m.metal} position={[w - 0.12, 1.02, 0.05]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.009, 0.009, 0.13, 10]} />
        </mesh>
      </group>
      {/* plaque beside the door + status strip above it */}
      <mesh position={[w / 2 + 0.55, 1.55, 0.012]}>
        <planeGeometry args={[0.72, 0.416]} />
        <meshStandardMaterial map={plaque} roughness={0.5} />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT + 0.16, 0.02]}>
        <boxGeometry args={[0.5, 0.05, 0.02]} />
        <meshStandardMaterial color={isOpen ? '#2fd08a' : '#5d6675'} emissive={isOpen ? '#2fd08a' : '#000000'} emissiveIntensity={isOpen ? 2.4 : 0} />
      </mesh>
    </group>
  );
}

function Corridor({ m }: { m: Materials }) {
  const H = CORRIDOR.height;
  const L = CORRIDOR.z1 - CORRIDOR.z0;
  const zc = (CORRIDOR.z0 + CORRIDOR.z1) / 2;
  // wall segments between door openings, per side
  const segments = (side: -1 | 1) => {
    const openings = DOORS.filter((d) => d.side === side).map((d) => d.z).sort((a, b) => b - a);
    const out: [number, number][] = [];
    // the first segment starts behind the foyer's back wall (which already closes that corner)
    let from = CORRIDOR.z1 - 0.2;
    for (const z of openings) {
      out.push([z + DOOR_WIDTH / 2 + 0.07, from]);
      from = z - DOOR_WIDTH / 2 - 0.07;
    }
    out.push([CORRIDOR.z0, from]);
    return out;
  };
  return (
    <group>
      <Slab material={m.terrazzo} size={[CORRIDOR.x1 - CORRIDOR.x0, 0.1, L]} position={[0, -0.05, zc]} tile={TILE.terrazzo} />
      <Slab material={m.ceiling} size={[CORRIDOR.x1 - CORRIDOR.x0, 0.1, L - 0.01]} position={[0, H + 0.05, zc - 0.005]} tile={TILE.ceiling} />
      {([-1, 1] as const).flatMap((side) =>
        segments(side).map(([a, b]) => {
          const x = side === -1 ? CORRIDOR.x0 - 0.1 : CORRIDOR.x1 + 0.1;
          return (
            <group key={`${side}:${a}`}>
              <Slab material={m.plaster} size={[0.2, H, b - a]} position={[x, H / 2, (a + b) / 2]} tile={TILE.plaster} />
              {/* walnut wainscot */}
              <Slab material={m.walnut} size={[0.03, 1.0, b - a]} position={[x - side * 0.115, 0.5, (a + b) / 2]} tile={TILE.walnut} />
            </group>
          );
        }),
      )}
      {([-1, 1] as const).flatMap((side) =>
        DOORS.filter((d) => d.side === side).map((d) => (
          <Slab key={`h${d.id}`} material={m.plaster} size={[0.2, H - DOOR_HEIGHT - 0.07, DOOR_WIDTH + 0.14]} position={[side === -1 ? CORRIDOR.x0 - 0.1 : CORRIDOR.x1 + 0.1, DOOR_HEIGHT + 0.07 + (H - DOOR_HEIGHT - 0.07) / 2, d.z]} tile={TILE.plaster} />
        )),
      )}
      {/* end wall with its door */}
      {[[CORRIDOR.x0, -DOOR_WIDTH / 2 - 0.07], [DOOR_WIDTH / 2 + 0.07, CORRIDOR.x1]].map(([a, b]) => (
        <Slab key={a} material={m.plaster} size={[b - a, H, 0.2]} position={[(a + b) / 2, H / 2, CORRIDOR.z0 - 0.1]} tile={TILE.plaster} />
      ))}
      <Slab material={m.plaster} size={[DOOR_WIDTH + 0.14, H - DOOR_HEIGHT - 0.07, 0.2]} position={[0, DOOR_HEIGHT + 0.07 + (H - DOOR_HEIGHT - 0.07) / 2, CORRIDOR.z0 - 0.1]} tile={TILE.plaster} />

      {Array.from({ length: 10 }, (_, i) => CORRIDOR.z1 - 1.8 - i * 3.4).map((z) => (
        <mesh key={z} material={panelLight} position={[0, H - 0.012, z]}>
          <boxGeometry args={[0.6, 0.02, 1.2]} />
        </mesh>
      ))}
      {[-14, -24, -34].map((z) => (
        <pointLight key={z} position={[0, H - 0.35, z]} intensity={7} distance={11} decay={2} color="#fff1dc" />
      ))}
      {DOORS.map((d) => (
        <DoorUnit key={d.id} door={d} m={m} />
      ))}
    </group>
  );
}

/* ───────────────────────── physics ───────────────────────── */

function Colliders() {
  const W = FACADE.width;
  const half = (a: number, b: number) => Math.abs(b - a) / 2;
  const mid = (a: number, b: number) => (a + b) / 2;
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[130, 0.5, 130]} position={[0, -0.5, 40]} />
      {/* world edge */}
      <CuboidCollider args={[0.5, 4, 50]} position={[-38, 4, 30]} />
      <CuboidCollider args={[0.5, 4, 50]} position={[38, 4, 30]} />
      <CuboidCollider args={[40, 4, 0.5]} position={[0, 4, 62]} />
      {/* front: solid facade + glazing, gap at the entrance */}
      <CuboidCollider args={[half(-W / 2, ENTRANCE.x0), 5, 0.25]} position={[mid(-W / 2, ENTRANCE.x0), 5, -0.1]} />
      <CuboidCollider args={[half(ENTRANCE.x1, W / 2), 5, 0.25]} position={[mid(ENTRANCE.x1, W / 2), 5, -0.1]} />
      {/* foyer */}
      <CuboidCollider args={[0.1, 2.5, half(FOYER.z0, FOYER.z1)]} position={[FOYER.x0 - 0.1, 2.5, mid(FOYER.z0, FOYER.z1)]} />
      <CuboidCollider args={[0.1, 2.5, half(FOYER.z0, FOYER.z1)]} position={[FOYER.x1 + 0.1, 2.5, mid(FOYER.z0, FOYER.z1)]} />
      <CuboidCollider args={[half(FOYER.x0, CORRIDOR.x0), 2.5, 0.1]} position={[mid(FOYER.x0, CORRIDOR.x0), 2.5, FOYER.z0 - 0.1]} />
      <CuboidCollider args={[half(CORRIDOR.x1, FOYER.x1), 2.5, 0.1]} position={[mid(CORRIDOR.x1, FOYER.x1), 2.5, FOYER.z0 - 0.1]} />
      <CuboidCollider args={[1.66, 0.55, 0.46]} position={[4.2, 0.55, -4.8]} />
      <CuboidCollider args={[0.5, 0.5, 1.4]} position={[-6.3, 0.5, -6.2]} />
      {/* corridor (doors stay shut to the body; entering is a scene change) */}
      <CuboidCollider args={[0.1, 2, half(CORRIDOR.z0, CORRIDOR.z1)]} position={[CORRIDOR.x0 - 0.1, 2, mid(CORRIDOR.z0, CORRIDOR.z1)]} />
      <CuboidCollider args={[0.1, 2, half(CORRIDOR.z0, CORRIDOR.z1)]} position={[CORRIDOR.x1 + 0.1, 2, mid(CORRIDOR.z0, CORRIDOR.z1)]} />
      <CuboidCollider args={[half(CORRIDOR.x0, CORRIDOR.x1), 2, 0.1]} position={[0, 2, CORRIDOR.z0 - 0.1]} />
      {/* outdoor furniture */}
      <CuboidCollider args={[0.45, 0.5, 2.2]} position={[-12, 0.5, 13]} />
      <CuboidCollider args={[0.45, 0.5, 2.2]} position={[12, 0.5, 13]} />
      {[-16, -11, 11, 16].map((x) => (
        <CuboidCollider key={x} args={[0.65, 0.3, 0.25]} position={[x, 0.3, 2.2]} />
      ))}
      {[-3.9, 3.9].map((x) => (
        <CuboidCollider key={x} args={[0.1, 1.9, 0.1]} position={[x, 1.9, 3.35]} />
      ))}
      {[-9, 9].flatMap((x) => [8, 18].map((z) => <CuboidCollider key={`${x}:${z}`} args={[0.15, 2, 0.15]} position={[x, 2, z]} />))}
    </RigidBody>
  );
}

/* ───────────────────────── composition ───────────────────────── */

export function CampusWorld({ shadows }: { shadows: number }) {
  const m = useMaterials();
  const ext = useExterior();
  const sun = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    sun.current?.target.position.set(0, 0, -6);
    sun.current?.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <Environment files="/assets/env/kloofendal_48d_partly_cloudy_puresky_2k.hdr" background environmentIntensity={0.75} backgroundIntensity={0.9} />
      <fog attach="fog" args={['#c9d3dd', 70, 190]} />
      <hemisphereLight intensity={0.25} color="#ffffff" groundColor="#8a7e6c" />
      {/* late-afternoon sun from the south-west, raking across the facade */}
      <directionalLight
        ref={sun}
        position={[-26, 22, 30]}
        intensity={3.2}
        color="#ffe9cf"
        castShadow={shadows > 0}
        shadow-mapSize={[shadows || 512, shadows || 512]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <Grounds ext={ext} />
      <Outdoor />
      <Facade m={m} ext={ext} />
      <Foyer m={m} />
      <Corridor m={m} />
      <Colliders />
    </>
  );
}
