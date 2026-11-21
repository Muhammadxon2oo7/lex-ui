/**
 * xAPI statements (actor / verb / object / result) for one room of a case —
 * shared by the "Hisobot (JSON)" download and the server, which sends them to
 * the learning-record store of the court backend (teacher dashboards).
 * The actor is never a name: an anonymous account (`anonymous` in the
 * download, a salted hash of the owner on the server).
 */
import type { Decision } from '@/contracts/case';

const HOME = 'https://lexsim.uz';
const EXT = (k: string) => `${HOME}/xapi/${k}`;

export interface RoomRecord {
  actor: string;
  kind: string;
  stage: string;
  stageTitle: string;
  score: number;
  hints: number;
  log: Decision[];
  /** Seconds the room took. */
  seconds?: number;
  cohort?: string;
  /** Learning outcomes judged in the room. */
  outcomes?: { text: string; met: boolean | null }[];
  /** The structured reflection (What? So what? Now what?). */
  reflection?: { label: string; text: string }[];
}

export function statementsFor(r: RoomRecord) {
  const actor = { objectType: 'Agent', account: { homePage: HOME, name: r.actor } };
  const object = (id: string, name: string) => ({ objectType: 'Activity', id: `${HOME}/case/${r.kind}/${r.stage}/${id}`, definition: { name: { uz: name } } });
  const context = r.cohort ? { extensions: { [EXT('cohort')]: r.cohort } } : undefined;
  return [
    ...r.log.map((d, i) => ({
      actor,
      verb: d.tone === 'info' && /maslahat/i.test(d.why ?? '') ? { id: EXT('hinted'), display: { uz: 'maslahat oldi' } } : { id: 'http://adlnet.gov/expapi/verbs/answered', display: { uz: 'javob berdi' } },
      object: object(`decision-${i + 1}`, d.prompt ?? `Qaror ${i + 1}`),
      result: {
        response: d.chose,
        success: d.tone !== 'bad',
        score: { raw: -d.points },
        extensions: { [EXT('tone')]: d.tone, [EXT('article')]: d.article, [EXT('better')]: d.better, [EXT('seconds')]: d.at },
      },
      ...(context ? { context } : {}),
    })),
    {
      actor,
      verb: { id: 'http://adlnet.gov/expapi/verbs/completed', display: { uz: 'yakunladi' } },
      object: object('stage', r.stageTitle),
      result: {
        completion: true,
        success: r.score >= 60,
        score: { raw: r.score, min: 0, max: 100, scaled: r.score / 100 },
        ...(r.seconds !== undefined ? { duration: `PT${Math.round(r.seconds)}S` } : {}),
        extensions: { [EXT('hints')]: r.hints },
      },
      ...(context ? { context } : {}),
    },
    // each learning outcome as its own result, so a teacher sees which outcomes a group misses
    ...(r.outcomes ?? []).filter((o) => o.met !== null).map((o, i) => ({
      actor,
      verb: o.met ? { id: 'http://adlnet.gov/expapi/verbs/mastered', display: { uz: 'erishdi' } } : { id: 'http://adlnet.gov/expapi/verbs/failed', display: { uz: 'erisha olmadi' } },
      object: object(`outcome-${i + 1}`, o.text),
      result: { success: Boolean(o.met) },
      ...(context ? { context } : {}),
    })),
    ...(r.reflection?.some((x) => x.text.trim())
      ? [{
          actor,
          verb: { id: EXT('reflected'), display: { uz: 'mulohaza yozdi' } },
          object: object('reflection', `${r.stageTitle}: mulohaza`),
          result: { response: r.reflection.filter((x) => x.text.trim()).map((x) => `${x.label} ${x.text.trim()}`).join('\n') },
          ...(context ? { context } : {}),
        }]
      : []),
  ];
}
