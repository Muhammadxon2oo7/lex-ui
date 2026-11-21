/**
 * Bridge to the court backend's domains and cases (v1.4.9 "case-lab"). SERVER ONLY.
 *
 * The browser never talks to the backend: the key (X-LexSim-Key), the student's hashed identity
 * (X-LexSim-Owner) and the mentor token (X-Admin-Token) are added here. Every answer is parsed
 * against src/contracts/library.ts before it goes out.
 *
 * Mentors: who is a mentor is still to be decided with the project owner. Until then a mentor signs
 * in with a shared code (LEXSIM_MENTOR_CODE) and gets a signed, httpOnly cookie; the admin token
 * (LEXSIM_ADMIN_TOKEN) stays on this server.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { DomainsEnvelope, DraftSchema, LibCaseSchema, type Domain, type Draft, type LibCase } from '@/contracts/library';
import { HttpError } from '@/server/engine/session';
import { keyHeaders, REMOTE_BASE, remoteKeyed } from '@/server/remote/key';

const ADMIN = process.env.LEXSIM_ADMIN_TOKEN || null;
const MENTOR_CODE = process.env.LEXSIM_MENTOR_CODE || null;
const SECRET = process.env.LEXSIM_COOKIE_SECRET || process.env.LEXSIM_REMOTE_KEY || 'lexsim-dev-only';
const MENTOR_COOKIE = 'lexsim_mentor';

type Init = { method?: string; body?: unknown; admin?: boolean; timeout?: number };

/** A backend call; backend errors come back as our errors ({code, message} in Uzbek). */
async function call(owner: string | undefined, path: string, init: Init = {}): Promise<{ status: number; json: unknown; retryAfter: number | null }> {
  if (!REMOTE_BASE) throw new HttpError(503, 'no_backend', 'Sud serveri ulanmagan');
  const needsKey = path !== '/domains';
  if (needsKey && !remoteKeyed()) throw new HttpError(503, 'no_backend_key', 'Sud serveri kaliti sozlanmagan: caselar faqat joylashtirilgan saytda ishlaydi');
  if (init.admin && !ADMIN) throw new HttpError(503, 'no_admin_token', 'Mentor tokeni sozlanmagan');
  let res: Response;
  try {
    res = await fetch(`${REMOTE_BASE}${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(needsKey ? keyHeaders(owner) : {}),
        ...(init.admin && ADMIN ? { 'X-Admin-Token': ADMIN } : {}),
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(init.timeout ?? 15_000),
    });
  } catch {
    throw new HttpError(504, 'backend_unreachable', 'Sud serveri javob bermadi. Birozdan keyin urinib koʻring.');
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok && res.status !== 202) {
    const e = (json as { error?: { code?: string; message?: string } } | null)?.error;
    const message = res.status === 429 ? 'Hozir juda koʻp soʻrov: bir vaqtda 2 tadan ortiq qoralama boʻlmaydi. Birozdan keyin urinib koʻring.' : res.status === 404 ? 'Topilmadi' : (e?.message ?? 'Sud serveri xatosi');
    throw new HttpError(res.status, e?.code ?? 'backend_error', message);
  }
  const ra = Number(res.headers.get('Retry-After'));
  return { status: res.status, json, retryAfter: Number.isFinite(ra) && ra > 0 ? ra : null };
}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new HttpError(502, 'bad_backend_response', 'Sud serveri javobi kutilgan shaklda emas');
  return r.data;
}

/** The list may come as {cases: [...]} or a bare array; one case as {case: {...}} or the object itself. */
const listOf = (json: unknown) => parse(z.array(LibCaseSchema), Array.isArray(json) ? json : (json as { cases?: unknown } | null)?.cases);
const oneOf = (json: unknown) => parse(LibCaseSchema, (json as { case?: unknown } | null)?.case ?? json);

/** Cases of others come without confidential facts and balance; we make sure of it, whatever the server sends. */
function publicView(c: LibCase): LibCase {
  if (c.mine) return c;
  return { ...c, side: { claimant: { task: c.side.claimant.task, confidential: [] }, respondent: { task: c.side.respondent.task, confidential: [] } }, balance: null };
}

export async function domains(): Promise<{ domains: Domain[]; source: string | null }> {
  return parse(DomainsEnvelope, (await call(undefined, '/domains')).json);
}

export async function listCases(owner: string, domain: string, scope: 'all' | 'mine'): Promise<LibCase[]> {
  const r = await call(owner, `/cases?domain=${encodeURIComponent(domain)}&scope=${scope}`);
  return listOf(r.json).map(publicView);
}

export async function getCase(owner: string, id: string): Promise<LibCase> {
  return publicView(oneOf((await call(owner, `/cases/${encodeURIComponent(id)}`)).json));
}

export async function startDraft(owner: string, body: { domain: string; story: string; answers?: string }): Promise<{ draft: Draft; retryAfter: number }> {
  const r = await call(owner, '/cases/drafts', { body, timeout: 20_000 });
  return { draft: parse(z.object({ draft: DraftSchema }), r.json).draft, retryAfter: r.retryAfter ?? 10 };
}

export async function getDraft(owner: string, id: string): Promise<Draft> {
  return parse(z.object({ draft: DraftSchema }), (await call(owner, `/cases/drafts/${encodeURIComponent(id)}`)).json).draft;
}

export async function saveCase(owner: string, body: unknown, id?: string): Promise<LibCase> {
  const r = await call(owner, id ? `/cases/${encodeURIComponent(id)}` : '/cases', { body, timeout: 20_000 });
  return oneOf(r.json);
}

/* ───────────────────────── mentors ───────────────────────── */

const sign = (v: string) => createHmac('sha256', SECRET).update(`mentor:${v}`).digest('hex');

export async function mentorLogin(code: string): Promise<void> {
  if (!MENTOR_CODE) throw new HttpError(503, 'mentor_not_configured', 'Mentor kirishi hali sozlanmagan (loyiha egasi bilan hal qilinadi)');
  const a = Buffer.from(code), b = Buffer.from(MENTOR_CODE);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(403, 'wrong_code', 'Kod notoʻgʻri');
  const issued = String(Date.now());
  (await cookies()).set(MENTOR_COOKIE, `${issued}.${sign(issued)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 12 * 3600 });
}

export async function isMentor(): Promise<boolean> {
  const v = (await cookies()).get(MENTOR_COOKIE)?.value;
  if (!v) return false;
  const [issued, mac] = v.split('.');
  if (!issued || !mac || mac.length !== 64) return false;
  const ok = timingSafeEqual(Buffer.from(mac), Buffer.from(sign(issued)));
  return ok && Date.now() - Number(issued) < 12 * 3600 * 1000;
}

async function mentorOnly() {
  if (!(await isMentor())) throw new HttpError(403, 'mentor_only', 'Faqat mentor uchun');
}

export async function reviewQueue(owner: string): Promise<LibCase[]> {
  await mentorOnly();
  const r = await call(owner, '/cases?scope=review', { admin: true });
  return listOf(r.json);
}

export async function review(owner: string, id: string, decision: 'approve' | 'reject', note: string): Promise<LibCase> {
  await mentorOnly();
  const r = await call(owner, `/cases/${encodeURIComponent(id)}/review`, { admin: true, body: { decision, note } });
  return oneOf(r.json);
}

/* ───────────────────────── moot ───────────────────────── */

/** Approved cases that can be argued (titles for the room's case picker; no confidential facts). */
export async function mootCases(owner: string): Promise<{ id: string; title: string; domain: string; summary: string }[]> {
  const r = await call(owner, '/moot/cases');
  return listOf(r.json).map((c) => ({ id: c.id, title: c.title, domain: c.domain, summary: c.summary }));
}

/** The whole case, both sides' confidential facts — for the room engine only, never sent to a browser as is. */
export async function mootCaseFull(owner: string, id: string): Promise<LibCase> {
  return oneOf((await call(owner, `/moot/cases/${encodeURIComponent(id)}`)).json);
}
