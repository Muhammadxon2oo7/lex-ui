import { EmotionSchema } from '@/contracts';
import { z } from 'zod';
import { HttpError } from '@/server/engine/session';
import { ownerToken, rateLimit, readBody } from '@/server/http';
import { synthesize } from '@/server/voice/provider';

// any voice of the court server's palette (built-in four, more per scenario); the feeling is a hint the server may use
const Body = z.object({ text: z.string().trim().min(1).max(600), voice: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/), emotion: EmotionSchema.optional() });

export async function POST(request: Request) {
  try {
    const owner = (await ownerToken(true))!;
    rateLimit(`tts:${owner}`, 90);
    const { text, voice, emotion } = await readBody(request, Body);
    const audio = await synthesize(text, voice, owner, emotion);
    if (!audio) throw new HttpError(404, 'voice_unavailable', 'Ovoz xizmati sozlanmagan');
    return new Response(new Uint8Array(audio), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' } });
  } catch (err) {
    const e = err instanceof HttpError ? err : new HttpError(502, 'voice_failed', 'Ovozni yaratib boʻlmadi');
    return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
}
