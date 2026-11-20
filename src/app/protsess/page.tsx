import type { Metadata } from 'next';
import ProcessClient from './ProcessClient';

export const metadata: Metadata = { title: 'Protsess xaritasi' };

export default function ProcessPage() {
  return <ProcessClient />;
}
