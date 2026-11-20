import type { Gesture } from '@/contracts';
import type { CaseLine } from '@/contracts/case';

/**
 * What the body does while a line is spoken. Deliberately small and
 * conservative: agreement nods, handing papers over, a tired sigh, a
 * refusal shake — a gesture only where a person would really make one.
 */
const RULES: [RegExp, Gesture][] = [
  // asking for the papers: the hand comes forward to take them
  [/\bbering\b/i, 'offer-envelope'],
  [/\b(mana|olib keldim|hujjatlarim)\b|^Mehnat shartnomam/i, 'offer-envelope'],
  [/^(yoʻq|olib qoʻying|mumkin emas)\b/i, 'shake-head'],
  [/^(ha|roziman|mayli|rahmat|tushunarli|qayd etildi|yaxshi|qabul qildim|iltimos qanoatlantiriladi)\b/i, 'nod'],
  [/(uxlay olmadim|bilmayapman|kechirasiz)/i, 'sigh'],
];

export function gestureFor(line: CaseLine | undefined): { id: string; clip: Gesture } | null {
  if (!line || line.speaker === 'you' || line.speaker === 'system') return null;
  for (const [re, clip] of RULES) if (re.test(line.text)) return { id: line.id, clip };
  return null;
}
