/**
 * Durable "Ish yoʻli" cases: the engine keeps working in memory (fast), and
 * every change is written through to the court backend's case store
 * (`PUT /store/cases/{id}`, optimistic versions). A case missing from memory
 * (server restart) is read back on first use, and so is the student's current
 * case of each kind (an index document per owner and kind).
 *
 * Completed rooms are also sent as xAPI statements (teacher dashboards).
 * Everything here is optional: without LEXSIM_REMOTE_KEY nothing is sent and
 * the engine behaves exactly as before. Failures never break a request.
 */
import type { CaseKind, CaseSnapshot } from '@/contracts/case';
import { statementsFor } from '@/lib/xapi';
import { storeGet, storePut } from '@/server/durable';
import { keyed, remoteKeyed, studentHash } from '@/server/remote/key';
import { currentCaseId, dumpCase, hasCase, loadCase } from './engine';

const g = globalThis as unknown as { __lexXapiSent?: Set<string> };
const sent = (g.__lexXapiSent ??= new Set());
const indexId = (owner: string, kind: CaseKind) => `idx-${studentHash(owner).slice(0, 24)}-${kind}`;

/** Write the case (and the owner's index for its kind) through to the store. Never throws. */
export async function saveCase(owner: string | undefined, snap: CaseSnapshot) {
  if (!owner || !remoteKeyed()) return;
  const d = dumpCase(snap.caseId);
  if (!d) return;
  await Promise.all([storePut(owner, snap.caseId, d.kind, d.state), storePut(owner, indexId(owner, snap.kind), 'index', { caseId: snap.caseId })]).catch(() => {});
}

async function fetchCase(owner: string, id: string): Promise<boolean> {
  const state = await storeGet(owner, id);
  if (!state) return false;
  loadCase(owner, state);
  return hasCase(id);
}

/** Make sure the case is in memory (after a restart it is read back from the store). */
export async function restoreCase(owner: string | undefined, id: string) {
  if (!owner || hasCase(id) || !remoteKeyed()) return;
  await fetchCase(owner, id).catch(() => false);
}

/** The owner's current case of this kind, read back from the store when memory has none. */
export async function restoreCurrent(owner: string | undefined, kind: CaseKind) {
  if (!owner || currentCaseId(owner, kind) || !remoteKeyed()) return;
  const caseId = ((await storeGet(owner, indexId(owner, kind))) as { caseId?: string } | null)?.caseId;
  if (caseId) await fetchCase(owner, caseId).catch(() => false);
}

/** A finished room → xAPI statements for the teacher (once per result). */
export async function reportRoom(owner: string | undefined, snap: CaseSnapshot) {
  if (!owner || !remoteKeyed() || !snap.stageDone || !snap.result || !snap.stage) return;
  const r = snap.result;
  const key = `${snap.caseId}:${snap.stage}:${r.score}:${r.log.length}:${r.hints}`;
  if (sent.has(key)) return;
  sent.add(key);
  const stage = snap.stages.find((s) => s.id === snap.stage);
  const statements = statementsFor({ actor: studentHash(owner), kind: snap.kind, stage: snap.stage, stageTitle: stage?.title ?? snap.stage, score: r.score, hints: r.hints, log: r.log, seconds: r.log.at(-1)?.at });
  await keyed(owner, '/xapi/statements', { body: { statements } }).catch(() => null);
}
