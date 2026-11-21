'use client';
/**
 * "Ish yoʻli" - one room of the case. Screen layout, kept deliberately calm:
 *   top    - one bar: the five stages (jump to any), case folder, Code, exit;
 *   bottom - one dialogue dock: who speaks, the line, your replies, mic.
 * Everything else (claim desk, rulings, results) appears as a single
 * focused sheet and goes away again.
 */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ease, modal } from '@/lib/motion';
import { Drawer } from '@/components/ui/Drawer';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { CaseEnvelopeSchema, StageIdSchema, type CaseActRequest, type CaseLine, type CaseSnapshot, type CaseSpeaker, type ClaimDraft, type Ruling, type StageId } from '@/contracts/case';
import { newId } from '@/game/api';
import { audio } from '@/game/audio';
import { getProfile, useProfile } from '@/game/profile';
import { type VoiceId, lipTrack, prefetchLine, speak, stopSpeaking, dropVoice, takeVoice, takeConfidence } from '@/game/voice';
import { matchUtterance } from '@/lib/uz';
import { CodePanel } from '@/components/hud/CodePanel';
import { Talk } from '@/components/hud/Talk';
import { ClaimEditor } from '@/components/case/ClaimEditor';
import type { PaperModel } from '@/components/case/paper';
import { deskDocs, type DeskDoc } from '@/components/case/documents';
import { HandView } from '@/components/case/HandView';
import { useDismiss } from '@/lib/useDismiss';
import { useGame } from '@/game/store';
import { statementsFor } from '@/lib/xapi';
import { clearVoices, saveVoice } from '@/lib/voiceStore';
import { PracticeRecord } from '@/components/record/PracticeRecord';
import type { RecordLine, RecordMeta } from '@/game/practiceRecord';

const CaseScene = dynamic(() => import('@/components/case/CaseScene'), { ssr: false });
const spring = ease.surface;

async function call(path: string, body?: unknown): Promise<CaseSnapshot> {
  const res = await fetch(`/api/v1/cases${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    // a stuck request must not freeze the room: fail, show the error, let the student retry
    signal: AbortSignal.timeout(15_000),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json as { error?: { message?: string } } | null)?.error?.message ?? 'Kutilmagan xatolik');
  const parsed = CaseEnvelopeSchema.safeParse(json);
  if (!parsed.success) throw new Error('Server javobi kontraktga mos emas');
  return parsed.data.case;
}

type Act = CaseActRequest extends infer T ? (T extends { clientActionId: string } ? Omit<T, 'clientActionId'> : never) : never;

export default function CaseClient() {
  const { id, stage: raw } = useParams<{ id: string; stage: string }>();
  const stage = StageIdSchema.safeParse(raw).success ? (raw as StageId) : null;
  const [snap, setSnap] = useState<CaseSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!stage) return;
    let cancelled = false;
    call(`/${id}/act`, { type: 'enter', stage, clientActionId: newId() }).then(
      (s) => !cancelled && setSnap(s),
      (e: Error) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [id, stage, round]);

  if (!stage || (error && !snap)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#0c0f14] p-6 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">Xonaga kirib boʻlmadi</h1>
          <p className="mt-2 max-w-md text-white/65">{error ?? 'Bunday xona yoʻq.'}</p>
          <Link href="/kampus" className="btn btn-primary mt-6">Terminalga qaytish</Link>
        </div>
      </main>
    );
  }
  if (!snap || snap.stage !== stage) return <main className="grid min-h-dvh place-items-center bg-[#0c0f14] text-white/70" role="status">Xona tayyorlanmoqda…</main>;

  const act = async (input: Act) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setSnap(await call(`/${id}/act`, { ...input, clientActionId: newId() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <Room key={`${stage}:${round}`} snap={snap} stage={stage} busy={busy} error={error} act={act} replay={() => { setSnap(null); setRound((r) => r + 1); }} />
    </MotionConfig>
  );
}

/** New lines one at a time, each in its speaker's voice; on reload only the latest batch replays. */
function usePresenter(lines: CaseLine[], voices: Partial<Record<CaseSpeaker, VoiceId>>) {
  const [heard, setHeard] = useState(() => {
    const lastYou = lines.findLastIndex((l) => l.speaker === 'you');
    return lastYou >= 0 ? lastYou + 1 : 0;
  });
  const line = lines[heard];
  useEffect(() => {
    if (!line) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const voice = voices[line.speaker];
    const words = line.speaker === 'you' ? 450 + Math.min(line.text.length, 160) * 10 : 900 + Math.min(line.text.length, 180) * 38;
    // someone walking in (the judge through the service door, a witness down the aisle):
    // nobody speaks until they have reached their place
    const prev = lines[heard - 1];
    const judgeWalks = line.scene.judgeIn && prev && !prev.scene.judgeIn;
    const witnessWalks = line.scene.witnessIn && prev && !prev.scene.witnessIn;
    const reading = Math.max(words, judgeWalks ? 5600 : witnessWalks ? 7200 : 0);
    // the lines that follow are fetched while this one plays (no wait between speakers)
    for (const n of lines.slice(heard + 1, heard + 4)) if (voices[n.speaker]) void prefetchLine(n.text, voices[n.speaker]!, n.emotion);
    // whoever walks in speaks at their place, not on the way
    const walk = voice ? (judgeWalks ? 4800 : witnessWalks ? 6400 : 0) : 0;
    const next = lines[heard + 1];
    // a breath between lines: the same speaker goes on quickly, a new one answers after a beat
    const pause = !next || next.speaker === 'you' ? 150 : next.speaker === line.speaker ? 240 : 560;
    void new Promise<void>((r) => (walk ? (timer = setTimeout(r, walk)) : r()))
      .then(() => (alive && voice ? speak(line.text, voice, line.emotion) : false))
      .then((spoken) => {
        if (!alive) return;
        // no audible voice: the mouth still forms the words, over the subtitle's reading time
        if (!spoken && voice) lipTrack(line.text, reading - 500);
        timer = setTimeout(() => setHeard((h) => h + 1), spoken ? pause : reading);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // a line is identified by its id; a new snapshot with the same lines must not restart it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.id]);
  return {
    current: lines[Math.min(heard, lines.length - 1)] as CaseLine | undefined,
    idle: heard >= lines.length,
    speaker: line ? line.speaker : null,
    skip: () => {
      stopSpeaking();
      setHeard((h) => Math.min(h + 1, lines.length));
    },
  };
}

function Room({ snap, stage, busy, error, act, replay }: { snap: CaseSnapshot; stage: StageId; busy: boolean; error: string | null; act: (a: Act) => Promise<void>; replay: () => void }) {
  const router = useRouter();
  const profile = useProfile();
  // each party speaks in the voice the case gives them
  const voices = Object.fromEntries(snap.parties.filter((x) => x.voice).map((x) => [x.role, x.voice])) as Partial<Record<CaseSpeaker, VoiceId>>;
  const { current, idle, speaker, skip } = usePresenter(snap.lines, voices);
  const [code, setCode] = useState<string | null>(null);
  const [folder, setFolder] = useState(false);
  const [heard, setHeard] = useState<{ said: string; ok: boolean } | null>(null);
  const [paper, setPaper] = useState<PaperModel | null>(null);
  // the papers on the desk, and the one in your hands
  const docs = useMemo(() => deskDocs(snap, stage), [snap, stage]);
  const [inHand, setInHand] = useState<DeskDoc | null>(null);
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [seenRulings, setSeenRulings] = useState(snap.rulings.length);
  // informational notes (not mistakes) fade away on their own after a few seconds
  const [faded, setFaded] = useState<string | null>(null);
  const infoSeen = snap.feedback?.tone === 'info' && faded === snap.feedback.message;
  useEffect(() => {
    const note = snap.feedback;
    if (note?.tone !== 'info' || !idle) return;
    const t = setTimeout(() => setFaded(note.message), 6000);
    return () => clearTimeout(t);
  }, [snap.feedback, idle]);
  const [openRuling, setOpenRuling] = useState<Ruling | null>(null);
  const def = snap.stages.find((s) => s.id === stage)!;
  const party = (role: CaseSpeaker) => snap.parties.find((p) => p.role === role);
  const pendingRuling = idle && snap.rulings.length > seenRulings ? snap.rulings[snap.rulings.length - 1] : null;
  const ruling = openRuling ?? pendingRuling;
  const courtroom = stage === 'hearing';
  const drafting = snap.await === 'draft' && idle;
  const finished = snap.stageDone && idle && !ruling;
  // the room waits for an answer - options may be hidden at higher levels, own words are always welcome
  const canAnswer = idle && !busy && !snap.stageDone && snap.answering && !ruling;
  const [said, setSaid] = useState('');

  const chimed = useRef(seenRulings);
  useEffect(() => {
    if (pendingRuling && chimed.current < snap.rulings.length) {
      chimed.current = snap.rulings.length;
      // the court's seal on the new ruling, then the sheet handed over
      audio.stamp();
      setTimeout(() => audio.paper(), 260);
    }
  }, [pendingRuling, snap.rulings.length]);

  // a hint: the article the right answer rests on (costs 5 points; the debrief counts them)
  /** An answer in own words (typed or spoken): understood on the server. */
  const sayOwn = (text: string, inputMode: 'text' | 'voice') => {
    const t = text.trim();
    if (!t) return;
    audio.tick();
    setSaid('');
    // the student's own voice goes into this room's practice record
    const wav = inputMode === 'voice' ? takeVoice() : (dropVoice(), null);
    if (wav) void saveVoice(`${snap.caseId}:${stage}`, t, wav);
    const confidence = takeConfidence();
    void act({ type: 'say', text: t, inputMode, ...(inputMode === 'voice' && confidence !== null ? { stt: { confidence } } : {}) });
  };
  const askHint = () => {
    audio.paper();
    void act({ type: 'hint' });
  };
  // a choice made on screen answers with a quiet tap
  const choose = (optionId: string) => {
    dropVoice();
    audio.tick();
    void act({ type: 'choose', optionId });
  };
  // the end of a room is marked by a soft chime
  useEffect(() => {
    if (finished) audio.chime();
  }, [finished]);
  // browsers only allow sound after a gesture: the first press or key in the room unlocks it
  useEffect(() => {
    const unlock = () => audio.unlock(useGame.getState().settings.volume);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  // you knock before walking into a judge's or an investigator's office
  useEffect(() => {
    if (snap.kind === 'labour' ? stage === 'chamber' : stage === 'interview' || stage === 'complaint') setTimeout(() => audio.knock(), 400);
  }, [stage, snap.kind]);

  const toggleStand = () => {
    if (!courtroom || busy || snap.stageDone) return;
    audio.chair();
    void act({ type: 'stand', up: !snap.standing });
  };
  const leave = () => {
    stopSpeaking();
    void act({ type: 'leave' });
    router.push('/kampus');
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (inHand) return; // the hand view has its own keys
    if (e.code === 'KeyK') setCode(code === null ? '' : null);
    else if (e.code === 'KeyH') setFolder((f) => !f);
    else if (e.code === 'Escape') {
      setCode(null);
      setFolder(false);
    } else if (e.code === 'KeyG') toggleStand();
    else if (e.code === 'KeyM' && canAnswer && snap.level !== 'advanced') askHint();
    else if (e.code === 'Space' && !ruling && !drafting) {
      e.preventDefault();
      skip();
    } else if (canAnswer && code === null) {
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (i >= 0 && snap.options[i]) choose(snap.options[i].id);
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const who = current && current.speaker !== 'system' && current.speaker !== 'you' ? party(current.speaker) : null;
  const handed = snap.lines.some((l) => l.speaker === 'clerk' && l.text.includes('Roʻyxat raqami'));
  const nextStage = snap.stages[def.number] ?? null;
  // on a phone the stage strip scrolls: keep the current room's pill fully in view
  const stagesNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = stagesNav.current;
    const pill = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (nav && pill) nav.scrollTo({ left: pill.offsetLeft - (nav.clientWidth - pill.offsetWidth) / 2, behavior: 'instant' });
  }, [stage]);
  const prompt = courtroom && idle && !snap.stageDone && snap.await
    ? snap.await === 'stand' ? (snap.standing ? null : 'Zaldagilar oʻrnidan turmoqda - siz ham turing') : snap.standing ? 'Endi oʻtirishingiz mumkin' : null
    : null;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0c0f14] text-white select-none">
      <div className="absolute inset-0">
        <CaseScene stage={stage} docs={docs} onInspect={setInHand} onHover={setHoverName} avatar={profile?.avatar ?? 'man'} paper={paper} line={idle ? undefined : current} speaker={idle ? null : speaker} scene={idle || !current ? snap.scene : current.scene} standing={snap.standing}
          cues={{ papers: stage === 'consult' ? snap.evidence.length : 0, handed, signed: snap.facts.some((f) => f.id === 'authority') }} />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[38dvh] bg-gradient-to-t from-black/60 to-transparent lg:inset-x-auto lg:right-0 lg:h-full lg:w-[42vw] lg:bg-gradient-to-l lg:from-black/55" />

      {/* what your hand is over */}
      <AnimatePresence>
        {hoverName && !inHand && (
          <motion.p key="hover" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}
            className="hud pointer-events-none absolute top-20 left-1/2 z-20 -translate-x-1/2 rounded-full px-4 py-1.5 text-[0.84rem]">
            {hoverName} - <span className="text-white/65">bosing: qoʻlga olish · sudrang: joyini oʻzgartirish</span>
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── top bar ── */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-start gap-3 p-3 sm:p-4">
        <nav ref={stagesNav} aria-label="Ish bosqichlari" className="glass flex min-w-0 items-center gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none]">
          {snap.stages.map((s) => {
            const here = s.id === stage;
            return (
              <Link key={s.id} href={`/ish/${snap.caseId}/${s.id}`} aria-current={here ? 'step' : undefined} title={`${s.number}. ${s.place} - ${s.title}`}
                className={`relative flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-[0.82rem] font-medium transition-colors duration-200 ${here ? 'text-[#0c0f14]' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
                {here && <motion.span layoutId="stage-lens" transition={ease.droplet} aria-hidden className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2),0_6px_16px_-6px_rgb(0_0_0/0.4)]" />}
                <span className={`relative grid size-5 place-items-center rounded-full text-[0.7rem] font-bold tabular-nums ${here ? 'bg-[#0c0f14] text-white' : s.status === 'done' ? 'bg-emerald-500 text-white' : s.status === 'returned' ? 'bg-red-500 text-white' : 'bg-white/15'}`}>
                  {s.status === 'done' && !here ? (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="bajarilgan"><path d="M2.5 6.4 5 8.8l4.5-5.3" /></svg>
                  ) : s.number}
                </span>
                <span className={`relative ${here ? 'inline' : 'hidden xl:inline'}`}>{s.place}</span>
              </Link>
            );
          })}
        </nav>
        <div className="glass ml-auto flex shrink-0 items-center gap-1 rounded-full p-1">
          <IconButton label="Ish papkasi" hotkey="H" onClick={() => { audio.paper(); setFolder(true); }}>
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </IconButton>
          <IconButton label="Kodeks" hotkey="K" onClick={() => { audio.paper(); setCode(''); }}>
            <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7M8 11h7" />
          </IconButton>
          <IconButton label="Terminalga chiqish" onClick={leave}>
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
          </IconButton>
        </div>
      </header>

      {/* ── prebrief: role, task, how it is scored - until the first answer ── */}
      <AnimatePresence>
        {!drafting && !finished && !snap.lines.some((l) => l.speaker === 'you') && (
          <Prebrief key={`brief-${stage}`} id={`${snap.caseId}:${stage}`} role={snap.parties.find((p) => p.role === 'you')?.label ?? 'Advokat'} stage={def} courtroom={courtroom} level={snap.level} />
        )}
      </AnimatePresence>

      {/* ── dialogue dock ── */}
      <AnimatePresence>
        {!drafting && !finished && (
          <motion.section key="dock" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={spring} aria-label="Suhbat"
            className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-3xl px-3 pb-3 sm:px-4 sm:pb-5 lg:inset-x-auto lg:right-5 lg:bottom-5 lg:w-[min(31rem,36vw)] lg:max-w-none lg:p-0">
            <AnimatePresence>
              {snap.feedback && idle && !ruling && !(snap.feedback.tone === 'info' && infoSeen) && (
                <motion.p key={snap.feedback.message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} role={snap.feedback.tone === 'bad' ? 'alert' : 'status'}
                  className="hud mx-auto mb-2 flex w-fit max-w-full items-center gap-2 rounded-full py-1.5 pr-2 pl-3 text-[0.84rem]">
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${snap.feedback.tone === 'bad' ? 'bg-red-400 shadow-[0_0_10px_rgb(248_113_113/0.8)]' : 'bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153/0.8)]'}`} />
                  <span className="min-w-0">{snap.feedback.message}</span>
                  {snap.feedback.article && <button type="button" className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[0.76rem] font-semibold" onClick={() => setCode(snap.feedback!.article)}>{snap.feedback.article}</button>}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div layout="size" transition={ease.surface} className="hud hud-strong overflow-hidden rounded-[28px]">
              <button type="button" onClick={skip} disabled={idle} className="block w-full px-5 pt-4 pb-3 text-left disabled:cursor-default">
                <span className={`block text-[0.68rem] font-semibold tracking-[0.16em] uppercase ${current?.speaker === 'you' ? 'text-sky-300' : current?.speaker === 'judge' ? 'text-emerald-300' : current?.speaker === 'system' || !current ? 'text-white/45' : 'text-amber-200'}`}>
                  {!current || current.speaker === 'system' ? `${def.number}. ${def.place}` : current.speaker === 'you' ? 'Siz' : who ? `${who.label} · ${who.name}` : ''}
                </span>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={current ? `${current.speaker}:${current.text}` : 'goal'} initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -4 }} transition={ease.surface}
                    className={`mt-1.5 block text-[1.12rem] leading-snug text-pretty ${!current || current.speaker === 'system' ? 'text-white/75 italic' : current.speaker === 'you' ? 'text-white/80' : 'text-white'}`}>
                    {current?.text ?? def.goal}
                  </motion.span>
                </AnimatePresence>
                {!idle && <span className="mt-1 block text-right text-[0.7rem] text-white/40">Space - davom</span>}
              </button>
              <p className="sr-only" role="log" aria-live="polite">{current ? `${current.speaker === 'you' ? 'Siz' : who?.label ?? ''}: ${current.text}` : ''}</p>

              {canAnswer && snap.options.length > 0 && (
                <ul role="group" aria-label="Javoblar" className="border-t border-white/[0.07] px-2 py-2">
                  {snap.options.map((o, i) => (
                    <motion.li key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.035 }}>
                      <button type="button" onClick={() => choose(o.id)}
                        className="hud-row flex min-h-11 w-full items-start gap-3 rounded-[18px] px-3 py-2.5 text-left">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] bg-white/12 text-[0.7rem] font-semibold tabular-nums text-white/75 shadow-[inset_0_-1px_0_rgb(0_0_0/0.3)]">{i + 1}</span>
                        <span className={`text-[0.92rem] leading-snug ${o.kind === 'act' ? 'font-medium text-sky-200' : 'text-white/90'}`}>{o.kind === 'act' ? `→ ${o.text}` : o.text}</span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}

              {canAnswer && (
                // one row for one's own words: speak (hold the mic or T) or type
                <form className="flex items-center gap-2 border-t border-white/[0.07] px-3 py-2.5" onSubmit={(e) => { e.preventDefault(); sayOwn(said, 'text'); }}>
                  <Talk compact enabled={canAnswer} onError={(m) => setHeard({ said: m, ok: false })}
                    onHeard={(spoken) => {
                      // an exact option read aloud is that option; anything else is understood on the server
                      const match = snap.options.length ? matchUtterance(spoken, snap.options) : null;
                      setHeard({ said: `«${spoken}»`, ok: true });
                      if (match) choose(match.option.id);
                      else sayOwn(spoken, 'voice');
                    }} />
                  <label className="sr-only" htmlFor="own-answer">Oʻz soʻzingiz bilan javob</label>
                  <div className="relative flex min-w-0 flex-1 items-center rounded-full bg-white/[0.08] shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.08)] transition-[background-color,box-shadow] duration-200 focus-within:bg-white/[0.11] focus-within:shadow-[inset_0_0_0_1px_rgb(52_211_153/0.7)]">
                    <input id="own-answer" value={said} onChange={(e) => setSaid(e.target.value)} maxLength={800} autoComplete="off"
                      placeholder={courtroom ? 'Hurmatli sud, …' : snap.options.length ? 'Yoki oʻz soʻzingiz bilan…' : 'Oʻz soʻzingiz bilan…'}
                      className="min-h-11 min-w-0 flex-1 bg-transparent pr-12 pl-4 text-[0.95rem] text-white outline-none placeholder:text-white/40 focus-visible:outline-none" />
                    <AnimatePresence>
                      {said.trim() && (
                        <motion.button key="send" type="submit" disabled={busy} aria-label="Yuborish" title="Yuborish (Enter)"
                          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={ease.droplet} whileTap={{ scale: 0.9 }}
                          className="absolute right-1 grid size-9 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_4px_12px_-2px_rgb(16_185_129/0.6)] disabled:opacity-50">
                          <svg aria-hidden width="14" height="14" viewBox="0 0 14 14"><path d="M7 12V2.5M2.8 6.5 7 2.3l4.2 4.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </form>
              )}
              {(canAnswer || (courtroom && idle && !snap.stageDone)) && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.07] px-3 py-2.5">
                  {/* what was heard, or what the room expects now - wraps instead of being cut off */}
                  <p className={`min-w-0 flex-1 basis-40 text-[0.8rem] leading-snug text-pretty ${heard && !heard.ok && !prompt ? 'text-amber-200' : 'text-white/60'}`} role="status">
                    {prompt ?? heard?.said ?? (canAnswer ? <><span className="pointer-coarse:hidden"><kbd className="bg-white/15!">T</kbd> yoki </span>mikrofonni bosib turib gapiring</> : '')}
                  </p>
                  {canAnswer && snap.level === 'intermediate' && !snap.revealed && snap.options.length === 0 && (
                    <button type="button" onClick={() => { audio.paper(); void act({ type: 'reveal' }); }} disabled={busy} title="Shu lahza uchun javob variantlarini ochadi (−10 ball)"
                      className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[0.84rem] font-medium transition-colors duration-150 hover:bg-white/15">
                      Variantlar<span className="text-[0.74rem] text-white/50 tabular-nums">−10</span>
                    </button>
                  )}
                  {canAnswer && snap.level !== 'advanced' && (
                    <button type="button" onClick={askHint} disabled={busy} title="Toʻgʻri javob tayanadigan moddani koʻrsatadi (−5 ball)"
                      className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[0.84rem] font-medium transition-colors duration-150 hover:bg-white/15">
                      <kbd className="!bg-white/20">M</kbd>Maslahat<span className="text-[0.74rem] text-white/50 tabular-nums">−5</span>
                    </button>
                  )}
                  {courtroom && idle && !snap.stageDone && (
                    <button type="button" onClick={toggleStand} disabled={busy}
                      className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.88rem] font-semibold transition-colors duration-150 ${prompt ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'bg-white/10 hover:bg-white/15'}`}>
                      <kbd className="!bg-white/20">G</kbd>{snap.standing ? 'Oʻtirish' : 'Oʻrnidan turish'}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
            {error && <p role="alert" className="mx-auto mt-2 w-fit rounded-full bg-danger px-4 py-1.5 text-[0.85rem]">{error}</p>}
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drafting && (
          <ClaimEditor key="claim" facts={snap.facts} evidence={snap.evidence} advocate={profile?.name ?? 'Siz'} initial={snap.draft} busy={busy}
            onSubmit={(draft: ClaimDraft) => {
              audio.printer();
              void act({ type: 'draft', draft });
            }}
            onCode={(a) => setCode(a)} onPaper={setPaper} />
        )}
        {ruling && (
          <RulingSheet key={ruling.title} ruling={ruling} onArticle={(a) => setCode(a)} onClose={() => {
            setOpenRuling(null);
            setSeenRulings(snap.rulings.length);
          }} />
        )}
        {finished && snap.result && <ResultSheet key="result" snap={snap} stage={def} next={nextStage} onReplay={() => { void clearVoices(`${snap.caseId}:${stage}`); replay(); }} onLeave={leave} onArticle={(a) => setCode(a)} />}
        {inHand && <HandView key={inHand.id} doc={inHand} onClose={() => setInHand(null)} />}
        {folder && <CaseFolder key="folder" snap={snap} onClose={() => setFolder(false)} onRuling={(r) => { setFolder(false); setOpenRuling(r); }} />}
        {code !== null && <CodePanel key="code" code={snap.code} open={code || null} onOpen={(n) => setCode(n)} onClose={() => setCode(null)} />}
      </AnimatePresence>
    </main>
  );
}

function IconButton({ label, hotkey, onClick, children }: { label: string; hotkey?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={hotkey ? `${label} (${hotkey})` : label} title={hotkey ? `${label} · ${hotkey}` : label}
      className="grid size-9 place-items-center rounded-full text-white/80 transition-colors duration-150 hover:bg-white/12 hover:text-white">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
    </button>
  );
}

/** A centred sheet over a dimmed room. With `onDismiss`, a click on the dimmed backdrop closes it. */
function Sheet({ children, label, wide = false, onDismiss }: { children: React.ReactNode; label: string; wide?: boolean; onDismiss?: () => void }) {
  const dismiss = useDismiss(onDismiss);
  return (
    <div {...dismiss} className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px]">
      <motion.div {...modal}
        role="dialog" aria-modal="true" aria-label={label} className={`w-full ${wide ? 'max-w-[36rem]' : 'max-w-md'}`}>
        {children}
      </motion.div>
    </div>
  );
}

function RulingSheet({ ruling, onClose, onArticle }: { ruling: Ruling; onClose: () => void; onArticle: (a: string) => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <Sheet label={ruling.title} wide onDismiss={onClose}>
      <article className="rounded-[6px] bg-[#fbfaf6] px-8 py-9 font-serif text-[0.92rem] leading-relaxed text-[#1b1b1b] shadow-[0_40px_120px_rgba(0,0,0,0.6)] select-text">
        <p className="text-center text-[0.76rem] tracking-wide">FUQAROLIK ISHLARI BOʻYICHA NAMUNA TUMANLARARO SUDI</p>
        <p className="text-center text-[0.68rem] text-black/45">oʻquv namunasi · ish № 2-1407/26</p>
        <h2 className="mt-5 text-center text-[1.02rem] font-bold">{ruling.title}</h2>
        <div className="mt-4 space-y-2">{ruling.body.map((p, i) => <p key={p} className={ruling.kind === 'judgment' && i === 0 ? 'text-center font-bold tracking-wide uppercase' : p.startsWith('•') ? 'pl-3' : 'indent-6 text-justify'}>{p}</p>)}</div>
        <div className="mt-5 flex flex-wrap gap-1.5 font-sans">
          {ruling.articles.map((a) => <button key={a} type="button" onClick={() => onArticle(a)} className="rounded-full bg-black/[0.06] px-3 py-1 text-[0.76rem] font-medium text-[#16213e] hover:bg-black/10">FPK {a}</button>)}
        </div>
        <div className="mt-6 flex items-center justify-between font-sans text-[0.8rem] text-black/55">
          <span>Sudya B. Islomov</span>
          <button ref={close} type="button" className="btn btn-primary !min-h-11" onClick={onClose}>Tanishdim</button>
        </div>
      </article>
    </Sheet>
  );
}

function ResultSheet({ snap, stage, next, onReplay, onLeave, onArticle }: { snap: CaseSnapshot; stage: CaseSnapshot['stages'][number]; next: CaseSnapshot['stages'][number] | null; onReplay: () => void; onLeave: () => void; onArticle: (a: string) => void }) {
  const r = snap.result!;
  const returned = stage.id === 'filing' && snap.stages.find((s) => s.id === 'filing')?.status === 'returned';
  const tone = r.score >= 85 ? 'text-emerald-600' : r.score >= 60 ? 'text-amber-600' : 'text-red-600';
  const mistakes = r.log.filter((d) => d.tone === 'bad').length;
  return (
    <Sheet label={`${stage.title}: natija`} wide>
      <section className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[28px] bg-[#f7f6f2] p-6 text-[#14171f] shadow-[0_40px_120px_rgba(0,0,0,0.5)] select-text">
        <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-black/45 uppercase">{stage.number}-bosqich · {stage.place}</p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <h2 className="text-[1.35rem] leading-tight font-semibold">{stage.title}</h2>
          <p className={`text-[2.2rem] leading-none font-semibold tabular-nums ${tone}`}>{r.score}</p>
        </div>
        {r.verdict && <p className="mt-2 text-[0.95rem] font-medium">{r.verdict}</p>}
        <p className="mt-2 text-[0.8rem] text-black/55 tabular-nums">{r.log.length} ta qaror · {mistakes} ta xato · {r.hints} ta maslahat</p>

        {/* the debrief: every decision, what it cost, what would have been better */}
        {r.log.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[0.72rem] font-semibold tracking-[0.12em] text-black/45 uppercase">Tahlil</h3>
            <ol className="mt-2 space-y-2">
              {r.log.map((d, i) => (
                <li key={i} className={`rounded-2xl px-3.5 py-2.5 text-[0.86rem] leading-snug ${d.tone === 'bad' ? 'bg-red-600/[0.07]' : 'bg-black/[0.035]'}`}>
                  {d.prompt && <p className="line-clamp-2 text-[0.78rem] text-black/50">«{d.prompt}»</p>}
                  <p className="mt-0.5 flex gap-2">
                    <span aria-hidden className={d.tone === 'bad' ? 'text-red-600' : d.tone === 'good' ? 'text-emerald-600' : 'text-black/40'}>{d.tone === 'bad' ? '✗' : d.tone === 'good' ? '✓' : '•'}</span>
                    <span><span className="sr-only">{d.tone === 'bad' ? 'Xato: ' : d.tone === 'good' ? 'Toʻgʻri: ' : ''}</span>{d.chose}</span>
                  </p>
                  {d.tone === 'bad' && (d.why || d.better) && (
                    <div className="mt-1.5 space-y-1 pl-5 text-[0.82rem]">
                      {d.why && <p className="text-red-800/90">{d.points > 0 ? `−${d.points} · ` : ''}{d.why}</p>}
                      {d.better && <p className="text-black/70"><span className="font-semibold text-emerald-700">Yaxshiroq: </span>{d.better}</p>}
                    </div>
                  )}
                  {d.article && (
                    <button type="button" onClick={() => onArticle(d.article!)} className="mt-1.5 ml-5 rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[0.74rem] font-medium text-[#16213e] hover:bg-black/10">
                      {snap.kind === 'labour' ? 'FPK' : 'JPK'} {d.article}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        {(r.good.length > 0 || r.notes.length > 0) && (
          <ul className="mt-4 space-y-1.5 text-[0.86rem]">
            {r.notes.filter((n) => !r.log.some((d) => d.why && n.includes(d.why))).map((n) => <li key={n} className="flex gap-2 text-black/70"><span className="text-red-600">•</span><span>{n}</span></li>)}
            {r.good.slice(0, 3).map((g) => <li key={g} className="flex gap-2"><span className="text-emerald-600">✓</span><span>{g}</span></li>)}
          </ul>
        )}
        {r.reflect && <Reflection id={`${snap.caseId}:${stage.id}`} question={r.reflect} />}
        <div className="mt-5">
          <RoomRecord snap={snap} stage={stage} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {returned ? (
            <Link href={`/ish/${snap.caseId}/draft`} className="btn btn-primary">Arizani tuzatish →</Link>
          ) : next ? (
            <Link href={`/ish/${snap.caseId}/${next.id}`} className="btn btn-primary">{next.number}. {next.place} →</Link>
          ) : null}
          <button type="button" className="btn btn-quiet" onClick={onReplay}>Qayta oʻynash</button>
          <button type="button" className="btn btn-quiet" onClick={onLeave}>Terminal</button>
        </div>
        <p className="mt-4 text-[0.7rem] leading-snug text-black/40">Oʻquv simulyatsiyasi, yuridik maslahat emas · ish holatlari toʻqilgan · moddalar lex.uz saytidan ({snap.code.retrievedAt})</p>
      </section>
    </Sheet>
  );
}

/** What this room asks of you and how it is scored (prebrief), dismissable and remembered per room. */
function Prebrief({ id, role, stage, courtroom, level }: { id: string; role: string; stage: CaseSnapshot['stages'][number]; courtroom: boolean; level: CaseSnapshot['level'] }) {
  const key = `lexsim.brief.${id}`;
  const [open, setOpen] = useState(() => {
    try {
      return typeof window === 'undefined' || localStorage.getItem(key) !== '1';
    } catch {
      return true;
    }
  });
  if (!open) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(key, '1');
    } catch {}
  };
  return (
    <motion.aside initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={spring} aria-label="Bosqich vazifasi"
      className="absolute top-20 left-3 z-20 w-[min(22rem,calc(100vw-1.5rem))] rounded-[22px] hud p-4 text-[0.84rem] leading-snug sm:left-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.66rem] font-semibold tracking-[0.16em] text-amber-200 uppercase">{stage.number}-bosqich · siz - {role.toLowerCase()}</p>
          <p className="mt-1 text-[0.98rem] font-semibold">{stage.title}</p>
          <p className="mt-1 line-clamp-2 text-white/80 sm:line-clamp-none">{stage.goal}</p>
        </div>
        <button type="button" onClick={close} aria-label="Yopish" className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">✕</button>
      </div>
      <ul className="mt-3 hidden space-y-1 text-white/70 sm:block">
        <li>• {level === 'advanced' ? 'Professional: faqat oʻz soʻzingiz bilan (yozing yoki T bilan ayting), maslahatsiz; izohlar - oxirgi tahlilda.' : level === 'intermediate' ? 'Oʻrta: oʻz soʻzingiz bilan javob bering; kerak boʻlsa variantlarni oching (−10).' : 'Variantni tanlang yoki oʻz soʻzingiz bilan yozing/ayting (T).'}</li>
        <li>• Har bir qaror baholanadi; xatoning sababi va moddasi yakuniy tahlilda koʻrsatiladi.</li>
        <li>• {level !== 'advanced' && <><kbd>M</kbd> maslahat - kerakli moddani koʻrsatadi (−5 ball). </>}<kbd>K</kbd> kodeks, <kbd>H</kbd> ish papkasi.</li>
        {courtroom && <li>• Sudga tik turib (<kbd>G</kbd>) va «Hurmatli sud!» deb murojaat qilinadi.</li>}
      </ul>
    </motion.aside>
  );
}

/** One question to think over; the answer stays in this browser only. */
function Reflection({ id, question }: { id: string; question: string }) {
  const key = `lexsim.reflect.${id}`;
  const [text, setText] = useState(() => {
    try {
      return typeof window === 'undefined' ? '' : (localStorage.getItem(key) ?? '');
    } catch {
      return '';
    }
  });
  return (
    <label className="mt-5 block">
      <span className="text-[0.72rem] font-semibold tracking-[0.12em] text-black/45 uppercase">Mulohaza</span>
      <span className="mt-1 block text-[0.9rem] font-medium">{question}</span>
      <textarea value={text} rows={3} placeholder="Ikki-uch jumla - faqat shu brauzerda saqlanadi"
        onChange={(e) => {
          setText(e.target.value);
          try {
            localStorage.setItem(key, e.target.value);
          } catch {}
        }}
        className="mt-2 w-full resize-y rounded-2xl bg-black/[0.045] px-3.5 py-2.5 text-[0.95rem] outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
    </label>
  );
}

/**
 * This room's practice record: every line in order (the student by name, the actors in their
 * voices), the debrief, and the downloads. The LMS statements (xAPI, anonymous actor) stay
 * available for teachers.
 */
function RoomRecord({ snap, stage }: { snap: CaseSnapshot; stage: CaseSnapshot['stages'][number] }) {
  const r = snap.result!;
  const data = useMemo(() => {
    const student = getProfile()?.name?.trim() || 'Talaba';
    const party = (role: CaseSpeaker) => snap.parties.find((p) => p.role === role);
    const lines: RecordLine[] = snap.lines.map((l) =>
      l.speaker === 'you'
        ? { who: student, role: 'student', text: l.text }
        : l.speaker === 'system'
          ? { who: '', role: 'system', text: l.text }
          : { who: party(l.speaker) ? `${party(l.speaker)!.label} · ${party(l.speaker)!.name}` : l.speaker, role: 'npc', text: l.text, voice: party(l.speaker)?.voice, emotion: l.emotion },
    );
    const meta: RecordMeta = {
      title: `${snap.title} - ${stage.number}-bosqich: ${stage.place}`,
      subtitle: `${stage.title} · ${({ beginner: 'boshlangʻich', intermediate: 'oʻrta', advanced: 'professional' } as const)[snap.level]} daraja`,
      student,
      date: new Date(),
      score: r.score,
      outcome: r.verdict,
      slug: `${snap.kind}-${stage.id}`,
    };
    return { lines, meta, analysis: { decisions: r.log, strengths: r.good, errors: r.notes } };
  }, [snap, stage, r]);
  const xapi = () => ({
    case: snap.title,
    stage: stage.id,
    code: { title: snap.code.title, edition: snap.code.edition },
    statements: statementsFor({ actor: 'anonymous', kind: snap.kind, stage: stage.id, stageTitle: stage.title, score: r.score, hints: r.hints, log: r.log, seconds: r.log.at(-1)?.at }),
  });
  return <PracticeRecord meta={data.meta} lines={data.lines} analysis={data.analysis} scope={`${snap.caseId}:${stage.id}`} xapi={xapi} />;
}

function CaseFolder({ snap, onClose, onRuling }: { snap: CaseSnapshot; onClose: () => void; onRuling: (r: Ruling) => void }) {
  return (
    // a click anywhere outside the drawer puts the folder away; grab the header to fling it back
    <Drawer side="right" label="Ish papkasi" onClose={onClose}
      className="w-[min(24rem,calc(100vw-1.5rem))] rounded-[24px] hud hud-strong"
      header={
        <header className="flex items-center gap-3 px-5 pt-4 pb-3">
          <h2 className="flex-1 text-[1rem] font-semibold">Ish papkasi</h2>
          <button type="button" className="btn btn-quiet !min-h-9 !px-3 text-[0.84rem]" onClick={onClose}>Yopish</button>
        </header>
      }>
      <div className="scroll-soft flex-1 space-y-5 overflow-y-auto px-5 pb-5 text-[0.88rem]">
        <p className="text-[0.82rem] text-white/60">{snap.title}</p>
        <FolderList title="Holatlar" empty="Hali aniqlanmagan" items={snap.facts.map((f) => [f.label, f.detail])} />
        <FolderList title="Hujjatlar" empty="Hali yoʻq" items={snap.evidence.map((e) => [e.label, e.detail])} />
        {snap.rulings.length > 0 && (
          <section>
            <h3 className="text-[0.7rem] font-semibold tracking-wider text-white/45 uppercase">Sud hujjatlari</h3>
            <ul className="mt-1.5 space-y-1">{snap.rulings.map((r, i) => (
              <li key={i}><button type="button" onClick={() => onRuling(r)} className="w-full rounded-xl px-2 py-1.5 text-left hover:bg-white/10">{r.title}</button></li>
            ))}</ul>
          </section>
        )}
        <p className="text-[0.7rem] leading-snug text-white/40">{snap.note}</p>
      </div>
    </Drawer>
  );
}

function FolderList({ title, empty, items }: { title: string; empty: string; items: [string, string][] }) {
  return (
    <section>
      <h3 className="text-[0.7rem] font-semibold tracking-wider text-white/45 uppercase">{title}</h3>
      {items.length === 0 ? <p className="mt-1 text-white/45">{empty}</p> : (
        <ul className="mt-1.5 space-y-2">{items.map(([label, detail]) => <li key={label}><span className="font-medium">{label}</span><span className="block text-[0.8rem] text-white/55">{detail}</span></li>)}</ul>
      )}
    </section>
  );
}
