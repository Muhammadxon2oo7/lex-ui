import { HttpError } from '@/server/engine/session';
import { ownerToken, rateLimit } from '@/server/http';
import { cachedAudio } from '@/server/voice/provider';

/**
 * A pre-rendered line by id (`npcTurn.audio`): fetched once and kept by the browser for good —
 * the id changes when the voice is re-recorded, so nothing stale is ever played.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  try {
    const { file } = await params;
    if (!/^[\w.-]{8,160}\.mp3$/.test(file)) throw new HttpError(404, 'not_found', 'Topilmadi');
    const owner = (await ownerToken(true))!;
    rateLimit(`voice-cache:${owner}`, 240);
    const audio = await cachedAudio(file, owner);
    if (!audio) throw new HttpError(404, 'voice_unavailable', 'Ovoz topilmadi');
    return new Response(new Uint8Array(audio), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000, immutable' } });
  } catch (err) {
    const e = err instanceof HttpError ? err : new HttpError(502, 'voice_failed', 'Ovozni olib boʻlmadi');
    return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
}
