import type { Metadata } from 'next';
import { Suspense } from 'react';
import CourtSimClient from './CourtSimClient';

export const metadata: Metadata = { title: 'Iqtisodiy sud' };

export default function CourtSessionPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0c0f14]" />}>
      <CourtSimClient />
    </Suspense>
  );
}
