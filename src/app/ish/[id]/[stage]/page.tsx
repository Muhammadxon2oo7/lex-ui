import type { Metadata } from 'next';
import { Suspense } from 'react';
import CaseClient from './CaseClient';

export const metadata: Metadata = { title: 'Ish yoʻli' };

export default function CaseStagePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0c0f14]" />}>
      <CaseClient />
    </Suspense>
  );
}
