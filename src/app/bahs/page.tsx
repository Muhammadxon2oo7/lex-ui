import type { Metadata } from 'next';
import BahsHome from './BahsHome';

export const metadata: Metadata = { title: 'Bahs — jamoaviy sud' };

export default function BahsPage() {
  return <BahsHome />;
}
