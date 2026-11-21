'use client';
/**
 * Lines of practice, grouped (economic court, civil, criminal, public services), ordered by how often
 * such disputes reached the courts in 2025 (stat.sud.uz, sent by the court server as `share2025`).
 */
import Link from 'next/link';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { Domain } from '@/contracts/library';
import { ApiError } from '@/game/api';
import { GROUPS, library, MODE_LABEL } from '@/game/library';
import { GlassLayer, GlassToolbar, ToolbarLink } from '@/components/ui/glass';
import { ease } from '@/lib/motion';

const ORDER = ['iqtisodiy', 'fuqarolik', 'jinoyat'];

export default function Domains() {
  const [data, setData] = useState<{ domains: Domain[]; source: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    library.domains().then((d) => alive && setData(d), (e) => alive && setError(e instanceof ApiError ? e.message : 'Sohalar yuklanmadi'));
    return () => {
      alive = false;
    };
  }, []);
  const groups = data ? [...new Set(data.domains.map((d) => d.group))].sort((a, b) => (ORDER.indexOf(a) + 1 || 9) - (ORDER.indexOf(b) + 1 || 9)) : [];
  const top = data ? Math.max(...data.domains.map((d) => d.share2025 ?? 0), 1) : 1;

  return (
    <main className="relative isolate w-full flex-1">
      <GlassLayer />
      <GlassToolbar back={{ href: '/', label: 'YOʻNALISHLAR' }}>
        <ToolbarLink href="/manbalar">Manbalar</ToolbarLink>
        <ToolbarLink href="/mentor" className="max-sm:hidden">Mentor</ToolbarLink>
      </GlassToolbar>
      <div className="mx-auto w-full max-w-6xl px-5 pt-8 pb-16 sm:pt-12">
        <p className="text-[0.8rem] font-semibold tracking-wider text-accent-ink uppercase">Sohalar va caselar</p>
        <h1 className="display mt-2 max-w-[20ch] text-[clamp(2.1rem,5.5vw,3.6rem)] font-semibold tracking-tight text-balance">Qaysi sohada mashq qilasiz?</h1>
        <p className="mt-3 max-w-[60ch] text-[1.02rem] leading-relaxed text-pretty text-ink-2">
          Har bir sohada tizim caselari va foydalanuvchilar kiritgan caselar bor. Oʻz holatingizni oddiy soʻz bilan yozsangiz, sunʼiy intellekt uni simulyatsiyaga mos case qilib tuzadi; boshqalarga u mentor tasdiqlagandan keyin chiqadi.
        </p>

        {error && <p role="alert" className="mt-8 rounded-2xl bg-danger-soft px-4 py-3 text-[0.92rem] font-medium text-danger">{error}</p>}
        {!data && !error && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="surface h-40 animate-pulse rounded-[26px] motion-reduce:animate-none" />)}
          </div>
        )}

        {groups.map((g, gi) => (
          <section key={g} aria-labelledby={`g-${g}`} className="mt-10">
            <h2 id={`g-${g}`} className="display text-[1.35rem] font-semibold">{GROUPS[g] ?? g}</h2>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data!.domains.filter((d) => d.group === g).sort((a, b) => (b.share2025 ?? -1) - (a.share2025 ?? -1)).map((d, i) => (
                <motion.li key={d.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...ease.surface, delay: Math.min(0.3, 0.04 * (gi * 3 + i)) }}>
                  <Link href={`/sohalar/${d.id}`} className="surface press group flex h-full flex-col rounded-[26px] p-5 transition-shadow duration-300 hover:shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.06),var(--shadow-lift)]">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-[1.12rem] leading-tight font-semibold text-balance">{d.title}</h3>
                      <span aria-hidden className="text-ink-3 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none">→</span>
                    </div>
                    {d.share2025 !== null && (
                      <div className="mt-3">
                        <div className="flex items-baseline justify-between text-[0.8rem]"><span className="text-ink-3">2025-yilda sudlarda</span><span className="font-semibold tabular-nums">{d.share2025.toLocaleString('uz-UZ')} %</span></div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-accent" style={{ width: `${(d.share2025 / top) * 100}%` }} /></div>
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                      {d.modes.map((m) => <span key={m} className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[0.74rem] font-semibold text-ink-2">{MODE_LABEL[m] ?? m}</span>)}
                      {d.codes.map((c) => <span key={c} className="rounded-full px-2 py-0.5 text-[0.72rem] font-semibold text-ink-3 ring-1 ring-black/[0.08]">{c}</span>)}
                    </div>
                    {d.note && <p className="mt-2 text-[0.78rem] leading-snug text-ink-3">{d.note}</p>}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </section>
        ))}
        {data?.source && <p className="mt-10 text-[0.8rem] text-ink-3">Ulushlar manbasi: <a href={data.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{data.source.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>. Iqtisodiy sohalarda - shartnomaviy nizolar ichida, fuqarolikda - fuqarolik ishlari ichida.</p>}
      </div>
    </main>
  );
}
