import type { Metadata } from 'next';
import HubClient from './HubClient';

export const metadata: Metadata = { title: 'Rol tanlash' };

export default function HubPage() {
  return <HubClient />;
}
