'use client';
/**
 * 3D runtime root (client only, lazy-loaded — never part of the landing,
 * hub or report bundles).
 *
 * Render pipeline (WebGL2, R3F v9):
 *   HDRI image-based lighting + one shadow-casting sun through the blinds
 *   → N8AO (contact / ambient occlusion) → bloom on HDR highlights
 *   → SMAA → filmic tone mapping.
 * Quality presets trade these stages against frame time and are lowered
 * automatically when the measured frame rate declines.
 */
import { Environment, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { Physics } from '@react-three/rapier';
import { ToneMappingMode } from 'postprocessing';
import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { NPC_SEAT, SPAWN } from '@/game/manifest';
import { useGame, type Quality } from '@/game/store';
import { Building } from './Building';
import { Character } from './Character';
import { Furniture } from './Furniture';
import { WorldItems } from './Items';
import { useMaterials } from './materials';
import { Player } from './Player';
import { SetDressing } from './SetDressing';
import { DevProbe } from '@/components/case/stagecraft';

const PRESET: Record<Quality, { dpr: [number, number]; shadow: number; lights: boolean }> = {
  low: { dpr: [0.75, 1], shadow: 0, lights: false },
  medium: { dpr: [1, 1.25], shadow: 1024, lights: true },
  high: { dpr: [1, 1.75], shadow: 2048, lights: true },
};


function RendererSetup({ quality }: { quality: Quality }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // With the post chain, tone mapping happens in the final effect instead.
    gl.toneMapping = quality === 'low' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    gl.toneMappingExposure = 1;
    gl.shadowMap.needsUpdate = true;
  }, [gl, quality]);
  return null;
}

function PostFx({ quality }: { quality: Quality }) {
  if (quality === 'low') return null;
  if (quality === 'medium') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur luminanceThreshold={1.1} intensity={0.3} />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    );
  }
  return <HighFx />;
}

/** Full chain. In conversation the lens focuses on the citizen and lets the room fall away. */
function HighFx() {
  const focused = useGame((s) => s.mode === 'seated' && !s.settings.reducedMotion);
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO halfRes aoRadius={0.85} distanceFalloff={1} intensity={2.4} quality="medium" />
      <DepthOfField target={NPC_SEAT.head} worldFocusRange={focused ? 2.4 : 60} bokehScale={focused ? 2 : 0} />
      <Bloom mipmapBlur luminanceThreshold={1.1} intensity={0.38} />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

function Scene({ quality }: { quality: Quality }) {
  const m = useMaterials();
  const preset = PRESET[quality];
  const setWorldReady = useGame((s) => s.setWorldReady);
  useEffect(() => setWorldReady(), [setWorldReady]);

  return (
    <>
      <Environment files="/assets/env/small_empty_room_1_1k.hdr" environmentIntensity={0.7} />
      <hemisphereLight intensity={0.28} color="#ffffff" groundColor="#b6a58f" />
      {/* Morning sun from the east, raking through the vertical blinds. */}
      <directionalLight
        position={[18, 10.5, 4]}
        intensity={4.2}
        color="#fff0dc"
        castShadow={preset.shadow > 0}
        shadow-mapSize={[preset.shadow || 512, preset.shadow || 512]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={2}
        shadow-camera-far={46}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
      />
      <Physics timeStep="vary" gravity={[0, -9.81, 0]}>
        <Building m={m} lights={preset.lights} />
        <Player />
      </Physics>
      <Furniture m={m} />
      <SetDressing m={m} />
      <WorldItems />
      <Character model="elder_man" position={NPC_SEAT.position} rotation={NPC_SEAT.rotation} seatTop={0.43} driven mood="impatient" doppi exitPath={RUSTAM_EXIT} />
      {quality !== 'low' && (
        <>
          <Character model="woman" position={[6.4, 0, 2.95]} rotation={-Math.PI / 2} seatTop={0.46} mood="neutral" seed={2} />
          <Character model="man" position={[6.4, 0, 7.25]} rotation={-Math.PI / 2} seatTop={0.46} mood="impatient" seed={3} />
        </>
      )}
      <PostFx quality={quality} />
    </>
  );
}

const ORDER: Quality[] = ['low', 'medium', 'high'];

/** When the appointment is over he stands, steps round his chair and leaves through the door of room 3. */
const RUSTAM_EXIT: [number, number][] = [
  [3.25, -2.72],
  [3.05, -1.35],
  [2.95, -0.35],
  [2.95, 1.1],
  [2.1, 2.8],
];

export default function WorldCanvas({ onContextLost }: { onContextLost: () => void }) {
  const quality = useGame((s) => s.settings.quality);
  const fov = useGame((s) => s.settings.fov);
  const preset = PRESET[quality];

  return (
    <Canvas
      shadows={preset.shadow > 0 ? 'percentage' : false}
      dpr={preset.dpr}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', stencil: false }}
      camera={{ fov, near: 0.06, far: 60, position: [SPAWN.position[0], 1.62, SPAWN.position[2]] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onContextLost();
        });
      }}
      aria-label="3D davlat xizmatlari markazi. Klaviaturasiz yoki ekran oʻquvchi bilan ishlash uchun 2D rejimdan foydalaning."
      role="img"
    >
      <color attach="background" args={['#0c0f14']} />
      <RendererSetup quality={quality} />
      <PerformanceMonitor
        ms={250}
        iterations={8}
        threshold={0.8}
        onDecline={() => {
          const { settings, setSettings } = useGame.getState();
          const i = ORDER.indexOf(settings.quality);
          if (!settings.autoQuality || i === 0) return;
          setSettings({ quality: ORDER[i - 1] });
          useGame.setState({ qualityNotice: true });
        }}
      />
      <DevProbe />
      <Suspense fallback={null}>
        <Scene quality={quality} />
      </Suspense>
    </Canvas>
  );
}
