/**
 * Typed client for the /api/v1 contract. Every response is validated with
 * the shared Zod schemas before it can reach the store or the 3D scene.
 */
import { z } from 'zod';
import {
  AssessmentSchema,
  HintSchema,
  MutationResponseSchema,
  RemoteStatusSchema,
  SnapshotSchema,
  type Assessment,
  type DocumentDraft,
  type Hint,
  type InputMode,
  type Level,
  type RemoteStatus,
  type MutationResponse,
  type SessionMode,
  type Snapshot,
} from '@/contracts';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

/** `timeout`: most calls answer at once; a court turn may wait for the external LLM (up to ~3 min). */
async function call<S extends z.ZodType>(schema: S, path: string, body?: unknown, attempt = 0, timeout = 15_000): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    // Mutations carry a client id, so one automatic retry is safe (idempotent).
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 600));
      return call(schema, path, body, attempt + 1, timeout);
    }
    throw new ApiError(0, 'network', 'Tarmoq bilan aloqa uzildi. Qayta urinib koʻring.');
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'unknown', err?.message ?? 'Kutilmagan xatolik');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ApiError(502, 'contract_violation', 'Server javobi kontraktga mos emas');
  return parsed.data;
}

const SnapshotEnvelope = z.object({ snapshot: SnapshotSchema });
const ReportEnvelope = z.object({ report: AssessmentSchema });

export const api = {
  createSession: (scenarioId: string, mode: SessionMode, level?: Level): Promise<Snapshot> =>
    call(SnapshotEnvelope, '/sessions', { scenarioId, mode, ...(level ? { level } : {}) }).then((r) => r.snapshot),
  getSession: (id: string): Promise<Snapshot> => call(SnapshotEnvelope, `/sessions/${id}`).then((r) => r.snapshot),
  interact: (id: string, action: 'start' | 'enter-room' | 'sit-at-desk' | 'open-terminal' | 'inspect-phone' | 'stand' | 'sit' | 'reveal-options' | 'silence'): Promise<MutationResponse> =>
    call(MutationResponseSchema, `/sessions/${id}/interactions`, { clientActionId: newId(), action }),
  turn: (id: string, clientTurnId: string, reply: { text: string } | { optionId: string }, meta?: { inputMode?: InputMode; stt?: { confidence?: number; durationMs?: number } }): Promise<MutationResponse> =>
    // same clientTurnId on the retry → the server answers once (idempotent)
    call(MutationResponseSchema, `/sessions/${id}/turns`, { clientTurnId, ...reply, ...meta }, 0, 190_000),
  document: (id: string, draft: DocumentDraft, submit: boolean): Promise<MutationResponse> =>
    call(MutationResponseSchema, `/sessions/${id}/documents`, { clientActionId: newId(), draft, submit }),
  finish: (id: string): Promise<MutationResponse> =>
    call(MutationResponseSchema, `/sessions/${id}/finish`, { clientActionId: newId() }, 0, 65_000),
  report: (id: string): Promise<Assessment> => call(ReportEnvelope, `/sessions/${id}/report`).then((r) => r.report),
  /** Court coach (external court backend, tutorial mode). */
  hint: (id: string, preview = false): Promise<Hint> => call(z.object({ hint: HintSchema }), `/sessions/${id}/hint${preview ? '?preview=1' : ''}`).then((r) => r.hint),
  /** Missed events after a sequence (court: a pending LLM answer arrives here). */
  events: (id: string, after: number): Promise<MutationResponse> => call(MutationResponseSchema, `/sessions/${id}/events?after=${after}`),
  /** Is the external court backend reachable, and its court scenarios. */
  remoteStatus: (): Promise<RemoteStatus> => call(RemoteStatusSchema, '/remote'),
  appeal: (id: string, reason: string): Promise<Assessment> =>
    call(ReportEnvelope, `/sessions/${id}/appeal`, { reason }).then((r) => r.report),
};
