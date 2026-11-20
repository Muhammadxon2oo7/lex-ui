import { notFound } from 'next/navigation';
import MantlePreview from './MantlePreview';

/** Dev-only: the judge's mantle up close (QA of the costume). */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MantlePreview />;
}
