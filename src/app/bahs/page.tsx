import type { Metadata } from 'next';
import { Suspense } from 'react';
import BahsHome from './BahsHome';

export const metadata: Metadata = { title: 'Bahs - jamoaviy sud' };

export default function BahsPage() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <BahsHome />
    </Suspense>
  );
}
