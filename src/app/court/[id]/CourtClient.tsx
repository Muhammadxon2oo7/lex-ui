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
import { ease, modal } from '@/lib/motion';
import { useEffect, useEffectEvent, useState } from 'react';
import { HearingEnvelopeSchema, type HearingLine, type HearingSnapshot, type Speaker } from '@/contracts/hearing';
import { newId } from '@/game/api';
import { speak, stopSpeaking, type VoiceId } from '@/game/voice';
import { matchUtterance } from '@/lib/uz';
import { Talk } from '@/components/hud/Talk';
import { CodePanel } from '@/components/hud/CodePanel';

const VOICE: Partial<Record<Speaker, VoiceId>> = { secretary: 'female', claimant: 'male', respondent: 'female_alt', witness: 'elder_m' };

const CourtRoom = dynamic(() => import('@/components/world/CourtRoom'), { ssr: false });
const spring = ease.surface;

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
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[58dvh] bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

      {/* case card + order of the hearing so far */}
      <aside className="glass absolute top-4 left-4 flex max-h-[calc(100dvh-2rem)] w-[min(19rem,calc(100vw-2rem))] flex-col rounded-[20px] px-4 py-3" aria-label="Ish va majlis tartibi">
        <p className="text-[0.66rem] font-semibold tracking-[0.16em] text-amber-200 uppercase">Fuqarolik ishi · 1-instansiya</p>
        <h1 className="text-[1.02rem] leading-tight font-semibold">{hearing.caseTitle}</h1>
        <p className="mt-0.5 text-[0.74rem] leading-snug text-white/55">{hearing.parties.filter((p) => p.role !== 'judge').map((p) => `${p.label}: ${p.name}`).join(' · ')}</p>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Majlis bosqichlari" aria-valuemin={0} aria-valuemax={hearing.total} aria-valuenow={hearing.done.length}>
          <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${(hearing.done.length / hearing.total) * 100}%` }} />
        </div>
        <ol className="scroll-soft mt-2 hidden min-h-0 flex-1 space-y-1 overflow-y-auto text-[0.8rem] md:block">
          {hearing.done.map((d) => (
            <li key={d.article}>
              <button type="button" onClick={() => setCode(d.article)} className="flex w-full items-baseline gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/10">
                <span aria-hidden className={d.attempts === 1 ? 'text-emerald-300' : 'text-amber-300'}>✓</span>
                <span className="flex-1 leading-snug text-white/85">{d.label}</span>
                <span className="shrink-0 text-[0.7rem] text-white/50 tabular-nums">{d.article.replace('-modda', '')}-m.</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[0.68rem] leading-snug text-white/45">{hearing.caseNote}</p>
      </aside>

      <div className="absolute top-4 right-4 flex gap-2">
        <button type="button" className="glass btn !min-h-10 !px-4 text-[0.86rem]" onClick={() => setCode('')}><kbd>K</kbd> Kodeks</button>
        <Link href="/kampus" className="glass btn !min-h-10 !px-4 text-[0.86rem]">Zaldan chiqish</Link>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 pb-5 sm:px-8">
        <div className="min-h-[4.5rem] text-center select-text" onClick={skip}>
          {current && (
            current.speaker === 'system' ? (
              <p className="mx-auto max-w-[56ch] text-[1rem] leading-snug text-amber-100/95 italic [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">{current.text}</p>
            ) : (
              <>
                <p className={`text-[0.7rem] font-semibold tracking-[0.18em] uppercase ${current.speaker === 'judge' ? 'text-emerald-300' : 'text-amber-200'} [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]`}>{who ? `${who.label} · ${who.name}` : ''}</p>
                <p className="mx-auto mt-1 max-w-[52ch] text-[clamp(1.02rem,1.8vw,1.3rem)] leading-snug font-medium text-balance [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_2px_18px_rgba(0,0,0,0.85)]">{current.text}</p>
              </>
            )
          )}
          <p className="sr-only" role="log" aria-live="polite">{current ? `${who?.label ?? 'Vaziyat'}: ${current.text}` : ''}</p>
          {!idle && <p className="mt-1 text-[0.72rem] text-white/45"><kbd>Space</kbd> davom etish</p>}
        </div>

        <AnimatePresence>
          {hearing.feedback && !hearing.feedback.correct && idle && (
            <motion.p key={hearing.feedback.message} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} role="alert" className="mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl bg-[#5b1f1a]/90 px-4 py-2.5 text-[0.9rem]">
              {hearing.feedback.message}
              {hearing.feedback.article && <button type="button" className="rounded-full bg-white/15 px-3 py-1 text-[0.8rem] font-medium" onClick={() => setCode(hearing.feedback!.article)}>Moddani ochish</button>}
            </motion.p>
          )}
        </AnimatePresence>
        {error && <p role="alert" className="mx-auto rounded-full bg-danger px-4 py-2 text-[0.9rem]">{error}</p>}

        {canAct && (
          <div className="flex flex-wrap items-center gap-3">
            <Talk
              enabled={canAct}
              onHeard={(said) => {
                const match = matchUtterance(said, hearing.options);
                setHeard({ said, ok: Boolean(match) });
                if (match) choose(match.option.id);
              }}
              onError={(m) => setHeard({ said: m, ok: false, error: true })}
            />
            {heard && (
              <p className="text-[0.82rem] leading-snug text-white/65" role="status">
                {heard.error ? heard.said : heard.ok ? <>Eshitildi: «{heard.said}»</> : <>«{heard.said}» - mos protsessual harakat topilmadi. Aniqroq ayting yoki pastdan tanlang.</>}
              </p>
            )}
          </div>
        )}
        <div className="min-h-[14rem]">
          {canAct && (
            <div role="group" aria-label="Protsessual harakatlar">
              <p className="mb-1.5 text-[0.72rem] font-semibold tracking-[0.14em] text-white/55 uppercase">Raislik qiluvchi sifatida keyingi harakatingiz - ayting yoki tanlang</p>
              <ul className="space-y-1.5">
                {hearing.options.map((o, i) => (
                  <motion.li key={o.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: i * 0.045 }}>
                    <button type="button" onClick={() => choose(o.id)} className="glass flex min-h-11 w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-[0.985]">
                      <kbd className="mt-0.5">{i + 1}</kbd>
                      <span className="text-[0.93rem] leading-snug">{o.text}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

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
