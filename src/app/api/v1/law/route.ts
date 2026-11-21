import { HttpError } from '@/server/engine/session';
import { handle } from '@/server/http';
import { normText } from '@/server/law/norms';

/** One norm of the verified pack, verbatim (lex.uz): GET /api/v1/law?ref=FK:326-modda */
export const GET = handle(async (request: Request) => {
  const ref = new URL(request.url).searchParams.get('ref') ?? '';
  const norm = ref.length <= 64 ? normText(ref) : null;
  if (!norm) throw new HttpError(404, 'not_found', 'Bu norma tekshirilgan toʻplamda yoʻq');
  return { norm };
});
