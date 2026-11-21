'use client';
/**
 * Push-to-talk. Hold T (or press and hold the microphone button), speak,
 * release. While held: a live level meter and - where the browser provides
 * it - the words as they are recognised. The parent decides what the words
 * mean (usually: which offered reply was said).
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { listenSupport, startListening, type Listening, type ListenSupport } from '@/game/voice';

type Phase = 'idle' | 'starting' | 'listening' | 'thinking';

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
};

export function useSupport(): ListenSupport | null {
  const [support, setSupport] = useState<ListenSupport | null>(null);
  useEffect(() => {
    let alive = true;
    void listenSupport().then((s) => alive && setSupport(s));
    return () => {
      alive = false;
    };
  }, []);
  return support;
}

/** `compact`: a round mic button that sits beside a text field (the label appears only while listening). */
export function Talk({ enabled, onHeard, onError, compact = false }: { enabled: boolean; onHeard: (text: string) => void; onError: (message: string) => void; compact?: boolean }) {
  const support = useSupport();
  const [phase, setPhase] = useState<Phase>('idle');
  const [partial, setPartial] = useState('');
  // how long the words have been on their way to meaning (shown when it is more than a moment)
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (phase !== 'thinking') return;
    const start = Date.now();
    const t = setInterval(() => setWaited(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setWaited(0);
    };
  }, [phase]);
  const session = useRef<Listening | null>(null);
  const holding = useRef(false);
  const bars = useRef<HTMLDivElement>(null);

  // Latest props/state for handlers that outlive a render (keyboard listener, pointer capture).
  const latest = useRef({ enabled, support, phase, onHeard, onError });
  useEffect(() => {
    latest.current = { enabled, support, phase, onHeard, onError };
  });

  const actions = useRef({
    begin: async () => {
      const { enabled: on, support: sup, phase: ph } = latest.current;
      if (!on || ph !== 'idle' || sup === 'none' || sup === null || session.current || holding.current) return;
      holding.current = true;
      setPartial('');
      setPhase('starting');
      latest.current.phase = 'starting';
      try {
        const s = await startListening();
        session.current = s;
        s.onPartial(setPartial);
        setPhase('listening');
        if (!holding.current) void actions.current.end(); // released before the mic was ready
      } catch (e) {
        holding.current = false;
        setPhase('idle');
        latest.current.onError(e instanceof Error ? e.message : 'Mikrofon ishlamadi');
      }
    },
    end: async () => {
      holding.current = false;
      const s = session.current;
      if (!s) return;
      session.current = null;
      setPhase('thinking');
      try {
        const text = await s.finish();
        setPhase('idle');
        if (text) latest.current.onHeard(text);
        else latest.current.onError('Hech narsa eshitilmadi. T ni bosib turib gapiring.');
      } catch (e) {
        setPhase('idle');
        latest.current.onError(e instanceof Error ? e.message : 'Nutqni tanib boʻlmadi');
      }
    },
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'KeyT' || e.repeat || isTyping(e.target) || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      void actions.current.begin();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') void actions.current.end();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      session.current?.cancel();
    };
  }, []);

  // level meter: written straight to the DOM every frame
  useEffect(() => {
    if (phase !== 'listening') return;
    let raf = 0;
    const tick = () => {
      const level = session.current?.level.current ?? 0;
      const el = bars.current;
      if (el) [...el.children].forEach((bar, i) => ((bar as HTMLElement).style.transform = `scaleY(${0.15 + Math.min(1, level * (0.6 + ((i * 37) % 5) / 6))})`));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (support === null) return null;
  const unavailable = support === 'none';

  return (
    <>
      <button
        type="button"
        disabled={!enabled || unavailable}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          void actions.current.begin();
        }}
        onPointerUp={() => void actions.current.end()}
        onPointerCancel={() => void actions.current.end()}
        aria-label="Gapirish uchun bosib turing (T)"
        title={unavailable ? 'Bu brauzerda oʻzbekcha nutqni tanish mavjud emas' : 'Bosib turib gapiring'}
        className={
          compact
            ? `grid size-11 shrink-0 touch-none place-items-center rounded-2xl transition-[background-color,transform] duration-150 select-none active:scale-[0.94] disabled:opacity-45 ${phase === 'listening' ? 'bg-red-500 text-white' : 'bg-white/[0.07] text-white/80 hover:bg-white/15'}`
            : `flex min-h-12 touch-none items-center gap-2.5 rounded-full pr-5 pl-2 text-[0.92rem] font-semibold transition-[background-color,transform] duration-150 select-none active:scale-[0.97] disabled:opacity-45 ${phase === 'listening' ? 'bg-red-500 text-white' : 'glass hover:bg-white/20'}`
        }
      >
        <span className={compact ? 'contents' : `grid size-9 place-items-center rounded-full ${phase === 'listening' ? 'bg-white/25' : 'bg-white/15'}`} aria-hidden>
          <svg width={compact ? 18 : 16} height={compact ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </span>
        {!compact && (unavailable ? 'Ovoz mavjud emas' : phase === 'listening' ? 'Gapiring…' : <><kbd>T</kbd> bosib turib gapiring</>)}
      </button>

      <AnimatePresence>
        {phase !== 'idle' && (
          <motion.div
            key="listening"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            role="status"
            aria-live="polite"
            // in the middle of the view, above the conversation panel - never over the replies
            className="glass pointer-events-none fixed inset-x-0 top-[26%] z-40 mx-auto flex w-fit max-w-[min(42rem,calc(100vw-2rem))] items-center gap-4 rounded-[24px] px-5 py-3.5"
          >
            {phase === 'thinking' ? (
              <span className="grid size-8 shrink-0 place-items-center" aria-hidden>
                <span className="size-5 rounded-full border-2 border-white/25 border-t-white motion-safe:animate-spin" />
              </span>
            ) : (
              <span className="flex h-8 shrink-0 items-end gap-[3px]" ref={bars} aria-hidden>
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} className="block h-8 w-[4px] origin-bottom rounded-full bg-red-400 transition-transform duration-75" style={{ transform: 'scaleY(0.15)' }} />
                ))}
              </span>
            )}
            <span className="min-w-0">
              {/* what you are saying, as you say it - and it stays there while it is being understood */}
              <span className={`block text-[1.05rem] leading-snug ${partial ? 'text-white' : 'text-white/70'}`}>
                {partial ? `«${partial}»` : phase === 'starting' ? 'Mikrofon yoqilmoqda…' : phase === 'thinking' ? 'Ovozingiz tanilmoqda…' : 'Gapiring, eshityapman…'}
              </span>
              {phase === 'thinking' && (
                <span className="mt-0.5 block text-[0.76rem] text-white/50 tabular-nums">
                  {waited < 3 ? 'Tushunilmoqda…' : `Tushunilmoqda… ${waited} s${waited >= 8 ? ' · server sekin ishlayapti' : ''}`}
                </span>
              )}
              {phase === 'listening' && <span className="mt-0.5 block text-[0.76rem] text-white/45">Qoʻyib yuborsangiz - yuboriladi</span>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
