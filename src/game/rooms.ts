/** Opening a practice room: shared by the orientation terminal, the corridor doors and the procedure map. */
import type { Level } from '@/contracts';
import { CaseEnvelopeSchema, kindOfStage, type CaseKind, type CaseSnapshot, type StageId } from '@/contracts/case';
import { api } from './api';

export type RoomAction = 'case' | 'dxm' | 'court' | 'tools' | 'library';

/** The student's case in progress (created on first use). */
export async function ensureCase(fresh = false, kind: CaseKind = 'labour', level?: Level): Promise<CaseSnapshot> {
  const res = await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh, kind, ...(level ? { level } : {}) }), signal: AbortSignal.timeout(15_000) });
  const json: unknown = await res.json().catch(() => null);
  const parsed = CaseEnvelopeSchema.safeParse(json);
  if (!res.ok || !parsed.success) throw new Error((json as { error?: { message?: string } } | null)?.error?.message ?? 'Ishni boshlab boʻlmadi');
  return parsed.data.case;
}

export async function currentCase(kind: CaseKind = 'labour'): Promise<CaseSnapshot | null> {
  const res = await fetch(`/api/v1/cases/current?kind=${kind}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  const json = (await res.json().catch(() => null)) as { case?: unknown } | null;
  const parsed = CaseEnvelopeSchema.safeParse(json);
  return res.ok && parsed.success ? parsed.data.case : null;
}

/** Prepares the room (creates a session where needed) and returns where to go. */
export async function roomUrl(action: RoomAction, stage?: StageId): Promise<string> {
  if (action === 'case') {
    const c = await ensureCase(false, stage ? kindOfStage(stage) : 'labour');
    const target = stage ?? c.stages.find((s) => s.status !== 'done')?.id ?? 'consult';
    return `/ish/${c.caseId}/${target}`;
  }
  if (action === 'dxm') {
    const snapshot = await api.createSession('dxm-yoqolgan-staj', 'tutorial');
    return `/simulation/${snapshot.sessionId}`;
  }
  if (action === 'court') {
    const res = await fetch('/api/v1/hearings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const json = (await res.json()) as { hearing?: { hearingId: string }; error?: { message: string } };
    if (!res.ok || !json.hearing) throw new Error(json.error?.message ?? 'Majlisni boshlab boʻlmadi');
    return `/court/${json.hearing.hearingId}`;
  }
  return action === 'tools' ? '/tools' : '/protsess';
}
