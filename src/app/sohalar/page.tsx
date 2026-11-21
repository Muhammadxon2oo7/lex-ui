import type { Metadata } from 'next';
import Domains from '@/components/library/Domains';

export const metadata: Metadata = { title: 'Sohalar va caselar' };

export default function DomainsPage() {
  return <Domains />;
}
