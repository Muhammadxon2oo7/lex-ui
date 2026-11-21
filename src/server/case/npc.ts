/**
 * When the room has no ready answer (court server v1.5 `POST /npc/reply`): the character answers in
 * their own role from the facts they know, and steers back to the room's goal. Order of precedence:
 * situation → match → clarify → AI character → the generic «tushunmadim».
 *
 * The court server checks every AI line (no new numbers, sums or dates; articles only from the list;
 * 1-3 sentences; no verdicts or legal advice) and throws away what fails - then we fall back to asking
 * again, as before. The AI is slow (9-50 s): the first call waits briefly; if the line is still being
 * written (`npc_pending`, or our own time limit) the character "thinks" and the client asks again -
 * the same request returns the finished line from the server's cache.
 */
import { keyed, remoteKeyed } from '@/server/remote/key';

/** Characters the court server can voice through the AI (others keep the ready lines only). */
const AI_SPEAKERS = new Set(['client', 'officer', 'investigator', 'chief', 'clerk', 'secretary', 'judge', 'respondent', 'witness', 'citizen', 'operator']);
const EMOTIONS = new Set(['neutral', 'impatient', 'upset', 'confused', 'uncertain', 'calm', 'reassured']);

export interface NpcRequest {
  speaker: string;
  caseKind: string;
  stage: string;
  goal: string;
  utterance: string;
  facts: string[];
  articles: string[];
  history: { speaker: string; text: string }[];
  conversationId: string;
}

export type NpcAnswer =
  | { kind: 'ok'; text: string; emotion?: string; engine: 'llm' | 'repeat' }
  | { kind: 'pending' }
  | { kind: 'none' };

export const canVoice = (speaker: string) => AI_SPEAKERS.has(speaker);
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** The scripted lines go to the server's memory of this conversation (the server only knows its own). */
async function remember(owner: string | undefined, req: NpcRequest) {
  if (!req.history.length) return;
  await keyed(owner, '/npc/history', { timeout: 2000, body: { conversationId: req.conversationId, items: req.history.slice(-20) } });
}

/**
 * One call. `first`: the student just spoke - remember the conversation, then wait up to ~7 s
 * (a serverless request must not hang); after that the client polls with the same request.
 */
export async function askNpc(owner: string | undefined, req: NpcRequest, first: boolean): Promise<NpcAnswer> {
  if (!remoteKeyed() || !canVoice(req.speaker) || words(req.utterance) < 2) return { kind: 'none' };
  if (first) await remember(owner, req);
  const r = await keyed<{ reply?: { text?: unknown; emotion?: unknown; engine?: unknown }; error?: { code?: string } }>(owner, '/npc/reply', {
    timeout: first ? 7000 : 9000,
    body: { ...req, history: req.history.slice(-8) },
  });
  // our own time limit: the server keeps writing, the same request will find it in the cache
  if (!r) return { kind: 'pending' };
  if (r.status === 503 && r.json?.error?.code === 'npc_pending') return { kind: 'pending' };
  const text = typeof r.json?.reply?.text === 'string' ? r.json.reply.text.trim() : '';
  if (r.status !== 200 || !text) return { kind: 'none' };
  const emotion = typeof r.json?.reply?.emotion === 'string' && EMOTIONS.has(r.json.reply.emotion) ? r.json.reply.emotion : undefined;
  return { kind: 'ok', text: text.slice(0, 600), emotion, engine: r.json?.reply?.engine === 'repeat' ? 'repeat' : 'llm' };
}
