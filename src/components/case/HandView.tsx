'use client';
/**
 * A document in your hands. Lifted out of the room and held in front of
 * you in its own small, cleanly lit canvas:
 *
 *   drag            turn it (keeps a little momentum, like a real sheet)
 *   wheel / + −     bring it closer
 *   F               turn it over
 *   O / Space       open the folder (and close it)
 *   ← →             leaf through the pages
 *   Esc             put it back (so does a click beside the document)
 *
 * Every action has a button too. Reduced motion: no momentum, no flourish.
 */
import { Environment } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'motion/react';
import { ease } from '@/lib/motion';
import { Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { audio } from '@/game/audio';
import { pageTexture } from './DeskItems';
import type { DeskDoc } from './documents';

const spring = ease.surface;
const grip = { dragging: false, vx: 0, vy: 0, dx: 0, dy: 0, zoom: 1, flip: 0, open: 0 };
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Held({ doc, page, open, flipped }: { doc: DeskDoc; page: number; open: boolean; flipped: boolean }) {
  const turn = useRef<THREE.Group>(null);
  const cover = useRef<THREE.Group>(null);
  const tex = pageTexture(doc, Math.min(page, doc.pages.length - 1));
  const back = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efece3', roughness: 0.9 }), []);

  useEffect(() => {
    turn.current?.rotation.set(-0.25, 0.35, 0.03);
  }, [doc.id]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = turn.current;
    if (!g) return;
    if (grip.dragging) {
      grip.vx = grip.dx / Math.max(dt, 0.004);
      grip.vy = grip.dy / Math.max(dt, 0.004);
    } else if (!reduced()) {
      grip.dx = grip.vx * dt;
      grip.dy = grip.vy * dt;
      grip.vx *= Math.exp(-4 * dt);
      grip.vy *= Math.exp(-4 * dt);
    } else grip.dx = grip.dy = 0;
    g.rotation.y += grip.dx * 0.008;
    g.rotation.x = THREE.MathUtils.clamp(g.rotation.x + grip.dy * 0.008, -1.4, 1.4);
    grip.dx = grip.dy = 0;
    // turning it over is a smooth half-turn about the long axis
    grip.flip = THREE.MathUtils.damp(grip.flip, flipped ? Math.PI : 0, 7, dt);
    g.children[0].rotation.y = grip.flip;
    const s = THREE.MathUtils.damp(g.scale.x, grip.zoom, 9, dt);
    g.scale.setScalar(s);
    grip.open = THREE.MathUtils.damp(grip.open, open ? 1 : 0, 6, dt);
    if (cover.current) cover.current.rotation.y = -grip.open * Math.PI * 0.92;
  });

  const W = doc.kind === 'box' ? 0.09 : 0.21;
  const H = doc.kind === 'box' ? 0.17 : 0.297;
  return (
    <group ref={turn}>
      <group>
        {doc.kind === 'folder' ? (
          <group>
            {/* back board with the current page, front cover hinged on the left */}
            <mesh position={[0, 0, -0.006]}>
              <boxGeometry args={[0.245, 0.325, 0.006]} />
              <meshStandardMaterial color={doc.color ?? '#2f5d8a'} roughness={0.75} />
            </mesh>
            <mesh position={[0, 0, -0.0025]}>
              <planeGeometry args={[0.21, 0.297]} />
              <meshStandardMaterial map={tex} roughness={0.9} />
            </mesh>
            <group ref={cover} position={[-0.1225, 0, 0.002]}>
              <mesh position={[0.1225, 0, 0]}>
                <boxGeometry args={[0.245, 0.325, 0.005]} />
                <meshStandardMaterial color={doc.color ?? '#2f5d8a'} roughness={0.75} />
              </mesh>
              <mesh position={[0.1225, 0.06, 0.0028]}>
                <planeGeometry args={[0.15, 0.06]} />
                <meshStandardMaterial color="#f3efe4" roughness={0.9} />
              </mesh>
            </group>
          </group>
        ) : doc.kind === 'box' ? (
          <group>
            <mesh>
              <boxGeometry args={[W, H, 0.04]} />
              <meshStandardMaterial color={doc.color ?? '#1b1d22'} roughness={0.4} />
            </mesh>
            <mesh position={[0.12, 0, 0]}>
              <planeGeometry args={[0.1, 0.21]} />
              <meshStandardMaterial map={tex} roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ) : (
          <group>
            <mesh>
              <planeGeometry args={[W, H]} />
              <meshStandardMaterial map={tex} roughness={0.9} />
            </mesh>
            <mesh rotation={[0, Math.PI, 0]} material={back}>
              <planeGeometry args={[W, H]} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

export function HandView({ doc, onClose }: { doc: DeskDoc; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(doc.kind !== 'folder');
  const [flipped, setFlipped] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const pressed = useRef({ x: 0, y: 0 });

  useEffect(() => {
    Object.assign(grip, { dragging: false, vx: 0, vy: 0, dx: 0, dy: 0, zoom: 1, flip: 0, open: doc.kind === 'folder' ? 0 : 1 });
    audio.paper();
    dialog.current?.focus();
  }, [doc]);

  const pages = doc.pages.length;
  const showPage = doc.kind !== 'folder' || open;
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.code === 'Escape') onClose();
    else if (e.code === 'KeyF') setFlipped((f) => !f);
    else if ((e.code === 'KeyO' || e.code === 'Space') && doc.kind === 'folder') {
      e.preventDefault();
      setOpen((o) => !o);
      audio.paper();
    } else if (e.code === 'ArrowRight' && showPage) setPage((p) => Math.min(pages - 1, p + 1));
    else if (e.code === 'ArrowLeft' && showPage) setPage((p) => Math.max(0, p - 1));
    else if (e.key === '+' || e.key === '=') grip.zoom = Math.min(2.2, grip.zoom + 0.2);
    else if (e.key === '-') grip.zoom = Math.max(0.7, grip.zoom - 0.2);
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const current = doc.pages[Math.min(page, pages - 1)];
  return (
    <motion.div ref={dialog} tabIndex={-1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring}
      role="dialog" aria-modal="true" aria-label={`${doc.name} - qoʻlda`}
      className="absolute inset-0 z-50 grid grid-cols-1 bg-[#05070b]/80 outline-none backdrop-blur-sm lg:grid-cols-[1fr_22rem]">
      <div className="relative min-h-[55dvh] cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          grip.dragging = true;
          last.current = { x: e.clientX, y: e.clientY };
          pressed.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!grip.dragging || !last.current) return;
          grip.dx += e.clientX - last.current.x;
          grip.dy += e.clientY - last.current.y;
          last.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          grip.dragging = false;
          last.current = null;
        }}
        onWheel={(e) => (grip.zoom = THREE.MathUtils.clamp(grip.zoom - e.deltaY * 0.0015, 0.7, 2.2))}>
        <Canvas dpr={[1, 2]} camera={{ fov: 30, near: 0.01, far: 5, position: [0, 0, 0.72] }}
          // a plain click beside the document (not a drag to turn it) puts it back
          onPointerMissed={(e) => {
            if (Math.hypot(e.clientX - pressed.current.x, e.clientY - pressed.current.y) < 6) onClose();
          }}>
          <Suspense fallback={null}>
            <Environment files="/assets/env/small_empty_room_1_1k.hdr" environmentIntensity={0.9} />
            <directionalLight position={[0.6, 1, 1.2]} intensity={1.2} />
            <Held doc={doc} page={page} open={open} flipped={flipped} />
          </Suspense>
        </Canvas>
        <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[0.78rem] text-white/55">Sudrang - aylantirish · gʻildirak - yaqinlashtirish · F - agʻdarish{doc.kind === 'folder' ? ' · O - ochish' : ''}{pages > 1 ? ' · ← → - varaqlash' : ''}</p>
      </div>
      <aside className="flex flex-col gap-3 bg-[#0d121b]/95 p-5 text-white ring-1 ring-white/10 select-text">
        <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-amber-200 uppercase">Qoʻlingizda</p>
        <h2 className="text-[1.25rem] leading-tight font-semibold">{doc.name}</h2>
        <p className="text-[0.9rem] leading-snug text-white/75">{doc.note}</p>
        {showPage && current && (
          <div className="rounded-xl bg-white/[0.05] p-3 text-[0.82rem] leading-snug ring-1 ring-white/10">
            <p className="font-semibold">{current.title}</p>
            <ul className="mt-1.5 space-y-1 text-white/75">{current.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        )}
        <div className="mt-auto flex flex-wrap gap-2">
          {doc.kind === 'folder' && (
            <button type="button" className="btn btn-primary !min-h-11" onClick={() => { setOpen((o) => !o); audio.paper(); }}>{open ? 'Jildni yopish' : 'Jildni ochish'}</button>
          )}
          {showPage && pages > 1 && (
            <>
              <button type="button" className="btn btn-quiet !min-h-11" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Oldingi varaq">←</button>
              <span className="self-center text-[0.8rem] text-white/60 tabular-nums">{page + 1} / {pages}</span>
              <button type="button" className="btn btn-quiet !min-h-11" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Keyingi varaq">→</button>
            </>
          )}
          <button type="button" className="btn btn-quiet !min-h-11" onClick={() => setFlipped((f) => !f)}>Agʻdarish</button>
          <button type="button" className="btn btn-quiet !min-h-11" onClick={onClose}>Joyiga qoʻyish</button>
        </div>
      </aside>
    </motion.div>
  );
}
