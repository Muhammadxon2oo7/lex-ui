'use client';
/**
 * «Nimaga asoslanib N ball?» - the court server's explainable verdict (v1.5): per criterion, the rubric
 * items with ✓ / ✗ / «qoʻllanmaydi», their weight, the student's own words as evidence and the reason,
 * plus the standard each criterion rests on (Jessup, Vis, Berkeley, SQE2, IPK). AI scores are for
 * practice until mentors' agreement with them is measured - the panel says so.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { MootEntry, MootExplain, MootRubric, MootSide } from '@/contracts/moot';
import { library } from '@/game/library';
import { ease } from '@/lib/motion';
import { Segmented } from '@/components/ui/glass';

const SIDE: Record<MootSide, string> = { claimant: 'Daʼvogar', respondent: 'Javobgar' };
const MET = { yes: ['✓', 'bg-accent-soft text-accent-ink', 'bajarildi'], no: ['✗', 'bg-danger-soft text-danger', 'bajarilmadi'], na: ['–', 'bg-black/[0.05] text-ink-3', 'qoʻllanmaydi'] } as const;

export function Explain({ explain, mine, transcript }: { explain: MootExplain; mine: MootSide | null; transcript: MootEntry[] }) {
  const sides = (['claimant', 'respondent'] as const).filter((s) => explain.sides[s]);
  const [side, setSide] = useState<MootSide>(mine && explain.sides[mine] ? mine : sides[0] ?? 'claimant');
  const [open, setOpen] = useState<string | null>(null);
  const [rubric, setRubric] = useState<MootRubric | null>(null);
  useEffect(() => {
    let alive = true;
    library.mootRubric().then((r) => alive && setRubric(r), () => {});
    return () => {
      alive = false;
    };
  }, []);
  const data = explain.sides[side];
  if (!data) return null;
  const seqName = (id: string) => transcript.find((e) => String(e.seq) === id)?.name;
  const missed = data.items.filter((i) => i.met === 'no' && i.weight > 0).sort((a, b) => b.weight - a.weight)[0];

  return (
    <section className="surface mt-4 rounded-[28px] p-5" aria-labelledby="why-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.76rem] font-semibold tracking-wider text-accent-ink uppercase">Nimaga asoslanib</p>
          <h2 id="why-title" className="display mt-1 text-lg font-semibold">Har bir ball qayerdan keldi</h2>
        </div>
        {sides.length > 1 && <div className="w-56"><Segmented label="Tomon" size="sm" value={side} onChange={(v) => { setSide(v); setOpen(null); }} options={sides.map((s) => [s, `${SIDE[s]}${s === mine ? ' · siz' : ''}`])} /></div>}
      </div>

      {explain.needsMentor && (
        <p className="mt-3 rounded-2xl bg-[#fff7e6] px-3.5 py-2.5 text-[0.86rem] text-[#8a5a00] ring-1 ring-[#f0d9a8]">Bu baho mentor tomonidan tekshiriladi{explain.routing.length ? `: ${explain.routing.map((r) => r.reason).filter(Boolean).join('; ')}` : '.'}</p>
      )}
      {data.band.length === 2 && data.band[0] !== data.band[1] && (
        <p className="mt-2 text-[0.84rem] text-ink-2">Ishonch oraligʻi: {data.band[0]}-{data.band[1]} ball (sudya yurishlari toʻliq kelishmadi).</p>
      )}

      <ul className="mt-4 space-y-2">
        {data.criteria.map((c) => {
          const items = data.items.filter((i) => i.dim === c.id);
          const dim = rubric?.dims.find((d) => d.id === c.id);
          const on = open === c.id;
          return (
            <li key={c.id} className="overflow-hidden rounded-2xl bg-black/[0.03]">
              <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : c.id)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-black/[0.02]">
                <span className="min-w-0 flex-1 font-semibold">{c.label || c.id}</span>
                <span className="tabular-nums">{c.score}<span className="text-ink-3"> / {c.max}</span></span>
                <span aria-hidden className={`text-ink-3 transition-transform duration-200 motion-reduce:transition-none ${on ? 'rotate-90' : ''}`}>›</span>
              </button>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div key="b" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={ease.surface}>
                    <div className="px-4 pb-4">
                      {(dim?.why || c.basis.length > 0) && (
                        <p className="text-[0.8rem] text-ink-3">
                          {dim?.why}{dim?.why && c.basis.length ? ' · ' : ''}
                          {c.basis.map((b, i) => {
                            const src = rubric?.sources[b];
                            return <span key={b}>{i ? ', ' : ''}{src?.url ? <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{src.title || b}</a> : src?.title || b}</span>;
                          })}
                        </p>
                      )}
                      <ul className="mt-2.5 space-y-2.5">
                        {items.map((i) => {
                          const [mark, tone, word] = MET[i.met];
                          return (
                            <li key={i.id} className="flex gap-3">
                              <span aria-label={word} className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[0.78rem] font-bold ${tone}`}>{mark}</span>
                              <div className="min-w-0 text-[0.9rem] leading-relaxed">
                                <p><span className="font-medium">{i.ask}</span> <span className="text-[0.76rem] text-ink-3">{i.weight > 0 ? `+${i.weight}` : i.weight} · {i.method === 'rule' ? 'qoida' : 'AI'}</span></p>
                                {i.evidence.filter((e) => e.quote).map((e, k) => (
                                  <blockquote key={k} className="mt-1 border-l-2 border-accent/40 pl-2.5 text-ink-2 italic">«{e.quote}»{e.turnId && <span className="not-italic text-[0.74rem] text-ink-3"> · {seqName(e.turnId) ?? 'bayonnoma'}, {e.turnId}-gap</span>}</blockquote>
                                ))}
                                {i.why && <p className="mt-0.5 text-[0.84rem] text-ink-2">{i.why}</p>}
                              </div>
                            </li>
                          );
                        })}
                        {items.length === 0 && <li className="text-[0.86rem] text-ink-3">Bu mezon boʻyicha bandlar kelmadi.</li>}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      {missed && <p className="mt-4 rounded-2xl bg-accent-soft px-4 py-3 text-[0.9rem] text-accent-ink"><span className="font-semibold">Keyingi safar: </span>{missed.ask.charAt(0).toLowerCase() + missed.ask.slice(1)}.</p>}
      <p className="mt-3 text-[0.8rem] text-ink-3">AI bahosi hozircha mashq va fikr-mulohaza uchun, rasmiy baho emas: mentorlar baholari bilan kelishuv oʻlchanguncha shunday qoladi. Ball AI emas, server tomonidan bandlar boʻyicha hisoblanadi; iqtibos bayonnomada topilmasa, band «bajarilmadi» hisoblanadi.</p>
    </section>
  );
}
