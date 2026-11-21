import type { Metadata } from 'next';
import { GlassLayer, GlassToolbar, ToolbarLink } from '@/components/ui/glass';
import { DIRECTION_SOURCES, SOURCE_DOCS, SOURCES_BUILT_AT, type SourceDoc } from '@/data/directions';

export const metadata: Metadata = {
  title: 'Normativ manbalar',
  description: 'LexSim yoʻnalishlari tayanadigan qonun va moddalar: tahrir sanasi va lex.uz havolasi bilan.',
};

const KIND: Record<string, string> = { code: 'Kodeks', law: 'Qonun', regulation: 'Qaror / buyruq', plenum: 'Oliy sud Plenumi qarori' };
const doc = (id: string) => SOURCE_DOCS.find((d) => d.id === id)!;
const cap = (t: string) => (t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);
/** The prosecution law's page carries the title of the 2001 act that gave it its current wording. */
const TITLE: Record<string, string> = { PROKURATURA: '«Prokuratura toʻgʻrisida»gi Qonun (29.08.2001-yildagi 257-II-son Qonun bilan tasdiqlangan tahrirda)' };
const label = (d: SourceDoc) => TITLE[d.id] ?? cap(d.title).replace(/^Oʻzbekiston respublikasining /i, '');

function Articles({ d, numbers }: { d: SourceDoc; numbers: string[] }) {
  if (!numbers.length) return <p className="mt-2 text-[0.82rem] text-ink-3">Umumiy asos: alohida moddasi boʻyicha baho berilmaydi.</p>;
  const list = numbers.map((n) => d.articles.find((a) => a.number === n)!).filter(Boolean);
  return (
    <details className="disclosure group mt-2">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-full py-1 text-[0.84rem] font-semibold text-accent-ink">
        <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="chev"><path d="M3 1.5L6.5 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="group-open:hidden">{list.length} ta modda/band - koʻrsatish</span>
        <span className="hidden group-open:inline">Yopish</span>
      </summary>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {list.map((a) => (
          <li key={a.number}>
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex gap-2 rounded-xl px-2 py-1.5 text-[0.84rem] leading-snug hover:bg-paper">
              <span className="shrink-0 font-semibold tabular-nums">{a.number}</span>
              <span className="text-ink-2">{a.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function SourcesPage() {
  return (
    <main className="relative isolate w-full flex-1">
      <GlassLayer />
      <GlassToolbar back={{ href: '/', label: 'YOʻNALISHLAR' }}>
        <ToolbarLink href="#hujjatlar">Barcha hujjatlar</ToolbarLink>
      </GlassToolbar>
      <div className="mx-auto w-full max-w-5xl px-5 pt-6 pb-12 sm:pt-10">
        <h1 className="display mt-4 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-semibold tracking-tight">Normativ manbalar</h1>
        <p className="mt-3 max-w-[64ch] text-[1.02rem] leading-relaxed text-pretty text-ink-2">
          Har bir yoʻnalish qaysi hujjatlarga va ularning qaysi moddalariga tayanadi. Matnlar Qonunchilik maʼlumotlari milliy bazasidan (lex.uz) skript bilan soʻzma-soʻz olingan - birorta modda raqami yoki matni xotiradan yozilmagan. Koddagi har bir modda havolasi shu roʻyxat bilan avtomatik tekshiriladi.
        </p>
        <p className="mt-2 text-[0.84rem] text-ink-3">Roʻyxat yangilangan: {SOURCES_BUILT_AT} · {SOURCE_DOCS.length} ta hujjat</p>

        <nav aria-label="Yoʻnalishlar" className="mt-6 flex flex-wrap gap-2">
          {DIRECTION_SOURCES.map((d) => <a key={d.id} href={`#${d.id}`} className="lg press rounded-full px-3.5 py-1.5 text-[0.86rem] font-semibold">{d.role}</a>)}
          <a href="#hujjatlar" className="rounded-full px-3.5 py-1.5 text-[0.86rem] font-semibold text-ink-2 hover:bg-black/5">Barcha hujjatlar</a>
        </nav>

        <div className="mt-8 space-y-6">
          {DIRECTION_SOURCES.map((dir) => (
            <section key={dir.id} id={dir.id} aria-labelledby={`${dir.id}-h`} className="surface scroll-mt-20 rounded-[30px] p-5 sm:p-7">
              <p className="text-[0.76rem] font-semibold tracking-wider text-accent-ink uppercase">{dir.role}</p>
              <h2 id={`${dir.id}-h`} className="display mt-1 text-[1.5rem] font-semibold">{dir.title}</h2>
              <p className="mt-2 max-w-[70ch] text-[0.92rem] leading-relaxed text-ink-2">{dir.note}</p>
              <ol className="mt-5 divide-y divide-line">
                {dir.uses.map((u) => {
                  const d = doc(u.doc);
                  return (
                    <li key={u.doc} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-accent">{label(d)}</a>
                        <span className="text-[0.78rem] text-ink-3">{[KIND[d.kind], d.adopted?.replace(/\s+/g, ' ').trim(), d.edition ? `tahrir ${d.edition}` : null].filter(Boolean).join(' · ')}</span>
                      </div>
                      <p className="mt-1 text-[0.9rem] text-ink-2">{u.why}</p>
                      <Articles d={d} numbers={u.articles} />
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>

        <section id="hujjatlar" aria-labelledby="all-h" className="mt-10 scroll-mt-20">
          <h2 id="all-h" className="display text-[1.5rem] font-semibold">Barcha hujjatlar</h2>
          <div className="surface mt-3 overflow-x-auto rounded-[24px]">
            <table className="w-full min-w-[44rem] text-left text-[0.86rem]">
              <thead className="text-[0.74rem] text-ink-3">
                <tr><th className="px-4 py-3 font-semibold">Hujjat</th><th className="px-4 py-3 font-semibold">Qabul qilingan</th><th className="px-4 py-3 font-semibold">Tahrir (lex.uz)</th><th className="px-4 py-3 font-semibold">Olingan</th><th className="px-4 py-3 text-right font-semibold">Moddalar</th></tr>
              </thead>
              <tbody>
                {SOURCE_DOCS.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3"><a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{label(d)}</a><span className="block text-[0.76rem] text-ink-3">{[KIND[d.kind], d.acceptingBody].filter(Boolean).join(' · ')}</span></td>
                    <td className="px-4 py-3 text-ink-2">{d.adopted?.replace(/\s+/g, ' ').trim() ?? '-'}</td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">{d.edition ?? '-'}</td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">{d.retrievedAt}</td>
                    <td className="px-4 py-3 text-right text-ink-2 tabular-nums">{d.articles.length}{d.total ? ` / ${d.total}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.8rem] leading-relaxed text-ink-3">«Moddalar» - toʻplamga olinganlari / hujjatdagi jami. Matn oʻzgarsa (yangi tahrir), toʻplam qayta yuklanadi va havolalar tekshiruvi qayta oʻtkaziladi. Oʻquv simulyatsiyasi - huquqiy maslahat emas.</p>
        </section>
      </div>
    </main>
  );
}
