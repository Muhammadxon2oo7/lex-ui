import type { Metadata } from 'next';
import CampusClient from '@/components/campus/CampusClient';

export const metadata: Metadata = { title: '3D kampus' };

/** The 3D campus (title → character → building): walk the corridor and enter a room by its door. */
export default function CampusPage() {
  return <CampusClient />;
}
