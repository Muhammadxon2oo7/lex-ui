import { HttpError } from '@/server/engine/session';
import { handle, ownerToken, rateLimit } from '@/server/http';
import { putAudio } from '@/server/moot/engine';

/** The speaker's own voice for a line (16 kHz mono WAV): the others hear it, the record keeps it. */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const owner = await ownerToken();
  rateLimit(`moot-audio:${owner}`, 60);
  if (!(request.headers.get('content-type') ?? '').startsWith('audio/wav')) throw new HttpError(415, 'unsupported_media', 'Faqat WAV qabul qilinadi');
  return { audio: putAudio(owner, (await params).code, Buffer.from(await request.arrayBuffer())) };
});
