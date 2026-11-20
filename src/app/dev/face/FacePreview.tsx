'use client';
import { Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { Emotion } from '@/contracts';
import { Character, type CharacterModel } from '@/components/world/Character';

const CAST: { model: CharacterModel; mood: Emotion }[] = [
  { model: 'elder_man', mood: 'calm' },
  { model: 'lawyer', mood: 'reassured' },
  { model: 'client', mood: 'upset' },
];

function Inner() {
  const q = useSearchParams();
  const mood = (q.get('mood') as Emotion | null) ?? null;
  return (
    <main className="grid h-dvh grid-cols-3 bg-[#d9d6cf]">
      {CAST.map((c) => (
        <Canvas key={c.model} camera={{ fov: 22, position: [0, 1.22, 1.05] }} onCreated={({ camera }) => camera.lookAt(0, 1.18, 0)}>
          <Suspense fallback={null}>
            <Environment files="/assets/env/small_empty_room_1_1k.hdr" environmentIntensity={0.85} />
            <directionalLight position={[1.5, 2.5, 2]} intensity={1.6} />
            <Character model={c.model} position={[0, 0, 0]} rotation={0} seatTop={0.46} mood={mood ?? c.mood} lookAt={[0, 1.22, 1.05]} restless={false} seed={3} />
          </Suspense>
        </Canvas>
      ))}
    </main>
  );
}

export default function FacePreview() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
