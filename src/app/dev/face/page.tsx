import { notFound } from 'next/navigation';
import FacePreview from './FacePreview';

/** Dev-only: faces up close (QA of skin, eyes, blinks, emotions). */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <FacePreview />;
}
