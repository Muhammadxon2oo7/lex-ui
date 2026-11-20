/**
 * Thin HTTP layer shared by the /api/v1 route handlers:
 * owner cookie, body validation, rate limiting and uniform error envelopes.
 */
import { cookies } from 'next/headers';
import type { z } from 'zod';
import { HttpError, getSession, newOwnerToken, type Session } from './engine/session';

const COOKIE = 'lexsim_owner';
const MAX_BODY_BYTES = 16 * 1024;

/** Sessions are bound to an HttpOnly cookie, so a leaked URL alone is not enough. */
export async function ownerToken(create = false): Promise<string | undefined> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing || !create) return existing;
  const token = newOwnerToken();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}

export async function ownedSession(id: string): Promise<Session> {
  return getSession(id, await ownerToken());
}

/* Fixed-window limiter: plenty for a single-node reference backend. */
const hits = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const t = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < t) {
    hits.set(key, { count: 1, resetAt: t + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt < t) hits.delete(k);
    return;
  }
  if (++entry.count > limit) throw new HttpError(429, 'rate_limited', 'Juda koʻp soʻrov. Birozdan soʻng urinib koʻring.');
}

export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large', 'Soʻrov hajmi juda katta');
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'invalid_json', 'JSON notoʻgʻri');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(422, 'validation_failed', 'Soʻrov maʼlumotlari notoʻgʻri');
  return parsed.data;
}

/** Wraps a handler so every failure becomes `{ error: { code, message } }`. */
export function handle<C>(fn: (request: Request, ctx: C) => Promise<unknown>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    try {
      return Response.json(await fn(request, ctx), { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
      }
      console.error('[lexsim] unhandled', err);
      return Response.json({ error: { code: 'internal', message: 'Ichki xatolik' } }, { status: 500 });
    }
  };
}

export type IdContext = { params: Promise<{ id: string }> };
