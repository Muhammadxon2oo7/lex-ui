/**
 * Human answers to the unexpected (court server v1.4.6, `/nlu/match` → `situation`).
 *
 * When a student swears, gives up on the client, has lost a document, switches to Russian or
 * chats about football, the court server recognises it and sends, for every kind of character,
 * a ready, pre-voiced, human reply. Here we pick the line for whoever the student is talking to,
 * never the same one twice in a row. Order of precedence where it is used:
 * situation → match → clarify → the generic "I did not understand".
 */
import type { Emotion } from '@/contracts';
import { keyed, remoteKeyed } from '@/server/remote/key';

export interface SituationReply {
  emotion?: string;
  voices?: string[];
  lines: string[];
}

export interface Situation {
  id: string;
  tone: 'bad' | 'info';
  ethics: boolean;
  note: string | null;
  replies: Record<string, SituationReply>;
}

const EMOTIONS: Emotion[] = ['neutral', 'impatient', 'upset', 'confused', 'uncertain', 'calm', 'reassured'];

/** What the court server sent, checked field by field (anything odd → no situation, never a broken turn). */
export function readSituation(raw: unknown): Situation | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== 'string' || !s.replies || typeof s.replies !== 'object') return null;
  const replies: Record<string, SituationReply> = {};
  for (const [who, r] of Object.entries(s.replies as Record<string, unknown>)) {
    const lines = Array.isArray((r as SituationReply)?.lines) ? (r as SituationReply).lines.filter((l) => typeof l === 'string' && l.trim()).slice(0, 6) : [];
    if (lines.length) replies[who] = { lines, emotion: (r as SituationReply).emotion, voices: (r as SituationReply).voices };
  }
  if (!Object.keys(replies).length) return null;
  return { id: s.id.slice(0, 40), tone: s.tone === 'bad' ? 'bad' : 'info', ethics: s.ethics === true, note: typeof s.note === 'string' ? s.note.slice(0, 300) : null, replies };
}

/**
 * The line for this speaker: in turn through the variants, so the same words never come twice in a row.
 * `count` is how many times this situation has already been answered in the session (stored by the caller).
 */
export function situationLine(sit: Situation, speaker: string, count: number): { text: string; emotion: Emotion | undefined } | null {
  const r = sit.replies[speaker];
  if (!r) return null;
  const emotion = EMOTIONS.includes(r.emotion as Emotion) ? (r.emotion as Emotion) : undefined;
  return { text: r.lines[count % r.lines.length], emotion };
}

/**
 * Ask the court server whether a free answer is one of the human situations (used where the room has
 * no NLU of its own, e.g. the DXM office). Null when it is not, or the server is not reachable in time.
 */
export async function askSituation(owner: string | undefined, text: string, candidates: { id: string; text: string }[], context: Record<string, string>, stt?: { confidence?: number }): Promise<Situation | null> {
  if (!remoteKeyed() || !text.trim()) return null;
  const r = await keyed<{ situation?: unknown }>(owner, '/nlu/match', {
    timeout: 2500,
    body: { utterance: text, inputMode: 'text', context, candidates, ...(stt?.confidence !== undefined ? { stt: { confidence: stt.confidence } } : {}) },
  });
  return r?.status === 200 ? readSituation(r.json?.situation) : null;
}
