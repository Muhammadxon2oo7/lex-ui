'use client';
/**
 * Room 3 — "Ish qurollari xonasi". A quiet room with a long table on which
 * the tools of a front-desk official are laid out. Look around (drag), point
 * at an object to see what it is, click to pick it up and handle it.
 */
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import Link from 'next/link';
import { MotionConfig, motion } from 'motion/react';
import { ToneMappingMode } from 'postprocessing';
import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';
import { ITEMS, type ItemId } from '@/game/items';
import { useGame } from '@/game/store';
import { ItemModel } from '@/components/world/Items';
import { Prop } from '@/components/world/Furniture';
import { TILE, tiledBox, useMaterials } from '@/components/world/materials';

const ItemViewer = dynamic(() => import('@/components/world/ItemViewer'), { ssr: false });

/** Where each object lies on the table (table top at y = 0.78). */
const LAYOUT: { id: ItemId; position: [number, number, number]; rotation: [number, number, number] }[] = [
  { id: 'case-folder', position: [-0.75, 0.787, 0.02], rotation: [-Math.PI / 2, 0, 0.08] },
  { id: 'code-book', position: [-0.2, 0.797, -0.06], rotation: [-Math.PI / 2, 0, -0.25] },
  { id: 'stamp', position: [0.28, 0.78, 0.08], rotation: [0, 0, 0] },
  { id: 'id-card', position: [0.62, 0.7805, 0.12], rotation: [-Math.PI / 2, 0, 0.3] },
  { id: 'queue-ticket', position: [0.88, 0.7802, -0.08], rotation: [-Math.PI / 2, 0, -0.2] },
  { id: 'receipt', position: [1.12, 0.7802, 0.06], rotation: [-Math.PI / 2, 0, 0.12] },
];

function Room({ hover, setHover }: { hover: ItemId | null; setHover: (id: ItemId | null) => void }) {
  const m = useMaterials();
  const top = tiledBox(3, 0.05, 1, TILE.oak);
  const floor = tiledBox(9, 0.1, 9, TILE.laminate);
  const wall = tiledBox(9, 3.2, 0.2, TILE.plaster);
  useEffect(() => () => [top, floor, wall].forEach((g) => g.dispose()), [top, floor, wall]);
  return (
    <>
      <Environment files="/assets/env/small_empty_room_1_1k.hdr" environmentIntensity={0.7} />
      <directionalLight position={[2, 5, 3]} intensity={2.2} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} />
      <pointLight position={[0, 2.4, 0.6]} intensity={4} distance={6} color="#fff1dc" />
      <mesh geometry={floor} material={m.laminate} position={[0, -0.05, 0]} receiveShadow />
      <mesh geometry={wall} material={m.plaster} position={[0, 1.6, -2.2]} receiveShadow />
      <mesh geometry={top} material={m.oak} position={[0.15, 0.755, 0]} castShadow receiveShadow />
      {[-1.25, 1.55].map((x) => (
        <mesh key={x} material={m.walnut} position={[x, 0.37, 0]} castShadow>
          <boxGeometry args={[0.06, 0.74, 0.9]} />
        </mesh>
      ))}
      <Prop model="desk_lamp_arm_01" position={[1.45, 0.78, -0.32]} rotation={-2.4} />
      <Prop model="Shelf_01" position={[-2.6, 0, -2.05]} />
      <Prop model="potted_plant_02" position={[2.7, 0, -1.6]} />
      {LAYOUT.map((l) => (
        <group
          key={l.id}
          position={l.position}
          rotation={l.rotation}
          scale={hover === l.id ? 1.06 : 1}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(l.id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHover(null);
            document.body.style.cursor = '';
          }}
          onClick={(e) => {
            e.stopPropagation();
            useGame.getState().inspect(l.id);
          }}
        >
          <ItemModel id={l.id} />
        </group>
      ))}
      <ContactShadows position={[0, 0.781, 0]} scale={3.2} far={0.3} blur={2.2} opacity={0.45} />
    </>
  );
}

export default function ToolsClient() {
  const [hover, setHover] = useState<ItemId | null>(null);
  const inspecting = useGame((s) => s.inspecting);
  useEffect(() => () => void (document.body.style.cursor = ''), []);
  return (
    <MotionConfig reducedMotion="user">
      <main className="relative h-dvh w-full overflow-hidden bg-[#0c0f14] text-white">
        <div className="absolute inset-0" inert={Boolean(inspecting)}>
          <Canvas shadows="percentage" dpr={[1, 2]} camera={{ position: [0.2, 1.65, 2.1], fov: 45 }} gl={{ antialias: false, toneMapping: THREE.NoToneMapping }} role="img" aria-label="Stol ustidagi ish qurollari">
            <color attach="background" args={['#0c0f14']} />
            <Suspense fallback={null}>
              <Room hover={hover} setHover={setHover} />
              <EffectComposer multisampling={0} enableNormalPass={false}>
                <N8AO halfRes aoRadius={0.4} intensity={2} />
                <Bloom mipmapBlur luminanceThreshold={1.1} intensity={0.3} />
                <SMAA />
                <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
              </EffectComposer>
            </Suspense>
            <OrbitControls target={[0.15, 0.8, 0]} enablePan={false} minDistance={1.1} maxDistance={3.2} minPolarAngle={0.5} maxPolarAngle={1.35} minAzimuthAngle={-0.9} maxAzimuthAngle={0.9} enableDamping />
          </Canvas>
        </div>

        <header className="glass absolute top-4 left-4 max-w-sm rounded-[20px] px-4 py-3 max-sm:top-17 max-sm:right-4">
          <p className="text-[0.66rem] font-semibold tracking-[0.18em] text-amber-200 uppercase">3-xona</p>
          <h1 className="text-lg leading-tight font-semibold">Ish qurollari xonasi</h1>
          <p className="mt-1 text-[0.84rem] leading-snug text-white/70">Stol ustidagi buyumni bosing — qoʻlingizga olib, aylantirib, ishlatib koʻring. Sudrab — xonaga qarash.</p>
        </header>
        <Link href="/" className="glass btn absolute top-4 right-4 !min-h-10 !px-4 text-[0.86rem]">Yoʻlakka chiqish</Link>

        {/* the same objects as a list: keyboard and screen-reader path */}
        <nav aria-label="Buyumlar" className="absolute inset-x-0 bottom-4 flex justify-center px-4">
          {/* one row everywhere: it scrolls sideways on a phone instead of piling up over the desk */}
          <ul className="glass flex max-w-full snap-x gap-1.5 overflow-x-auto overscroll-x-contain rounded-card p-2 [scrollbar-width:none] sm:flex-wrap sm:justify-center">
            {LAYOUT.map((l) => (
              <li key={l.id} className="shrink-0 snap-start whitespace-nowrap">
                <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => useGame.getState().inspect(l.id)} onFocus={() => setHover(l.id)} onBlur={() => setHover(null)} onMouseEnter={() => setHover(l.id)} onMouseLeave={() => setHover(null)} className={`min-h-11 rounded-2xl px-3.5 text-left transition-colors ${hover === l.id ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                  <span className="block text-[0.88rem] leading-tight font-semibold">{ITEMS[l.id].name}</span>
                  <span className="block text-[0.68rem] text-white/50">{ITEMS[l.id].kind}</span>
                </motion.button>
              </li>
            ))}
          </ul>
        </nav>
        <ItemViewer />
      </main>
    </MotionConfig>
  );
}
