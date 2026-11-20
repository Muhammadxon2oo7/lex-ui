'use client';
/**
 * In-hand inspection: the object is lifted out of the room and held in
 * front of you. Drag to turn it (it keeps a little momentum, like a real
 * thing), wheel to bring it closer, F to flip it over, Space to use it —
 * press the seal onto paper, open the folder or the book.
 *
 * Runs in its own small canvas above the world so the held object is lit
 * cleanly and never clips into the desk. Keyboard equivalents exist for
 * every pointer action.
 */
import { Environment } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'motion/react';
import { Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { audio } from '@/game/audio';
import { ITEMS, type ItemId } from '@/game/items';
import { useGame } from '@/game/store';
import { ItemModel, sealArt, type Act } from './Items';
import { canvasTexture } from './materials';

/** Pointer / key input for the frame loop (never React state: it changes every frame). */
const hand = { dragging: false, dx: 0, dy: 0, vx: 0, vy: 0, zoom: 1, spin: 0, open: 0, press: -1, stamped: false };
const reset = (): void => void Object.assign(hand, { dragging: false, dx: 0, dy: 0, vx: 0, vy: 0, zoom: 1, spin: 0, open: 0, press: -1, stamped: false });

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const IDENTITY = new THREE.Quaternion();
const START = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.55, 0.04));
const damp = THREE.MathUtils.damp;

function Held({ id }: { id: ItemId }) {
  const def = ITEMS[id];
  const tilt = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const imprint = useRef<THREE.MeshStandardMaterial>(null);
  const act = useRef(0) as Act;
  const scale = 0.2 / def.size;

  const ink = useMemo(() => canvasTexture(256, 256, (ctx, w) => sealArt(ctx, w, 'rgba(43,58,154,0.85)')), []);
  useEffect(() => () => ink.dispose(), [ink]);

  useEffect(() => {
    turn.current?.quaternion.copy(START);
  }, [id]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = turn.current;
    const t = tilt.current;
    if (!g || !t) return;

    // direct manipulation: 1:1 while dragging, momentum after release
    if (hand.dragging) {
      hand.vx = hand.dx / Math.max(dt, 0.004);
      hand.vy = hand.dy / Math.max(dt, 0.004);
    } else {
      hand.dx = hand.vx * dt;
      hand.dy = hand.vy * dt;
      hand.vx = damp(hand.vx, 0, 4, dt);
      hand.vy = damp(hand.vy, 0, 4, dt);
    }
    const spin = hand.spin * (1 - Math.exp(-9 * dt));
    hand.spin -= spin;
    g.quaternion.premultiply(_q.setFromAxisAngle(Y, hand.dx + spin)).premultiply(_q.setFromAxisAngle(X, hand.dy));
    hand.dx = hand.dy = 0;

    act.current = damp(act.current, hand.open, 7, dt);
    t.scale.setScalar(damp(t.scale.x, scale * hand.zoom, 10, dt));

    // the seal: square up, come down on the paper, lift
    let drop = 0;
    if (hand.press >= 0) {
      hand.press += dt / 0.9;
      g.quaternion.slerp(IDENTITY, 1 - Math.exp(-14 * dt));
      drop = Math.sin(Math.min(hand.press, 1) * Math.PI);
      if (hand.press > 0.5 && !hand.stamped) {
        hand.stamped = true;
        audio.stamp();
      }
      if (hand.press >= 1) hand.press = -1;
    }
    g.position.y = -drop * 0.052;
    // look down onto the sheet while stamping
    t.rotation.x = damp(t.rotation.x, hand.stamped || hand.press >= 0 ? 0.85 : 0, 6, dt);
    if (imprint.current) imprint.current.opacity = damp(imprint.current.opacity, hand.stamped ? 1 : 0, 18, dt);
  });

  return (
    <group ref={tilt} scale={scale}>
      <group ref={turn}>
        <group position={[0, id === 'stamp' ? -0.055 : 0, 0]}>
          <ItemModel id={id} act={act} />
        </group>
      </group>
      {id === 'stamp' && (
        <group position={[0, -0.1085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <planeGeometry args={[0.13, 0.09]} />
            <meshStandardMaterial color="#fbfaf5" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0, 0.0004]}>
            <planeGeometry args={[0.042, 0.042]} />
            <meshStandardMaterial ref={imprint} map={ink} transparent opacity={0} roughness={1} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Viewer({ id }: { id: ItemId }) {
  const def = ITEMS[id];
  const close = useGame((s) => s.closeInspect);
  const pressed = useRef({ x: 0, y: 0 });
  const [used, setUsed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    reset();
    dialog.current?.focus(); // the object has focus, so Space uses it rather than a button
    return reset;
  }, [id]);

  const use = () => {
    if (!def.action) return;
    if (id === 'stamp') {
      if (hand.press >= 0) return;
      hand.stamped = false;
      hand.press = 0;
    } else {
      hand.open = hand.open ? 0 : 1;
      audio.paper();
    }
    setUsed(id === 'stamp' ? true : hand.open === 1);
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    // While something is in your hand, keys belong to it — not to the room behind.
    e.stopPropagation();
    const step = 0.18;
    switch (e.code) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowLeft': hand.dx -= step; break;
      case 'ArrowRight': hand.dx += step; break;
      case 'ArrowUp': hand.dy -= step; break;
      case 'ArrowDown': hand.dy += step; break;
      case 'KeyF': hand.spin += Math.PI; break;
      case 'Equal': case 'NumpadAdd': hand.zoom = Math.min(2.2, hand.zoom * 1.15); break;
      case 'Minus': case 'NumpadSubtract': hand.zoom = Math.max(0.6, hand.zoom / 1.15); break;
      case 'Space':
        if ((e.target as HTMLElement).tagName !== 'BUTTON') {
          e.preventDefault();
          use();
        }
        break;
      default:
        return;
    }
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <motion.div
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`${def.name} — qoʻlda koʻrish`}
      className="fixed inset-0 z-40 text-white outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      style={{ background: 'radial-gradient(70% 60% at 42% 48%, rgba(40,46,58,0.72) 0%, rgba(8,10,14,0.9) 100%)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
    >
      <div
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pressed.current = { x: e.clientX, y: e.clientY };
          hand.dragging = true;
          hand.vx = hand.vy = 0;
        }}
        onPointerMove={(e) => {
          if (!hand.dragging) return;
          hand.dx += e.movementX * 0.0085;
          hand.dy += e.movementY * 0.0085;
        }}
        onPointerUp={() => (hand.dragging = false)}
        onPointerCancel={() => (hand.dragging = false)}
        onWheel={(e) => (hand.zoom = THREE.MathUtils.clamp(hand.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 0.6, 2.2))}
      >
        <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 0.62], fov: 35, near: 0.01, far: 5 }} aria-hidden
          // a plain click beside the item (not a drag to turn it) puts it back
          onPointerMissed={(e) => Math.hypot(e.clientX - pressed.current.x, e.clientY - pressed.current.y) < 6 && close()}>
          <Suspense fallback={null}>
            <Environment files="/assets/env/small_empty_room_1_1k.hdr" environmentIntensity={0.9} />
            <directionalLight position={[0.6, 1.2, 1.4]} intensity={2.6} color="#fff3e2" />
            <directionalLight position={[-1, 0.2, 0.6]} intensity={0.6} color="#cfe0ff" />
            <Held id={id} />
          </Suspense>
        </Canvas>
      </div>

      <motion.aside
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className="glass absolute top-4 right-4 w-[min(22rem,calc(100vw-2rem))] rounded-[24px] p-5 select-text"
      >
        <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-amber-200 uppercase">{def.kind}</p>
        <h2 className="mt-1 text-2xl leading-tight font-semibold tracking-tight">{def.name}</h2>
        <p className="mt-2 text-[0.95rem] leading-snug text-white/85">{def.purpose}</p>
        <h3 className="mt-4 text-[0.7rem] font-semibold tracking-[0.16em] text-white/50 uppercase">Amaliyotda</h3>
        <ul className="mt-1.5 space-y-1.5 text-[0.9rem] leading-snug text-white/80">
          {def.practice.map((line) => (
            <li key={line} className="flex gap-2"><span aria-hidden className="text-emerald-300">•</span>{line}</li>
          ))}
        </ul>
      </motion.aside>

      <div className="absolute inset-x-0 bottom-5 flex flex-wrap items-center justify-center gap-2 px-4">
        {def.action && (
          <button type="button" className="btn btn-primary" onClick={use}>
            <kbd>Space</kbd> {used && def.action.again ? def.action.again : def.action.label}
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={() => (hand.spin += Math.PI)}><kbd>F</kbd> Oʻgirish</button>
        <button type="button" className="btn btn-quiet" onClick={close}><kbd>Esc</kbd> Joyiga qoʻyish</button>
        <p className="w-full text-center text-[0.78rem] text-white/55">Sudrab aylantiring · gʻildirak yoki <kbd>+</kbd> <kbd>−</kbd> — yaqinlashtirish · <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> — burish</p>
      </div>
    </motion.div>
  );
}

export default function ItemViewer() {
  const id = useGame((s) => s.inspecting);
  return id ? <Viewer key={id} id={id} /> : null;
}
