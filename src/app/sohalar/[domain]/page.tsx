import type { Metadata } from 'next';
import { Suspense } from 'react';
import DomainCases from '@/components/library/DomainCases';

export const metadata: Metadata = { title: 'Caselar' };

export default function DomainPage() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <DomainCases />
    </Suspense>
  );
}
