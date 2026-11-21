'use client';
/**
 * Iqtisodiy sud — a court session run by the external court backend
 * (judge procedure tied to IPK, an LLM opposing advocate, Lex.uz RAG),
 * played in our own 3D courtroom with our own conventions:
 *
 *   · every line is presented in turn, in its speaker's voice, and the room
 *     follows it (the hall rises, the judge walks in from the service door);
 *   · the student answers in their own words — typed or spoken (T) — standing
 *     (G), and addresses the court «Hurmatli sud!»;
 *   · M asks the coach (−5 points); a long answer from the opposing advocate
 *     shows as «Raqib advokat javob tayyorlamoqda…» while we poll /events;
 *   · at the end the existing report page shows the assessment and debrief.
 *
 * The session lives on that server; our API routes adapt and validate it
 * (src/server/remote/court.ts). Nothing here talks to it directly.
 */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { CourtScene, Hint, Snapshot, Turn } from '@/contracts';
import type { Speaker } from '@/contracts/hearing';
import { ApiError, api, newId } from '@/game/api';
import { audio } from '@/game/audio';
import { useProfile } from '@/game/profile';
import { useGame } from '@/game/store';
import { lipTrack, speak, stopSpeaking, voiceStatus, type VoiceId } from '@/game/voice';
import { Talk } from '@/components/hud/Talk';
import { useDismiss } from '@/lib/useDismiss';

const CourtRoom = dynamic(() => import('@/components/world/CourtRoom'), { ssr: false });

const spring = { type: 'spring', bounce: 0, duration: 0.4 } as const;
type Role = NonNullable<Turn['role']>;
const VOICE: Record<Role, VoiceId> = { judge: 'elder_m', secretary: 'female', opponent: 'female_alt', witness: 'male', expert: 'male' };
/** Where each speaker sits in our courtroom: the other side's advocate at the right-hand table. */
const SEAT: Record<Role, Speaker> = { judge: 'judge', secretary: 'secretary', opponent: 'respondent', witness: 'witness', expert: 'witness' };
const LABEL: Record<Role, string> = { judge: 'Sudya', secretary: 'Sud majlisi kotibi', opponent: 'Raqib tomon vakili', witness: 'Guvoh', expert: 'Ekspert' };
const LEVEL = { beginner: 'boshlangʻich', intermediate: 'oʻrta', advanced: 'professional' } as const;
const EMPTY_SCENE: CourtScene = { judgeIn: false, everyoneStands: false, witnessIn: false };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Live procedure: what an advocate may do besides answering. The court recognises these from the words themselves. */
const MOVES = (other: string) => [
  { id: 'ask', label: 'Raqibga savol', start: `Hurmatli sud, ${other} vakilidan soʻramoqchiman: ` },
  { id: 'motion', label: 'Iltimosnoma', start: 'Hurmatli sud, iltimosnoma bilan chiqaman: ' },
  { id: 'object', label: 'Eʼtiroz', start: `Hurmatli sud, ${other} vakilining gapiga eʼtiroz bildiraman, chunki ` },
  { id: 'settle', label: 'Kelishuv', start: 'Hurmatli sud, kelishuv bitimi tuzishni taklif qilamiz: ' },
];

/** New lines one at a time, each in its speaker's voice; a reload replays only the latest batch. */
function usePresenter(turns: Turn[]) {
  const [heard, setHeard] = useState(() => {
    const lastYou = turns.findLastIndex((t) => t.speaker === 'user');
    return lastYou >= 0 ? lastYou + 1 : 0;
  });
  // the user's own lines are not replayed: the next line to present skips them
  let at = heard;
  while (turns[at]?.speaker === 'user') at++;
  const turn = turns[at];
  useEffect(() => {
    if (!turn || turn.speaker === 'user') return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const words = 900 + Math.min(turn.text.length, 200) * 38;
    // the judge walking in from the service door: nobody speaks until he is at his chair
    const walksIn = turn.scene?.judgeIn === true && !foldScene(turns.slice(0, at)).judgeIn && at > 0;
    const reading = Math.max(words, walksIn ? 5600 : 0);
    const voice = turn.speaker === 'npc' && turn.role ? VOICE[turn.role] : null;
    void (voice ? speak(turn.text, voice) : Promise.resolve(false)).then((spoken) => {
      if (!alive) return;
      if (!spoken && voice) lipTrack(turn.text, reading - 500);
      timer = setTimeout(() => setHeard(at + 1), spoken ? 300 : reading);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // a turn is identified by its id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn?.id]);
  return {
    heard: at,
    current: turns[Math.min(at, turns.length - 1)] as Turn | undefined,
    idle: at >= turns.length,
    skip: () => {
      stopSpeaking();
      setHeard(Math.min(at + 1, turns.length));
    },
  };
}

/** The room after these lines: each line may change who is in and who stands. */
function foldScene(turns: Turn[]): CourtScene & { entries: number } {
  let s = { ...EMPTY_SCENE, entries: 0 };
  for (const t of turns) {
    if (!t.scene) continue;
    if (t.scene.judgeIn && !s.judgeIn) s = { ...s, entries: s.entries + 1 };
    s = { ...s, ...t.scene };
  }
  return s;
}

export default function CourtSimClient() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.getSession(sessionId).then((s) => alive && setSnap(s), (e: unknown) => alive && setError(e instanceof ApiError ? e.message : 'Sessiyani ochib boʻlmadi'));
    return () => {
      alive = false;
    };
  }, [sessionId]);
  if (error && !snap) {
    return (
      <main className="grid h-dvh place-items-center bg-[#0c0f14] p-6 text-white">
        <div role="alert" className="max-w-md rounded-[28px] bg-[#0d121b] p-7 ring-1 ring-white/10">
          <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-amber-200 uppercase">Sud serveri</p>
          <h1 className="mt-2 text-[1.3rem] font-semibold">{error}</h1>
          <div className="mt-5 flex gap-2"><Link href="/hub" className="btn btn-primary">Orqaga</Link></div>
        </div>
      </main>
    );
  }
  if (!snap) return <main className="grid h-dvh place-items-center bg-[#0c0f14] text-[0.9rem] text-white/60">Sud zali tayyorlanmoqda…</main>;
  return (
    <MotionConfig reducedMotion="user">
      <Room key={snap.sessionId} initial={snap} />
    </MotionConfig>
  );
}

function Room({ initial }: { initial: Snapshot }) {
  const router = useRouter();
  const profile = useProfile();
  const id = initial.sessionId;
  const [snap, setSnap] = useState(initial);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitSince, setWaitSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hint, setHint] = useState<Hint | null>(null);
  const [heardSaid, setHeardSaid] = useState<string | null>(null);
  const alive = useRef(true);
  // (StrictMode mounts twice in development: the flag must come back on remount)
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  const { heard, current, idle, skip } = usePresenter(snap.turns);
  const scene = useMemo(() => foldScene(snap.turns.slice(0, Math.min(heard + 1, snap.turns.length))), [snap.turns, heard]);
  const standing = snap.standing ?? false;
  const respondentSide = snap.scenario.id.includes('javobgar');
  const tutorial = snap.mode === 'tutorial';
  // the level decides what is open: options (beginner, or revealed in intermediate), hints, immediate notes
  const level = snap.level ?? 'beginner';
  const hintsOn = tutorial && snap.hintsAllowed !== false;
  const options = snap.options;
  const canReveal = level === 'intermediate' && !snap.optionsRevealed && options.length === 0;
  const closed = snap.turns.some((t) => t.speaker === 'npc' && /majlisi yopi|Yakunlash tugmasini/i.test(t.text));
  const canSpeak = idle && !busy && !snap.pending && snap.status === 'in-progress';
  // the note on the last answer stays a few seconds, then gets out of the way of the next question
  const fbMsg = snap.feedback ? `${snap.feedback.optionId ?? ''}:${snap.feedback.message}` : null;
  const [fbGone, setFbGone] = useState<string | null>(null);
  useEffect(() => {
    if (!fbMsg) return;
    const t = setTimeout(() => setFbGone(fbMsg), 8000);
    return () => clearTimeout(t);
  }, [fbMsg]);
  const showFeedback = Boolean(snap.feedback && fbGone !== fbMsg);

  // the answer from the other side may come later (LLM): poll until it is there
  const settle = async (s: Snapshot) => {
    setSnap(s);
    if (!s.pending) return;
    setWaitSince(Date.now());
    let seq = s.sequence;
    while (alive.current) {
      await sleep(1500);
      const e = await api.events(id, seq);
      seq = e.snapshot.sequence;
      setSnap(e.snapshot);
      if (!e.snapshot.pending) break;
    }
    setWaitSince(null);
  };
  useEffect(() => {
    if (!initial.pending) return;
    // resume waiting once, on arrival (a reload while the other side was answering)
    const t = setTimeout(() => void settle(initial).catch(() => setWaitSince(null)), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!waitSince) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitSince]);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Kutilmagan xatolik');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  // the court server speaks only for students with a session there: ask again now that we have one
  useEffect(() => {
    void voiceStatus(true);
  }, []);

  const enter = () =>
    run(async () => {
      audio.unlock(useGame.getState().settings.volume);
      setSnap((await api.interact(id, 'start')).snapshot);
      setSnap((await api.interact(id, 'sit-at-desk')).snapshot);
    });

  // how the answer in the box came to be: spoken (T) or typed — reported with the turn
  const spoken = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  // a move chip writes the opening; the student finishes the sentence (caret at the end)
  const begin = (start: string) => {
    setDraft(start);
    requestAnimationFrame(() => {
      const el = box.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start.length, start.length);
    });
  };
  const send = (text: string) => {
    const said = text.trim();
    if (!said || !canSpeak) return;
    const clientTurnId = newId();
    const inputMode = spoken.current ? 'voice' : 'text';
    setDraft('');
    setHint(null);
    spoken.current = false;
    audio.tick();
    void run(async () => {
      try {
        setFbGone(null); // the same note may come again for a new answer
        await settle((await api.turn(id, clientTurnId, { text: said }, { inputMode })).snapshot);
      } catch (e) {
        setDraft(said); // nothing is lost: send it again (the same id would be answered once)
        throw e;
      }
    });
  };
  const choose = (optionId: string) => {
    if (!canSpeak) return;
    const clientTurnId = newId();
    setHint(null);
    audio.tick();
    setFbGone(null);
    void run(async () => settle((await api.turn(id, clientTurnId, { optionId }, { inputMode: 'option' })).snapshot));
  };
  const reveal = () =>
    run(async () => {
      audio.paper();
      setSnap((await api.interact(id, 'reveal-options')).snapshot);
    });

  // silence: past the level's limit with nothing said or typed, the court reacts (once per wait)
  const silenceSent = useRef<string | null>(null);
  const lastTurnId = snap.turns.at(-1)?.id ?? '';
  useEffect(() => {
    if (!canSpeak || !snap.silenceSec || draft.trim() || silenceSent.current === lastTurnId) return;
    const t = setTimeout(() => {
      silenceSent.current = lastTurnId;
      void api.interact(id, 'silence').then((r) => alive.current && setSnap(r.snapshot), () => {});
    }, snap.silenceSec * 1000);
    return () => clearTimeout(t);
  }, [canSpeak, snap.silenceSec, draft, lastTurnId, id]);

  const toggleStand = () =>
    run(async () => {
      audio.chair();
      setSnap((await api.interact(id, standing ? 'sit' : 'stand')).snapshot);
    });

  const askHint = () =>
    run(async () => {
      audio.paper();
      setHint(await api.hint(id));
    });

  const finish = () =>
    run(async () => {
      stopSpeaking();
      let s = (await api.finish(id)).snapshot;
      for (let i = 0; i < 60 && s.status !== 'report-ready' && alive.current; i++) {
        await sleep(1000);
        s = await api.getSession(id);
      }
      audio.chime();
      router.push(`/simulation/${id}/report`);
    });

  // browsers only allow sound after a gesture
  useEffect(() => {
    const unlock = () => audio.unlock(useGame.getState().settings.volume);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space' && !idle) {
      e.preventDefault();
      skip();
    } else if (e.code === 'KeyG' && snap.status === 'in-progress') void toggleStand();
    else if (e.code === 'KeyM' && hintsOn && canSpeak) void askHint();
    else if (canSpeak && options.length) {
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (i >= 0 && options[i]) choose(options[i].id);
    }
    else if (e.code === 'Escape') setHint(null);
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const role = current?.speaker === 'npc' ? current.role : undefined;
  const seat = !idle && role ? SEAT[role] : null;
  const crowd: Speaker[] = scene.everyoneStands ? ['secretary', 'claimant', 'respondent'] : seat === 'respondent' ? ['respondent'] : [];
  const waited = waitSince ? Math.max(0, Math.round((now - waitSince) / 1000)) : 0;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0c0f14] text-white select-none">
      <div className="absolute inset-0">
        <CourtRoom
          view="advocate"
          speaker={seat}
          witnessPresent={scene.witnessIn}
          witnessCalled={scene.witnessIn}
          standing={crowd}
          judgePresent={scene.judgeIn}
          judgeEntries={scene.entries}
          advocateStanding={standing}
          advocateSpeaking={!idle && current?.speaker === 'user'}
          avatar={profile?.avatar ?? 'man'}
          moods={seat && current?.emotion ? { [seat]: current.emotion } : undefined}
          labels={respondentSide ? { left: 'JAVOBGAR', right: 'DAʼVOGAR' } : { left: 'DAʼVOGAR', right: 'JAVOBGAR' }}
        />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[38dvh] bg-gradient-to-t from-black/60 to-transparent lg:inset-x-auto lg:right-0 lg:h-full lg:w-[42vw] lg:bg-gradient-to-l lg:from-black/55" />

      {/* ── top bar ── */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-start gap-3 p-3 sm:p-4">
        <div className="glass flex min-w-0 items-center gap-2 rounded-full py-1 pr-4 pl-1">
          <span className="grid h-9 shrink-0 place-items-center rounded-full bg-white px-3 text-[0.8rem] font-semibold text-[#0c0f14]">Iqtisodiy sud</span>
          <span className="truncate text-[0.84rem] text-white/80">{snap.scenario.title}</span>
          <span className={`ml-1 hidden shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold sm:inline ${snap.engine === 'llm' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-white/60'}`}
            title={snap.engine === 'llm' ? 'Raqib tomon javoblarini til modeli tuzmoqda' : 'Shablon javoblar'}>
            {snap.engine === 'llm' ? 'AI raqib' : 'Shablon'}
          </span>
        </div>
        <div className="glass ml-auto flex shrink-0 items-center gap-1 rounded-full p-1">
          {snap.status === 'in-progress' && (
            <button type="button" onClick={() => void finish()} disabled={busy || Boolean(snap.pending)}
              className={`min-h-9 rounded-full px-3.5 text-[0.84rem] font-semibold transition-colors duration-150 ${closed ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'text-white/80 hover:bg-white/12'}`}>
              Yakunlash
            </button>
          )}
          <Link href="/hub" aria-label="Chiqish" title="Chiqish" className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/12 hover:text-white" onClick={() => stopSpeaking()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>
          </Link>
        </div>
      </header>

      {/* ── dialogue dock ── */}
      {snap.status !== 'briefing' && (
        <section aria-label="Sud majlisi" className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-3xl px-3 pb-3 sm:px-4 sm:pb-5 lg:inset-x-auto lg:right-5 lg:bottom-5 lg:w-[min(31rem,36vw)] lg:max-w-none lg:p-0">
          <AnimatePresence>
            {waitSince && (
              <motion.p key="wait" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} role="status"
                className="mx-auto mb-2 flex w-fit items-center gap-2 rounded-full bg-[#1d2a44]/95 px-4 py-1.5 text-[0.84rem]">
                <span aria-hidden className="size-2 animate-pulse rounded-full bg-amber-300 motion-reduce:animate-none" />
                Raqib advokat javob tayyorlamoqda… <span className="text-white/50 tabular-nums">{waited} s</span>
              </motion.p>
            )}
            {snap.feedback && showFeedback && idle && !waitSince && (
              <motion.p key={`fb-${snap.feedback.message}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} role={snap.feedback.tone === 'bad' ? 'alert' : 'status'}
                className={`mx-auto mb-2 flex w-fit max-w-full items-center gap-2 rounded-full px-4 py-1.5 text-[0.84rem] ${snap.feedback.tone === 'bad' ? 'bg-[#6b221c]/95' : 'bg-[#163d2f]/95'}`}>
                <span className="min-w-0">{snap.feedback.message}</span>
                {snap.feedback.article && <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[0.76rem] font-semibold">{snap.feedback.article}</span>}
              </motion.p>
            )}
            {error && (
              <motion.p key="err" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} role="alert"
                className="mx-auto mb-2 w-fit max-w-full rounded-full bg-[#6b221c]/95 px-4 py-1.5 text-[0.84rem]">{error}</motion.p>
            )}
          </AnimatePresence>

          <div className="overflow-hidden rounded-[26px] bg-[#0d121b]/88 shadow-[0_24px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-xl">
            <button type="button" onClick={skip} disabled={idle} className="block w-full px-5 pt-4 pb-3 text-left disabled:cursor-default">
              <span className={`block text-[0.68rem] font-semibold tracking-[0.16em] uppercase ${current?.speaker === 'user' ? 'text-sky-300' : role === 'judge' ? 'text-emerald-300' : !role ? 'text-white/45' : 'text-amber-200'}`}>
                {!current || current.speaker === 'system' ? snap.scenario.briefing.workplace : current.speaker === 'user' ? 'Siz' : role ? LABEL[role] : ''}
              </span>
              <span className={`mt-1.5 block text-[1.12rem] leading-snug text-pretty ${!current || current.speaker === 'system' ? 'text-white/75 italic' : current.speaker === 'user' ? 'text-white/75' : 'text-white'}`}>
                {current?.text ?? 'Sud majlisi boshlanmoqda.'}
              </span>
              {current?.articles && current.articles.length > 0 && (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {current.articles.map((a) => (
                    <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="rounded-full bg-white/10 px-2.5 py-0.5 text-[0.74rem] font-semibold text-white/80 hover:bg-white/15">{a.label} ↗</a>
                  ))}
                </span>
              )}
              {!idle && <span className="mt-1 block text-right text-[0.7rem] text-white/40">Space — davom</span>}
            </button>
            <p className="sr-only" role="log" aria-live="polite">{current ? `${current.speaker === 'user' ? 'Siz' : role ? LABEL[role] : ''}: ${current.text}` : ''}</p>

            {snap.status === 'in-progress' && canSpeak && options.length > 0 && (
              <ul role="group" aria-label="Javob variantlari" className="border-t border-white/8 px-2 py-2">
                {options.map((o, i) => (
                  <motion.li key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.035 }}>
                    <button type="button" onClick={() => choose(o.id)}
                      className="flex min-h-11 w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition-[background-color,transform] duration-150 hover:bg-white/[0.08] active:scale-[0.99]">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-white/10 text-[0.7rem] font-semibold tabular-nums text-white/70">{i + 1}</span>
                      <span className="text-[0.92rem] leading-snug text-white/90">{o.text}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
            {snap.status === 'in-progress' && (
              <form className="border-t border-white/8 px-3 pt-3 pb-2.5" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
                {level !== 'advanced' && canSpeak && !draft.trim() && (
                  <div role="group" aria-label="Protsessual harakatlar" className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 scrollbar-none">
                    {MOVES(respondentSide ? 'daʼvogar' : 'javobgar').map((m) => (
                      <button key={m.id} type="button" onClick={() => begin(m.start)} title={m.start.trim()}
                        className="min-h-8 shrink-0 rounded-full bg-white/[0.07] px-3 text-[0.8rem] font-medium whitespace-nowrap text-white/75 transition-[background-color,transform] duration-150 hover:bg-white/12 hover:text-white active:scale-[0.97] pointer-coarse:min-h-10">
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
                <label className="sr-only" htmlFor="court-answer">Sudga javobingiz</label>
                <textarea ref={box} id="court-answer" value={draft} rows={2} maxLength={800} disabled={!canSpeak}
                  onChange={(e) => {
                    if (!draft.trim()) spoken.current = false; // typing a fresh answer
                    setDraft(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(draft);
                    }
                  }}
                  placeholder={canSpeak ? (options.length ? 'Variantni tanlang (1–4) yoki oʻzingiz ayting…' : 'Hurmatli sud, …   (Enter — yuborish, T — aytish)') : snap.pending ? 'Raqib tomon javobini kuting…' : 'Gapni tinglang…'}
                  className="w-full resize-none rounded-2xl bg-white/[0.07] px-3.5 py-2.5 text-[0.98rem] leading-snug text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Talk enabled={canSpeak} onError={(m) => setHeardSaid(m)}
                    onHeard={(said) => {
                      spoken.current = true;
                      setHeardSaid(`«${said}» — tekshirib, yuboring`);
                      setDraft((d) => (d ? `${d} ${said}` : said));
                    }} />
                  <p className="min-w-0 flex-1 truncate text-[0.78rem] text-white/55" role="status">
                    {heardSaid ?? (standing ? 'Tik turibsiz' : 'Sudga tik turib murojaat qilinadi — G')}
                  </p>
                  {canReveal && (
                    <button type="button" onClick={() => void reveal()} disabled={!canSpeak} title="Shu bosqich uchun javob variantlarini ochadi (−10 ball)"
                      className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[0.84rem] font-medium hover:bg-white/15 disabled:opacity-50">
                      Variantlar<span className="text-[0.74rem] text-white/50 tabular-nums">−10</span>
                    </button>
                  )}
                  {hintsOn && (
                    <button type="button" onClick={() => void askHint()} disabled={!canSpeak} title="Nima deyish kerakligini koʻrsatadi (−5 ball)"
                      className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[0.84rem] font-medium hover:bg-white/15 disabled:opacity-50">
                      <kbd className="!bg-white/20">M</kbd>Maslahat<span className="text-[0.74rem] text-white/50 tabular-nums">−5</span>
                    </button>
                  )}
                  <button type="button" onClick={() => void toggleStand()} disabled={busy}
                    className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.88rem] font-semibold transition-colors duration-150 ${standing ? 'bg-white/10 hover:bg-white/15' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}>
                    <kbd className="!bg-white/20">G</kbd>{standing ? 'Oʻtirish' : 'Oʻrnidan turish'}
                  </button>
                  <button type="submit" disabled={!canSpeak || !draft.trim()} className="btn btn-primary !min-h-11">Yuborish</button>
                </div>
              </form>
            )}
            {snap.status === 'evaluating' && <p className="border-t border-white/8 px-5 py-3 text-[0.88rem] text-white/70" role="status">Hisobot tayyorlanmoqda…</p>}
            {snap.status === 'report-ready' && (
              <div className="border-t border-white/8 px-3 py-2.5"><Link href={`/simulation/${id}/report`} className="btn btn-primary">Hisobotni ochish →</Link></div>
            )}
          </div>
        </section>
      )}

      <AnimatePresence>
        {snap.status === 'briefing' && <Briefing key="brief" snap={snap} busy={busy} onEnter={() => void enter()} />}
        {hint && <HintSheet key="hint" hint={hint} onUse={(text) => { setDraft(text); setHint(null); }} onClose={() => setHint(null)} />}
      </AnimatePresence>
    </main>
  );
}

/** Before the hall: who you are, what you know (also what only you know), what is asked of you. */
function Briefing({ snap, busy, onEnter }: { snap: Snapshot; busy: boolean; onEnter: () => void }) {
  const b = snap.scenario.briefing;
  const SECRET = /^\s*Maxfiy\b[^:]*:\s*/i;
  const secret = b.authority.filter((a) => SECRET.test(a)).map((a) => a.replace(SECRET, '').replace(/^./, (c) => c.toUpperCase()));
  const open = b.authority.filter((a) => !SECRET.test(a));
  return (
    <div className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px]">
      <motion.section initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} transition={spring}
        role="dialog" aria-modal="true" aria-labelledby="brief-title" className="w-full max-w-[36rem] rounded-[28px] bg-[#f7f6f2] p-6 text-[#14171f] shadow-[0_40px_120px_rgba(0,0,0,0.5)] select-text">
        <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-black/45 uppercase">{b.workplace} · {snap.scenario.durationMinutes} daqiqa · {snap.mode === 'tutorial' ? 'mashq' : 'baholash'} · {LEVEL[snap.level ?? 'beginner']}</p>
        <h2 id="brief-title" className="mt-1 text-[1.35rem] leading-tight font-semibold">{snap.scenario.title}</h2>
        <p className="mt-1 text-[0.95rem] font-medium">Siz — {b.position}</p>
        <ul className="mt-4 space-y-1.5 text-[0.92rem] leading-snug">
          {b.task.map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="text-emerald-600">•</span><span>{t}</span></li>)}
        </ul>
        {/* the role's papers are part of the task; only the "Maxfiy" notes are the secret box (their own label stripped) */}
        {open.length > 0 && (
          <ul className="mt-1.5 space-y-1.5 text-[0.92rem] leading-snug">
            {open.map((a) => <li key={a} className="flex gap-2"><span aria-hidden className="text-emerald-600">•</span><span>{a}</span></li>)}
          </ul>
        )}
        {secret.length > 0 && (
          <div className="mt-4 rounded-2xl bg-amber-500/10 px-4 py-3 text-[0.88rem] leading-snug">
            <p className="text-[0.68rem] font-semibold tracking-[0.12em] text-amber-800 uppercase">Faqat siz bilasiz</p>
            {secret.map((a) => <p key={a} className="mt-1 text-pretty">{a}</p>)}
          </div>
        )}
        <ul className="mt-4 space-y-1 text-[0.82rem] text-black/60">
          <li>• {snap.level === 'advanced' ? 'Javobni faqat oʻzingiz aytasiz yoki yozasiz — variant va maslahat yoʻq; tahlil oxirida.' : snap.level === 'intermediate' ? 'Javobni oʻzingiz aytasiz yoki yozasiz; kerak boʻlsa variantlarni ochasiz (−10).' : 'Variantni tanlang (1–4) yoki oʻz soʻzingiz bilan ayting/yozing.'} <kbd className="!border-black/10 !bg-black/5">T</kbd> — ovoz.</li>
          <li>• Sudga tik turib (<kbd className="!border-black/10 !bg-black/5">G</kbd>) va «Hurmatli sud!» deb murojaat qilinadi.</li>
          {snap.mode === 'tutorial' && snap.hintsAllowed !== false && <li>• <kbd className="!border-black/10 !bg-black/5">M</kbd> maslahat — nima deyish kerakligini koʻrsatadi (−5 ball).</li>}
          {snap.engine === 'llm' && snap.level === 'advanced' && <li>• Kutilmagan dalilga raqib tomon javobini til modeli tuzadi — bunday paytda biroz kutiladi.</li>}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={onEnter} disabled={busy} autoFocus>{busy ? 'Kirilmoqda…' : 'Majlis zaliga kirish'}</button>
          <Link href="/hub" className="btn btn-quiet">Orqaga</Link>
        </div>
        <p className="mt-4 text-[0.7rem] leading-snug text-black/40">{snap.scenario.disclaimer}</p>
      </motion.section>
    </div>
  );
}

/** The coach: what to do now, the usual mistake, and an example you may put in your answer (never sent for you). */
function HintSheet({ hint, onUse, onClose }: { hint: Hint; onUse: (text: string) => void; onClose: () => void }) {
  const dismiss = useDismiss(onClose);
  return (
    <motion.div {...dismiss} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring} className="absolute inset-0 z-40">
      <motion.aside initial={{ x: -16 }} animate={{ x: 0 }} transition={spring} aria-label="Maslahat"
        className="absolute top-20 left-3 w-[min(24rem,calc(100vw-1.5rem))] rounded-[22px] bg-[#0d121b]/95 p-4 text-[0.88rem] leading-snug ring-1 ring-white/10 backdrop-blur-xl select-text sm:left-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.66rem] font-semibold tracking-[0.16em] text-amber-200 uppercase">Maslahat · {hint.title}</p>
            <p className="mt-1.5 text-white/90">{hint.todo}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Yopish" className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">✕</button>
        </div>
        {hint.commonMistake && <p className="mt-2.5 rounded-xl bg-red-500/10 px-3 py-2 text-[0.84rem] text-red-100/90"><span className="font-semibold">Koʻp uchraydigan xato: </span>{hint.commonMistake}</p>}
        {hint.example && (
          <div className="mt-2.5 rounded-xl bg-white/[0.06] px-3 py-2">
            <p className="text-[0.84rem] text-white/80">«{hint.example}»</p>
            <button type="button" onClick={() => onUse(hint.example!)} className="mt-2 rounded-full bg-white/12 px-3 py-1 text-[0.8rem] font-semibold hover:bg-white/18">Namunani javobga qoʻyish</button>
          </div>
        )}
        {hint.sources.length > 0 && (
          <p className="mt-2.5 flex flex-wrap gap-1.5">
            {hint.sources.map((s) => <a key={s.officialUrl + s.title} href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/10 px-2.5 py-0.5 text-[0.74rem] text-white/75 hover:bg-white/15">{s.articleNumber ?? s.title} ↗</a>)}
          </p>
        )}
      </motion.aside>
    </motion.div>
  );
}
