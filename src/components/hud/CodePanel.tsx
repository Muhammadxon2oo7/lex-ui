'use client';
/** The Code, open-book: searchable list of the exercise's articles, verbatim from lex.uz. */
import { useMemo, useState } from 'react';
import type { Article } from '@/contracts/hearing';
import { Drawer } from '@/components/ui/Drawer';

export interface Code {
  title: string;
  edition: string;
  retrievedAt: string;
  articles: Article[];
}

export function CodePanel({ code, open, onOpen, onClose }: { code: Code; open: string | null; onOpen: (n: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const article: Article | undefined = code.articles.find((a) => a.number === open);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return code.articles.filter((a) => !q || `${a.number} ${a.title} ${a.text}`.toLowerCase().includes(q));
  }, [query, code.articles]);
  return (
    // a click anywhere outside the drawer closes the Code; grab the header to fling it away
    <Drawer side="right" label="Fuqarolik protsessual kodeksi" onClose={onClose} z="z-50"
      className="w-[min(30rem,calc(100vw-1.5rem))] rounded-[24px] hud hud-strong"
      header={
      <header className="px-5 pt-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-amber-200 uppercase">Kodeks · lex.uz</p>
            <h2 className="text-[1.02rem] leading-tight font-semibold">Fuqarolik protsessual kodeksi</h2>
            <p className="text-[0.72rem] text-white/55">Tahrir: {code.edition} · olingan: {code.retrievedAt}</p>
          </div>
          <button type="button" className="btn btn-quiet !min-h-9 !px-3 text-[0.84rem]" onClick={onClose}>Yopish</button>
        </div>
        {article ? (
          <button type="button" className="mt-3 text-[0.84rem] font-medium text-white/70 hover:text-white" onClick={() => onOpen('')}>← Barcha moddalar</button>
        ) : (
          <input type="search" aria-label="Moddalardan qidirish" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Modda raqami yoki soʻz…" className="mt-3 min-h-11 w-full rounded-xl bg-white/10 px-3 text-base outline-none placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-emerald-400" />
        )}
      </header>
      }>
      <div className="scroll-soft mt-3 flex-1 overflow-y-auto px-5 pb-5" tabIndex={0}>
        {article ? (
          <article>
            <h3 className="text-lg leading-snug font-semibold">{article.number}. {article.title}</h3>
            {article.text.split('\n').filter(Boolean).map((p, i) => (
              <p key={i} className="mt-2.5 text-[0.95rem] leading-relaxed text-white/90">{p}</p>
            ))}
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-[0.85rem] font-medium text-emerald-300 underline underline-offset-2">lex.uz saytida ochish ↗</a>
          </article>
        ) : (
          <ul className="space-y-1">
            {list.map((a) => (
              <li key={a.number}>
                <button type="button" onClick={() => onOpen(a.number)} className="flex min-h-11 w-full items-baseline gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/10">
                  <span className="w-20 shrink-0 text-[0.8rem] font-semibold text-amber-200 tabular-nums">{a.number}</span>
                  <span className="text-[0.92rem] leading-snug">{a.title}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-4 text-[0.9rem] text-white/60">Topilmadi. Bu yerda faqat mashqqa oid moddalar bor.</li>}
          </ul>
        )}
      </div>
    </Drawer>
  );
}

