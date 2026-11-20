'use client';
/**
 * Cinematic conversation layer for the immersive view — the way simulation
 * games do it, not a chat window:
 *
 *   • the citizen's line appears as a subtitle while he speaks and gestures;
 *   • when he stops, the student picks a reply (1–4, Tab for more) or
 *     answers in their own words (T);
 *   • desk actions live on single keys: terminal (F), notebook (V),
 *     look at the phone photo (R), stand up (G).
 *
 * Lines are presented one at a time; speech, gesture and subtitle start
 * together (`beginLine`). Space skips ahead. Everything is also reachable
 * by pointer and by Tab focus, and the full line is exposed to screen
 * readers the moment it starts.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { ReplyOption, Turn } from '@/contracts';
import { availableItems } from '@/game/items';
import { useGame } from '@/game/store';
import { speak, stopSpeaking } from '@/game/voice';
import { matchUtterance } from '@/lib/uz';
import { Talk } from './Talk';
import { useDismiss } from '@/lib/useDismiss';

const spring = { type: 'spring', bounce: 0, duration: 0.4 } as const;
const CHARS_PER_TICK = 2;
const TICK_MS = 30;
const DWELL_MS = 1500;
const PAGE = 4;

const KIND_LABEL: Record<ReplyOption['kind'], string> = { ask: 'Savol', explain: 'Tushuntirish', react: 'Munosabat' };

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
};

/* ───────────────────────── line presenter ───────────────────────── */

/**
 * Walks through spoken lines the student has not seen yet. Returns the line
 * on screen, how much of it is typed, and whether the stage is idle
 * (everything said → replies may appear).
 */
function useLinePresenter(turns: Turn[], instant: boolean) {
  // Lines before `done` have been fully presented. After a refresh nothing replays.
  const [done, setDone] = useState(turns.length);
  const [typed, setTyped] = useState({ id: '', n: 0 });
  const beginLine = useGame((s) => s.beginLine);

  const queued = turns.slice(done).find((t) => t.speaker !== 'user');
  const last = [...turns].reverse().find((t) => t.speaker !== 'user');
  const line = queued ?? last;
  const n = !queued || instant ? Infinity : typed.id === queued.id ? typed.n : 0;
  const complete = !line || n >= line.text.length;

  /** Starts the line: gesture + face now, voice if available. Resolves when the voice is done. */
  const start = useEffectEvent((turn: Turn): Promise<unknown> => {
    if (turn.speaker !== 'npc') return Promise.resolve();
    beginLine(turn);
    return speak(turn.text, 'elder_m');
  });

  useEffect(() => {
    if (!queued) return;
    const voice = start(queued);
    let count = 0;
    let alive = true;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      // Wait for the voice, hold the line briefly, then move on to the next one (if any).
      void voice.then((heard) => {
        if (!alive) return;
        const hold = heard ? 450 : instant ? DWELL_MS + queued.text.length * 30 : DWELL_MS;
        dwell = setTimeout(() => setDone(queued.index + 1), hold);
      });
    };
    if (instant) {
      finish();
      return () => {
        alive = false;
        clearTimeout(dwell);
      };
    }
    const timer = setInterval(() => {
      count += CHARS_PER_TICK;
      setTyped({ id: queued.id, n: count });
      if (count >= queued.text.length) {
        clearInterval(timer);
        finish();
      }
    }, TICK_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      clearTimeout(dwell);
    };
  }, [queued, instant]);

  const skip = () => {
    if (!queued) return;
    if (n < queued.text.length) setTyped({ id: queued.id, n: queued.text.length });
    else {
      stopSpeaking();
      setDone(queued.index + 1);
    }
  };

  return { line, shown: line ? line.text.slice(0, n) : '', complete, idle: !queued, skip };
}

/* ───────────────────────── reply choices ───────────────────────── */

export function ReplyChoices({ options, disabled, onPick, dark }: { options: ReplyOption[]; disabled: boolean; onPick: (o: ReplyOption) => void; dark: boolean }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(options.length / PAGE));
  const current = page % pages;
  const visible = options.slice(current * PAGE, current * PAGE + PAGE);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (disabled || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (index >= 0 && visible[index]) {
      e.preventDefault();
      onPick(visible[index]);
    } else if (e.code === 'KeyQ' && pages > 1) {
      e.preventDefault();
      setPage((p) => p + 1);
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div role="group" aria-label="Javob variantlari">
      <ul className="space-y-1.5">
        {visible.map((option, i) => (
          <motion.li key={option.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: i * 0.045 }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(option)}
              className={`group flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-[background-color,transform] duration-150 active:scale-[0.985] disabled:opacity-50 ${
                dark ? 'glass hover:bg-white/20 focus-visible:bg-white/20' : 'border border-line bg-white hover:border-accent hover:bg-accent-soft'
              }`}
            >
              <kbd className={dark ? '' : '!border-line !bg-paper text-ink-2'}>{i + 1}</kbd>
              <span className="min-w-0 flex-1 text-[0.97rem] leading-snug">{option.text}</span>
              <span className={`hidden shrink-0 text-[0.66rem] font-semibold uppercase tracking-wider sm:block ${dark ? 'text-white/45' : 'text-ink-3'}`}>
                {KIND_LABEL[option.kind]}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
      {pages > 1 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPage((p) => p + 1)}
          className={`mt-2 inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[0.82rem] font-medium ${dark ? 'text-white/75 hover:text-white' : 'text-ink-2 hover:text-ink'}`}
        >
          <kbd className={dark ? '' : '!border-line !bg-paper text-ink-2'}>Q</kbd> Boshqa javoblar
          <span className="tabular-nums opacity-60">{current + 1}/{pages}</span>
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── side panels ───────────────────────── */

function Notebook({ onClose }: { onClose: () => void }) {
  const snapshot = useGame((s) => s.snapshot)!;
  const [tab, setTab] = useState<'facts' | 'log'>('facts');
  return (
    <motion.aside
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={spring}
      aria-label="Ish daftari"
      className="glass absolute top-4 right-4 bottom-4 z-30 flex w-[min(24rem,calc(100vw-2rem))] flex-col rounded-[24px] select-text"
    >
      <header className="flex items-center gap-2 px-4 pt-4">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-full bg-white/10 p-1" role="tablist">
          {(['facts', 'log'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-9 rounded-full text-[0.84rem] font-semibold ${tab === t ? 'bg-white/20' : 'text-white/60'}`}>
              {t === 'facts' ? `Faktlar · ${snapshot.facts.length}/${snapshot.factsTotal}` : 'Suhbat tarixi'}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="btn btn-quiet !min-h-9 !px-3 text-[0.84rem]">Yopish</button>
      </header>
      <div className="scroll-soft flex-1 space-y-2 overflow-y-auto p-4 text-[0.92rem] leading-snug" tabIndex={0}>
        {tab === 'facts' ? (
          snapshot.facts.length ? (
            snapshot.facts.map((f, i) => (
              <p key={f.id} className="rounded-2xl bg-emerald-300/12 px-3 py-2.5 text-emerald-50">
                <span className="mr-2 font-semibold tabular-nums text-emerald-300">{i + 1}.</span>
                {f.text}
              </p>
            ))
          ) : (
            <p className="text-white/60">Hali hech narsa aniqlanmadi. Fuqaro muhim tafsilotlarni faqat toʻgʻri savol berilganda aytadi.</p>
          )
        ) : (
          snapshot.turns.map((t) => (
            <p key={t.id} className={t.speaker === 'system' ? 'italic text-amber-100/80' : ''}>
              {t.speaker !== 'system' && <strong className={t.speaker === 'user' ? 'text-emerald-300' : 'text-white'}>{t.speaker === 'user' ? 'Siz' : snapshot.scenario.npc.name}: </strong>}
              <span className="text-white/85">{t.text}</span>
            </p>
          ))
        )}
      </div>
    </motion.aside>
  );
}

/** The photo he shows on his phone: a synthetic work-record page (no real person). */
function PhoneExhibit({ onClose }: { onClose: () => void }) {
  const rows = [
    ['12', '1991 03 04', 'Жамоа хўжалигига тракторчи этиб қабул қилинди', 'Буйруқ № 14'],
    ['13', '1994 01 10', '2-бригадага ўтказилди', 'Буйруқ № 3'],
    ['14', '1998 11 30', 'Хўжалик тугатилиши муносабати билан бўшатилди', 'Буйруқ № 57'],
  ];
  const dismiss = useDismiss(onClose);
  return (
    <motion.div {...dismiss} className="absolute inset-0 z-40 grid place-items-center bg-black/55 p-4 select-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Telefondagi surat: mehnat daftarchasi sahifasi"
        initial={{ y: 60, rotate: -4, scale: 0.9 }}
        animate={{ y: 0, rotate: -1.5, scale: 1 }}
        exit={{ y: 60, scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
        className="w-[min(22rem,100%)] rounded-[44px] bg-[#0b0c0f] p-3 shadow-[0_40px_90px_rgba(0,0,0,0.6)] ring-1 ring-white/15"
      >
        <div className="overflow-hidden rounded-[34px] bg-[#1a1712]">
          <div className="flex items-center justify-between px-5 pt-3 pb-2 text-[0.7rem] text-white/70">
            <span>Galereya</span>
            <span>IMG_2041.jpg</span>
          </div>
          {/* the photographed page: slightly skewed, warm paper, uneven light */}
          <div className="relative mx-3 mb-3 origin-center rotate-[1.2deg] bg-[#e9dfc6] p-3 text-[#2b2a3a] shadow-inner" style={{ backgroundImage: 'radial-gradient(120% 90% at 20% 10%, #f4ecd8 0%, #e3d6b6 60%, #cdbd98 100%)' }}>
            <p className="text-center text-[0.62rem] font-semibold tracking-[0.2em] text-[#5a4a3a]">МЕҲНАТ ДАФТАРЧАСИ · ИШ ҲАҚИДА МАЪЛУМОТЛАР</p>
            <table className="mt-2 w-full border-collapse text-[0.66rem] leading-tight">
              <thead>
                <tr className="text-[0.56rem] text-[#5a4a3a]">
                  {['№', 'Сана', 'Ишга қабул қилиш, ўтказиш, бўшатиш', 'Асос'].map((h) => (
                    <th key={h} className="border border-[#8a7a5c]/70 px-1 py-1 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-[cursive] text-[#1f2a5c]">
                {rows.map((r) => (
                  <tr key={r[0]}>
                    {r.map((c, i) => (
                      <td key={i} className="border border-[#8a7a5c]/70 px-1 py-2 align-top">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="absolute right-5 bottom-4 grid size-14 -rotate-12 place-items-center rounded-full border-2 border-[#3b4a9a]/55 text-center text-[0.42rem] leading-tight font-semibold text-[#3b4a9a]/60">ЖАМОА<br />ХЎЖАЛИГИ<br />КАДРЛАР</div>
          </div>
          <p className="px-5 pb-3 text-[0.7rem] leading-snug text-white/55">Oʻquv uchun yaratilgan sintetik hujjat. Real shaxsga tegishli emas.</p>
        </div>
        <button type="button" autoFocus onClick={onClose} className="btn btn-quiet mt-3 w-full !text-white">
          Telefonni qaytarish <kbd>Esc</kbd>
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────── the stage ───────────────────────── */

export function DialogueStage() {
  const snapshot = useGame((s) => s.snapshot)!;
  const busy = useGame((s) => s.busy);
  const pendingText = useGame((s) => s.pendingText);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const exhibitOpen = useGame((s) => s.exhibitOpen);
  const { choose, say, stand, finish, openTerminal, inspectPhone, closeExhibit } = useGame.getState();

  const [notebook, setNotebook] = useState(false);
  const [writing, setWriting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [tray, setTray] = useState(false);
  const [text, setText] = useState('');
  const [heard, setHeard] = useState<{ said: string; as: string | null } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const active = snapshot.status === 'in-progress';
  const { line, shown, complete, idle, skip } = useLinePresenter(snapshot.turns, reducedMotion);
  const canReply = active && idle && !busy && !pendingText;
  const phoneAvailable = snapshot.objects.phone === 'active';
  const npcName = snapshot.scenario.npc.name;
  const optionsKey = useMemo(() => snapshot.options.map((o) => o.id).join('|'), [snapshot.options]);

  /** What the student said out loud → the reply they meant, or free speech. */
  const onHeard = (said: string) => {
    if (!canReply) return;
    const match = matchUtterance(said, snapshot.options);
    setHeard({ said, as: match ? match.option.text : null });
    if (match) void choose(match.option);
    else void say(said);
  };
  useEffect(() => {
    if (!heard) return;
    const t = setTimeout(() => setHeard(null), 6000);
    return () => clearTimeout(t);
  }, [heard]);

  const submitText = () => {
    const value = text.trim();
    if (!value || !canReply) return;
    setText('');
    setWriting(false);
    void say(value);
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (useGame.getState().inspecting) return; // keys belong to the object in your hand
    if (e.code === 'Escape') {
      if (exhibitOpen) closeExhibit();
      else if (tray) setTray(false);
      else if (writing) setWriting(false);
      else if (notebook) setNotebook(false);
      else if (confirming) setConfirming(false);
      else return;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || exhibitOpen) return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        skip();
        break;

      case 'KeyV':
        setNotebook((v) => !v);
        break;
      case 'KeyB':
        setTray((v) => !v);
        break;
      case 'KeyF':
        void openTerminal();
        break;
      case 'KeyG':
        stand();
        break;
      case 'KeyR':
        if (phoneAvailable) void inspectPhone();
        break;
    }
  });
  useEffect(() => {
    // Capture phase: Escape closes the top-most layer here before the pause menu sees it.
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  useEffect(() => {
    if (writing) input.current?.focus();
  }, [writing]);

  const speaker = pendingText ? 'Siz' : line?.speaker === 'npc' ? npcName : null;
  const subtitle = pendingText ?? shown;

  return (
    <>
      {/* cinematic framing: soft letterbox + readable ground for the subtitle */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[7dvh] bg-gradient-to-b from-black/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[62dvh] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

      {/* who you are talking to */}
      <div className="glass pointer-events-none absolute top-4 left-4 w-64 rounded-[20px] px-4 py-3">
        <p className="text-[1rem] leading-tight font-semibold">{npcName}</p>
        <p className="text-[0.74rem] text-white/60">{snapshot.scenario.npc.age} yosh · navbat A-047</p>
        {snapshot.meters && (
          <div className="mt-2.5 space-y-2">
            {([['Sabr', snapshot.meters.patience, '#f3c969'], ['Ishonch', snapshot.meters.trust, '#5dd6a0']] as const).map(([label, value, color]) => (
              <div key={label} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
                <div className="flex justify-between text-[0.68rem] font-medium text-white/70">
                  <span>{label}</span>
                  <span className="tabular-nums">{value}</span>
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full transition-[width,background-color] duration-700 ease-out" style={{ width: `${value}%`, background: value < 30 ? '#ff7a6b' : color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-5 sm:px-8">
        {/* subtitle */}
        <div className="min-h-[5.5rem] cursor-default text-center select-text" onClick={skip}>
          {line?.speaker === 'system' && !pendingText ? (
            <p className="mx-auto max-w-[52ch] text-[1.02rem] leading-snug text-amber-100/95 italic [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">{shown}</p>
          ) : (
            subtitle && (
              <>
                <p className={`text-[0.72rem] font-semibold tracking-[0.18em] uppercase ${pendingText ? 'text-emerald-300' : 'text-amber-200'} [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]`}>{speaker}</p>
                <p className="mx-auto mt-1 max-w-[46ch] text-[clamp(1.1rem,2vw,1.45rem)] leading-snug font-medium text-balance text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_2px_18px_rgba(0,0,0,0.85)]">
                  <span aria-hidden>{subtitle}</span>
                  {!complete && !pendingText && <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse bg-white/80" />}
                </p>
              </>
            )
          )}
          {/* full text for assistive tech, announced once per line */}
          <p className="sr-only" role="log" aria-live="polite">{pendingText ? `Siz: ${pendingText}` : line ? `${line.speaker === 'npc' ? npcName : 'Vaziyat'}: ${line.text}` : ''}</p>
          {busy && pendingText && <p className="mt-1.5 text-[0.78rem] text-white/55" role="status">{npcName} oʻylamoqda…</p>}
          {!idle && complete && <p className="mt-1.5 text-[0.72rem] text-white/45"><kbd>Space</kbd> davom etish</p>}
        </div>

        {heard && (
          <p className="mx-auto -mt-2 max-w-2xl text-center text-[0.8rem] leading-snug text-white/60" role="status">
            Eshitildi: «{heard.said}»{heard.as ? <> → <span className="text-white/85">{heard.as}</span></> : ' — erkin javob sifatida yuborildi'}
          </p>
        )}
        {/* replies */}
        <div className="min-h-[13.5rem]">
          <AnimatePresence mode="wait">
            {canReply && !writing && (
              <motion.div key={optionsKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <ReplyChoices key={optionsKey} options={snapshot.options} disabled={!canReply} onPick={(o) => void choose(o)} dark />
              </motion.div>
            )}
            {canReply && writing && (
              <motion.form key="write" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="glass flex items-center gap-2 rounded-full p-1.5 pl-5" onSubmit={(e) => { e.preventDefault(); submitText(); }}>
                <label htmlFor="own-words" className="sr-only">Oʻz soʻzingiz bilan javob</label>
                <input id="own-words" ref={input} value={text} maxLength={800} onChange={(e) => setText(e.target.value)} placeholder="Oʻz soʻzingiz bilan ayting…" className="min-h-11 flex-1 bg-transparent text-base outline-none placeholder:text-white/45" autoComplete="off" />
                <button type="submit" className="btn btn-primary" disabled={!text.trim()}>Aytish</button>
                <button type="button" className="btn btn-quiet" onClick={() => setWriting(false)}>Bekor</button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* what is on the desk: pick something up */}
        <AnimatePresence>
          {tray && (
            <motion.ul key="tray" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={spring} className="glass flex flex-wrap gap-2 rounded-[20px] p-2.5" aria-label="Stol ustidagi buyumlar">
              {availableItems(snapshot).map((item) => (
                <li key={item.id}>
                  <button type="button" className="btn btn-quiet !min-h-11 flex-col !items-start !gap-0 !rounded-2xl !px-3.5 !py-1.5 text-left" onClick={() => { setTray(false); useGame.getState().inspect(item.id); }}>
                    <span className="text-[0.9rem] leading-tight">{item.name}</span>
                    <span className="text-[0.68rem] font-medium text-white/50">{item.kind}</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {/* desk actions */}
        {active && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[0.82rem]">
            <Talk enabled={canReply && !writing} onHeard={onHeard} onError={(m) => useGame.setState({ error: m })} />
            {canReply && !writing && (
              <button type="button" className="btn btn-quiet !min-h-10 !px-3" onClick={() => setWriting(true)}>Klaviatura</button>
            )}
            <button type="button" className="btn btn-quiet !min-h-10 !px-3" onClick={() => void openTerminal()}><kbd>F</kbd> {snapshot.documentSubmitted ? 'Terminal ✓' : 'Terminal'}</button>
            <button type="button" className="btn btn-quiet !min-h-10 !px-3" onClick={() => setNotebook((v) => !v)}><kbd>V</kbd> Daftar{snapshot.facts.length > 0 && <span className="rounded-full bg-emerald-400/25 px-1.5 text-[0.7rem] text-emerald-200 tabular-nums">{snapshot.facts.length}</span>}</button>
            {phoneAvailable && (
              <button type="button" className="btn btn-quiet !min-h-10 !px-3" onClick={() => void inspectPhone()}><kbd>R</kbd> Suratni koʻrish</button>
            )}
            <button type="button" className="btn btn-quiet !min-h-10 !px-3" aria-expanded={tray} onClick={() => setTray((v) => !v)}><kbd>B</kbd> Buyumlar</button>
            <button type="button" className="btn btn-quiet !min-h-10 !px-3" onClick={stand}><kbd>G</kbd> Turish</button>
            <span className="flex-1" />
            {confirming ? (
              <span className="flex items-center gap-2" role="group" aria-label="Qabulni yakunlashni tasdiqlang">
                <span className="text-white/80">Yakunlansinmi?</span>
                <button type="button" className="btn btn-danger !min-h-10" disabled={busy} onClick={() => void finish()}>Ha, yakunlash</button>
                <button type="button" className="btn btn-quiet !min-h-10" onClick={() => setConfirming(false)}>Yoʻq</button>
              </span>
            ) : (
              <button type="button" className="btn btn-quiet !min-h-10 !px-4" onClick={() => setConfirming(true)}>Qabulni yakunlash</button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {notebook && <Notebook key="notebook" onClose={() => setNotebook(false)} />}
        {exhibitOpen && <PhoneExhibit key="exhibit" onClose={closeExhibit} />}
      </AnimatePresence>
    </>
  );
}
