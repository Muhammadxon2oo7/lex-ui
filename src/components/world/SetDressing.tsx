'use client';
/**
 * The small things that make an office read as a real, used place: queue
 * kiosk, radiators, notice board, exit sign, flag, switches, extinguisher.
 * Pure set dressing — none of it carries scenario logic.
 */
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { WINDOWS } from '@/game/manifest';
import { UI_FONT, canvasTexture, type Materials } from './materials';

const red = new THREE.MeshStandardMaterial({ color: '#b3231c', roughness: 0.35, metalness: 0.2 });
const cork = new THREE.MeshStandardMaterial({ color: '#b58a5a', roughness: 0.95 });
const radiatorWhite = new THREE.MeshStandardMaterial({ color: '#e8e6e1', roughness: 0.45, metalness: 0.3 });

function useCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const texture = useMemo(() => canvasTexture(w, h, draw), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

const label = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, px: number, color: string, weight = 600, align: CanvasTextAlign = 'center') => {
  ctx.font = `${weight} ${px}px ${UI_FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
};

/** Self-service queue terminal by the entrance. */
function Kiosk({ m }: { m: Materials }) {
  const screen = useCanvas(512, 640, (ctx, w, h) => {
    ctx.fillStyle = '#0f1a33';
    ctx.fillRect(0, 0, w, h);
    label(ctx, 'ELEKTRON NAVBAT', w / 2, 70, 34, '#ffffff', 700);
    const items = ['Maʼlumotnoma olish', 'Hujjat topshirish', 'Maslahat'];
    items.forEach((t, i) => {
      ctx.fillStyle = i === 2 ? '#1f8a5b' : '#22335c';
      ctx.beginPath();
      ctx.roundRect(48, 150 + i * 130, w - 96, 96, 22);
      ctx.fill();
      label(ctx, t, w / 2, 198 + i * 130, 30, '#ffffff', 600);
    });
    label(ctx, 'Hozir: A-047', w / 2, h - 60, 28, '#ffb020', 700);
  });
  return (
    <group position={[2.1, 0, 8.6]} rotation={[0, Math.PI + 0.35, 0]}>
      <mesh material={m.whiteLaminate} position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 1.1, 0.3]} />
      </mesh>
      <group position={[0, 1.22, 0.02]} rotation={[-0.42, 0, 0]}>
        <mesh material={m.darkPlastic} castShadow>
          <boxGeometry args={[0.46, 0.5, 0.05]} />
        </mesh>
        <mesh position={[0, 0, 0.027]}>
          <planeGeometry args={[0.38, 0.44]} />
          <meshBasicMaterial map={screen} toneMapped={false} color="#c8c8c8" />
        </mesh>
      </group>
      {/* ticket slot */}
      <mesh material={m.darkPlastic} position={[0, 0.82, 0.152]}>
        <boxGeometry args={[0.16, 0.02, 0.01]} />
      </mesh>
    </group>
  );
}

function Radiator({ z, length }: { z: number; length: number }) {
  const fins = Math.floor(length / 0.07);
  return (
    <group position={[6.93, 0.42, z]}>
      {Array.from({ length: fins }, (_, i) => (
        <mesh key={i} material={radiatorWhite} position={[0, 0, -length / 2 + 0.035 + i * 0.07]} castShadow>
          <boxGeometry args={[0.09, 0.56, 0.05]} />
        </mesh>
      ))}
      <mesh material={radiatorWhite} position={[0, -0.36, -length / 2 - 0.06]}>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
      </mesh>
    </group>
  );
}

function NoticeBoard() {
  const posters = useCanvas(1024, 640, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const sheet = (x: number, y: number, sw: number, sh: number, rot: number, bg: string, draw: () => void) => {
      ctx.save();
      ctx.translate(x + sw / 2, y + sh / 2);
      ctx.rotate(rot);
      ctx.translate(-sw / 2, -sh / 2);
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, sw, sh);
      ctx.shadowColor = 'transparent';
      draw();
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(sw / 2, 14, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const lines = (n: number, x: number, y: number, lw: number) => {
      ctx.fillStyle = '#b9bfca';
      for (let i = 0; i < n; i++) ctx.fillRect(x, y + i * 22, lw - ((i * 37) % 70), 8);
    };
    sheet(40, 40, 300, 400, -0.02, '#ffffff', () => {
      ctx.fillStyle = '#16213e';
      ctx.fillRect(0, 0, 300, 70);
      label(ctx, 'ISH TARTIBI', 150, 36, 26, '#fff', 700);
      label(ctx, 'Du–Ju  09:00–18:00', 150, 120, 22, '#16213e', 600);
      label(ctx, 'Tushlik  13:00–14:00', 150, 156, 22, '#16213e', 500);
      label(ctx, 'Shanba  09:00–13:00', 150, 192, 22, '#16213e', 500);
      lines(6, 30, 240, 240);
    });
    sheet(370, 60, 290, 380, 0.03, '#eaf5ef', () => {
      label(ctx, 'XIZMATLAR', 145, 46, 24, '#136443', 800);
      label(ctx, 'BEPUL', 145, 110, 54, '#1f8a5b', 800);
      label(ctx, 'belgilangan tartibda', 145, 162, 20, '#136443', 500);
      label(ctx, 'koʻrsatiladi', 145, 188, 20, '#136443', 500);
      lines(5, 30, 240, 230);
    });
    sheet(690, 36, 290, 220, -0.035, '#fff7e0', () => {
      label(ctx, 'EʼLON', 145, 46, 24, '#8a5a00', 800);
      lines(6, 28, 86, 234);
    });
    sheet(700, 290, 270, 300, 0.02, '#ffffff', () => {
      label(ctx, 'Kerakli hujjatlar', 135, 46, 22, '#16213e', 700);
      lines(9, 26, 86, 218);
    });
    sheet(60, 470, 560, 130, 0.01, '#fdeceb', () => {
      label(ctx, 'Korrupsiyaga yoʻl yoʻq — ishonch telefoni', 280, 50, 24, '#b3261e', 700);
      lines(2, 40, 84, 480);
    });
  });
  return (
    <group position={[-4.2, 1.55, 9.985]} rotation={[0, Math.PI, 0]}>
      <mesh material={cork} castShadow>
        <boxGeometry args={[1.7, 1.08, 0.025]} />
      </mesh>
      <mesh position={[0, 0, 0.014]}>
        <planeGeometry args={[1.62, 1.01]} />
        <meshStandardMaterial map={posters} transparent roughness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * Flag of the Republic of Uzbekistan on an indoor pole: 1:2, blue / white /
 * green with thin red fimbriations; a white crescent and twelve five-pointed
 * stars (rows of 3, 4, 5) in the blue band at the hoist — drawn to the
 * proportions of the official construction sheet (unit = 1/125 of the height
 * of a 250×125 flag). Hung from the pole it droops in soft folds.
 */
/**
 * The State symbols are never redrawn by hand: both textures are rasterised
 * from the official images (tools/symbols/*.svg, the drawings annexed to the
 * Law «Oʻzbekiston Respublikasining Davlat bayrogʻi toʻgʻrisida», 18.11.1991
 * No. 407-XII, and the Law «… Davlat gerbi toʻgʻrisida», 02.07.1992
 * No. 616-XII) by tools/symbols/rasterise.mjs — so the crescent, the twelve
 * stars, Humo, the wreath and the «OʻZBEKISTON» ribbon are exactly theirs.
 */
const SYMBOLS = { flag: '/assets/symbols/flag.png', emblem: '/assets/symbols/emblem.png' };

function useSymbol(url: string) {
  const t = useTexture(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * The State Emblem as it hangs in Uzbek courtrooms and offices: the emblem
 * itself on a light round plaque with a thin gilt rim. `radius` is the
 * plaque's (the emblem fills ~80 % of it, upright, never cropped).
 */
export function StateEmblem({ position, rotation = 0, radius = 0.32 }: { position: [number, number, number]; rotation?: number; radius?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.012]}>
        <cylinderGeometry args={[radius, radius, 0.024, 64]} />
        <meshStandardMaterial color="#c9a45c" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.003]}>
        <cylinderGeometry args={[radius * 0.93, radius * 0.93, 0.004, 64]} />
        <meshStandardMaterial color="#f6f4ee" roughness={0.6} />
      </mesh>
      <Suspense fallback={null}>
        <EmblemFace size={radius * 1.56} />
      </Suspense>
    </group>
  );
}

function EmblemFace({ size }: { size: number }) {
  const t = useSymbol(SYMBOLS.emblem);
  // the official drawing is 134.869 × 137.221 mm
  return (
    <mesh position={[0, 0, 0.009]}>
      <planeGeometry args={[size * (134.869 / 137.221), size]} />
      {/* the official colours exactly: kept out of tone mapping, which would
          bleach the gold and greens of a brightly lit wall */}
      <meshBasicMaterial map={t} transparent alphaTest={0.02} toneMapped={false} color="#e6e6e6" />
    </mesh>
  );
}

export function Flag(props: { m: Materials; position?: [number, number, number]; rotation?: number }) {
  return (
    <Suspense fallback={null}>
      <FlagOnPole {...props} />
    </Suspense>
  );
}

function FlagOnPole({ m, position = [-2.35, 0, 0.62], rotation = 0 }: { m: Materials; position?: [number, number, number]; rotation?: number }) {
  // 1:2 cloth from the official drawing; on the reverse the plane shows the
  // mirror image, so the crescent and stars sit at the pole on both faces,
  // as the law requires.
  const texture = useSymbol(SYMBOLS.flag);
  // 1.5 × 0.75 m cloth: the hoist is fixed to the pole and the fly hangs in
  // folds — reaching ~0.9 m from the pole, so it clears walls and furniture.
  const cloth = useMemo(() => {
    const W = 1.5, H = 0.75;
    const geo = new THREE.PlaneGeometry(W, H, 40, 16);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + W / 2; // 0 at the pole
      const y = pos.getY(i);
      const t = x / W;
      const droop = Math.pow(t, 1.4);
      const angle = droop * 0.95;
      const r = x * (1 - 0.22 * droop);
      pos.setX(i, Math.sin(Math.PI / 2 - angle) * r * 0.8);
      pos.setY(i, y - Math.cos(Math.PI / 2 - angle) * r * 0.8 - t * 0.04);
      pos.setZ(i, Math.sin(t * 13 + y * 1.5) * 0.045 * t + Math.sin(t * 5.3) * 0.025 * t);
    }
    geo.computeVertexNormals();
    geo.userData.base = Float32Array.from(pos.array as ArrayLike<number>);
    return geo;
  }, []);
  // still indoor air: the folds breathe very slightly (off with reduced motion)
  useFrame(({ clock }) => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pos = cloth.attributes.position;
    const base = cloth.userData.base as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const k = Math.min(1, Math.max(0, bx / 1.0));
      pos.setZ(i, base[i * 3 + 2] + Math.sin(t * 0.9 + bx * 4 + base[i * 3 + 1] * 2) * 0.012 * k);
    }
    pos.needsUpdate = true;
  });
  useEffect(() => () => cloth.dispose(), [cloth]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={m.metal} position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.19, 0.04, 24]} />
      </mesh>
      <mesh material={m.metal} position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 2.4, 12]} />
      </mesh>
      <mesh material={m.trim} position={[0, 2.43, 0]}>
        <coneGeometry args={[0.035, 0.11, 16]} />
      </mesh>
      <mesh geometry={cloth} position={[0.015, 2.0, 0]} castShadow>
        <meshStandardMaterial map={texture} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ExitSign() {
  const texture = useCanvas(512, 180, (ctx, w, h) => {
    ctx.fillStyle = '#0a7a3b';
    ctx.fillRect(0, 0, w, h);
    label(ctx, 'CHIQISH  →', w / 2, h / 2 + 4, 92, '#eafff1', 800);
  });
  return (
    <group position={[0, 2.68, 9.97]} rotation={[0, Math.PI, 0]}>
      <mesh>
        <boxGeometry args={[0.62, 0.22, 0.04]} />
        <meshStandardMaterial color="#1b1e22" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <planeGeometry args={[0.58, 0.19]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WallDetails({ m }: { m: Materials }) {
  return (
    <>
      {/* light switches beside the doors */}
      {([[3.72, 1.1, 0.105, 0], [3.72, 1.1, -0.105, Math.PI], [1.5, 1.1, 9.995, Math.PI]] as const).map(([x, y, z, r], i) => (
        <mesh key={i} material={m.whiteLaminate} position={[x, y, z]} rotation={[0, r, 0]}>
          <boxGeometry args={[0.085, 0.085, 0.012]} />
        </mesh>
      ))}
      {/* sockets along the skirting */}
      {([[-2, 0.3, 0.105], [5.6, 0.3, 0.105], [1.012, 0.3, -4.6]] as const).map(([x, y, z], i) => (
        <mesh key={i} material={m.whiteLaminate} position={[x, y, z]} rotation={[0, i === 2 ? Math.PI / 2 : 0, 0]}>
          <boxGeometry args={[0.14, 0.08, 0.012]} />
        </mesh>
      ))}
      {/* fire extinguisher on its bracket */}
      <group position={[0.75, 0, 0.2]}>
        <mesh material={red} position={[0, 0.62, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 0.46, 20]} />
        </mesh>
        <mesh material={red} position={[0, 0.87, 0]}>
          <sphereGeometry args={[0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh material={m.darkPlastic} position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.022, 0.03, 0.08, 10]} />
        </mesh>
        <mesh material={m.darkPlastic} position={[0.06, 0.93, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.12, 0.016, 0.03]} />
        </mesh>
        <mesh material={m.metal} position={[0, 0.36, -0.06]}>
          <boxGeometry args={[0.16, 0.03, 0.06]} />
        </mesh>
      </group>
    </>
  );
}

export function SetDressing({ m }: { m: Materials }) {
  return (
    <group>
      <Kiosk m={m} />
      {WINDOWS.map((w) => (
        <Radiator key={w.z0} z={(w.z0 + w.z1) / 2} length={w.z1 - w.z0 - 0.7} />
      ))}
      <NoticeBoard />
      {/* off the wall and turned toward the hall, so the cloth hangs in the room, not against the plaster */}
      <Flag m={m} position={[-2.3, 0, 1.0]} rotation={-0.55} />
      <ExitSign />
      <WallDetails m={m} />
    </group>
  );
}
