'use client'; // error boundaries must be Client Components
import { ErrorScreen } from '@/components/hud/ErrorScreen';

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
