import type { Metadata } from 'next';
import { Suspense } from 'react';
import SimulationClient from './SimulationClient';

export const metadata: Metadata = { title: 'Simulyatsiya' };

export default function SimulationPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0c0f14]" />}>
      <SimulationClient />
    </Suspense>
  );
}
