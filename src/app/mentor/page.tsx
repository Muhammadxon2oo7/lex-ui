import type { Metadata } from 'next';
import Mentor from '@/components/library/Mentor';

export const metadata: Metadata = { title: 'Mentor', robots: { index: false } };

export default function MentorPage() {
  return <Mentor />;
}
