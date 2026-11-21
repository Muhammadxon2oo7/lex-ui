/**
 * Understanding an answer given in the student's own words (typed or spoken)
 * in an "Ish yoʻli" room: which of the moment's replies it means.
 *
 *   1. the court backend's /nlu/match (reranker + rules, ~0.2–0.4 s) when the
 *      server key is set — it also catches ethics violations and, when two
 *      replies of opposite worth are close, asks for clarification rather than guess;
 *   2. otherwise our own lexical matcher (src/lib/uz.ts), cautious by design.
 */
import { matchUtterance } from '@/lib/uz';
import { readSituation, type Situation } from '@/server/situation';
import { keyed } from '@/server/remote/key';
import { freeCandidates } from './engine';

type Nlu = {
  match: { id: string; score: number } | null;
  clarify: string | null;
  quality?: { ethics?: 'ok' | 'violation' };
  reason?: string;
  /** v1.4.6: a recognised human situation, with a ready reply for every kind of character */
  situation?: unknown;
};

/** `ai`: nothing ready fits - the character may answer through the AI (court server /npc/reply). */
export type Understood = { optionId: string | null; clarify: string | null; ethics: boolean; situation?: Situation | null; ai?: boolean };

const FORBIDDEN = ['pora', 'tanish', 'konvert', 'pul beraman', 'kelishib qoʻyamiz'];

export async function understand(id: string, owner: string | undefined, text: string, inputMode: 'text' | 'voice', stt?: { confidence?: number }): Promise<Understood> {
  const cand = freeCandidates(id, owner);
  if (!cand.options.length) return { optionId: null, clarify: 'Hozir javob kutilmayapti.', ethics: false };
  // the recogniser was not sure what it heard: never judge a guess — the person you talk to asks again
  if (inputMode === 'voice' && stt?.confidence !== undefined && stt.confidence < 0.5) return { optionId: null, clarify: 'Ovozingiz aniq eshitilmadi — yana bir bor, aniqroq ayting.', ethics: false };
  const r = await keyed<Nlu>(owner, '/nlu/match', {
    timeout: 4000,
    body: {
      utterance: text,
      inputMode,
      ...(stt?.confidence !== undefined ? { stt: { confidence: stt.confidence } } : {}),
      context: { case: cand.kind, stage: cand.stage, node: cand.node, prompt: cand.prompt },
      candidates: cand.options.map((o) => ({ id: o.id, text: o.text, tone: o.tone })),
      rubric: { mustAddress: cand.stage === 'hearing' || cand.stage === 'chamber', forbidden: FORBIDDEN },
    },
  });
  if (r?.status === 200 && r.json) {
    const n = r.json;
    // first: a human situation (swearing, giving up, a lost paper, Russian, small talk) — answered like a person would
    const situation = readSituation(n.situation);
    if (situation) return { optionId: null, clarify: null, ethics: situation.ethics, situation };
    if (n.quality?.ethics === 'violation') {
      // the room's own trap reply (envelope, connections…) if it has one, else a penalty on the spot
      const trap = cand.options.find((o) => o.tone === 'bad' && /konvert|tanish|pora/i.test(o.text));
      return { optionId: trap?.id ?? null, clarify: null, ethics: !trap };
    }
    if (n.match) return { optionId: n.match.id, clarify: null, ethics: false };
    return { optionId: null, clarify: n.clarify ?? 'Fikringizni aniqroq, toʻliq gap bilan ayting.', ethics: false, ai: true };
  }
  // fallback: our cautious lexical matcher
  if (FORBIDDEN.some((w) => text.toLowerCase().includes(w))) {
    const trap = cand.options.find((o) => o.tone === 'bad' && /konvert|tanish|pora/i.test(o.text));
    return { optionId: trap?.id ?? null, clarify: null, ethics: !trap };
  }
  const m = matchUtterance(text, cand.options);
  return m ? { optionId: m.option.id, clarify: null, ethics: false } : { optionId: null, clarify: 'Tushunmadim - fikringizni aniqroq, toʻliq gap bilan ayting.', ethics: false, ai: true };
}
