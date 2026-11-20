import type { Metadata } from 'next';
import ToolsClient from './ToolsClient';

export const metadata: Metadata = { title: 'Ish qurollari xonasi' };

export default function ToolsPage() {
  return <ToolsClient />;
}
