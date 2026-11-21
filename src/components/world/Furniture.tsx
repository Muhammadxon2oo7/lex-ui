'use client';
/**
 * Props and set dressing: photoscanned CC0 models (Poly Haven → Meshopt GLB),
 * the custom desk + workstation, signage drawn on canvas, and the two
 * scenario-driven props (envelope, queue display).
 */
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { DESK, MONITOR, SEAT } from '@/game/manifest';
import { useGame } from '@/game/store';
import { TILE, UI_FONT, canvasTexture, ornamentTexture, tiledBox, type Materials } from './materials';

const MODELS = [
  'modern_arm_chair_01', 'dining_chair_02', 'sofa_03', 'potted_plant_02', 'potted_plant_04', 'wall_clock',
  'desk_lamp_arm_01', 'binder_notebook', 'book_encyclopedia_set_01', 'drawer_cabinet', 'modern_coffee_table_01', 'Shelf_01',
] as const;
type Model = (typeof MODELS)[number];
const url = (model: string) => `/assets/models/${model}.glb`;
MODELS.forEach((m) => useGLTF.preload(url(m)));

type PropProps = { model: Model | (string & {}); position: [number, number, number]; rotation?: number; scale?: number };

export function Prop({ model, position, rotation = 0, scale = 1 }: PropProps) {
  const { scene } = useGLTF(url(model));
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    return clone;
  }, [scene]);
  return <primitive object={object} position={position} rotation={[0, rotation, 0]} scale={scale} />;
}

function Sign({
  position, rotation = 0, size, draw, emissive = false, resolution = 256,
}: {
  position: [number, number, number];
  rotation?: number;
  size: [number, number];
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  emissive?: boolean;
  resolution?: number;
}) {
  const texture = useMemo(
    () => canvasTexture(Math.round(size[0] * resolution), Math.round(size[1] * resolution), draw),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      <planeGeometry args={size} />
      {emissive ? (
        <meshBasicMaterial map={texture} toneMapped={false} />
      ) : (
        <meshStandardMaterial map={texture} transparent roughness={0.7} />
      )}
    </mesh>
  );
}

const text = (
  ctx: CanvasRenderingContext2D, value: string, x: number, y: number, px: number, color: string, weight = 600, align: CanvasTextAlign = 'left',
) => {
  ctx.font = `${weight} ${px}px ${UI_FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
};

function Desk({ m }: { m: Materials }) {
  const top = useMemo(() => tiledBox(1.84, 0.04, 0.84, TILE.oak), []);
  useEffect(() => () => top.dispose(), [top]);
  return (
    <group position={DESK.position}>
      <mesh geometry={top} material={m.oak} position={[0, 0.74, 0]} castShadow receiveShadow />
      {[-0.86, 0.86].map((x) => (
        <mesh key={x} material={m.walnut} position={[x, 0.36, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.04, 0.72, 0.78]} />
        </mesh>
      ))}
      <mesh material={m.walnut} position={[0, 0.46, 0.36]} castShadow receiveShadow>
        <boxGeometry args={[1.68, 0.5, 0.02]} />
      </mesh>
      {/* paper tray + a few loose forms on the staff side */}
      <mesh material={m.darkPlastic} position={[0.6, 0.775, -0.2]} castShadow>
        <boxGeometry args={[0.26, 0.03, 0.34]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={m.paper} position={[0.6, 0.795 + i * 0.003, -0.2]} rotation={[0, i * 0.04 - 0.03, 0]} receiveShadow>
          <boxGeometry args={[0.21, 0.002, 0.297]} />
        </mesh>
      ))}
    </group>
  );
}

function Workstation({ m }: { m: Materials }) {
  const facing = Math.atan2(SEAT.eye[0] - MONITOR.position[0], SEAT.eye[2] - MONITOR.position[2]);
  const submitted = useGame((s) => s.snapshot?.documentSubmitted ?? false);
  const screen = useMemo(
    () =>
      canvasTexture(1024, 600, (ctx, w, h) => {
        ctx.fillStyle = '#f4f6f8';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, w, 76);
        text(ctx, 'Yagona oyna · 3-xona', 32, 38, 30, '#ffffff', 700);
        text(ctx, 'oʻquv muhiti', w - 32, 38, 22, '#9fb0cf', 500, 'right');
        text(ctx, 'Navbat: A-047', 32, 130, 34, '#16213e', 700);
        text(ctx, submitted ? 'Soʻrov rasmiylashtirildi' : 'Yangi murojaat - rasmiylashtirilmagan', 32, 178, 24, submitted ? '#1f8a5b' : '#8a5a1f', 600);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(32, 230 + i * 84, w - 64, 68);
          ctx.fillStyle = '#e3e7ee';
          ctx.fillRect(52, 252 + i * 84, 300 + ((i * 97) % 220), 12);
          ctx.fillRect(52, 274 + i * 84, 180 + ((i * 53) % 160), 10);
        }
        ctx.fillStyle = '#1f8a5b';
        ctx.fillRect(w - 292, h - 34 - 4, 260, 6);
      }),
    [submitted],
  );
  useEffect(() => () => screen.dispose(), [screen]);
  return (
    <group position={MONITOR.position} rotation={[0, facing, 0]}>
      <mesh material={m.metal} position={[0, 0.006, 0]} castShadow>
        <boxGeometry args={[0.24, 0.012, 0.17]} />
      </mesh>
      <mesh material={m.metal} position={[0, 0.16, -0.03]} castShadow>
        <boxGeometry args={[0.035, 0.3, 0.02]} />
      </mesh>
      <mesh material={m.darkPlastic} position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[0.58, 0.35, 0.025]} />
      </mesh>
      <mesh position={[0, 0.365, 0.0135]}>
        <planeGeometry args={[0.55, 0.32]} />
        <meshBasicMaterial map={screen} toneMapped={false} color="#d8d8d8" />
      </mesh>
      <mesh material={m.darkPlastic} position={[0.02, 0.01, 0.3]} castShadow>
        <boxGeometry args={[0.38, 0.016, 0.13]} />
      </mesh>
      <mesh material={m.darkPlastic} position={[0.3, 0.012, 0.3]} castShadow>
        <boxGeometry args={[0.06, 0.024, 0.1]} />
      </mesh>
    </group>
  );
}

/** Appears only when the scenario engine emits `scene.objectState envelope=active`. */
function Envelope({ m }: { m: Materials }) {
  const active = useGame((s) => s.snapshot?.objects.envelope === 'active');
  if (!active) return null;
  return (
    <mesh material={m.paper} position={[4.52, DESK.top + 0.004, -3.14]} rotation={[0, 0.35, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.165, 0.006, 0.115]} />
    </mesh>
  );
}

/** Printed receipt handed across the desk once the request is filed. */
function Receipt({ m }: { m: Materials }) {
  const active = useGame((s) => s.snapshot?.objects.receipt === 'active');
  if (!active) return null;
  return (
    <mesh material={m.paper} position={[4.22, DESK.top + 0.002, -3.12]} rotation={[0, -0.2, 0]} receiveShadow>
      <boxGeometry args={[0.08, 0.002, 0.2]} />
    </mesh>
  );
}

function RoomOrnament() {
  const texture = useMemo(() => {
    const t = ornamentTexture().clone();
    t.repeat.set(5.9 / 1.2, 1);
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[4, 2.72, -5.995]}>
      <planeGeometry args={[5.9, 0.4]} />
      <meshStandardMaterial map={texture} roughness={0.35} />
    </mesh>
  );
}

export function Furniture({ m }: { m: Materials }) {
  return (
    <group>
      {/* ── consultation room ── */}
      <Desk m={m} />
      <Workstation m={m} />
      <Envelope m={m} />
      <Receipt m={m} />
      <Prop model="modern_arm_chair_01" position={[4.4, 0, -4.55]} />
      <Prop model="modern_arm_chair_01" position={[4.4, 0, -2.3]} rotation={Math.PI} />
      <Prop model="desk_lamp_arm_01" position={[5.12, DESK.top, -3.12]} rotation={2.2} />
      <Prop model="binder_notebook" position={[3.98, DESK.top, -3.86]} rotation={0.2} />
      <Prop model="book_encyclopedia_set_01" position={[5.7, 1.26, -5.9]} />
      <Prop model="drawer_cabinet" position={[2.2, 0, -5.72]} />
      <Prop model="Shelf_01" position={[6.0, 0, -5.98]} />
      <Prop model="potted_plant_02" position={[6.35, 0, -5.25]} rotation={1.2} />
      <Prop model="potted_plant_04" position={[6.2, 0.93, -3.1]} scale={1.3} />
      <Prop model="wall_clock" position={[4.0, 2.25, -5.99]} />
      <RoomOrnament />
      <Sign
        position={[1.012, 1.62, -3.3]} rotation={Math.PI / 2} size={[0.6, 0.84]}
        draw={(ctx, w, h) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#16213e';
          ctx.fillRect(0, 0, w, 14);
          text(ctx, 'Davlat xizmatlari', w / 2, 46, 15, '#16213e', 700, 'center');
          text(ctx, 'belgilangan tartibda', w / 2, 68, 13, '#16213e', 500, 'center');
          text(ctx, 'koʻrsatiladi', w / 2, 88, 13, '#16213e', 500, 'center');
          ctx.fillStyle = '#1f8a5b';
          ctx.fillRect(w / 2 - 22, 108, 44, 3);
          text(ctx, 'Korrupsiyaga', w / 2, 142, 17, '#b3261e', 800, 'center');
          text(ctx, 'yoʻl yoʻq!', w / 2, 166, 17, '#b3261e', 800, 'center');
          text(ctx, 'Ishonch telefoni: 0000', w / 2, 198, 9, '#6b7280', 500, 'center');
        }}
      />

      {/* ── lobby ── */}
      <mesh material={m.oak} position={[-4.4, 0.525, 1.5]} castShadow receiveShadow>
        <boxGeometry args={[3, 1.05, 0.78]} />
      </mesh>
      <mesh material={m.whiteLaminate} position={[-4.4, 1.07, 1.52]} castShadow receiveShadow>
        <boxGeometry args={[3.12, 0.04, 0.9]} />
      </mesh>
      <Prop model="potted_plant_04" position={[-5.5, 1.09, 1.55]} scale={1.2} />
      <Prop model="sofa_03" position={[-6.45, 0, 4.4]} rotation={Math.PI / 2} />
      <Prop model="sofa_03" position={[-6.45, 0, 7.7]} rotation={Math.PI / 2} />
      <Prop model="modern_coffee_table_01" position={[-5.0, 0, 6.05]} />
      <Prop model="binder_notebook" position={[-5.05, 0.395, 6.0]} rotation={1.1} />
      {[2.25, 2.95, 3.65, 4.35, 5.85, 6.55, 7.25, 7.95].map((z) => (
        <Prop key={z} model="dining_chair_02" position={[6.42, 0, z]} rotation={-Math.PI / 2} />
      ))}
      <Prop model="potted_plant_02" position={[-6.4, 0, 9.3]} rotation={0.4} />
      <Prop model="potted_plant_02" position={[6.3, 0, 9.35]} rotation={2.4} />
      <Prop model="wall_clock" position={[-0.6, 2.3, 0.105]} />

      <Sign
        position={[-6.985, 2.1, 5.9]} rotation={Math.PI / 2} size={[5.2, 0.9]} resolution={200}
        draw={(ctx, w, h) => {
          text(ctx, 'DAVLAT XIZMATLARI MARKAZI', w / 2, h * 0.4, 58, '#16213e', 700, 'center');
          text(ctx, 'LexSim · oʻquv simulyatsiya muhiti', w / 2, h * 0.78, 26, '#1f8a5b', 600, 'center');
        }}
      />
      <Sign
        position={[-4.4, 2.2, 0.105]} size={[2.2, 0.36]}
        draw={(ctx, w, h) => {
          ctx.fillStyle = '#16213e';
          ctx.fillRect(0, 0, w, h);
          text(ctx, 'MAʼLUMOT  ·  NAVBAT', w / 2, h / 2, 40, '#ffffff', 700, 'center');
        }}
      />
      {/* queue display above the door of room 3 */}
      <mesh material={m.darkPlastic} position={[2.95, 2.55, 0.125]}>
        <boxGeometry args={[1.0, 0.36, 0.04]} />
      </mesh>
      <Sign
        position={[2.95, 2.55, 0.147]} size={[0.94, 0.3]} emissive resolution={640}
        draw={(ctx, w, h) => {
          ctx.fillStyle = '#05080f';
          ctx.fillRect(0, 0, w, h);
          text(ctx, 'A-047', w * 0.05, h / 2, h * 0.5, '#ffb020', 800);
          text(ctx, '→ 3-XONA', w * 0.95, h / 2, h * 0.36, '#5dffa9', 700, 'right');
        }}
      />
      <Sign
        position={[1.98, 1.6, 0.105]} size={[0.5, 0.26]} resolution={900}
        draw={(ctx, w, h) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#1f8a5b';
          ctx.fillRect(0, 0, w * 0.24, h);
          text(ctx, '3', w * 0.12, h / 2, h * 0.62, '#ffffff', 800, 'center');
          text(ctx, 'Fuqarolarni', w * 0.3, h * 0.36, h * 0.2, '#16213e', 700);
          text(ctx, 'qabul qilish', w * 0.3, h * 0.66, h * 0.2, '#16213e', 500);
        }}
      />
    </group>
  );
}
