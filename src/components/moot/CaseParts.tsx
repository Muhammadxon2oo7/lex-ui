'use client';
/**
 * Pieces of a «Bahs» case file shared by the lobby, the briefing, the hall and the verdict:
 * the chain of dates, the norms (verbatim from lex.uz on demand), the debrief, and the case catalogue.
 * `dark` - over the 3D hall (glass panel); otherwise the light surfaces of the pages.
 */
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useState } from 'react';
import type { MootCaseView, MootCatalogItem, MootSkill, NormRef, NormText } from '@/contracts/moot';
import { library } from '@/game/library';
import { ease } from '@/lib/motion';

export const SKILL: Record<MootSkill, string> = {
  dalil: 'Dalillar',
  qoida: 'Qoida',
  hisob: 'Hisob-kitob',
  protsess: 'Protsess',
  tavsif: 'Tavsif va sababiyat',
};
export const LEVEL = ['', 'Boshlangʻich', 'Oʻrta', 'Murakkab'] as const;

function Dots({ level, dark = false }: { level: number; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Daraja: ${LEVEL[level]}`}>
      <span aria-hidden className="inline-flex gap-0.5">
        {[1, 2, 3].map((i) => <span key={i} className={`size-1.5 rounded-full ${i <= level ? (dark ? 'bg-amber-200' : 'bg-accent') : dark ? 'bg-white/20' : 'bg-black/15'}`} />)}
      </span>
      <span>{LEVEL[level]}</span>
    </span>
  );
}

/** Topic · level · skills, one quiet line. */
export function CaseMeta({ c, dark = false }: { c: Pick<MootCaseView, 'topic' | 'level' | 'skills'>; dark?: boolean }) {
  if (!c.topic && !c.level) return null;
  const dim = dark ? 'text-white/60' : 'text-ink-3';
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.76rem] font-semibold ${dim}`}>
      {c.topic && <span className={dark ? 'text-amber-200' : 'text-accent-ink'}>{c.topic}</span>}
      {c.level && <Dots level={c.level} dark={dark} />}
      {c.skills.length > 0 && <span>{c.skills.map((s) => SKILL[s]).join(' · ')}</span>}
    </p>
  );
}

/** The chain of dates: a thin rail with a dot per event. */
export function Timeline({ items, dark = false }: { items: { date: string; text: string }[]; dark?: boolean }) {
  if (!items.length) return null;
  return (
    <ol className="relative mt-2 space-y-2.5 pl-5">
      <span aria-hidden className={`absolute top-1.5 bottom-1.5 left-[5px] w-px ${dark ? 'bg-white/15' : 'bg-black/10'}`} />
      {items.map((t, i) => (
        <li key={`${t.date}-${i}`} className="relative">
          <span aria-hidden className={`absolute top-[0.45em] -left-5 size-[11px] rounded-full ring-2 ${dark ? 'bg-amber-200 ring-[#1a1d24]' : 'bg-accent ring-white'}`} />
          <span className={`block text-[0.78rem] font-semibold tabular-nums ${dark ? 'text-white/70' : 'text-ink-2'}`}>{t.date}</span>
          <span className="block">{t.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** One norm: tap to read it verbatim (fetched once from the verified pack). */
function Norm({ n, dark }: { n: NormRef; dark: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<NormText | null>(null);
  const [failed, setFailed] = useState(false);
  const toggle = () => {
    setOpen(!open);
    if (!text && !open) library.law(n.ref).then(setText, () => setFailed(true));
  };
  const dim = dark ? 'text-white/65' : 'text-ink-2';
  return (
    <li className={`overflow-hidden rounded-xl ${dark ? 'bg-white/[0.06]' : 'bg-black/[0.035]'}`}>
      <button type="button" aria-expanded={open} onClick={toggle} className={`flex min-h-11 w-full items-baseline gap-3 px-3 py-2 text-left ${dark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.03]'}`}>
        <span className={`shrink-0 text-[0.8rem] font-semibold ${dark ? 'text-amber-200' : 'text-accent-ink'}`}>{n.label}</span>
        <span className={`min-w-0 flex-1 text-[0.86rem] leading-snug ${dim}`}>{n.title}</span>
        <span aria-hidden className={`text-[0.8rem] transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-90' : ''} ${dim}`}>›</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="t" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={ease.surface}>
            <div className="px-3 pb-3 text-[0.88rem] leading-relaxed">
              {failed ? <p className={dim}>Matn yuklanmadi. <a href={n.url} target="_blank" rel="noopener noreferrer" className="underline">lex.uzʼda ochish ↗</a></p>
                : !text ? <p className={`animate-pulse motion-reduce:animate-none ${dim}`}>Yuklanmoqda…</p>
                : (
                  <>
                    {text.text.split('\n').filter(Boolean).map((p, i) => <p key={i} className="mt-1.5">{p}</p>)}
                    <p className={`mt-2 text-[0.76rem] ${dim}`}>{text.document} · tahrir {text.edition ?? '-'} · olingan {text.retrievedAt}</p>
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className={`mt-1 inline-block text-[0.8rem] font-medium underline underline-offset-2 ${dark ? 'text-emerald-300' : 'text-accent-ink'}`}>lex.uz saytida ochish ↗</a>
                  </>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function Norms({ items, dark = false }: { items: NormRef[]; dark?: boolean }) {
  if (!items.length) return null;
  return <ul className="mt-2 space-y-1.5">{items.map((n) => <Norm key={n.ref} n={n} dark={dark} />)}</ul>;
}

/** After the verdict: what the case is based on and what the real courts decided. */
export function Debrief({ d }: { d: NonNullable<MootCaseView['debrief']> }) {
  return (
    <section className="surface mt-4 rounded-[28px] p-5" aria-labelledby="real-title">
      <p className="text-[0.76rem] font-semibold tracking-wider text-accent-ink uppercase">Haqiqiy ishda</p>
      <h2 id="real-title" className="display mt-1 text-lg font-semibold">Sudlar nima qildi</h2>
      <ol className="mt-3 space-y-2.5 text-[0.94rem] leading-relaxed">
        {d.outcome.map((t, i) => (
          <li key={i} className="flex gap-3"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.74rem] font-bold text-accent-ink">{i + 1}</span><span>{t}</span></li>
        ))}
      </ol>
      <h3 className="mt-5 font-semibold">Bu ish nimani oʻrgatadi</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.92rem] leading-relaxed text-ink-2">{d.lessons.map((t, i) => <li key={i}>{t}</li>)}</ul>
      <div className="mt-5 rounded-2xl bg-paper px-4 py-3 text-[0.84rem] text-ink-2">
        <p><span className="font-semibold text-ink">Asos: </span><a href={d.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{d.ruling} ↗</a></p>
        <p className="mt-1">{d.mark === 'T' ? 'Faktlar qarorning toʻliq matni bilan tekshirilgan.' : 'Faktlar ishonchli ikkilamchi manbadan (yuridik nashr) olingan.'} {d.adapted}</p>
      </div>
    </section>
  );
}

/** The case picker: topic filter and a card per case; radio semantics. */
export function Catalog({ items, extra, value, onChange }: { items: MootCatalogItem[]; extra: { id: string; title: string }[]; value: string; onChange: (id: string) => void }) {
  const topics = ['Hammasi', ...Array.from(new Set(items.map((i) => i.topic)))];
  const [topic, setTopic] = useState('Hammasi');
  const shown = items.filter((i) => topic === 'Hammasi' || i.topic === topic);
  return (
    <div>
      <LayoutGroup id="topics">
        <div role="tablist" aria-label="Mavzu" className="scroll-soft -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {topics.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={topic === t} onClick={() => setTopic(t)}
              className={`relative min-h-9 shrink-0 rounded-full px-3.5 text-[0.84rem] font-semibold transition-colors duration-200 ${topic === t ? 'text-white' : 'text-ink-2 hover:text-ink'}`}>
              {topic === t && <motion.span layoutId="topic-lens" transition={ease.surface} aria-hidden className="absolute inset-0 rounded-full bg-ink" />}
              <span className="relative">{t}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>
      <div role="radiogroup" aria-label="Ish" className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {shown.map((c) => {
          const on = c.id === value;
          return (
            <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.id)}
              className={`press flex flex-col rounded-[20px] border p-4 text-left transition-[border-color,background-color] duration-200 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-card hover:bg-paper'}`}>
              <span className="flex items-center gap-2 text-[0.74rem] font-semibold text-ink-3">
                <span className="text-accent-ink">{c.topic}</span><Dots level={c.level} />
                {c.abroad && <span className="rounded-full bg-black/[0.05] px-2 py-0.5">chet el ishi</span>}
                {on && <span aria-hidden className="ml-auto grid size-5 place-items-center rounded-full bg-accent text-[0.7rem] text-white">✓</span>}
              </span>
              <span className="mt-1.5 text-[0.98rem] leading-snug font-semibold text-balance">{c.title}</span>
              <span className="mt-1 line-clamp-2 text-[0.84rem] leading-snug text-ink-2">{c.summary}</span>
              <span className="mt-2 flex flex-wrap gap-1">{c.skills.map((s) => <span key={s} className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.7rem] font-semibold text-ink-2">{SKILL[s]}</span>)}</span>
            </button>
          );
        })}
        {topic === 'Hammasi' && extra.map((c) => {
          const on = c.id === value;
          return (
            <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.id)}
              className={`press rounded-[20px] border p-4 text-left ${on ? 'border-accent bg-accent-soft' : 'border-line bg-card hover:bg-paper'}`}>
              <span className="text-[0.74rem] font-semibold text-ink-3">Mentor tasdiqlagan</span>
              <span className="mt-1.5 block text-[0.98rem] leading-snug font-semibold">{c.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
