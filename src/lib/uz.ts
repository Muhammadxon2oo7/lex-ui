/** Uzbek text helpers shared by client and server (no runtime dependencies). */

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', ъ: "'", ь: '', э: 'e', ю: 'yu',
  я: 'ya', ў: "o'", қ: 'q', ғ: "g'", ҳ: 'h', ы: 'i', щ: 'sh',
};

/** Lower-case, unify apostrophes, transliterate Cyrillic, drop punctuation. */
export function normalizeUz(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ʻʼ‘’`´ʹ]/g, "'")
    .replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? c)
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set(['va', 'bu', 'u', 'men', 'siz', 'sizning', 'bilan', 'uchun', 'ham', 'esa', 'deb', 'bir', 'bor', 'yo\'q', 'endi', 'shu', 'o\'sha', 'mi', 'chi', 'da', 'ga', 'ni', 'ning', 'aka', 'opa', 'hurmatli']);

/** Content-word stems: crude, but robust to Uzbek suffixes ("yillarda" ≈ "yillar"). */
export function stems(text: string): Set<string> {
  return new Set(
    normalizeUz(text)
      .split(' ')
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/'/g, '').slice(0, 5)),
  );
}

/**
 * Which offered reply did the speaker mean? Cosine overlap of content stems;
 * a match needs a clear score AND a clear lead over the runner-up, otherwise
 * we would rather treat the utterance as free speech than guess.
 */
export function matchUtterance<T extends { id: string; text: string }>(utterance: string, options: T[]): { option: T; score: number } | null {
  const said = stems(utterance);
  if (said.size === 0) return null;
  const scored = options
    .map((option) => {
      const target = stems(option.text);
      let shared = 0;
      for (const s of said) if (target.has(s)) shared += 1;
      return { option, score: target.size ? shared / Math.sqrt(said.size * target.size) : 0 };
    })
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < 0.34) return null;
  if (second && best.score - second.score < 0.08) return null;
  return best;
}
