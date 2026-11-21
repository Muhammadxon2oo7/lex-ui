'use client';
/**
 * "Tartibni tiklang" - the stages of a procedure, shuffled; the student
 * picks what comes next. A wrong pick costs a point and names the article
 * that governs the step that actually comes next. The order is the order
 * of the procedure map (which follows the articles of the code).
 */
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useDismiss } from '@/lib/useDismiss';

type Stage = { id: string; label: string; articles: string[] };
type Article = { number: string; title: string; source: string };

function shuffle<T>(items: T[], seed: number): T[] {
  let s = seed | 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return items.map((x) => ({ x, k: rand() })).sort((a, b) => a.k - b.k).map((v) => v.x);
}

export function OrderDrill({ title, stages, articles, onOpen, onClose }: { title: string; stages: Stage[]; articles: Record<string, Article>; onOpen: (key: string) => void; onClose: () => void }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const deck = useMemo(() => shuffle(stages, seed), [stages, seed]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [hint, setHint] = useState<{ wrong: string; article: string | null } | null>(null);

  const next = stages[placed.length];
  const done = placed.length === stages.length;
  const score = done ? Math.max(0, Math.round(100 - (misses / stages.length) * 100)) : null;

  const pick = (id: string) => {
    if (!next) return;
    if (id === next.id) {
      setPlaced((p) => [...p, id]);
      setHint(null);
    } else {
      setMisses((m) => m + 1);
      setHint({ wrong: id, article: next.articles[0] ?? null });
    }
  };

  const dismiss = useDismiss(onClose);

  const restart = () => {
    setSeed(Math.floor(Math.random() * 1e9));
    setPlaced([]);
    setMisses(0);
    setHint(null);
  };

  return (
    <div {...dismiss} className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="drill-title">
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }} className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#0e1829] ring-1 ring-white/10">
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-amber-200 uppercase">Mashq · tartibni tiklang</p>
            <h2 id="drill-title" className="truncate text-[1.1rem] font-semibold">{title}</h2>
          </div>
          <p className="text-[0.85rem] text-white/60 tabular-nums">{placed.length}/{stages.length} · xato: {misses}</p>
          <button type="button" className="btn btn-quiet !min-h-9 !rounded-xl !px-3 text-[0.84rem]" onClick={onClose}>Yopish</button>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-2">
          <div className="scroll-soft min-h-0 overflow-y-auto border-white/10 p-4 md:border-r">
            <p className="mb-2 text-[0.75rem] font-semibold tracking-wide text-white/50 uppercase">Jarayon</p>
            <ol className="space-y-1.5">
              {placed.map((id, i) => {
                const st = stages.find((s) => s.id === id)!;
                return (
                  <motion.li key={id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 rounded-xl bg-[#13351f]/60 p-2.5 ring-1 ring-[#1f8a5b]/40">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#1f8a5b] text-[0.72rem] font-bold">{i + 1}</span>
                    <span className="flex-1 text-[0.9rem] leading-snug">{st.label}</span>
                    {st.articles[0] && (
                      <button type="button" onClick={() => onOpen(st.articles[0])} className="shrink-0 text-[0.72rem] font-semibold text-[#5dd6a0] underline underline-offset-2">
                        {articles[st.articles[0]].number.replace('-modda', '')}-m.
                      </button>
                    )}
                  </motion.li>
                );
              })}
              {!done && <li className="rounded-xl border border-dashed border-white/15 p-2.5 text-[0.85rem] text-white/40">{placed.length + 1}-bosqich: qaysi biri?</li>}
            </ol>
          </div>

          <div className="scroll-soft min-h-0 overflow-y-auto p-4">
            {done ? (
              <div className="py-6 text-center">
                <p className="text-[0.75rem] font-semibold tracking-wide text-white/50 uppercase">Natija</p>
                <p className="mt-1 text-5xl font-semibold tabular-nums">{score}</p>
                <p className="mt-2 text-[0.9rem] text-white/65">{misses === 0 ? 'Barcha bosqichlar birinchi urinishda toʻgʻri.' : `${misses} ta notoʻgʻri tanlov.`}</p>
                <button type="button" className="btn btn-primary mt-5 !rounded-xl" onClick={restart}>Qayta urinish</button>
              </div>
            ) : (
              <>
                <p className="mb-2 text-[0.75rem] font-semibold tracking-wide text-white/50 uppercase">Keyingi bosqichni tanlang</p>
                {hint && (
                  <p role="alert" className="mb-2 rounded-xl bg-[#5b1f1a]/80 px-3 py-2 text-[0.84rem]">
                    Bu bosqich hali emas.{' '}
                    {hint.article && (
                      <>
                        Keyingisini aniqlash uchun{' '}
                        <button type="button" onClick={() => onOpen(hint.article!)} className="font-semibold underline underline-offset-2">
                          {articles[hint.article].number} «{articles[hint.article].title}»
                        </button>{' '}
                        ni oʻqing.
                      </>
                    )}
                  </p>
                )}
                <ul className="space-y-1.5">
                  {deck.filter((s) => !placed.includes(s.id)).map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => pick(s.id)} className={`min-h-11 w-full rounded-xl px-3 py-2 text-left text-[0.9rem] leading-snug ring-1 transition-colors ${hint?.wrong === s.id ? 'bg-[#5b1f1a]/50 ring-red-400/40' : 'bg-white/[0.05] ring-white/10 hover:bg-white/[0.1]'}`}>
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </motion.section>
    </div>
  );
}
