/**
 * Adapter for the external court backend (LexSim backend v1: judge procedure,
 * an LLM opposing advocate, Lex.uz RAG, deterministic court rubric).
 *
 * SERVER ONLY. The browser never talks to that server directly: our own
 * /api/v1/sessions routes delegate here for session ids with the `rmt_`
 * prefix, so the existing client (src/game/api.ts), its Zod contract and the
 * report page work unchanged. What this layer does:
 *
 *   · keeps the other server's owner cookie on our side (one per our owner);
 *   · validates every payload with our own Zod schemas; since backend v1.2
 *     its snapshot already matches, and the old normalisation (durationMinutes,
 *     briefing, options) only acts as a fallback if a field arrives in the
 *     old shape;
 *   · drops events our contract does not know instead of failing the turn;
 *   · waits long enough for the LLM (turns up to 3 min) and turns network
 *     trouble into clear Uzbek errors.
 *
 * Enabled only when LEXSIM_REMOTE_URL is set, e.g.
 *   LEXSIM_REMOTE_URL=http://192.168.88.110:8100/api/v1
 */
import {
  AssessmentSchema,
  HintSchema,
  MutationResponseSchema,
  SimEventSchema,
  SnapshotSchema,
  type Assessment,
  type Hint,
  type MutationResponse,
  type RemoteStatus,
  type Snapshot,
} from '@/contracts';
import { HttpError } from '@/server/engine/session';

const BASE = process.env.LEXSIM_REMOTE_URL?.replace(/\/+$/, '') || null;
const PREFIX = 'rmt_';
const REMOTE_COOKIE = 'lexsim_owner';

export const remoteEnabled = () => BASE !== null;
/** The court backend's owner cookie for this student, if they have opened a court session (its voice service needs it). */
export const remoteCookie = (owner: string) => jars.get(owner) ?? null;
export const isRemoteId = (id: string) => id.startsWith(PREFIX);
const local = (remoteId: string) => `${PREFIX}${remoteId}`;
const remote = (id: string) => id.slice(PREFIX.length);

/** Our owner token → the owner cookie the court backend issued to us for that student. */
const g = globalThis as unknown as { __lexRemoteJars?: Map<string, string> };
const jars = (g.__lexRemoteJars ??= new Map());

const TIMEOUT = { quick: 20_000, turn: 180_000, finish: 60_000 } as const;

async function request(owner: string, path: string, body: unknown | undefined, timeout: number): Promise<unknown> {
  if (!BASE) throw new HttpError(404, 'remote_disabled', 'Sud serveri ulanmagan');
  const cookie = jars.get(owner);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: `${REMOTE_COOKIE}=${cookie}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw timedOut
      ? new HttpError(504, 'remote_timeout', 'Sud serveri javobni kechiktirdi. Xuddi shu gapni qayta yuboring — takrorlanmaydi.')
      : new HttpError(503, 'remote_unavailable', 'Sud serveri bilan aloqa yoʻq. Lokal tarmoqqa ulanganingizni tekshiring.');
  }
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const m = c.match(new RegExp(`^${REMOTE_COOKIE}=([^;]+)`));
    if (m) jars.set(owner, m[1]);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new HttpError(res.status, e?.code ?? 'remote_error', e?.message ?? 'Sud serveri xatolik qaytardi');
  }
  return json;
}

const broken = (what: string, issues: unknown) => {
  console.error(`[lexsim] remote ${what} does not match the contract`, JSON.stringify(issues).slice(0, 600));
  return new HttpError(502, 'remote_contract', 'Sud serveri javobi kontraktga mos emas');
};

/** Their briefing is one paragraph; ours is structured. Secret notes (Maxfiy) go to `authority`, the rest to `task`. */
function briefing(text: string, role: string) {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const secret = sentences.findIndex((s) => /^Maxfiy\b/i.test(s));
  const open = secret < 0 ? sentences : sentences.slice(0, secret);
  const hidden = secret < 0 ? [] : sentences.slice(secret).map((s) => s.replace(/^Maxfiy:\s*/i, ''));
  return { workplace: 'Iqtisodiy sud · sud majlisi', position: role, authority: hidden, task: open };
}

function normaliseSnapshot(raw: unknown): Snapshot {
  const s = raw as Record<string, unknown> & { sessionId: string; scenario: Record<string, unknown> };
  const scenario = s.scenario ?? {};
  const shaped = {
    ...s,
    sessionId: local(String(s.sessionId)),
    options: Array.isArray(s.options) ? s.options : [],
    scenario: {
      ...scenario,
      durationMinutes: typeof scenario.durationMinutes === 'string' ? scenario.durationMinutes : String(scenario.durationMinutes ?? ''),
      briefing: typeof scenario.briefing === 'string' ? briefing(scenario.briefing, String(scenario.role ?? '')) : scenario.briefing,
    },
  };
  const parsed = SnapshotSchema.safeParse(shaped);
  if (!parsed.success) throw broken('snapshot', parsed.error.issues);
  return parsed.data;
}

function normaliseMutation(raw: unknown): MutationResponse {
  const r = raw as { events?: unknown[]; snapshot: unknown };
  const events = (r.events ?? [])
    .map((e) => ({ ...(e as object), sessionId: local(String((e as { sessionId?: string }).sessionId ?? '')) }))
    // an event type our contract does not know is skipped, not fatal
    .filter((e) => SimEventSchema.safeParse(e).success);
  const shaped = { events, snapshot: normaliseSnapshot(r.snapshot) };
  const parsed = MutationResponseSchema.safeParse(shaped);
  if (!parsed.success) throw broken('mutation', parsed.error.issues);
  return parsed.data;
}

function normaliseReport(raw: unknown): Assessment {
  const r = (raw as { report: Record<string, unknown> }).report;
  const parsed = AssessmentSchema.safeParse({ ...r, sessionId: local(String(r.sessionId)), appeal: r.appeal ?? null });
  if (!parsed.success) throw broken('report', parsed.error.issues);
  return parsed.data;
}

/* ───────────────────────────── the operations ───────────────────────────── */

let scenarioCache: { at: number; ids: Set<string> } | null = null;
/** Is this scenario one of the court backend's? (cached for a minute) */
export async function isRemoteScenario(scenarioId: string): Promise<boolean> {
  if (!BASE) return false;
  if (!scenarioCache || Date.now() - scenarioCache.at > 60_000) {
    try {
      const list = (await request('status', '/scenarios', undefined, 4000)) as { scenarios?: { id: string }[] };
      scenarioCache = { at: Date.now(), ids: new Set((list.scenarios ?? []).map((x) => x.id)) };
    } catch {
      return false;
    }
  }
  return scenarioCache.ids.has(scenarioId);
}

export const remoteCourt = {
  create: async (owner: string, scenarioId: string, mode: 'tutorial' | 'assessment', level?: 'beginner' | 'intermediate' | 'advanced') =>
    normaliseSnapshot(((await request(owner, '/sessions', { scenarioId, mode, ...(level ? { level } : {}) }, TIMEOUT.quick)) as { snapshot: unknown }).snapshot),
  get: async (owner: string, id: string) =>
    normaliseSnapshot(((await request(owner, `/sessions/${remote(id)}`, undefined, TIMEOUT.quick)) as { snapshot: unknown }).snapshot),
  interact: async (owner: string, id: string, body: unknown) => normaliseMutation(await request(owner, `/sessions/${remote(id)}/interactions`, body, TIMEOUT.quick)),
  turn: async (owner: string, id: string, body: unknown) => normaliseMutation(await request(owner, `/sessions/${remote(id)}/turns`, body, TIMEOUT.turn)),
  finish: async (owner: string, id: string, body: unknown) => normaliseMutation(await request(owner, `/sessions/${remote(id)}/finish`, body, TIMEOUT.finish)),
  document: async (owner: string, id: string, body: unknown) => normaliseMutation(await request(owner, `/sessions/${remote(id)}/documents`, body, TIMEOUT.quick)),
  events: async (owner: string, id: string, after: number) => {
    const r = (await request(owner, `/sessions/${remote(id)}/events?after=${after}`, undefined, TIMEOUT.quick)) as { events?: unknown[]; snapshot: unknown };
    return normaliseMutation(r);
  },
  report: async (owner: string, id: string) => normaliseReport(await request(owner, `/sessions/${remote(id)}/report`, undefined, TIMEOUT.quick)),
  appeal: async (owner: string, id: string, reason: string) => normaliseReport(await request(owner, `/sessions/${remote(id)}/appeal`, { reason }, TIMEOUT.quick)),
  /** `preview`: look without paying (−5 points are charged only for a real hint). */
  hint: async (owner: string, id: string, preview = false): Promise<Hint> => {
    const r = (await request(owner, `/sessions/${remote(id)}/hint${preview ? '?preview=1' : ''}`, undefined, TIMEOUT.quick)) as { hint: unknown };
    const parsed = HintSchema.safeParse(r.hint);
    if (!parsed.success) throw broken('hint', parsed.error.issues);
    return parsed.data;
  },
};

/** Health + scenarios, for the hub card (short timeouts: the hub must not wait on a dead server). */
export async function remoteStatus(): Promise<RemoteStatus> {
  if (!BASE) return { enabled: false, ok: false, llm: false, scenarios: [] };
  try {
    const [health, list] = await Promise.all([
      request('status', '/health', undefined, 4000) as Promise<{ ok?: boolean; llm?: { enabled?: boolean } }>,
      request('status', '/scenarios', undefined, 4000) as Promise<{ scenarios?: Record<string, unknown>[] }>,
    ]);
    const scenarios = (list.scenarios ?? []).map((x) => ({
      id: String(x.id),
      title: String(x.title ?? ''),
      role: String(x.role ?? ''),
      durationMinutes: String(x.durationMinutes ?? ''),
      // the card shows the open task only — never the role's secret notes (authority / "Maxfiy")
      briefing:
        typeof x.briefing === 'string'
          ? x.briefing.replace(/\s*Maxfiy[\s\S]*$/, '')
          : Array.isArray((x.briefing as { task?: unknown } | undefined)?.task)
            ? ((x.briefing as { task: unknown[] }).task.filter((t) => typeof t === 'string' && !/Maxfiy/i.test(t)) as string[]).join(' ')
            : '',
      position: String((x.briefing as { position?: unknown } | undefined)?.position ?? x.role ?? ''),
      disclaimer: String(x.disclaimer ?? ''),
    }));
    scenarioCache = { at: Date.now(), ids: new Set(scenarios.map((x) => x.id)) };
    return { enabled: true, ok: Boolean(health.ok), llm: Boolean(health.llm?.enabled), scenarios };
  } catch {
    return { enabled: true, ok: false, llm: false, scenarios: [] };
  }
}
