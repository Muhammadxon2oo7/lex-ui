/**
 * The moot court's decision.
 *
 * Two layers, and it says which one spoke:
 *   · 'model' - the court server's language model reads the whole record against the case file
 *     and weighs the SUBSTANCE (who proved what, who answered whom). Used when the server offers it.
 *   · 'rules' - the reference scorer below: what can be measured without understanding - did each
 *     side use its floor, address the court, rely on the case's facts and evidence, answer the other
 *     side's points, refer to the contract or the law. It is a fair first reading of form and
 *     coverage, not a judgment on the merits, and the ruling says so.
 *
 * Either way the court names a winner of the DEBATE; it never pretends to decide a real claim.
 */
import { MootExplainSchema, MootVerdictSchema, type MootEntry, type MootSide, type MootStep, type MootVerdict } from '@/contracts/moot';
import { keyed, remoteKeyed, studentHash } from '@/server/remote/key';
import type { MootCase } from './cases';

const norm = (t: string) => t.toLowerCase().replace(/[ʻʼ'`’‘]/g, 'ʻ').replace(/\s+/g, ' ');
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
/** Swearing ends the manners score (a short list of stems; the court server's own filter is the real one). */
const FOUL = ['sik', 'jalab', 'qoʻtoq', 'qotoq', 'naxuy', 'нахуй', 'сука', 'blya', 'бля', 'haromi', 'ahmoq'];
const LEGAL = [/\bmodda/, /kodeks/, /\bband/, /shartnomaning/, /qonun/];
/**
 * Criterion weights - the court server's rubric «moot-2026.11.1» (GET /rubrics/moot): each tied to a moot or
 * qualifying-exam standard (Jessup, Vis, Berkeley, SQE2). Kept equal so both readings add up the same way.
 */
export const W = { legal: 30, rebuttal: 25, facts: 20, participation: 15, manners: 10 } as const;

export interface JudgePlayer {
  id: string;
  name: string;
  side: MootSide;
}

function coverage(text: string, groups: string[][]): number {
  const t = norm(text);
  return groups.filter((g) => g.some((w) => t.includes(norm(w)))).length;
}

export function ruleVerdict(c: MootCase, agenda: MootStep[], transcript: MootEntry[], players: JudgePlayer[], forfeit: MootSide | null = null): MootVerdict {
  const sides: MootSide[] = ['claimant', 'respondent'];
  const said = (side: MootSide) => transcript.filter((e) => e.side === side);
  const score = Object.fromEntries(
    sides.map((side) => {
      const other: MootSide = side === 'claimant' ? 'respondent' : 'claimant';
      const mine = said(side);
      const all = mine.map((e) => e.text).join(' ');
      const steps = agenda.filter((s) => s.kind === 'speech' && s.side === side);
      const used = steps.filter((s) => words(mine.filter((e) => e.step === s.id).map((e) => e.text).join(' ')) >= 6).length;
      const openings = steps.map((s) => mine.find((e) => e.step === s.id)).filter(Boolean) as MootEntry[];
      const polite = openings.filter((e) => norm(e.text).includes('hurmatli sud')).length;
      const foul = FOUL.some((w) => norm(all).includes(w));
      // answering the other side: after they first spoke, do you take up THEIR points?
      const theirFirst = said(other)[0]?.seq ?? Infinity;
      const later = mine.filter((e) => e.seq > theirFirst).map((e) => e.text).join(' ');
      const legal = LEGAL.filter((r) => r.test(norm(all))).length;
      return [side, {
        participation: steps.length ? Math.round((used / steps.length) * W.participation) : 0,
        manners: foul ? 0 : openings.length ? Math.round((polite / openings.length) * W.manners) : 0,
        facts: c.points[side].length ? Math.round((coverage(all, c.points[side]) / c.points[side].length) * W.facts) : 0,
        rebuttal: Math.round((Math.min(3, coverage(later, c.points[other])) / 3) * W.rebuttal),
        legal: Math.round((Math.min(3, legal) / 3) * W.legal),
        foul,
      }];
    }),
  ) as Record<MootSide, { participation: number; manners: number; facts: number; rebuttal: number; legal: number; foul: boolean }>;

  const rows: [keyof Omit<(typeof score)['claimant'], 'foul'>, string, number, string][] = [
    ['legal', 'Huquqiy asos', W.legal, 'Shartnoma bandi, modda yoki qonunga havola.'],
    ['rebuttal', 'Raqibga javob', W.rebuttal, 'Qarshi tomon dalillariga munosabat bildirildimi.'],
    ['facts', 'Faktlar va dalillar', W.facts, 'Ish materiallaridagi holat va dalillarga tayanish.'],
    ['participation', 'Soʻzdan foydalanish', W.participation, 'Har bir berilgan soʻzda mazmunli chiqish qilindimi.'],
    ['manners', 'Sud odobi', W.manners, '«Hurmatli sud» deb murojaat; haqorat boʻlsa - 0.'],
  ];
  const criteria = rows.map(([id, label, max, note]) => ({ id, label, max, claimant: score.claimant[id], respondent: score.respondent[id], note }));
  const totals = { claimant: criteria.reduce((n, r) => n + r.claimant, 0), respondent: criteria.reduce((n, r) => n + r.respondent, 0) };
  if (forfeit) totals[forfeit] = 0;
  // the ethics ceiling (court server v1.5): a side that swore scores at most 40 and cannot win
  for (const s of sides) if (score[s].foul) totals[s] = Math.min(totals[s], 40);
  const fouled = sides.filter((s) => score[s].foul);
  const winner: MootSide | null = forfeit ? (forfeit === 'claimant' ? 'respondent' : 'claimant')
    : fouled.length === 1 ? (fouled[0] === 'claimant' ? 'respondent' : 'claimant')
    : fouled.length === 2 || Math.abs(totals.claimant - totals.respondent) <= 2 ? null
    : totals.claimant > totals.respondent ? 'claimant' : 'respondent';
  const NAME = { claimant: 'daʼvogar tomoni', respondent: 'javobgar tomoni' } as const;
  const edge = winner && !forfeit ? [...criteria].sort((a, b) => b[winner] - b[winner === 'claimant' ? 'respondent' : 'claimant'] - (a[winner] - a[winner === 'claimant' ? 'respondent' : 'claimant']))[0] : null;
  const ruling = forfeit
    ? [`${NAME[forfeit][0].toUpperCase()}${NAME[forfeit].slice(1)} majlisni tark etdi.`, `Bahsda ${NAME[winner!]} texnik gʻalaba qozondi.`]
    : [
        'Sud taraflarning chiqishlarini eshitdi va baholadi.',
        `Daʼvogar tomoni - ${totals.claimant} ball, javobgar tomoni - ${totals.respondent} ball.`,
        winner ? `Bahsda ${NAME[winner]} ustun keldi${edge ? `: ayniqsa «${edge.label.toLowerCase()}» boʻyicha` : ''}.` : 'Taraflar teng chiqdi: bahs durang bilan yakunlandi.',
        ...(score.claimant.foul || score.respondent.foul ? ['Sud zalida haqoratga yoʻl qoʻyilmaydi: odob mezoni boʻyicha ball berilmadi.'] : []),
      ];
  return {
    winner,
    totals,
    criteria,
    ruling,
    players: players.map((p) => {
      const mine = transcript.filter((e) => e.by === p.id);
      const w = words(mine.map((e) => e.text).join(' '));
      const steps = new Set(mine.map((e) => e.step)).size;
      const polite = mine.some((e) => norm(e.text).includes('hurmatli sud'));
      return { id: p.id, name: p.name, side: p.side, words: w, speeches: steps, note: !mine.length ? 'Soʻzga chiqmadi.' : `${steps} marta soʻzga chiqdi, ${w} soʻz.${polite ? '' : ' Sudga «Hurmatli sud» deb murojaat qilishni unutmang.'}` };
    }),
    engine: 'rules',
    forfeit: Boolean(forfeit),
    pending: false,
    verdictId: null,
    explain: null,
  };
}

export type JudgeAnswer = { kind: 'ok'; verdict: MootVerdict } | { kind: 'pending'; retryAfter: number } | { kind: 'none' };

/**
 * One call to the court server's model (POST /moot/judge → a verdict in our shape).
 * The server waits ~22 s; a slower model answers 503 judge_pending and keeps writing in the background:
 * the SAME request asked again later returns the finished verdict from its cache. Anything else - no key,
 * an error, a malformed verdict - is 'none', and the rules decide (the hearing always ends with a decision).
 * `owner`: whose identity goes with the call (X-LexSim-Owner is required by the server).
 */
export async function askJudge(c: MootCase, agenda: MootStep[], transcript: MootEntry[], players: JudgePlayer[], owner: string, participants: { owner: string; side: MootSide }[] = []): Promise<JudgeAnswer> {
  if (!remoteKeyed()) return { kind: 'none' };
  const base = ruleVerdict(c, agenda, transcript, players, null);
  const r = await keyed<{ verdict?: unknown; verdictId?: unknown; explain?: unknown; error?: { code?: string } }>(owner, '/moot/judge', {
    timeout: 26_000,
    body: {
      // case.id: the case-lab id when the case lives there (so a solution can be bound to this verdict)
      case: { id: c.labId ?? c.id, title: c.title, claim: c.claim, facts: c.facts, evidence: c.evidence, side: c.side },
      // who may bind this verdict to their solution, and on which side (hashed owners, never the cookie)
      participants: participants.map((p) => ({ owner: studentHash(p.owner), side: p.side })),
      agenda: agenda.map(({ id, title, side, role }) => ({ id, title, side, role })),
      transcript: transcript.filter((e) => e.side).map(({ seq, by, name, side, text, step }) => ({ seq, by, name, side, text, step })),
      players,
      rules: { totals: base.totals, criteria: base.criteria },
    },
  });
  if (!r) return { kind: 'none' };
  if (r.status === 503 && r.json?.error?.code === 'judge_pending') return { kind: 'pending', retryAfter: 15 };
  const explain = MootExplainSchema.safeParse(r.json?.explain);
  const parsed = MootVerdictSchema.safeParse(r.status === 200 ? {
    ...(r.json?.verdict as object), engine: 'model', forfeit: false, pending: false,
    verdictId: typeof r.json?.verdictId === 'string' ? r.json.verdictId : null,
    explain: explain.success ? explain.data : null,
  } : null);
  return parsed.success ? { kind: 'ok', verdict: parsed.data } : { kind: 'none' };
}
