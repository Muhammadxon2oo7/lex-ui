'use client';
import { Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { Character } from '@/components/world/Character';

export default function MantlePreview() {
  return (
    <main className="grid h-dvh grid-cols-2 bg-[#d9d6cf]">
      {[0, -1.2].map((turn) => (
        <Canvas key={turn} camera={{ fov: 30, position: [0, 1.45, 2.2] }} onCreated={({ camera }) => camera.lookAt(0, 1.25, 0)}>
          <Suspense fallback={null}>
            <Environment files="/assets/env/small_empty_room_1_1k.hdr" environmentIntensity={0.8} />
            <directionalLight position={[2, 4, 3]} intensity={1.4} />
            <Character model="elder_man" position={[0, 0, 0]} rotation={turn} seatTop={0.46} standing robe restless={false} />
          </Suspense>
        </Canvas>
      ))}
    </main>
  );
}
