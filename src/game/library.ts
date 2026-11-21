/** Client side of domains and cases: everything goes through our own /api/v1/library routes. */
import { z } from 'zod';
import { DomainsEnvelope, DraftSchema, LibCaseSchema, type Draft, type LibCase } from '@/contracts/library';
import { MootCatalogItemSchema, NormTextSchema } from '@/contracts/moot';
import { ApiError } from './api';

async function call<S extends z.ZodType>(schema: S, path: string, body?: unknown, timeout = 25_000): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new ApiError(0, 'network', 'Aloqa uzildi. Internetni tekshiring.');
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Xatolik yuz berdi');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ApiError(502, 'bad_response', 'Server javobi kutilgandek emas');
  return parsed.data;
}

const One = z.object({ case: LibCaseSchema });
const Many = z.object({ cases: z.array(LibCaseSchema) });

export const library = {
  domains: () => call(DomainsEnvelope, '/library/domains'),
  cases: (domain: string, scope: 'all' | 'mine' = 'all') => call(Many, `/library/cases?domain=${encodeURIComponent(domain)}&scope=${scope}`).then((r) => r.cases),
  case: (id: string) => call(One, `/library/cases/${encodeURIComponent(id)}`).then((r) => r.case),
  draft: (domain: string, story: string, answers?: string) => call(z.object({ draft: DraftSchema, retryAfter: z.number().catch(10) }), '/library/drafts', { domain, story, ...(answers ? { answers } : {}) }),
  pollDraft: (id: string): Promise<Draft> => call(z.object({ draft: DraftSchema }), `/library/drafts/${encodeURIComponent(id)}`).then((r) => r.draft),
  save: (c: Omit<LibCase, 'id' | 'source' | 'status' | 'mine' | 'reviewNote' | 'createdAt' | 'updatedAt'> & { draftId?: string }, id?: string) =>
    call(One, id ? `/library/cases/${encodeURIComponent(id)}` : '/library/cases', c).then((r) => r.case),
  mentor: () => call(z.object({ mentor: z.boolean() }), '/library/mentor').then((r) => r.mentor),
  mentorLogin: (code: string) => call(z.object({ mentor: z.boolean() }), '/library/mentor', { code }),
  queue: () => call(Many, '/library/review').then((r) => r.cases),
  review: (id: string, decision: 'approve' | 'reject', note: string) => call(One, `/library/cases/${encodeURIComponent(id)}/review`, { decision, note }),
  /** The built-in «Bahs» cases (no backend needed). */
  mootCatalog: () => call(z.object({ cases: z.array(MootCatalogItemSchema) }), '/moot/catalog').then((r) => r.cases),
  /** One norm of the verified pack, verbatim. */
  law: (ref: string) => call(z.object({ norm: NormTextSchema }), `/law?ref=${encodeURIComponent(ref)}`).then((r) => r.norm),
  mootCases: () => call(z.object({ cases: z.array(z.object({ id: z.string(), title: z.string(), domain: z.string(), summary: z.string() })) }), '/moot/cases').then((r) => r.cases),
};

export const GROUPS: Record<string, string> = { iqtisodiy: 'Iqtisodiy sud', fuqarolik: 'Fuqarolik ishlari', jinoyat: 'Jinoyat ishlari', 'maʼmuriy': 'Davlat xizmatlari', "ma'muriy": 'Davlat xizmatlari' };
export const MODE_LABEL: Record<string, string> = { court: 'Sud zali', path: 'Ish yoʻli', moot: 'Bahs' };
