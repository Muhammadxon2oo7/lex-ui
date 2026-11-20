/**
 * AI-ekspert (reference implementation): deterministic rubric evaluator.
 *
 * It never takes part in the dialogue. It reads the authoritative session
 * record (transcript evidence, unlocked facts, bribe outcome, submitted
 * document) and produces the 6-criterion / 100-point assessment.
 *
 * "Manba boʻlmasa, modda yoʻq": no article numbers are produced here. Each
 * legal remark carries the title of the relevant act and is flagged
 * `needs-mentor` until a mentor verifies it against the current Lex.uz
 * edition (`verifiedAt`).
 */
import type { Assessment, CriterionId, Outcome, Source } from '@/contracts';
import type { IntentTag } from './intent';
import type { Session } from './session';

export const RUBRIC_VERSION = 'lexsim-rubric-1.0';

type Feedback = Assessment['feedback'][number];

const OUTCOMES: Record<Outcome['id'], Outcome> = {
  excellent: {
    id: 'excellent',
    title: 'Ish toʻgʻri yoʻlga qoʻyildi',
    description:
      'Rustam aka nima qilishni, qancha kutishni va natijani qanday kuzatishni bilgan holda xotirjam chiqib ketdi.',
  },
  average: {
    id: 'average',
    title: 'Toʻgʻri yoʻnaltirildi, lekin tushuntirilmadi',
    description:
      'Xizmat toʻgʻri tanlandi, ammo hujjatlar, muddat yoki keyingi qadam aniq aytilmadi. Fuqaro yana qaytib kelishi ehtimoli yuqori.',
  },
  poor: {
    id: 'poor',
    title: 'Fuqaro norozi ketdi',
    description: 'Muammo hal boʻlmadi. Rustam aka rahbariyatga shikoyat yozmoqchi.',
  },
  failed: {
    id: 'failed',
    title: 'Pora qabul qilindi',
    description:
      'Noqonuniy taklif qabul qilindi. Simulyatsiya avtomatik muvaffaqiyatsiz yakunlandi va natija 0 ballga tushirildi.',
  },
};

const quoteOf = (s: Session, turnId: string | undefined) => s.turns.find((t) => t.id === turnId)?.text;

export function evaluate(s: Session): Assessment {
  const sc = s.scenario;
  const ev = (tag: IntentTag) => s.evidence[tag] ?? [];
  const has = (tag: IntentTag) => ev(tag).length > 0;
  const doc = s.document;
  const submitted = s.documentSubmitted;

  const rootFound = s.unlocked.has('work-period-1991-1998');
  const correctService = submitted && doc.service === sc.correctService;
  const explainedSteps = has('explain-documents') && has('explain-deadline');

  /* ── criteria ── */
  const legal =
    (rootFound ? 10 : 0) +
    (correctService ? 12 : 0) +
    (has('overpromise') ? 0 : 4) +
    (has('dismiss') ? 0 : 4);

  const facts = Math.round((s.unlocked.size / sc.facts.length) * 15);

  const procedure =
    (has('explain-documents') ? 4 : 0) +
    (has('explain-deadline') ? 4 : 0) +
    (has('explain-tracking') ? 3 : 0) +
    (submitted ? 4 : 0);

  const communication = Math.max(
    0,
    (has('greeting') ? 3 : 0) +
      (has('empathy') ? 4 : 0) +
      (has('paraphrase') ? 3 : 0) +
      (has('jargon') ? 0 : 2) +
      (has('rude') ? 0 : 3) -
      Math.max(0, ev('rude').length - 1) * 2,
  );

  const ethicsByStage: Record<Session['bribe']['stage'], number> = {
    refused: 15,
    ambiguous: 5,
    pushed: 3,
    offered: 3,
    accepted: 0,
    none: 12,
  };
  const ethics = ethicsByStage[s.bribe.stage];

  const evidenceHits = sc.expectedEvidence.filter((e) => doc.evidence.includes(e)).length;
  const periodOk = doc.periodFrom.includes('1991') && doc.periodTo.includes('1998');
  const document = submitted
    ? (doc.service === sc.correctService ? 3 : 0) +
      (periodOk ? 2 : 0) +
      (doc.employer.trim().length >= 5 ? 2 : 0) +
      Math.min(2, evidenceHits) +
      (doc.nextStep.trim().length >= 20 ? 1 : 0)
    : 0;

  const zeroed = s.bribe.stage === 'accepted';
  const raw = legal + facts + procedure + communication + ethics + document;

  /* ── outcome ── */
  let outcome: Outcome;
  if (zeroed) outcome = OUTCOMES.failed;
  else if (s.endedBy === 'npc-left' || !correctService) outcome = OUTCOMES.poor;
  else if (rootFound && explainedSteps) outcome = OUTCOMES.excellent;
  else outcome = OUTCOMES.average;

  const criteria: Assessment['criteria'] = (
    [
      [
        'legal',
        'Huquqiy toʻgʻrilik',
        legal,
        30,
        correctService
          ? 'Masala staj tasdiqlanmagani bilan bogʻliq ekani aniqlanib, toʻgʻri xizmat rasmiylashtirildi.'
          : 'Murojaat toʻgʻri xizmatga bogʻlanmadi: asosiy masala — 1991–1998-yillardagi stajni arxiv orqali tasdiqlash.',
        [...ev('explain-service'), ...ev('overpromise'), ...ev('dismiss')],
      ],
      [
        'facts',
        'Faktlarni aniqlash',
        facts,
        15,
        `Yashirin faktlardan ${s.unlocked.size} tasi / ${sc.facts.length} tasi aniqlandi.`,
        [...ev('ask-work-period'), ...ev('ask-documents'), ...ev('ask-employer-status'), ...ev('ask-previous-visits')],
      ],
      [
        'procedure',
        'Tartib-taomil',
        procedure,
        15,
        'Kerakli hujjatlar, muddat, natijani kuzatish va arizani rasmiylashtirish boʻyicha baholandi.',
        [...ev('explain-documents'), ...ev('explain-deadline'), ...ev('explain-tracking')],
      ],
      [
        'communication',
        'Muomala va empatiya',
        communication,
        15,
        'Salomlashish, tinglash, muammoni takrorlab tasdiqlash va tushunarli til baholandi.',
        [...ev('greeting'), ...ev('empathy'), ...ev('paraphrase'), ...ev('rude'), ...ev('jargon')],
      ],
      [
        'ethics',
        'Etika va korrupsiyaga qarshi',
        ethics,
        15,
        {
          refused: 'Noqonuniy taklif xushmuomalalik bilan, lekin qatʼiy rad etildi.',
          ambiguous: 'Taklif aniq rad etilmadi — noaniq javob bilan oʻtkazib yuborildi.',
          pushed: 'Taklifga javob berilmay qabul yakunlandi.',
          offered: 'Taklifga javob berilmay qabul yakunlandi.',
          accepted: 'Taklif qabul qilindi. Bu avtomatik muvaffaqiyatsizlik.',
          none: 'Bu sessiyada etik sinov tushmadi; umumiy halollik boʻyicha baholandi.',
        }[s.bribe.stage],
        [s.bribe.offerTurnId, s.bribe.responseTurnId].filter((x): x is string => Boolean(x)),
      ],
      [
        'document',
        'Hujjat sifati',
        document,
        10,
        submitted
          ? 'Arizadagi xizmat turi, davr, ish joyi, ilovalar va keyingi qadam tekshirildi.'
          : 'Terminalda hujjat rasmiylashtirilmadi.',
        [],
      ],
    ] as [CriterionId, string, number, number, string, string[]][]
  ).map(([id, label, score, max, explanation, supportingTurnIds]) => ({
    id,
    label,
    score: Math.min(score, max),
    max,
    explanation,
    supportingTurnIds: [...new Set(supportingTurnIds)],
  }));

  /* ── feedback ── */
  const src = sc.sources;
  const strengths: Feedback[] = [];
  const errors: Feedback[] = [];
  const strength = (title: string, message: string, turnId?: string) =>
    strengths.push({ kind: 'strength', title, message, quote: quoteOf(s, turnId), relatedTurnIds: turnId ? [turnId] : [], sources: [] });
  const error = (title: string, message: string, sources: Source[], turnId?: string) =>
    errors.push({ kind: 'error', title, message, quote: quoteOf(s, turnId), relatedTurnIds: turnId ? [turnId] : [], sources });

  if (s.bribe.stage === 'refused')
    strength('Porani qatʼiy rad etdingiz', 'Xizmat belgilangan tartibda, qoʻshimcha haqsiz koʻrsatilishini tushuntirdingiz.', s.bribe.responseTurnId);
  if (rootFound)
    strength('Haqiqiy sababni topdingiz', 'Shikoyat ortida hisobga olinmagan ish staji turganini aniqlashtiruvchi savol bilan ochdingiz.', ev('ask-work-period')[0]);
  if (has('empathy') || has('paraphrase'))
    strength('Fuqaroni tingladingiz', 'Xotirjam ohang va muammoni takrorlab tasdiqlash ishonchni oshirdi.', (ev('empathy')[0] ?? ev('paraphrase')[0]));
  if (explainedSteps)
    strength('Keyingi qadam aniq aytildi', 'Hujjatlar va muddatni tushuntirdingiz — fuqaro qayta qatnamaydi.', ev('explain-deadline')[0]);
  if (s.inspectedPhone)
    strength('Dalilni koʻzdan kechirdingiz', 'Telefondagi daftarcha suratini ochib koʻrdingiz — soʻrovga ilova qilinadigan hujjat tekshirildi.');
  if (s.unlocked.size === sc.facts.length)
    strength('Barcha faktlar aniqlandi', 'Toʻrtala yashirin fakt ham savollar orqali ochildi.');

  if (zeroed)
    error('Pora qabul qilindi', 'Fuqaroning “choy puli” taklifi qabul qilindi. Bunday holatda natija qolgan ballardan qatʼi nazar 0 ga tushadi.', [src.anticorruption], s.bribe.responseTurnId);
  else if (s.bribe.stage === 'ambiguous' || s.bribe.stage === 'pushed' || s.bribe.stage === 'offered')
    error('Taklif aniq rad etilmadi', 'Noqonuniy taklifni noaniq javob bilan oʻtkazib yuborish — rad etish emas. Aniq “yoʻq” va tartibni tushuntirish kerak edi.', [src.anticorruption], s.bribe.responseTurnId ?? s.bribe.offerTurnId);
  if (has('dismiss'))
    error('Fuqaro asossiz qaytarildi', 'Masalani aniqlamasdan “bizda emas” deyish — fuqaroni asossiz qaytarish. Avval sababni aniqlash, soʻng aniq idora va xizmatni koʻrsatish kerak.', [src.appeals, src.procedure], ev('dismiss')[0]);
  if (!rootFound)
    error('Haqiqiy muammo aniqlanmadi', 'Birinchi gapga qarab xulosa chiqarildi. Qaysi yillarda va qayerda ishlagani soʻralmadi, shuning uchun staj masalasi ochilmadi.', [src.pension]);
  if (submitted && doc.service !== sc.correctService)
    error('Notoʻgʻri xizmat tanlandi', 'Bu nafaqani qayta hisoblash yoki shikoyat masalasi emas: avval staj arxiv maʼlumotnomasi bilan tasdiqlanishi kerak.', [src.pension, src.procedure]);
  if (!submitted && !zeroed)
    error('Hujjat rasmiylashtirilmadi', 'Qabul ogʻzaki maslahat bilan tugadi. Amaliy natija — terminalda rasmiylashtirilgan soʻrov.', [src.procedure]);
  if (has('overpromise'))
    error('Vakolatdan tashqari vaʼda', 'Natijani kafolatlash xodim vakolatiga kirmaydi: staj tasdiqlangach qarorni vakolatli organ qabul qiladi.', [src.procedure], ev('overpromise')[0]);
  if (!explainedSteps && !zeroed)
    error('Muddat va hujjatlar tushuntirilmadi', 'Fuqaro nima olib kelishi va qancha kutishini bilmay ketdi.', [src.procedure]);
  if (has('jargon'))
    error('Tushunarsiz til', 'Yuridik atamalar fuqaroni chalkashtirdi. Sodda soʻzlar bilan tushuntirish kerak.', [], ev('jargon')[0]);
  if (has('rude'))
    error('Qoʻpol muomala', 'Fuqaroga qoʻpol javob berildi; sabr va ishonch keskin pasaydi.', [src.appeals], ev('rude')[0]);

  const mentor: Feedback = {
    kind: 'mentor-review',
    title: 'Mentor tekshirsin',
    message:
      'Huquqiy havolalar faqat hujjat nomi darajasida berildi. Aniq modda raqamlari, xizmat nomi va muddatlar lex.uz saytidagi amaldagi tahrir boʻyicha mentor tomonidan tasdiqlanmaguncha koʻrsatilmaydi.',
    relatedTurnIds: [],
    sources: Object.values(src),
  };

  /* ── "qanday aytish kerak edi" for the weakest answer ── */
  const weakId = ev('dismiss')[0] ?? ev('rude')[0] ?? ev('jargon')[0] ?? ev('overpromise')[0] ?? (zeroed ? s.bribe.responseTurnId : undefined);
  const weakText = quoteOf(s, weakId);
  const betterAnswer = weakText
    ? {
        original: weakText,
        improved: zeroed
          ? 'Rustam aka, rahmat, lekin buni qabul qila olmayman — xizmat bepul va belgilangan tartibda koʻrsatiladi. Pulingizni oling, ishingizni shundoq ham hozir rasmiylashtiramiz.'
          : 'Rustam aka, xavotir olmang, birga koʻrib chiqamiz. Avval ayting-chi: qaysi yillarda va qayerda ishlagansiz, qoʻlingizda qanday hujjatlar bor?',
        why: zeroed
          ? 'Rad etish aniq, hurmat bilan va tartibni tushuntirgan holda boʻlishi kerak.'
          : 'Avval tinglash va aniqlashtirish, keyin yoʻnaltirish: fuqaro oʻzini eshitilgan his qiladi va yashirin fakt ochiladi.',
      }
    : null;

  const idealDone: Record<string, boolean> = {
    listen: has('greeting') && (has('empathy') || has('paraphrase')),
    clarify: s.unlocked.size >= 2,
    diagnose: rootFound,
    route: correctService,
    explain: explainedSteps,
    ethics: s.bribe.stage === 'refused',
    tracking: has('explain-tracking'),
  };

  return {
    sessionId: s.id,
    scenarioId: sc.public.id,
    rubricVersion: RUBRIC_VERSION,
    scoreTotal: zeroed ? 0 : Math.min(100, raw),
    zeroedByEthics: zeroed,
    outcome,
    criteria,
    feedback: [...strengths.slice(0, 3), ...errors.slice(0, 3), mentor],
    betterAnswer,
    idealPath: sc.idealPath.map((p) => ({ step: p.step, done: idealDone[p.id] ?? false })),
    nextScenario: {
      ...sc.nextScenario,
      reason: rootFound
        ? 'Keyingi bosqich: arxivdan kelgan rus tilidagi hujjat bilan ishlash.'
        : 'Faktlarni aniqlash koʻnikmasini yana bir bor mashq qilish tavsiya etiladi.',
    },
    reviewStatus: 'needs-mentor',
    appeal: null,
    turns: s.turns,
    facts: sc.facts
      .filter((f) => s.unlocked.has(f.id))
      .map((f) => ({ id: f.id, text: f.summary, unlockedAtTurn: s.unlocked.get(f.id)! })),
    factsTotal: sc.facts.length,
    evaluatedAt: new Date().toISOString(),
  };
}
