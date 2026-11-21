import { HttpError } from '@/server/engine/session';
import { ownerToken } from '@/server/http';
import { getAudio } from '@/server/moot/engine';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  try {
    const { code, id } = await params;
    const wav = getAudio(await ownerToken(), code, id);
    return new Response(new Uint8Array(wav), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=3600' } });
  } catch (err) {
    const e = err instanceof HttpError ? err : new HttpError(500, 'internal', 'Ichki xatolik');
    return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
}
