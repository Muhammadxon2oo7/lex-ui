'use client';
/**
 * Handleable objects, modelled at real size (metres). The same component is
 * used where the object lies in the room and in the in-hand inspection view,
 * so what you pick up is exactly what you saw on the desk.
 *
 * Every printed surface is drawn on a canvas - synthetic samples only, no
 * real person's data and no legal text.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ItemId } from '@/game/items';
import { ITEM_SPOTS } from '@/game/manifest';
import { useGame } from '@/game/store';
import { UI_FONT, canvasTexture } from './materials';
import { flagBands } from './symbols';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
/** 0 = closed, 1 = open; read every frame so opening animates without React. */
export type Act = { current: number };

function useTex(w: number, h: number, draw: Draw) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const texture = useMemo(() => canvasTexture(w, h, draw), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

const put = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, px: number, color: string, weight = 600, align: CanvasTextAlign = 'left', font = UI_FONT) => {
  ctx.font = `${weight} ${px}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
};

/** Word-wraps `value` into `maxWidth`; returns the y after the last line. */
function wrap(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, px: number, color: string, weight = 500) {
  ctx.font = `${weight} ${px}px ${UI_FONT}`;
  let line = '';
  for (const word of value.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      put(ctx, line, x, y, px, color, weight);
      y += px * 1.3;
      line = word;
    } else line = next;
  }
  put(ctx, line, x, y, px, color, weight);
  return y + px * 1.3;
}

const lines = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, n: number, gap: number, color = '#c3c8d1') => {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) ctx.fillRect(x, y + i * gap, w - ((i * 61) % (w * 0.3)), Math.max(2, gap * 0.16));
};

/* ───────────────────────── seal artwork ───────────────────────── */

/** Round office seal. `mirror` → the rubber die (reads backwards, like a real one). */
export function sealArt(ctx: CanvasRenderingContext2D, size: number, color: string, mirror = false) {
  ctx.save();
  if (mirror) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  const c = size / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.028;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  const ring = 'DAVLAT XIZMATLARI MARKAZI ★ OʻQUV NAMUNASI ★ ';
  ctx.font = `700 ${size * 0.072}px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...ring].forEach((ch, i) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((i / ring.length) * Math.PI * 2);
    ctx.fillText(ch, 0, -size * 0.38);
    ctx.restore();
  });
  put(ctx, 'LexSim', c, c - size * 0.05, size * 0.11, color, 800, 'center');
  put(ctx, '3-xona', c, c + size * 0.09, size * 0.07, color, 600, 'center');
  ctx.restore();
}

/* ───────────────────────── the objects ───────────────────────── */

const wood = new THREE.MeshStandardMaterial({ color: '#6f4425', roughness: 0.45 });
const black = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.5 });
const steel = new THREE.MeshStandardMaterial({ color: '#b9bcc2', roughness: 0.3, metalness: 1 });
const rubber = new THREE.MeshStandardMaterial({ color: '#7a2424', roughness: 0.9 });
const white = new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.85 });
const pageEdge = new THREE.MeshStandardMaterial({ color: '#e9e2cf', roughness: 0.95 });

/** Origin at the die face; stands upright. */
function Stamp() {
  const die = useTex(256, 256, (ctx, w) => {
    ctx.fillStyle = '#6b1d1d';
    ctx.fillRect(0, 0, w, w);
    sealArt(ctx, w, '#c98a8a', true);
  });
  const dieMaterials = useMemo(() => [rubber, rubber, new THREE.MeshStandardMaterial({ map: die, roughness: 0.9 })], [die]);
  return (
    <group>
      <mesh material={dieMaterials} position={[0, 0.0015, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.003, 40]} />
      </mesh>
      <mesh material={black} position={[0, 0.012, 0]} castShadow>
        <cylinderGeometry args={[0.023, 0.023, 0.018, 40]} />
      </mesh>
      <mesh material={steel} position={[0, 0.0225, 0]}>
        <cylinderGeometry args={[0.0238, 0.0238, 0.003, 40]} />
      </mesh>
      <mesh material={wood} position={[0, 0.056, 0]} castShadow>
        <cylinderGeometry args={[0.0105, 0.016, 0.064, 28]} />
      </mesh>
      <mesh material={wood} position={[0, 0.096, 0]} castShadow>
        <sphereGeometry args={[0.02, 28, 20]} />
      </mesh>
    </group>
  );
}

/** Flag stripes along the top edge - the way Uzbek ID cards are coloured, without the state emblem. */
const flagBand = (ctx: CanvasRenderingContext2D, w: number, y: number, h: number) => flagBands(ctx, 0, y, w, h);

/** Fine guilloche-like lines, the security background of a real card (decorative only). */
const guilloche = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.strokeStyle = 'rgba(0,120,150,0.08)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 26; k++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = h * 0.55 + Math.sin(x / 38 + k * 0.5) * (40 + k * 6) + Math.cos(x / 91 + k) * 18;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};

/** Training sample in the layout of an Uzbek ID card. Watermarked; all numbers are zeros. */
function IdCard() {
  const front = useTex(1012, 638, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#f2f6f4');
    g.addColorStop(0.5, '#e4eef0');
    g.addColorStop(1, '#eaf2e8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    guilloche(ctx, w, h);
    flagBand(ctx, w, 0, 36);
    put(ctx, 'OʻZBEKISTON RESPUBLIKASI', 40, 66, 30, '#123a52', 800);
    put(ctx, 'REPUBLIC OF UZBEKISTAN', 40, 98, 20, '#3d6278', 600);
    put(ctx, 'SHAXS GUVOHNOMASI', w - 40, 66, 26, '#123a52', 800, 'right');
    put(ctx, 'IDENTITY CARD', w - 40, 98, 20, '#3d6278', 600, 'right');
    // portrait
    ctx.fillStyle = '#c9d6dd';
    ctx.fillRect(40, 130, 250, 320);
    ctx.fillStyle = '#9fb2bd';
    ctx.beginPath();
    ctx.arc(165, 255, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(165, 450, 112, 110, 0, Math.PI, 0);
    ctx.fill();
    const field = (label: string, en: string, value: string, x: number, y: number) => {
      put(ctx, `${label} / ${en}`, x, y, 16, '#5a7180', 500);
      put(ctx, value, x, y + 27, 27, '#0e2230', 700);
    };
    field('Familiyasi', 'Surname', 'NAMUNAYEV', 320, 140);
    field('Ismi', 'Given name', 'RUSTAM', 320, 205);
    field('Otasining ismi', 'Patronymic', 'NAMUNA OʻGʻLI', 320, 270);
    field('Tugʻilgan sanasi', 'Date of birth', '00.00.1962', 320, 335);
    field('Jinsi', 'Sex', 'E/M', 700, 335);
    field('Fuqaroligi', 'Nationality', 'OʻZBEKISTON / UZB', 320, 400);
    field('Amal qilish muddati', 'Date of expiry', '00.00.0000', 320, 465);
    field('Karta raqami', 'Card No.', 'AA0000000', 700, 465);
    put(ctx, 'Imzo / Signature', 40, 500, 16, '#5a7180', 500);
    ctx.strokeStyle = '#1b2f6b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(50, 560);
    ctx.bezierCurveTo(90, 520, 120, 590, 160, 545);
    ctx.bezierCurveTo(190, 515, 220, 575, 270, 540);
    ctx.stroke();
    // training watermark - this is not a document
    ctx.save();
    ctx.translate(w / 2, h / 2 + 30);
    ctx.rotate(-0.35);
    put(ctx, 'OʻQUV NAMUNASI', 0, 0, 92, 'rgba(179,38,30,0.16)', 900, 'center');
    ctx.restore();
    put(ctx, 'HAQIQIY HUJJAT EMAS', w - 40, h - 34, 20, '#b3261e', 800, 'right');
  });
  const back = useTex(1012, 638, (ctx, w, h) => {
    ctx.fillStyle = '#e6eef0';
    ctx.fillRect(0, 0, w, h);
    guilloche(ctx, w, h);
    flagBand(ctx, w, 0, 24);
    // chip
    ctx.fillStyle = '#c9a54a';
    ctx.beginPath();
    ctx.roundRect(60, 70, 120, 96, 14);
    ctx.fill();
    ctx.strokeStyle = '#9c7d2e';
    ctx.lineWidth = 2;
    ctx.strokeRect(84, 92, 72, 52);
    const field = (label: string, value: string, x: number, y: number) => {
      put(ctx, label, x, y, 16, '#5a7180', 500);
      put(ctx, value, x, y + 26, 25, '#0e2230', 700);
    };
    field('JShShIR / PINFL', '00000000000000', 230, 80);
    field('Tugʻilgan joyi / Place of birth', 'TOSHKENT VILOYATI', 230, 150);
    field('Berilgan sanasi / Date of issue', '00.00.0000', 620, 80);
    const mono = 'ui-monospace, Menlo, monospace';
    put(ctx, 'IUUZBAA0000000000000000000000<', 50, 470, 33, '#0e2230', 600, 'left', mono);
    put(ctx, '6200000M0000000UZB<<<<<<<<<<<0', 50, 520, 33, '#0e2230', 600, 'left', mono);
    put(ctx, 'NAMUNAYEV<<RUSTAM<<<<<<<<<<<<<', 50, 570, 33, '#0e2230', 600, 'left', mono);
    ctx.save();
    ctx.translate(w / 2, 300);
    ctx.rotate(-0.3);
    put(ctx, 'OʻQUV NAMUNASI', 0, 0, 80, 'rgba(179,38,30,0.15)', 900, 'center');
    ctx.restore();
  });
  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: '#e7eef2', roughness: 0.5 });
    return [edge, edge, edge, edge, new THREE.MeshPhysicalMaterial({ map: front, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.15 }), new THREE.MeshStandardMaterial({ map: back, roughness: 0.32 })];
  }, [front, back]);
  return (
    <mesh material={materials} castShadow>
      <boxGeometry args={[0.0856, 0.054, 0.0009]} />
    </mesh>
  );
}

/** Hinged cover used by the book and the folder. */
function Hinged({ act, width, height, depth, z, angle, material }: { act?: Act; width: number; height: number; depth: number; z: number; angle: number; material: THREE.Material | THREE.Material[] }) {
  const hinge = useRef<THREE.Group>(null);
  useFrame(() => {
    if (hinge.current) hinge.current.rotation.y = -(act?.current ?? 0) * angle;
  });
  return (
    <group ref={hinge} position={[-width / 2, 0, z]}>
      <mesh material={material} position={[width / 2, 0, 0]} castShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
    </group>
  );
}

/** Cover faces +Z; centred. */
function CodeBook({ act }: { act?: Act }) {
  const cover = useTex(600, 860, (ctx, w, h) => {
    ctx.fillStyle = '#17402f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9a54a';
    ctx.lineWidth = 6;
    ctx.strokeRect(34, 34, w - 68, h - 68);
    put(ctx, 'NORMATIV-HUQUQIY', w / 2, 250, 46, '#e3c878', 700, 'center');
    put(ctx, 'HUJJATLAR', w / 2, 312, 46, '#e3c878', 700, 'center');
    put(ctx, 'toʻplami', w / 2, 374, 34, '#e3c878', 500, 'center');
    ctx.fillStyle = '#c9a54a';
    ctx.fillRect(w / 2 - 60, 430, 120, 4);
    put(ctx, 'Davlat xizmatlari markazi', w / 2, 640, 28, '#cdbb86', 500, 'center');
    put(ctx, 'xodimi uchun · oʻquv nusxasi', w / 2, 680, 28, '#cdbb86', 500, 'center');
  });
  const page = useTex(600, 860, (ctx, w, h) => {
    ctx.fillStyle = '#f6f1e3';
    ctx.fillRect(0, 0, w, h);
    put(ctx, 'MUNDARIJA', w / 2, 90, 34, '#2a2a2a', 700, 'center');
    let y = 170;
    const acts = [
      '“Maʼmuriy tartib-taomillar toʻgʻrisida”gi Qonun',
      '“Jismoniy va yuridik shaxslarning murojaatlari toʻgʻrisida”gi Qonun',
      '“Fuqarolarning davlat pensiya taʼminoti toʻgʻrisida”gi Qonun',
      '“Korrupsiyaga qarshi kurashish toʻgʻrisida”gi Qonun',
    ];
    acts.forEach((title, i) => {
      put(ctx, `${i + 1}.`, 60, y, 26, '#2a2a2a', 700);
      y = wrap(ctx, title, 100, y, w - 160, 26, '#2a2a2a') + 26;
    });
    ctx.fillStyle = '#b3261e';
    ctx.fillRect(60, h - 170, w - 120, 2);
    wrap(ctx, 'Bosma nusxa eskirishi mumkin. Amaldagi tahrirni lex.uz saytidan tekshiring.', 60, h - 130, w - 120, 22, '#7a2a22', 600);
  });
  const coverMaterials = useMemo(() => {
    const cloth = new THREE.MeshStandardMaterial({ color: '#17402f', roughness: 0.8 });
    const inside = new THREE.MeshStandardMaterial({ color: '#efe8d6', roughness: 0.9 });
    return [cloth, cloth, cloth, cloth, new THREE.MeshStandardMaterial({ map: cover, roughness: 0.75 }), inside];
  }, [cover]);
  const cloth = coverMaterials[0];
  return (
    <group>
      <mesh material={pageEdge} castShadow>
        <boxGeometry args={[0.142, 0.205, 0.026]} />
      </mesh>
      <mesh position={[0, 0, 0.0132]}>
        <planeGeometry args={[0.142, 0.205]} />
        <meshStandardMaterial map={page} roughness={0.95} />
      </mesh>
      <mesh material={cloth} position={[0, 0, -0.0148]} castShadow>
        <boxGeometry args={[0.15, 0.215, 0.003]} />
      </mesh>
      <mesh material={cloth} position={[-0.0755, 0, 0]}>
        <boxGeometry args={[0.004, 0.215, 0.0326]} />
      </mesh>
      <Hinged act={act} width={0.15} height={0.215} depth={0.003} z={0.0148} angle={2.5} material={coverMaterials} />
    </group>
  );
}

/** Cover faces +Z; centred. */
function CaseFolder({ act }: { act?: Act }) {
  const cover = useTex(700, 960, (ctx, w, h) => {
    ctx.fillStyle = '#c2a36b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(90,60,20,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 14, 1);
    }
    ctx.fillStyle = '#f6f1e3';
    ctx.fillRect(90, 150, w - 180, 300);
    ctx.strokeStyle = '#5b4a2a';
    ctx.lineWidth = 3;
    ctx.strokeRect(90, 150, w - 180, 300);
    put(ctx, 'ISH YURITISH JILDI', w / 2, 215, 40, '#2c2414', 800, 'center');
    put(ctx, 'Navbat raqami:  A-047', 130, 300, 30, '#2c2414', 600);
    put(ctx, 'Xona:  3', 130, 350, 30, '#2c2414', 600);
    put(ctx, 'Sana:  ____ . ____ . 20__', 130, 400, 30, '#2c2414', 600);
    put(ctx, 'Shaxsga doir maʼlumot - begonalarga berilmaydi', w / 2, h - 90, 24, '#5b3a1a', 600, 'center');
  });
  const form = useTex(700, 960, (ctx, w, h) => {
    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(0, 0, w, h);
    put(ctx, 'MUROJAAT VARAQASI', w / 2, 90, 36, '#1b2433', 800, 'center');
    put(ctx, '№ A-047 · oʻquv namunasi', w / 2, 134, 24, '#5a6472', 500, 'center');
    ['Murojaatchi', 'Murojaat mazmuni', 'Ilova qilingan hujjatlar', 'Qabul qilgan xodim'].forEach((label, i) => {
      const y = 210 + i * 170;
      put(ctx, label, 60, y, 24, '#1b2433', 700);
      lines(ctx, 60, y + 36, w - 120, 3, 34, '#c9ced6');
    });
    ctx.strokeStyle = '#8a93a0';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(w - 150, h - 130, 78, 0, Math.PI * 2);
    ctx.stroke();
    put(ctx, 'M.Oʻ.', w - 150, h - 130, 26, '#8a93a0', 600, 'center');
  });
  const coverMaterials = useMemo(() => {
    const kraft = new THREE.MeshStandardMaterial({ color: '#c2a36b', roughness: 0.9 });
    return [kraft, kraft, kraft, kraft, new THREE.MeshStandardMaterial({ map: cover, roughness: 0.9 }), kraft];
  }, [cover]);
  return (
    <group>
      <mesh material={coverMaterials[0]} position={[0, 0, -0.005]} castShadow>
        <boxGeometry args={[0.235, 0.32, 0.002]} />
      </mesh>
      <mesh material={white} position={[0.004, 0, -0.001]}>
        <boxGeometry args={[0.21, 0.297, 0.006]} />
      </mesh>
      <mesh position={[0.004, 0, 0.0022]}>
        <planeGeometry args={[0.21, 0.297]} />
        <meshStandardMaterial map={form} roughness={0.95} />
      </mesh>
      <Hinged act={act} width={0.235} height={0.32} depth={0.002} z={0.005} angle={2.6} material={coverMaterials} />
    </group>
  );
}

function Slip({ width, height, draw }: { width: number; height: number; draw: Draw }) {
  const texture = useTex(Math.round(width * 6000), Math.round(height * 6000), draw);
  const materials = useMemo(() => [white, white, white, white, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }), white], [texture]);
  return (
    <mesh material={materials}>
      <boxGeometry args={[width, height, 0.0003]} />
    </mesh>
  );
}

const barcode = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = '#111';
  for (let i = 0, px = x; px < x + w; i++) {
    const bar = 2 + ((i * 7) % 5);
    if (i % 2 === 0) ctx.fillRect(px, y, bar, h);
    px += bar;
  }
};

function QueueTicket() {
  return (
    <Slip
      width={0.058}
      height={0.085}
      draw={(ctx, w, h) => {
        ctx.fillStyle = '#fdfcf8';
        ctx.fillRect(0, 0, w, h);
        put(ctx, 'DAVLAT XIZMATLARI MARKAZI', w / 2, 44, 20, '#111', 700, 'center');
        put(ctx, 'A-047', w / 2, 190, 110, '#111', 800, 'center');
        put(ctx, '3-xona', w / 2, 290, 40, '#111', 600, 'center');
        put(ctx, 'Sizdan oldin: 2 kishi', w / 2, 360, 24, '#333', 500, 'center');
        barcode(ctx, 50, h - 90, w - 100, 50);
      }}
    />
  );
}

function ReceiptSlip() {
  return (
    <Slip
      width={0.08}
      height={0.2}
      draw={(ctx, w, h) => {
        ctx.fillStyle = '#fdfcf8';
        ctx.fillRect(0, 0, w, h);
        put(ctx, 'TILXAT', w / 2, 60, 46, '#111', 800, 'center');
        put(ctx, 'Yagona oyna · 3-xona', w / 2, 112, 24, '#333', 500, 'center');
        ctx.fillStyle = '#111';
        ctx.fillRect(40, 150, w - 80, 2);
        put(ctx, 'Murojaat qabul qilindi', 40, 200, 26, '#111', 700);
        put(ctx, 'Navbat: A-047', 40, 250, 24, '#333', 500);
        lines(ctx, 40, 310, w - 80, 9, 40, '#bfc4cc');
        put(ctx, 'Holatini raqam boʻyicha kuzating', w / 2, h - 230, 22, '#333', 600, 'center');
        barcode(ctx, 50, h - 180, w - 100, 80);
        put(ctx, 'oʻquv namunasi', w / 2, h - 50, 20, '#777', 500, 'center');
      }}
    />
  );
}

export function ItemModel({ id, act }: { id: ItemId; act?: Act }) {
  switch (id) {
    case 'stamp':
      return <Stamp />;
    case 'id-card':
      return <IdCard />;
    case 'code-book':
      return <CodeBook act={act} />;
    case 'case-folder':
      return <CaseFolder act={act} />;
    case 'queue-ticket':
      return <QueueTicket />;
    case 'receipt':
      return <ReceiptSlip />;
  }
}

/** The objects where they lie in the room (flat things rest on their back). */
export function WorldItems() {
  const interviewing = useGame((s) => (s.snapshot?.turns.length ?? 0) > 0);
  const held = useGame((s) => s.inspecting);
  const flat = -Math.PI / 2;
  const [sx, sy, sz] = ITEM_SPOTS.stamp;
  const [bx, by, bz] = ITEM_SPOTS['code-book'];
  const [fx, fy, fz] = ITEM_SPOTS['case-folder'];
  return (
    <group>
      {held !== 'stamp' && (
        <group position={[sx, sy, sz]}>
          {/* ink pad it rests beside */}
          <mesh material={black} position={[-0.09, 0.009, 0.01]} castShadow>
            <boxGeometry args={[0.1, 0.018, 0.07]} />
          </mesh>
          <Stamp />
        </group>
      )}
      {held !== 'code-book' && (
        <group position={[bx, by + 0.0165, bz]} rotation={[flat, 0, -0.35]}>
          <CodeBook />
        </group>
      )}
      {held !== 'case-folder' && (
        <group position={[fx, fy + 0.007, fz]} rotation={[flat, 0, Math.PI + 0.08]}>
          <CaseFolder />
        </group>
      )}
      {interviewing && held !== 'id-card' && (
        <group position={[4.66, sy + 0.001, -3.24]} rotation={[flat, 0, Math.PI - 0.3]}>
          <IdCard />
        </group>
      )}
    </group>
  );
}
