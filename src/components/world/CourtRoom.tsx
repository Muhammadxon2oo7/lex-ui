'use client';
/**
 * Courtroom — laid out after real Uzbek district courtrooms (reference:
 * press photographs of open hearings, e.g. daryo.uz, 2020):
 *
 *   · plain light plaster walls, a stepped (tray) ceiling with square LED panels;
 *   · a raised podium; the bench and its high-backed carved chairs in dark
 *     mahogany, a panelled backdrop with a pediment and the round state
 *     State Emblem above the presiding judge (the Law on Courts requires it in
 *     the courtroom — rendered from the official image, see `StateEmblem`);
 *   · two dark doors either side of the backdrop (the judges' door is one of them);
 *   · the parties' tables along the side walls, facing each other across the
 *     floor; the witness at a lectern in the middle, facing the bench;
 *   · an air-conditioner and a wall screen for video-conference hearings.
 *
 * Two points of view: the presiding judge's (the bench exercise) and the
 * claimant's advocate's — you, at the claimant's table.
 */
import { Environment } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Emotion, Gesture } from '@/contracts';
import type { Speaker } from '@/contracts/hearing';
import { Character, type CharacterModel } from './Character';
import { DocShape } from '@/components/case/DeskItems';
import type { DeskDoc } from '@/components/case/documents';
import { Prop } from './Furniture';
import { TILE, UI_FONT, canvasTexture, tiledBox, useMaterials, type Materials } from './materials';
import { Flag, StateEmblem } from './SetDressing';
import { DevProbe, FitFov, FrameForPanel, QualityGovernor, RoomFx, SeatCamera, Window, useTier } from '@/components/case/stagecraft';
import { audio } from '@/game/audio';

type V3 = [number, number, number];

/* ───────────────────────── layout ───────────────────────── */

const W = 11, D = 12, H = 3.6, ZC = 0.5;
const BACK = ZC - D / 2; // −5.5
const PODIUM = 0.25;

/** Presiding judge's own eye (bench exercise). */
const EYE: V3 = [0, 1.55, -4.55];
/** You, the claimant's advocate, at the claimant's table on the left wall, facing across the room (+x). */
const ME_AT: V3 = [-4.55, 0, -1.55];
const ADVOCATE = { seated: [-4.4, 1.2, -1.55] as V3, standing: [-3.97, 1.63, -1.55] as V3 };
const CLIENT_AT: V3 = [-4.55, 0, -0.6];
const JUDGE_SEAT = { position: [0, PODIUM, -4.92] as V3, at: [0, 1.5, -4.8] as V3 };
/** The judges' door: right of the backdrop, on the podium. */
const JUDGE_DOOR: [number, number] = [4.0, -5.2];
/** Half the width of the door opening, and the height of its head above the floor. */
const DOOR_HALF = 0.5;
const DOOR_TOP = PODIUM + 2.17;
/** The judge walks in from the corridor behind the wall, through the door, along the podium to the chair. */
const JUDGE_ROUTE: [number, number][] = [[4.0, -7.3], [4.0, -5.0], [2.6, -4.5], [0.9, -4.5]];
const JUDGE_EXIT: [number, number][] = [[0.9, -4.5], [2.6, -4.5], [4.0, -5.0], [4.0, -7.3]];
/** A witness waits in the corridor and walks in through the hall's entrance, down the aisle. */
const WITNESS_ROUTE: [number, number][] = [[-3.6, 6.0], [-0.7, 5.4], [0, 3.0], [0, 0.1]];

/** Who sits where; `at` is the head the cameras and eyes turn to. */
const SEATS: Record<Exclude<Speaker, 'judge' | 'system'>, { position: V3; rotation: number; at: V3 }> = {
  claimant: { position: CLIENT_AT, rotation: Math.PI / 2, at: [-4.35, 1.25, -0.6] },
  respondent: { position: [4.55, 0, -0.6], rotation: -Math.PI / 2, at: [4.35, 1.45, -0.6] },
  secretary: { position: [4.55, 0, -2.65], rotation: -Math.PI / 2, at: [4.35, 1.45, -2.65] },
  // the witness stands behind the lectern (back at z −1.09) with a hand's breadth to spare
  witness: { position: [0, 0, -0.45], rotation: Math.PI, at: [0, 1.6, -0.9] },
};

/** The value, but only after a delay — people do not all move on the same frame. */
function useLag<T>(value: T, ms: number): T {
  const [lagged, setLagged] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setLagged(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return lagged;
}

const _door = new THREE.Vector3();

/* ───────────────────────── materials & primitives ───────────────────────── */

function Box({ m, size, position, tile = 1, rotation = 0 }: { m: THREE.Material; size: V3; position: V3; tile?: number; rotation?: number }) {
  const geometry = useMemo(() => tiledBox(size[0], size[1], size[2], tile), [size, tile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={m} position={position} rotation={[0, rotation, 0]} castShadow receiveShadow />;
}

const ledPanel = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#f6f8ff'), emissiveIntensity: 2.2, roughness: 0.6 });
const gold = new THREE.MeshStandardMaterial({ color: '#c9a45c', metalness: 0.85, roughness: 0.32 });
const black = new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.5, metalness: 0.2 });
const whitePlastic = new THREE.MeshStandardMaterial({ color: '#f2f2ef', roughness: 0.45 });
const doorWood = new THREE.MeshStandardMaterial({ color: '#3a2620', roughness: 0.55 });

/** Dark red-brown mahogany: the walnut veneer, stained (shared look of every court-building room). */
export function useMahogany(m: Materials) {
  const mat = useMemo(() => {
    const c = m.walnut.clone();
    c.color = new THREE.Color('#7e3a2b');
    c.roughness = 0.62;
    return c;
  }, [m.walnut]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

function useText(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useMemo(() => canvasTexture(w, h, draw), []);
  useEffect(() => () => t.dispose(), [t]);
  return t;
}

/* ───────────────────────── the room ───────────────────────── */

/** Walls, parquet, the stepped ceiling with square LED panels, cornice. */
function Shell({ m }: { m: Materials }) {
  const sign = useText(1400, 220, (ctx, w, h) => {
    ctx.font = `700 70px ${UI_FONT}`;
    ctx.fillStyle = '#2a2a2a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('2-SUD MAJLISLARI ZALI', w / 2, h * 0.42);
    ctx.font = `500 36px ${UI_FONT}`;
    ctx.fillStyle = '#7a5a2a';
    ctx.fillText('Fuqarolik ishlari boʻyicha Namuna tumanlararo sudi · oʻquv', w / 2, h * 0.8);
  });
  const panels: [number, number][] = [];
  for (const x of [-3.3, -1.1, 1.1, 3.3]) for (const z of [-2.6, 0.2, 3.0, 5.4]) panels.push([x, z]);
  return (
    <group>
      <Box m={m.laminate} size={[W, 0.1, D]} position={[0, -0.05, ZC]} tile={TILE.laminate} />
      {/* stepped ceiling: a lowered border round a higher field */}
      <Box m={m.ceiling} size={[W - 1.4, 0.1, D - 1.4]} position={[0, H + 0.05, ZC]} tile={TILE.ceiling} />
      <Box m={m.plaster} size={[W, 0.25, 0.7]} position={[0, H - 0.125, BACK + 0.35]} tile={TILE.plaster} />
      <Box m={m.plaster} size={[W, 0.25, 0.7]} position={[0, H - 0.125, ZC + D / 2 - 0.35]} tile={TILE.plaster} />
      <Box m={m.plaster} size={[0.7, 0.25, D - 1.4]} position={[-W / 2 + 0.35, H - 0.125, ZC]} tile={TILE.plaster} />
      <Box m={m.plaster} size={[0.7, 0.25, D - 1.4]} position={[W / 2 - 0.35, H - 0.125, ZC]} tile={TILE.plaster} />
      <Box m={whitePlastic} size={[W - 1.4, 0.06, 0.06]} position={[0, H - 0.27, BACK + 0.72]} />
      {/* back wall, with a real opening for the judges' door (they come in from the corridor behind it) */}
      <Box m={m.plaster} size={[JUDGE_DOOR[0] - DOOR_HALF + W / 2, H, 0.2]} position={[(JUDGE_DOOR[0] - DOOR_HALF - W / 2) / 2, H / 2, BACK]} tile={TILE.plaster} />
      <Box m={m.plaster} size={[W / 2 - JUDGE_DOOR[0] - DOOR_HALF, H, 0.2]} position={[(W / 2 + JUDGE_DOOR[0] + DOOR_HALF) / 2, H / 2, BACK]} tile={TILE.plaster} />
      <Box m={m.plaster} size={[DOOR_HALF * 2, H - DOOR_TOP, 0.2]} position={[JUDGE_DOOR[0], (H + DOOR_TOP) / 2, BACK]} tile={TILE.plaster} />
      <Box m={m.plaster} size={[W, H, 0.2]} position={[0, H / 2, ZC + D / 2]} tile={TILE.plaster} />
      <Box m={m.plaster} size={[0.2, H, D]} position={[-W / 2, H / 2, ZC]} tile={TILE.plaster} />
      <Box m={m.plaster} size={[0.2, H, D]} position={[W / 2, H / 2, ZC]} tile={TILE.plaster} />
      {/* skirting */}
      <Box m={doorWood} size={[0.02, 0.1, D - 0.4]} position={[-W / 2 + 0.11, 0.05, ZC]} />
      <Box m={doorWood} size={[0.02, 0.1, D - 0.4]} position={[W / 2 - 0.11, 0.05, ZC]} />
      {panels.map(([x, z]) => (
        <mesh key={`${x}:${z}`} material={ledPanel} position={[x, H - 0.012, z]}>
          <boxGeometry args={[0.6, 0.02, 0.6]} />
        </mesh>
      ))}
      {[-2.2, 0.9, 4.0].map((z) => <Window key={z} m={m} position={[W / 2 - 0.13, 2.05, z]} rotation={-Math.PI / 2} size={[1.3, 1.3]} />)}
      <mesh position={[0, 2.65, ZC + D / 2 - 0.115]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[4.6, 0.72]} />
        <meshStandardMaterial map={sign} transparent roughness={0.7} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {/* the public entrance, back of the hall */}
      <Box m={doorWood} size={[1.0, 2.15, 0.06]} position={[-3.6, 1.075, ZC + D / 2 - 0.13]} />
      <Box m={gold} size={[0.03, 0.22, 0.04]} position={[-3.2, 1.05, ZC + D / 2 - 0.17]} />
      <pointLight position={[0, 3.2, -2.6]} intensity={8} distance={12} decay={2} color="#fff4e6" />
      <pointLight position={[0, 3.2, 2.6]} intensity={7} distance={12} decay={2} color="#fff4e6" />
    </group>
  );
}

/** Panelled mahogany backdrop behind the judges' chairs, with a pediment and the State Emblem. */
function Backdrop({ wood }: { wood: THREE.Material }) {
  const pediment = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2.05, 0);
    s.lineTo(2.05, 0);
    s.lineTo(0, 0.42);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
    g.translate(0, 0, -0.06);
    return g;
  }, []);
  useEffect(() => () => pediment.dispose(), [pediment]);
  const z = BACK + 0.2;
  return (
    <group>
      <Box m={wood} size={[3.9, 2.45, 0.08]} position={[0, PODIUM + 1.225, z]} tile={1.3} />
      {/* raised panels and pilasters */}
      {[-1.3, 0, 1.3].map((x) => <Box key={x} m={wood} size={[1.05, 1.9, 0.03]} position={[x, PODIUM + 1.15, z + 0.05]} tile={1.3} />)}
      {[-1.95, 1.95].map((x) => <Box key={x} m={wood} size={[0.12, 2.6, 0.14]} position={[x, PODIUM + 1.3, z + 0.04]} tile={1.3} />)}
      <Box m={wood} size={[4.15, 0.1, 0.18]} position={[0, PODIUM + 2.5, z + 0.04]} tile={1.3} />
      <mesh geometry={pediment} material={wood} position={[0, PODIUM + 2.55, z + 0.04]} castShadow />
      {/* clear of the ceiling's border (its underside at H − 0.25) */}
      <StateEmblem position={[0, PODIUM + 2.72, z + 0.16]} radius={0.28} />
    </group>
  );
}

/**
 * A dark door. The judges' one is a real doorway onto a short lit corridor;
 * it swings open into the hall (hinged on the wall side, clear of the judge's
 * path) when the judge is at it — driven by where the judge actually is.
 */
function Door({ x, judge, m }: { x: number; judge?: { current: THREE.Vector3 }; m?: Materials }) {
  const leaf = useRef<THREE.Group>(null);
  const was = useRef<'shut' | 'open'>('shut');
  useFrame(({ camera }, dt) => {
    if (!judge || !leaf.current) return;
    const near = Math.hypot(judge.current.x - JUDGE_DOOR[0], judge.current.z - JUDGE_DOOR[1]) < 1.25;
    leaf.current.rotation.y = THREE.MathUtils.damp(leaf.current.rotation.y, near ? 1.45 : 0, near ? 4 : 2.5, dt);
    // the latch as it opens, the thud as it shuts — heard from where you sit
    const level = Math.min(1, 3 / Math.max(1, camera.position.distanceTo(_door.set(x, 1.1, BACK))));
    if (near && was.current === 'shut') {
      was.current = 'open';
      audio.door(true, level);
    } else if (!near && was.current === 'open' && leaf.current.rotation.y < 0.08) {
      was.current = 'shut';
      audio.door(false, level);
    }
  });
  const corridor = 2.3;
  return (
    <group position={[x, PODIUM, BACK + 0.12]}>
      {m ? (
        <>
          {/* frame round the opening */}
          {/* frame: the head sits a little below the lintel and inside the jambs — no shared planes */}
          {[-1, 1].map((k) => <Box key={k} m={black} size={[0.05, 2.2, 0.26]} position={[k * (DOOR_HALF + 0.005), 1.1, -0.11]} />)}
          <Box m={black} size={[1.04, 0.05, 0.25]} position={[0, 2.145, -0.11]} />
          {/* threshold: the podium level carries on through the wall */}
          <Box m={doorWood} size={[0.99, PODIUM - 0.003, 0.27]} position={[0, -PODIUM / 2 - 0.0015, -0.11]} />
          {/* the corridor behind: floor level with the podium, plain walls, its own light */}
          <Box m={m.laminate} size={[1.6, 0.1, corridor]} position={[0, -0.05, -0.22 - corridor / 2]} tile={TILE.laminate} />
          <Box m={m.plaster} size={[1.6, 0.1, corridor]} position={[0, 2.65, -0.22 - corridor / 2]} tile={TILE.plaster} />
          {[-1, 1].map((k) => <Box key={k} m={m.plaster} size={[0.1, 2.7, corridor]} position={[k * 0.85, 1.3, -0.22 - corridor / 2]} tile={TILE.plaster} />)}
          <Box m={m.plaster} size={[1.8, 2.7, 0.1]} position={[0, 1.3, -0.27 - corridor]} tile={TILE.plaster} />
          <pointLight position={[0, 2.3, -1.4]} intensity={1.6} distance={3.2} decay={2} color="#fff1df" />
        </>
      ) : (
        <Box m={black} size={[1.06, 2.2, 0.04]} position={[0, 1.1, -0.02]} />
      )}
      <group ref={leaf} position={[0.47, 0, 0]}>
        <Box m={doorWood} size={[0.94, 2.12, 0.05]} position={[-0.47, 1.06, 0.01]} />
        <Box m={gold} size={[0.02, 0.18, 0.03]} position={[-0.84, 1.0, 0.05]} />
      </group>
    </group>
  );
}

function AirConditioner({ position, rotation }: { position: V3; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={whitePlastic} castShadow>
        <boxGeometry args={[0.9, 0.29, 0.2]} />
      </mesh>
      <mesh material={black} position={[0, -0.1, 0.101]}>
        <boxGeometry args={[0.8, 0.03, 0.005]} />
      </mesh>
    </group>
  );
}

/** The hall screen: dark, or the case being heard (court, kind of case, «Sud majlisi»). */
function WallScreen({ position, rotation, lines }: { position: V3; rotation: number; lines?: string[] }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={black} castShadow>
        <boxGeometry args={[1.1, 0.64, 0.05]} />
      </mesh>
      {lines?.length ? <ScreenText key={lines.join('|')} lines={lines} /> : (
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[1.04, 0.58]} />
          <meshStandardMaterial color="#0d1116" roughness={0.15} metalness={0.2} />
        </mesh>
      )}
    </group>
  );
}

function ScreenText({ lines }: { lines: string[] }) {
  const t = useText(1024, 576, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#13233b');
    g.addColorStop(1, '#0b1626');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9a45c';
    ctx.fillRect(72, 96, 8, h - 192);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 34px ${UI_FONT}`;
    ctx.fillText(lines[0] ?? '', 112, 168);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 64px ${UI_FONT}`;
    ctx.fillText(lines[1] ?? '', 112, 268, w - 180);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `500 40px ${UI_FONT}`;
    lines.slice(2).forEach((l, i) => ctx.fillText(l, 112, 352 + i * 58, w - 180));
  });
  return (
    <mesh position={[0, 0, 0.03]}>
      <planeGeometry args={[1.04, 0.58]} />
      <meshStandardMaterial map={t} emissive="#ffffff" emissiveMap={t} emissiveIntensity={0.55} roughness={0.3} />
    </mesh>
  );
}

function Microphone({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={black} position={[0, 0.012, 0]}><cylinderGeometry args={[0.05, 0.06, 0.024, 20]} /></mesh>
      <mesh material={black} position={[0, 0.16, 0.05]} rotation={[0.45, 0, 0]}><cylinderGeometry args={[0.005, 0.005, 0.32, 8]} /></mesh>
      <mesh material={black} position={[0, 0.3, 0.12]} rotation={[0.9, 0, 0]}><cylinderGeometry args={[0.012, 0.009, 0.07, 12]} /></mesh>
    </group>
  );
}

function Nameplate({ text, position, rotation = 0 }: { text: string; position: V3; rotation?: number }) {
  const t = useText(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1b2433';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9a45c';
    ctx.fillRect(0, h - 8, w, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 54px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h * 0.46);
  });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh rotation={[-0.35, 0, 0]} position={[0, 0.045, 0]}>
        <boxGeometry args={[0.36, 0.09, 0.012]} />
        <meshStandardMaterial color="#1b2433" />
      </mesh>
      <mesh rotation={[-0.35, 0, 0]} position={[0, 0.045, 0.009]}>
        <planeGeometry args={[0.36, 0.09]} />
        <meshStandardMaterial map={t} roughness={0.5} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  );
}

/**
 * A party's desk in mahogany. Built facing −z (modesty panel and nameplate
 * toward −z); `rotation` turns it to face across the room.
 */
function Table({ wood, m, position, rotation = 0, width = 1.6, label, decor = true, docs }: { wood: THREE.Material; m: Materials; position: V3; rotation?: number; width?: number; label?: string; decor?: boolean; docs?: DeskDoc[] }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Box m={wood} size={[width, 0.045, 0.72]} position={[0, 0.745, 0]} tile={1.3} />
      <Box m={wood} size={[width, 0.7, 0.04]} position={[0, 0.37, -0.34]} tile={1.3} />
      {[-width / 2 + 0.03, width / 2 - 0.03].map((x) => <Box key={x} m={wood} size={[0.05, 0.72, 0.7]} position={[x, 0.36, 0]} tile={1.3} />)}
      {label && <Nameplate text={label} position={[0, 0.77, -0.27]} rotation={Math.PI} />}
      <Microphone position={[-width / 2 + 0.3, 0.77, -0.18]} rotation={Math.PI} />
      {docs?.length ? <TablePapers docs={docs} width={width} /> : decor && (
        <mesh material={m.paper} position={[0.25, 0.77, 0.05]} rotation={[0, 0.15, 0]}>
          <boxGeometry args={[0.21, 0.004, 0.297]} />
        </mesh>
      )}
    </group>
  );
}

/**
 * The case papers on a party's table: laid out side by side in front of the
 * sitters (+z), each a little askew like real papers; extra ones stack.
 */
function TablePapers({ docs, width }: { docs: DeskDoc[]; width: number }) {
  // seen from a chair a metre or two away: a smaller page is just as legible and far lighter on the GPU
  const res = { low: 512, medium: 640, high: 768 }[useTier()];
  const slots = Math.max(1, Math.floor((width - 0.7) / 0.29));
  return (
    <>
      {docs.map((d, i) => {
        const slot = i % slots;
        const layer = Math.floor(i / slots);
        const x = -width / 2 + 0.62 + slot * 0.29 + layer * 0.04;
        const tilt = ((i * 37) % 9 - 4) * 0.035;
        return (
          <group key={d.id + i} position={[x, 0.768 + layer * 0.004, 0.1 + layer * 0.03]} rotation={[0, Math.PI + tilt, 0]}>
            <DocShape doc={d} res={res} />
          </group>
        );
      })}
    </>
  );
}

/** High-backed carved judge's chair (mahogany frame, dark leather). */
function JudgeChair({ m, wood, position }: { m: Materials; wood: THREE.Material; position: V3 }) {
  return (
    <group position={position}>
      <Box m={m.leather} size={[0.6, 0.12, 0.55]} position={[0, 0.4, 0.02]} tile={TILE.leather} />
      <Box m={m.leather} size={[0.56, 0.95, 0.08]} position={[0, 0.98, -0.27]} tile={TILE.leather} />
      <Box m={wood} size={[0.7, 1.3, 0.06]} position={[0, 0.95, -0.32]} tile={1.3} />
      {/* carved crest, a little thinner than the back it rises from (no shared faces) */}
      <mesh material={wood} position={[0, 1.66, -0.32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.054, 32, 1, false, 0, Math.PI]} />
      </mesh>
      {[-0.33, 0.33].map((x) => <Box key={x} m={wood} size={[0.06, 0.26, 0.5]} position={[x, 0.58, 0]} tile={1.3} />)}
      {[-0.26, 0.26].flatMap((x) => [-0.22, 0.22].map((z) => <Box key={`${x}:${z}`} m={wood} size={[0.05, 0.36, 0.05]} position={[x, 0.18, z]} tile={1.3} />))}
    </group>
  );
}

/** Public bench row (mahogany). */
function Bench({ wood, position }: { wood: THREE.Material; position: V3 }) {
  return (
    <group position={position}>
      <Box m={wood} size={[3.4, 0.05, 0.42]} position={[0, 0.45, 0]} tile={1.3} />
      <Box m={wood} size={[3.4, 0.42, 0.04]} position={[0, 0.72, 0.21]} tile={1.3} />
      {[-1.6, 0, 1.6].map((x) => <Box key={x} m={wood} size={[0.05, 0.45, 0.4]} position={[x, 0.225, 0]} tile={1.3} />)}
    </group>
  );
}

/* ───────────────────────── scene ───────────────────────── */

type CourtProps = {
  speaker: Speaker | null;
  witnessPresent: boolean;
  witnessCalled: boolean;
  standing: Speaker[];
  /** Whose eyes: the presiding judge's (default) or the claimant's advocate's. */
  view?: 'judge' | 'advocate';
  judgePresent?: boolean;
  /** How many times the judge has entered (each entrance is walked from the judges' door). */
  judgeEntries?: number;
  advocateStanding?: boolean;
  /** The advocate (you) is speaking: the room looks at you. */
  advocateSpeaking?: boolean;
  /**
   * The room's attention is on you without you speaking: you stayed seated when everyone rose,
   * you spoke without rising, or the court waits for your answer. Heads turn to you (when nobody
   * else speaks) and the judge's face hardens — the room's own way of saying "stand up".
   */
  attention?: 'rise' | 'waiting' | null;
  /** Things placed in the room from outside (the papers on your table). */
  extra?: React.ReactNode;
  /** The student's own body at the advocate's seat. */
  avatar?: 'man' | 'woman';
  /** Feelings of whoever is speaking now. */
  moods?: Partial<Record<Speaker, Emotion>>;
  /** Gesture that goes with the current line. */
  cue?: { speaker: Speaker; cue: { id: string; clip: Gesture } | null };
  /** Table plates: your table (left) and the other side's (right). Default: claimant / respondent. */
  labels?: { left: string; right: string };
  /** Who sits in the hall for this case (see game/courtStage): your principal, the other side, a witness. */
  cast?: { principal?: CharacterModel | null; opponent?: CharacterModel; witness?: CharacterModel };
  /** The papers on your table (left) and the other side's (right). */
  papers?: { left: DeskDoc[]; right: DeskDoc[] };
  /** The hall screen: court, kind of case, … (dark when absent). */
  screen?: string[];
};

function Scene({ speaker, witnessPresent, witnessCalled, standing, view = 'judge', judgePresent = true, judgeEntries = 1, advocateStanding = false, advocateSpeaking = false, attention = null, moods, cue, avatar = 'man', extra, labels = { left: 'DAʼVOGAR', right: 'JAVOBGAR' }, cast, papers, screen }: CourtProps) {
  const principal = cast?.principal === undefined ? 'client' : cast.principal;
  const opponent = cast?.opponent ?? 'lawyer';
  const witnessModel = cast?.witness ?? 'worker';
  // someone not rising for the court: the judge is impatient, the clerk unsure; waiting for an answer: the judge expects it
  const stare: Partial<Record<Speaker, Emotion>> = attention === 'rise' ? { judge: 'impatient', secretary: 'uncertain', respondent: 'confused' } : attention === 'waiting' ? { judge: 'impatient' } : {};
  const feel = (who: Speaker, fallback: Emotion): Emotion => moods?.[who] ?? stare[who] ?? fallback;
  const gest = (who: Speaker) => (cue?.speaker === who ? cue.cue : null);
  const advocate = view === 'advocate';
  const judgeAt = useRef(new THREE.Vector3(1e4, 0, 1e4));
  const heads: Partial<Record<Speaker | 'advocate', V3>> = {
    judge: JUDGE_SEAT.at,
    secretary: SEATS.secretary.at,
    claimant: SEATS.claimant.at,
    respondent: SEATS.respondent.at,
    witness: SEATS.witness.at,
    advocate: advocateStanding ? ADVOCATE.standing : ADVOCATE.seated,
  };
  // whoever speaks holds the room; with nobody speaking, the room's attention may still be on you
  const talker = advocateSpeaking || (attention && (!speaker || speaker === 'system')) ? 'advocate' : speaker;
  // everyone looks at whoever is speaking — at you only when you speak
  const gaze = (self: Speaker): V3 | undefined => {
    if (!advocate) return EYE;
    if (!talker || talker === self || talker === 'system') return self === 'judge' ? undefined : judgePresent ? JUDGE_SEAT.at : undefined;
    return heads[talker];
  };
  // everyone rises, but not on the same frame
  const lagSecretary = useLag(standing.includes('secretary'), 0);
  const lagRespondent = useLag(standing.includes('respondent'), 420);
  const lagClient = useLag(standing.includes('claimant'), 750);
  const lagJudge = useLag(standing.length > 1, 200);
  // the sound of the hall getting up / sitting down (not on first render)
  const hallUp = standing.length > 1;
  const heardHall = useRef(hallUp);
  useEffect(() => {
    if (heardHall.current === hallUp) return;
    heardHall.current = hallUp;
    audio.hall(hallUp);
  }, [hallUp]);
  const up = (role: Speaker) => standing.includes(role);
  const m = useMaterials();
  const wood = useMahogany(m);
  const chair = (at: V3, rotation: number) => <Prop model="dining_chair_02" position={[at[0] - Math.sin(rotation) * 0.02, 0, at[2] - Math.cos(rotation) * 0.02]} rotation={rotation} />;
  const focus = speaker === 'judge' ? (advocate ? JUDGE_SEAT.at : null) : speaker && speaker !== 'system' ? SEATS[speaker].at : null;
  return (
    <>
      {advocate ? (
        <SeatCamera seated={ADVOCATE.seated} standing={ADVOCATE.standing} up={advocateStanding} base={-1.0} focus={focus} limit={1.35} />
      ) : (
        <SeatCamera seated={EYE} base={Math.PI} focus={focus} limit={1.25} />
      )}
      <Environment files="/assets/env/small_empty_room_1_1k.hdr" environmentIntensity={0.6} />
      <hemisphereLight intensity={0.32} color="#ffffff" groundColor="#b6a58f" />
      <directionalLight position={[8, 7, 1]} intensity={1.2} color="#fff0dc" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-0.0004} shadow-normalBias={0.03} />
      <Shell m={m} />
      <AirConditioner position={[-W / 2 + 0.22, 2.75, -3.2]} rotation={Math.PI / 2} />
      <WallScreen position={[W / 2 - 0.14, 2.1, -4.2]} rotation={-Math.PI / 2} lines={screen} />

      {/* the podium, with a step, across the back of the hall */}
      <Box m={wood} size={[W - 0.2, PODIUM, 1.95]} position={[0, PODIUM / 2, BACK + 1.07]} tile={1.3} />
      <Box m={wood} size={[4.6, 0.12, 0.3]} position={[0, 0.06, BACK + 2.2]} tile={1.3} />
      <Backdrop wood={wood} />
      <Door x={-4.0} />
      <Door x={JUDGE_DOOR[0]} m={m} judge={advocate ? judgeAt : undefined} />
      <Flag m={m} position={[-2.6, PODIUM, BACK + 0.6]} />

      {/* the bench: a long mahogany desk, three high-backed chairs */}
      <Box m={wood} size={[4.0, 0.83, 0.06]} position={[0, PODIUM + 0.415, BACK + 1.88]} tile={1.3} />
      {[-2, 2].map((x) => <Box key={x} m={wood} size={[0.06, 0.83, 0.72]} position={[x, PODIUM + 0.415, BACK + 1.53]} tile={1.3} />)}
      <Box m={wood} size={[4.1, 0.045, 0.78]} position={[0, PODIUM + 0.855, BACK + 1.54]} tile={1.3} />
      <mesh material={m.paper} position={[-0.35, PODIUM + 0.882, BACK + 1.55]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[0.21, 0.004, 0.297]} />
      </mesh>
      <Microphone position={[0.45, PODIUM + 0.878, BACK + 1.7]} />
      {[-1.0, 0, 1.0].map((x) => <JudgeChair key={x} m={m} wood={wood} position={[x, PODIUM, JUDGE_SEAT.position[2] - 0.02]} />)}
      {advocate && judgeEntries > 0 && (
        <Suspense fallback={null}>
          <Character key={`judge-${judgeEntries}`} model="elder_man" robe position={JUDGE_SEAT.position} rotation={0} seatTop={0.46} seed={11} mood={feel('judge', 'calm')} cue={gest('judge')}
            talking={speaker === 'judge'} lookAt={gaze('judge')} standing={lagJudge || !judgePresent} enterPath={JUDGE_ROUTE} exitPath={JUDGE_EXIT} leave={!judgePresent} track={judgeAt} restless={false} />
        </Suspense>
      )}

      {extra}

      {/* claimant's table, left wall: you and Sardor */}
      <Table wood={wood} m={m} position={[-3.6, 0, -1.1]} rotation={-Math.PI / 2} width={2.1} label={labels.left} decor={!advocate} docs={papers?.left} />
      {chair(ME_AT, Math.PI / 2)}
      {chair(CLIENT_AT, Math.PI / 2)}
      {advocate && <Character model={avatar} position={ME_AT} rotation={Math.PI / 2} seatTop={0.46} seed={13} mood="calm" restless={false} firstPerson standing={advocateStanding} />}
      {principal && <Character model={principal} {...SEATS.claimant} seatTop={0.46} seed={2} mood="uncertain" restless={false} talking={speaker === 'claimant'} lookAt={advocate ? gaze('claimant') : EYE} standing={advocate ? lagClient : up('claimant')} />}

      {/* respondent's table, right wall, facing you */}
      <Table wood={wood} m={m} position={[3.6, 0, -0.6]} rotation={Math.PI / 2} width={1.9} label={labels.right} docs={papers?.right} />
      {chair(SEATS.respondent.position, SEATS.respondent.rotation)}
      <Character model={opponent} {...SEATS.respondent} seatTop={0.46} seed={3} mood={feel('respondent', 'neutral')} cue={gest('respondent')} restless={false} upright={0.14} talking={speaker === 'respondent'} lookAt={gaze('respondent')} standing={advocate ? lagRespondent : up('respondent')} />

      {/* secretary, right, by the podium */}
      <Table wood={wood} m={m} position={[3.6, 0, -2.65]} rotation={Math.PI / 2} width={1.3} label="KOTIB" />
      {chair(SEATS.secretary.position, SEATS.secretary.rotation)}
      <Character model="secretary" {...SEATS.secretary} seatTop={0.46} seed={5} atWork mood={feel('secretary', 'calm')} cue={gest('secretary')} restless={false} upright={0.08} talking={speaker === 'secretary'} lookAt={gaze('secretary')} standing={advocate ? lagSecretary : up('secretary')} />

      {/* the witness lectern, in the middle, facing the bench */}
      {!advocate && chair(SEATS.witness.position, SEATS.witness.rotation)}
      <group position={[0, 0, -1.3]}>
        <Box m={wood} size={[0.75, 1.05, 0.42]} position={[0, 0.525, 0]} tile={1.3} />
        <Box m={wood} size={[0.82, 0.04, 0.5]} position={[0, 1.07, 0.02]} tile={1.3} />
        <Microphone position={[0.18, 1.09, -0.1]} />
      </group>
      {witnessPresent && (
        witnessCalled ? (
          advocate ? (
            // walks in down the aisle and testifies standing at the lectern (FPK 212)
            <Suspense fallback={null}>
              <Character model={witnessModel} {...SEATS.witness} seatTop={0.46} seed={4} mood={feel('witness', 'uncertain')} cue={gest('witness')} restless={false} talking={speaker === 'witness'} lookAt={gaze('witness') ?? JUDGE_SEAT.at} standing enterPath={WITNESS_ROUTE} />
            </Suspense>
          ) : (
            <Character model={witnessModel} {...SEATS.witness} seatTop={0.46} seed={4} mood="uncertain" talking={speaker === 'witness'} lookAt={EYE} standing={up('witness')} />
          )
        ) : advocate ? null : (
          <Character model={witnessModel} position={[-1.6, 0, 3.6]} rotation={Math.PI} seatTop={0.46} seed={4} mood="neutral" lookAt={EYE} standing={up('witness')} />
        )
      )}

      {/* the public: a low rail and rows of benches either side of the aisle */}
      <Box m={wood} size={[4.2, 0.9, 0.05]} position={[-2.9, 0.45, 1.4]} tile={1.3} />
      <Box m={wood} size={[4.2, 0.9, 0.05]} position={[2.9, 0.45, 1.4]} tile={1.3} />
      {[2.4, 3.6, 4.8].flatMap((z) => [-2.9, 2.9].map((x) => <Bench key={`${x}:${z}`} wood={wood} position={[x, 0, z]} />))}
    </>
  );
}

export default function CourtRoom(props: CourtProps) {
  const advocate = props.view === 'advocate';
  return (
    <Canvas shadows="percentage" dpr={[1, 1.75]} gl={{ antialias: false, powerPreference: 'high-performance' }} onCreated={({ gl }) => (gl.toneMapping = THREE.NoToneMapping)} camera={{ fov: 60, near: 0.1, far: 40, position: advocate ? ADVOCATE.seated : EYE }} role="img" aria-label={advocate ? '3D sud zali, daʼvogar vakili oʻrnidan koʻrinish' : '3D sud zali, raislik qiluvchi oʻrnidan koʻrinish'} className="cursor-grab active:cursor-grabbing">
      <color attach="background" args={['#0c0f14']} />
      <Suspense fallback={null}>
        <Scene {...props} />
        {advocate && <FrameForPanel />}
        <FitFov />
        <QualityGovernor />
        <DevProbe />
        <RoomFx />
      </Suspense>
    </Canvas>
  );
}
