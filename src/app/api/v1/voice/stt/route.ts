import { HttpError } from '@/server/engine/session';
import { ownerToken, rateLimit } from '@/server/http';
import { transcribe } from '@/server/voice/provider';

const MAX_BYTES = 1_200_000; // ~37 s of 16 kHz mono PCM

export async function POST(request: Request) {
  try {
    const owner = (await ownerToken(true))!;
    rateLimit(`stt:${owner}`, 40);
    if (!(request.headers.get('content-type') ?? '').startsWith('audio/wav')) throw new HttpError(415, 'unsupported_media', 'Faqat WAV qabul qilinadi');
    const audio = await request.arrayBuffer();
    if (audio.byteLength > MAX_BYTES) throw new HttpError(413, 'payload_too_large', 'Yozuv juda uzun');
    const heard = await transcribe(audio, owner);
    if (heard === null) throw new HttpError(404, 'voice_unavailable', 'Nutqni tanish xizmati sozlanmagan');
    return Response.json({ text: heard.text, confidence: heard.confidence, lowConfidence: heard.low }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const e = err instanceof HttpError ? err : new HttpError(502, 'voice_failed', 'Nutqni tanib boʻlmadi');
    return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
}
