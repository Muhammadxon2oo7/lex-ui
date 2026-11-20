import type { Metadata } from 'next';
import { Suspense } from 'react';
import CourtClient from './CourtClient';

export const metadata: Metadata = { title: 'Sud majlisi' };

export default function CourtPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0c0f14]" />}>
      <CourtClient />
    </Suspense>
  );
}
