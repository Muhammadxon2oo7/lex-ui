import type { Metadata } from 'next';
import { Suspense } from 'react';
import MootClient from './MootClient';

export const metadata: Metadata = { title: 'Bahs - xona' };

export default function MootRoomPage() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <MootClient />
    </Suspense>
  );
}
