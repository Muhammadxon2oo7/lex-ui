'use client';
/** The single canvas of the campus: one world from the title screen to the corridor. */
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { Physics } from '@react-three/rapier';
import { ToneMappingMode } from 'postprocessing';
import { Suspense } from 'react';
import * as THREE from 'three';
import type { AvatarModel } from '@/game/profile';
import { CampusPlayer } from './CampusPlayer';
import { CampusWorld } from './CampusWorld';
import { DevProbe, QualityGovernor, useTier } from '@/components/case/stagecraft';

export default function CampusCanvas({ avatar, reducedMotion, sensitivity, onReady }: { avatar: AvatarModel; reducedMotion: boolean; sensitivity: number; onReady: () => void }) {
  // the device decides the start (lib/deviceTier); the governor steps down if frames still drop
  const tier = useTier();
  return (
    <Canvas
      shadows="percentage"
      dpr={1}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, toneMapping: THREE.NoToneMapping }}
      camera={{ fov: 55, near: 0.08, far: 400, position: [16, 7, 32] }}
      role="img"
      aria-label="LexSim huquqiy amaliyot markazi — 3D bino, maydon va xonalar yoʻlagi"
      onCreated={() => requestAnimationFrame(onReady)}
    >
      <QualityGovernor />
      <DevProbe />
      <Suspense fallback={null}>
        <Physics timeStep="vary">
          <CampusWorld shadows={tier === 'high' ? 2048 : 1024} />
          <CampusPlayer avatar={avatar} reducedMotion={reducedMotion} sensitivity={sensitivity} />
        </Physics>
        {/* low: no post chain at all (the renderer tone-maps); medium: no ambient occlusion */}
        {tier !== 'low' && (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            {tier === 'high' ? <N8AO halfRes aoRadius={0.9} distanceFalloff={1} intensity={2.2} quality="medium" /> : <></>}
            <Bloom mipmapBlur luminanceThreshold={1.05} intensity={0.35} />
            <SMAA />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
