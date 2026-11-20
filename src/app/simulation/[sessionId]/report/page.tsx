import type { Metadata } from 'next';
import { Suspense } from 'react';
import ReportClient from './ReportClient';

export const metadata: Metadata = { title: 'Hisobot' };

export default function ReportPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <ReportClient />
    </Suspense>
  );
}
