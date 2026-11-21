'use client';
/**
 * Court hearing, conducted from the bench.
 *
 * The student presides: at every moment they choose the next procedural
 * action. The Code is always one key away (K) - open-book, as in a real
 * courtroom - and every completed step is tied to the article that governs
 * it, quoted verbatim from lex.uz.
 */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ease, modal, note } from '@/lib/motion';
import { useEffect, useEffectEvent, useState } from 'react';
import { HearingEnvelopeSchema, type HearingLine, type HearingSnapshot, type Speaker } from '@/contracts/hearing';
import { newId } from '@/game/api';
import { speak, stopSpeaking, type VoiceId } from '@/game/voice';
import { matchUtterance } from '@/lib/uz';
import { Talk } from '@/components/hud/Talk';
import { CodePanel } from '@/components/hud/CodePanel';

const VOICE: Partial<Record<Speaker, VoiceId>> = { secretary: 'female', claimant: 'male', respondent: 'female_alt', witness: 'elder_m' };

const CourtRoom = dynamic(() => import('@/components/world/CourtRoom'), { ssr: false });

async function request(path: string, body?: unknown): Promise<HearingSnapshot> {
  const res = await fetch(`/api/v1/hearings${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json as { error?: { message?: string } } | null)?.error?.message ?? 'Kutilmagan xatolik');
  const parsed = HearingEnvelopeSchema.safeParse(json);
  if (!parsed.success) throw new Error('Server javobi kontraktga mos emas');
  return parsed.data.hearing;
}

/** Shows new lines one at a time; returns the one on screen and who is speaking. */
function usePresenter(lines: HearingLine[]) {
  const [done, setDone] = useState(lines.length - 1);
  const current = lines[Math.min(done, lines.length - 1)];
  const pending = done < lines.length - 1;
  // Each participant's line is spoken in their voice; the next one waits for it.
  useEffect(() => {
    if (!pending) return;
    const line = lines[done];
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const voice = line && VOICE[line.speaker];
    const reading = done < 0 ? 0 : 900 + Math.min(line?.text.length ?? 0, 160) * 38;
    void (voice ? speak(line.text, voice) : Promise.resolve(false)).then((heard) => {
      if (alive) timer = setTimeout(() => setDone((d) => d + 1), heard ? 400 : reading);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [done, pending, lines]);
  // the last line of a batch is spoken too
  useEffect(() => {
    if (pending) return;
    const line = lines[done];
    const voice = line && VOICE[line.speaker];
    if (voice) void speak(line.text, voice);
    return () => stopSpeaking();
  }, [done, pending, lines]);
  const speaking: Speaker | null = pending || current?.speaker !== 'system' ? (current?.speaker ?? null) : null;
  return {
    current,
    idle: !pending,
    speaking: pending ? speaking : null,
    skip: () => {
      stopSpeaking();
      setDone((d) => Math.min(d + 1, lines.length - 1));
    },
  };
}

export default function CourtClient() {
  const { id } = useParams<{ id: string }>();
  const [hearing, setHearing] = useState<HearingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null); // null = closed, '' = list, 'N-modda' = article

  useEffect(() => {
    let cancelled = false;
    request(`/${id}`).then((h) => !cancelled && setHearing(h), (e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error && !hearing) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="display text-2xl font-semibold">Sud majlisi ochilmadi</h1>
          <p className="mt-2 text-ink-2">{error}</p>
          <Link href="/kampus" className="btn btn-primary mt-6">Yoʻlakka qaytish</Link>
        </div>
      </main>
    );
  }
  if (!hearing) return <main className="grid min-h-dvh place-items-center bg-[#0c0f14] text-white/70" role="status">Sud zali tayyorlanmoqda…</main>;

  const choose = async (optionId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setHearing(await request(`/${id}/act`, { clientActionId: newId(), optionId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <Stage key={hearing.hearingId} hearing={hearing} busy={busy} error={error} code={code} setCode={setCode} choose={choose} />
    </MotionConfig>
  );
}

function Stage({ hearing, busy, error, code, setCode, choose }: { hearing: HearingSnapshot; busy: boolean; error: string | null; code: string | null; setCode: (v: string | null) => void; choose: (id: string) => void }) {
  const { current, idle, speaking, skip } = usePresenter(hearing.lines);
  const canAct = idle && !busy && !hearing.finished;
  const [heard, setHeard] = useState<{ said: string; ok: boolean; error?: boolean } | null>(null);
  const name = (role: Speaker) => hearing.parties.find((p) => p.role === role);
  const witnessCalled = hearing.done.some((d) => d.article === '229-modda');

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyK') setCode(code === null ? '' : null);
    else if (e.code === 'Escape' && code !== null) setCode(null);
    else if (e.code === 'Space') {
      e.preventDefault();
      skip();
    } else if (canAct && code === null) {
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (i >= 0 && hearing.options[i]) choose(hearing.options[i].id);
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const who = current && current.speaker !== 'system' ? name(current.speaker) : null;

  /**
   * Who is on their feet - FPK 212: everyone rises when the court enters and
   * leaves, and while the decision is read; participants give explanations,
   * testimony and answers standing.
   */
  const lastStep = hearing.done[hearing.done.length - 1]?.article;
  const courtMoving = hearing.done.length === 0 || lastStep === '247-modda' || lastStep === '248-modda';
  const everyone: Speaker[] = ['secretary', 'claimant', 'respondent', 'witness'];
  const standing: Speaker[] = courtMoving
    ? everyone
    : current && (current.speaker === 'claimant' || current.speaker === 'respondent' || current.speaker === 'witness')
      ? [current.speaker]
      : [];

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0c0f14] text-white select-none">
      <div className="absolute inset-0">
        <CourtRoom speaker={speaking} witnessPresent={hearing.witnessPresent} witnessCalled={witnessCalled} standing={standing} />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[40dvh] bg-gradient-to-t from-black/55 to-transparent lg:inset-x-auto lg:right-0 lg:h-full lg:w-[42vw] lg:bg-gradient-to-l lg:from-black/45" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />

      {/* ── top bar: the case (and, on wide screens, the order of the hearing so far), then actions ── */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3 sm:p-4">
        <aside className="hud flex max-h-[calc(100dvh-2rem)] min-w-0 flex-1 flex-col rounded-[22px] px-4 py-3 sm:max-w-[19rem] sm:flex-none sm:basis-[19rem]" aria-label="Ish va majlis tartibi">
          <p className="text-[0.66rem] font-semibold tracking-[0.16em] text-amber-200 uppercase">Fuqarolik ishi · 1-instansiya</p>
          <h1 className="truncate text-[0.98rem] leading-tight font-semibold sm:whitespace-normal">{hearing.caseTitle}</h1>
          <p className="mt-0.5 hidden text-[0.74rem] leading-snug text-white/60 sm:block">{hearing.parties.filter((p) => p.role !== 'judge').map((p) => `${p.label}: ${p.name}`).join(' · ')}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Majlis bosqichlari" aria-valuemin={0} aria-valuemax={hearing.total} aria-valuenow={hearing.done.length}>
              <motion.div className="h-full rounded-full bg-emerald-400" initial={false} animate={{ scaleX: hearing.done.length / hearing.total }} transition={ease.surface} style={{ transformOrigin: '0 50%' }} />
            </div>
            <span className="text-[0.7rem] text-white/60 tabular-nums">{hearing.done.length}/{hearing.total}</span>
          </div>
          <ol className="scroll-soft mt-2 hidden min-h-0 flex-1 space-y-0.5 overflow-y-auto text-[0.8rem] md:block">
            {hearing.done.map((d) => (
              <li key={d.article}>
                <button type="button" onClick={() => setCode(d.article)} className="hud-row flex w-full items-baseline gap-2 rounded-[10px] px-1.5 py-1 text-left">
                  <span aria-hidden className={d.attempts === 1 ? 'text-emerald-300' : 'text-amber-300'}>✓</span>
                  <span className="flex-1 leading-snug text-white/85">{d.label}</span>
                  <span className="shrink-0 text-[0.7rem] text-white/50 tabular-nums">{d.article.replace('-modda', '')}-m.</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-2 hidden text-[0.68rem] leading-snug text-white/45 md:block">{hearing.caseNote}</p>
        </aside>
        <div className="glass ml-auto flex shrink-0 items-center gap-1 rounded-full p-1">
          <button type="button" onClick={() => setCode('')} title="Kodeks (K)" aria-label="Kodeks"
            className="flex h-9 items-center gap-2 rounded-full px-2.5 text-[0.84rem] font-medium text-white/85 transition-colors duration-150 hover:bg-white/12 hover:text-white">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7M8 11h7" /></svg>
            <span className="max-sm:hidden">Kodeks</span>
          </button>
          <Link href="/kampus" title="Zaldan chiqish" aria-label="Zaldan chiqish"
            className="flex h-9 items-center gap-2 rounded-full px-2.5 text-[0.84rem] font-medium text-white/85 transition-colors duration-150 hover:bg-white/12 hover:text-white">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>
            <span className="max-sm:hidden">Chiqish</span>
          </Link>
        </div>
      </header>

      {/* ── one dock: what is said, feedback, your voice, your next procedural step ── */}
      <section aria-label="Sud majlisi" className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-3xl px-3 pb-3 sm:px-4 sm:pb-5 lg:inset-x-auto lg:right-5 lg:bottom-5 lg:w-[min(32rem,38vw)] lg:max-w-none lg:p-0">
        <AnimatePresence>
          {hearing.feedback && !hearing.feedback.correct && idle && (
            <motion.p key={hearing.feedback.message} {...note} role="alert" className="hud mx-auto mb-2 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-[18px] py-2 pr-2 pl-3 text-[0.86rem]">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-red-400 shadow-[0_0_10px_rgb(248_113_113/0.8)]" />
              <span className="min-w-0 flex-1">{hearing.feedback.message}</span>
              {hearing.feedback.article && <button type="button" className="rounded-full bg-white/15 px-3 py-1 text-[0.78rem] font-semibold hover:bg-white/25" onClick={() => setCode(hearing.feedback!.article)}>Moddani ochish</button>}
            </motion.p>
          )}
        </AnimatePresence>
        {error && <p role="alert" className="hud mx-auto mb-2 w-fit rounded-full px-4 py-1.5 text-[0.86rem]">{error}</p>}

        <motion.div layout="size" transition={ease.surface} className="hud hud-strong overflow-hidden rounded-[28px]">
          <button type="button" onClick={skip} disabled={idle} className="block w-full px-5 pt-4 pb-3 text-left select-text disabled:cursor-default">
            <span className={`block text-[0.68rem] font-semibold tracking-[0.16em] uppercase ${!current || current.speaker === 'system' ? 'text-white/50' : current.speaker === 'judge' ? 'text-emerald-300' : 'text-amber-200'}`}>
              {!current || current.speaker === 'system' ? 'Sud majlisi zali' : who ? `${who.label} · ${who.name}` : ''}
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={current ? `${current.speaker}:${current.text}` : 'idle'} initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -4 }} transition={ease.surface}
                className={`mt-1.5 block text-[1.08rem] leading-snug text-pretty ${!current || current.speaker === 'system' ? 'text-white/75 italic' : 'text-white'}`}>
                {current?.text ?? 'Raislik qiluvchi sifatida keyingi protsessual harakatni tanlang.'}
              </motion.span>
            </AnimatePresence>
            {!idle && <span className="mt-1 block text-right text-[0.7rem] text-white/40">Space - davom</span>}
          </button>
          <p className="sr-only" role="log" aria-live="polite">{current ? `${who?.label ?? 'Vaziyat'}: ${current.text}` : ''}</p>

          {canAct && (
            <div role="group" aria-label="Protsessual harakatlar" className="border-t border-white/[0.07]">
              <p className="px-5 pt-3 text-[0.68rem] font-semibold tracking-[0.14em] text-white/50 uppercase">Keyingi harakatingiz - ayting yoki tanlang</p>
              <ul className="scroll-soft max-h-[28dvh] space-y-0.5 overflow-y-auto overscroll-contain px-2 py-2 sm:max-h-[36dvh] lg:max-h-[46dvh]">
                {hearing.options.map((o, i) => (
                  <motion.li key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...ease.surface, delay: i * 0.035 }}>
                    <button type="button" onClick={() => choose(o.id)} className="hud-row flex min-h-11 w-full items-start gap-3 rounded-[18px] px-3 py-2.5 text-left">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] bg-white/12 text-[0.7rem] font-semibold tabular-nums text-white/75 shadow-[inset_0_-1px_0_rgb(0_0_0/0.3)]">{i + 1}</span>
                      <span className="text-[0.92rem] leading-snug text-white/90">{o.text}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
          {canAct && (
            <div className="flex items-center gap-3 border-t border-white/[0.07] px-3 py-2.5">
              <Talk compact enabled={canAct}
                onHeard={(said) => {
                  const match = matchUtterance(said, hearing.options);
                  setHeard({ said, ok: Boolean(match) });
                  if (match) choose(match.option.id);
                }}
                onError={(m) => setHeard({ said: m, ok: false, error: true })}
              />
              <p className={`min-w-0 flex-1 text-[0.8rem] leading-snug ${heard && !heard.ok ? 'text-amber-200' : 'text-white/60'}`} role="status">
                {heard ? (heard.error ? heard.said : heard.ok ? <>Eshitildi: «{heard.said}»</> : <>«{heard.said}» - mos harakat topilmadi. Aniqroq ayting yoki tanlang.</>) : <><span className="pointer-coarse:hidden"><kbd className="bg-white/15!">T</kbd> yoki </span>mikrofonni bosib turib ayting</>}
              </p>
            </div>
          )}
        </motion.div>
      </section>

      {hearing.finished && idle && (
        <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/60 p-4">
          <motion.section {...modal} role="dialog" aria-modal="true" aria-labelledby="court-result" className="glass-light w-full max-w-2xl rounded-[28px] p-6 select-text sm:p-8">
            <p className="text-[0.72rem] font-semibold tracking-wider text-accent-ink uppercase">Sud majlisi yopildi</p>
            <h2 id="court-result" className="display mt-1 text-3xl font-semibold">Tartibga rioya: {hearing.score} / 100</h2>
            <p className="mt-2 text-[0.92rem] text-ink-2">{hearing.done.filter((d) => d.attempts === 1).length} ta bosqich birinchi urinishda toʻgʻri, jami {hearing.total} ta. Ball faqat protsessual ketma-ketlikni oʻlchaydi - ishning mazmuni baholanmaydi.</p>
            <ol className="scroll-soft mt-4 max-h-[42dvh] space-y-1 overflow-y-auto">
              {hearing.done.map((d, i) => {
                const a = hearing.code.articles.find((x) => x.number === d.article)!;
                return (
                  <li key={d.article} className="flex items-baseline gap-3 rounded-xl px-2 py-1.5 text-[0.9rem] odd:bg-black/[0.04]">
                    <span className="w-5 text-right text-ink-3 tabular-nums">{i + 1}</span>
                    <span className="flex-1">{d.label}</span>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-medium text-navy underline decoration-line underline-offset-2">FPK {d.article}</a>
                    <span className={`w-20 shrink-0 text-right text-[0.8rem] font-semibold ${d.attempts === 1 ? 'text-accent-ink' : 'text-warn'}`}>{d.attempts === 1 ? 'birinchi' : `${d.attempts} urinish`}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-[0.78rem] leading-relaxed text-ink-2">
              Moddalar matni lex.uz saytidan {hearing.code.retrievedAt} kuni olingan ({hearing.code.edition} tahriri). Ish holatlari toʻqilgan; ssenariy amaliyotchi sudya yoki mentor tomonidan hali tasdiqlanmagan.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/kampus" className="btn btn-primary">Yoʻlakka qaytish</Link>
              <button type="button" className="btn btn-quiet" onClick={() => setCode('')}>Kodeksni koʻrish</button>
            </div>
          </motion.section>
        </div>
      )}

      <AnimatePresence>
        {code !== null && <CodePanel key="code" code={hearing.code} open={code || null} onOpen={(n) => setCode(n)} onClose={() => setCode(null)} />}
      </AnimatePresence>
    </main>
  );
}
