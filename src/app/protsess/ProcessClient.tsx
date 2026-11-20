'use client';
/**
 * Protsess xaritasi — how a matter actually moves in Uzbekistan, step by
 * step: from the application at a state body, through the five procedural
 * codes, to the decision and the appeal. Every stage is tied to articles
 * quoted verbatim from lex.uz (built by tools/build-process.mjs from the
 * verified research pack). Labels, actors and outputs are descriptive
 * summaries; the law is the article text.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { roomUrl, type RoomAction } from '@/game/rooms';
import { OrderDrill } from './OrderDrill';
import { useDismiss } from '@/lib/useDismiss';

type Article = { key: string; source: string; number: string; title: string; text: string; url: string };
type Stage = { id: string; label: string; actor: string; output: string; articles: string[] };
type Phase = { id: string; label: string; stages: Stage[]; practice: RoomAction | null };
type Track = { id: string; short: string; title: string; lexUrl?: string; edition?: string | null; partial?: boolean; sources: string[]; phases: Phase[] };
type Source = { id: string; title: string; lexUrl: string; edition: string | null; retrievedAt: string };
type ProcessMap = { builtAt: string; complete: boolean; tracks: Track[]; sources: Record<string, Source>; articles: Record<string, Article> };

const spring = { type: 'spring', bounce: 0, duration: 0.4 } as const;

/** Which road a matter takes — orientation only (study guide), the law decides. */
const ROUTES: { when: string; track: string }[] = [
  { when: 'Davlat organiga ariza, xizmat soʻrash, murojaat', track: 'ADMIN' },
  { when: 'Fuqaroning qarzi, aliment, uy-joy, mehnat nizosi', track: 'FPK' },
  { when: 'Tadbirkorlik shartnomasi, korporativ nizo', track: 'IPK' },
  { when: 'Davlat organi qarori yoki harakatsizligi ustidan nizo', track: 'MSIYK' },
  { when: 'Jinoyat alomati: xabar, tergov, ayblov, sud', track: 'JPK' },
  { when: 'Maʼmuriy huquqbuzarlik: bayonnoma, jarima, shikoyat', track: 'MJtK' },
];

const PRACTICE_LABEL: Record<RoomAction, string> = {
  case: 'Ish yoʻlida amalda oʻtish',
  dxm: 'DXM qabulida mashq qilish',
  court: 'Sud zalida mashq qilish',
  tools: 'Ish qurollari',
  library: '',
};

export default function ProcessClient() {
  const router = useRouter();
  const [data, setData] = useState<ProcessMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackId, setTrackId] = useState('ADMIN');
  const [open, setOpen] = useState<string | null>(null);
  const dismissArticle = useDismiss(() => setOpen(null));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<RoomAction | null>(null);
  const [drill, setDrill] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/data/process-map.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((j: ProcessMap) => alive && setData(j))
      .catch(() => alive && setError('Protsess xaritasini yuklab boʻlmadi'));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const track = data?.tracks.find((t) => t.id === trackId) ?? null;
  const article = open && data ? data.articles[open] : null;

  /** Stages whose label or articles mention the query. */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !track || !data) return null;
    const hit = new Set<string>();
    for (const ph of track.phases)
      for (const st of ph.stages)
        if (st.label.toLowerCase().includes(q) || st.articles.some((k) => `${data.articles[k].number} ${data.articles[k].title} ${data.articles[k].text}`.toLowerCase().includes(q))) hit.add(st.id);
    return hit;
  }, [query, track, data]);

  const practise = async (action: RoomAction) => {
    setBusy(action);
    try {
      router.push(await roomUrl(action));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xonani ochib boʻlmadi');
      setBusy(null);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="min-h-dvh bg-[#0b1322] text-white">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1322]/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3.5">
            <span className="h-8 w-1 rounded-full bg-[#1f8a5b]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[0.66rem] font-semibold tracking-[0.3em] text-white/45">4-XONA · HUQUQIY KUTUBXONA</p>
              <h1 className="text-[1.2rem] font-semibold tracking-tight">Protsess xaritasi</h1>
            </div>
            <Link href="/" className="btn btn-quiet !min-h-10 !rounded-xl text-[0.86rem]">Yoʻlakka qaytish</Link>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 pt-6 pb-16">
          <p className="max-w-[72ch] text-[0.98rem] leading-relaxed text-white/70">
            Oʻzbekistonda ish qanday yuritiladi — ariza berishdan qarorgacha va shikoyatgacha. Har bir bosqich qonundagi moddaga bogʻlangan: moddani bosing, lex.uz saytidagi matni soʻzma-soʻz ochiladi.
          </p>

          {/* which road? */}
          <section aria-labelledby="routes" className="mt-6">
            <h2 id="routes" className="text-[0.72rem] font-semibold tracking-[0.2em] text-white/50 uppercase">Qaysi yoʻl?</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ROUTES.map((r) => {
                const t = data?.tracks.find((x) => x.id === r.track);
                const active = trackId === r.track;
                return (
                  <li key={r.track}>
                    <button
                      type="button"
                      onClick={() => {
                        setTrackId(r.track);
                        setOpen(null);
                      }}
                      aria-pressed={active}
                      className={`flex h-full w-full flex-col rounded-xl p-3.5 text-left ring-1 transition-colors ${active ? 'bg-[#16253f] ring-[#1f8a5b]' : 'bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]'}`}
                    >
                      <span className="text-[0.88rem] leading-snug text-white/80">{r.when}</span>
                      <span className={`mt-1.5 text-[0.95rem] font-semibold ${active ? 'text-[#5dd6a0]' : ''}`}>→ {t?.short ?? r.track}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[0.74rem] text-white/40">Yoʻnaltiruvchi koʻrsatma oʻquv maqsadida; aniq ish uchun sudga taalluqlilik qonun boʻyicha tekshiriladi.</p>
          </section>

          {error && <p role="alert" className="mt-6 rounded-xl bg-[#5b1f1a] px-4 py-3">{error}</p>}
          {!data && !error && <p className="mt-10 text-white/50" role="status">Yuklanmoqda…</p>}

          {track && data && (
            <section className="mt-8" aria-labelledby="track-title">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-amber-200 uppercase">{track.short}</p>
                  <h2 id="track-title" className="text-2xl font-semibold tracking-tight">{track.title}</h2>
                  <p className="mt-1 text-[0.8rem] text-white/50">
                    Manba:{' '}
                    {track.sources.map((s, i) => (
                      <span key={s}>
                        {i > 0 && ' · '}
                        <a href={data.sources[s].lexUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-2 hover:text-white">{data.sources[s].title}</a>
                        {data.sources[s].edition && <span className="text-white/35"> ({data.sources[s].edition} tahriri)</span>}
                      </span>
                    ))}
                  </p>
                </div>
                <button type="button" onClick={() => setDrill(true)} className="btn btn-primary !min-h-11 !rounded-xl">Mashq: tartibni tiklang</button>
                <label className="block w-full sm:w-72">
                  <span className="sr-only">Bosqich yoki moddani qidirish</span>
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Qidirish: modda, soʻz…" className="min-h-11 w-full rounded-xl bg-white/[0.06] px-4 text-base ring-1 ring-white/10 outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-[#1f8a5b]" />
                </label>
              </div>
              {track.partial && (
                <p className="mt-4 rounded-xl bg-amber-300/10 px-4 py-3 text-[0.85rem] text-amber-100/90 ring-1 ring-amber-300/20">
                  Hozircha bu kodeks boʻyicha faqat sud majlisi bosqichlari tasdiqlangan. Ariza berish, tayyorlov, qaror va shikoyat bosqichlari lex.uz manbalaridan toʻldirilmoqda.
                </p>
              )}

              {/* phases: a timeline that reads left → right on wide screens, top → bottom on phones */}
              <ol className="mt-6 grid gap-4 lg:auto-cols-[minmax(17rem,1fr)] lg:grid-flow-col lg:overflow-x-auto lg:pb-3">
                {track.phases.map((ph, pi) => (
                  <li key={ph.id} className="flex min-w-0 flex-col rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                    <div className="flex items-center gap-2.5 px-1.5 pt-1 pb-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#1f8a5b] text-[0.8rem] font-bold">{pi + 1}</span>
                      <h3 className="text-[1rem] font-semibold">{ph.label}</h3>
                    </div>
                    <ol className="flex-1 space-y-2">
                      {ph.stages.map((st) => {
                        const dim = matches && !matches.has(st.id);
                        return (
                          <li key={st.id} className={`rounded-xl bg-[#101b30] p-3 ring-1 ring-white/[0.07] transition-opacity ${dim ? 'opacity-30' : ''}`}>
                            <p className="text-[0.92rem] leading-snug font-semibold">{st.label}</p>
                            <p className="mt-1 text-[0.74rem] leading-snug text-white/50">
                              {st.actor}
                              {st.output && st.output !== '—' && <> · natija: <span className="text-white/70">{st.output}</span></>}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {st.articles.map((k) => {
                                const a = data.articles[k];
                                return (
                                  <button key={k} type="button" onClick={() => setOpen(k)} title={a.title} className={`rounded-md px-2 py-1 text-[0.72rem] font-semibold tabular-nums ring-1 transition-colors ${open === k ? 'bg-[#1f8a5b] ring-[#1f8a5b]' : 'bg-white/[0.05] text-white/80 ring-white/10 hover:bg-white/[0.12]'}`}>
                                    {track.sources.length > 1 ? `${a.source} ` : ''}
                                    {a.number.replace('-modda', '')}-m.
                                  </button>
                                );
                              })}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    {ph.practice && (
                      <button type="button" disabled={busy !== null} onClick={() => void practise(ph.practice!)} className="mt-3 min-h-11 rounded-xl bg-[#1f8a5b] px-3 text-[0.88rem] font-semibold hover:bg-[#17704a] disabled:opacity-50">
                        {busy === ph.practice ? 'Xona tayyorlanmoqda…' : PRACTICE_LABEL[ph.practice]} →
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {drill && track && data && (
          <OrderDrill
            title={track.title}
            stages={track.phases.flatMap((p) => p.stages.map((s) => ({ ...s, id: `${p.id}:${s.id}` })))}
            articles={data.articles}
            onOpen={(k) => setOpen(k)}
            onClose={() => setDrill(false)}
          />
        )}

        {/* the article, verbatim */}
        <AnimatePresence>
          {article && data && (
            // a click anywhere beside the article closes it
            <motion.div key="scrim" {...dismissArticle} className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          )}
          {article && data && (
            <motion.aside
              key={article.key}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={spring}
              role="dialog"
              aria-label={`${article.number}. ${article.title}`}
              className="fixed top-0 right-0 bottom-0 z-50 flex w-[min(34rem,100vw)] flex-col border-l border-white/10 bg-[#0e1829] shadow-[-30px_0_80px_rgba(0,0,0,0.5)]"
            >
              <header className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-amber-200 uppercase">{data.sources[article.source].title}</p>
                  <h3 className="mt-1 text-[1.12rem] leading-snug font-semibold">{article.number}. {article.title}</h3>
                </div>
                <button type="button" onClick={() => setOpen(null)} className="btn btn-quiet !min-h-9 !rounded-xl !px-3 text-[0.84rem]">Yopish</button>
              </header>
              <div className="scroll-soft flex-1 overflow-y-auto px-5 py-4 select-text" tabIndex={0}>
                {article.text.split('\n').filter(Boolean).map((p, i) => (
                  <p key={i} className="mb-3 text-[0.96rem] leading-relaxed text-white/90">{p}</p>
                ))}
              </div>
              <footer className="border-t border-white/10 px-5 py-3 text-[0.78rem] text-white/50">
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#5dd6a0] underline underline-offset-2">lex.uz saytida ochish ↗</a>
                <span className="ml-2">· matn {data.sources[article.source].retrievedAt} kuni olingan{data.sources[article.source].edition ? `, ${data.sources[article.source].edition} tahriri` : ''}</span>
              </footer>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
