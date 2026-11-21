'use client';
/**
 * Heads-up layer for the immersive view. Deliberately minimal: a crosshair,
 * one contextual prompt, the task list - everything else appears only when
 * the player asks for it (pause) or the scenario calls for it.
 */
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ease, modal } from '@/lib/motion';
import { useProfile } from '@/game/profile';
import { useGame, type Quality } from '@/game/store';
import { useDismiss } from '@/lib/useDismiss';

/** Critically damped spring: arrives without overshoot (nothing here was flicked). */
const spring = ease.surface;
/** Symmetric: a sheet leaves along the path it came in (lib/motion). */
const sheet = modal;

export function Objectives() {
  const objectives = useGame((s) => s.snapshot?.objectives ?? []);
  const next = objectives.find((o) => !o.done);
  return (
    <aside className="glass pointer-events-none absolute top-4 right-4 w-[min(19rem,calc(100vw-2rem))] rounded-[20px] px-4 py-3" aria-label="Vazifalar">
      <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-white/55">Vazifa</p>
      <ol className="mt-1.5 space-y-1.5" aria-live="polite">
        {objectives.map((o) => (
          <li key={o.id} className={`flex items-start gap-2 text-[0.86rem] leading-snug ${o.done ? 'text-white/45' : o.id === next?.id ? 'font-semibold text-white' : 'text-white/70'}`}>
            <span aria-hidden className={`mt-[3px] grid size-4 shrink-0 place-items-center rounded-full border text-[0.6rem] ${o.done ? 'border-emerald-300/60 bg-emerald-400/25 text-emerald-200' : 'border-white/35'}`}>
              {o.done ? '✓' : ''}
            </span>
            <span>{o.label}<span className="sr-only">{o.done ? ' - bajarildi' : ''}</span></span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function ExploreHud() {
  const focus = useGame((s) => s.focus);
  const title = useGame((s) => s.snapshot?.scenario.role);
  return (
    <>
      <div className="glass pointer-events-none absolute top-4 left-4 rounded-full px-4 py-2 text-[0.82rem] font-semibold">
        LexSim <span className="mx-1.5 text-white/35">·</span> {title}
      </div>
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 shadow-[0_0_0_1.5px_rgba(0,0,0,0.35)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[16%] flex justify-center" aria-live="polite">
        <AnimatePresence>
          {focus && (
            <motion.p key={focus.id} {...sheet} transition={spring} className="glass rounded-full px-5 py-2.5 text-[0.95rem] font-medium">
              <kbd>E</kbd> <span className="ml-2">{focus.prompt}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <p className="glass pointer-events-none absolute bottom-4 left-4 hidden rounded-full px-4 py-2 text-[0.78rem] text-white/80 sm:block">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> yurish <span className="mx-1.5 text-white/30">·</span> sichqoncha - qarash{' '}
        <span className="mx-1.5 text-white/30">·</span> <kbd>Shift</kbd> tez <span className="mx-1.5 text-white/30">·</span> <kbd>Esc</kbd> pauza
      </p>
    </>
  );
}

/** Shown while resting on a lobby seat: you can look around, nothing else is asked of you. */
export function RestHud() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
      <p className="glass pointer-events-none absolute inset-x-0 bottom-[12%] mx-auto w-fit rounded-full px-5 py-2.5 text-[0.95rem] font-medium" role="status">
        <kbd>G</kbd> <span className="ml-2">Oʻrnidan turish</span>
      </p>
    </>
  );
}

export function Briefing({ onStart, immersive }: { onStart: () => void; immersive: boolean }) {
  const snapshot = useGame((s) => s.snapshot)!;
  const worldReady = useGame((s) => s.worldReady);
  const busy = useGame((s) => s.busy);
  const { scenario, mode } = snapshot;
  const profile = useProfile();
  const ready = !immersive || worldReady;
  return (
    <div className={immersive ? 'absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/40 p-4' : ''}>
      <motion.div
        {...sheet}
        transition={spring}
        role="dialog"
        aria-modal={immersive}
        aria-labelledby="briefing-title"
        className={`w-full max-w-xl rounded-[28px] p-6 sm:p-8 ${immersive ? 'glass-light' : 'border border-line bg-card'}`}
      >
        <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-accent-ink">
          Brifing · {scenario.role} · {scenario.level} · {scenario.durationMinutes} daqiqa
        </p>
        <h1 id="briefing-title" className="display mt-2 text-3xl font-semibold">{profile ? `${profile.name}, bugungi ish joyingiz` : 'Bugungi ish joyingiz'}</h1>
        <p className="mt-2 text-[0.98rem] text-ink-2">{scenario.briefing.workplace}</p>
        <p className="font-medium">{scenario.briefing.position}</p>

        <h2 className="mt-5 text-[0.8rem] font-semibold uppercase tracking-wider text-ink-3">Vakolatlaringiz</h2>
        <ul className="mt-1.5 space-y-1 text-[0.93rem]">
          {scenario.briefing.authority.map((a) => (
            <li key={a} className="flex gap-2"><span aria-hidden className="text-accent">•</span>{a}</li>
          ))}
        </ul>
        <h2 className="mt-4 text-[0.8rem] font-semibold uppercase tracking-wider text-ink-3">Vazifa</h2>
        <ul className="mt-1.5 space-y-1 text-[0.93rem]">
          {scenario.briefing.task.map((a) => (
            <li key={a} className="flex gap-2"><span aria-hidden className="text-accent">•</span>{a}</li>
          ))}
        </ul>

        <p className="mt-5 rounded-2xl bg-paper px-4 py-3 text-[0.8rem] leading-relaxed text-ink-2">
          {mode === 'tutorial'
            ? 'Mashq rejimi: fuqaroning sabr va ishonch darajasi ekranda koʻrinadi.'
            : 'Baholash rejimi: koʻrsatkichlar yashirin - fuqaroning holatini uning oʻzidan oʻqing.'}{' '}
          {scenario.disclaimer}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary min-w-40" disabled={!ready || busy} onClick={onStart}>
            {ready ? 'Ishni boshlash' : '3D muhit yuklanmoqda…'}
          </button>
          {immersive && (
            <Link href={`/simulation/${snapshot.sessionId}?view=2d`} className="btn btn-quiet" replace>
              2D rejimda oʻtish
            </Link>
          )}
        </div>
        {immersive && (
          <p className="mt-3 text-[0.78rem] text-ink-3">Boshlagach sichqoncha qulflanadi. Chiqish - Esc. Vaqt hisobi shu tugmadan boshlanadi.</p>
        )}
      </motion.div>
    </div>
  );
}

const QUALITY: { id: Quality; label: string }[] = [
  { id: 'low', label: 'Past' },
  { id: 'medium', label: 'Oʻrta' },
  { id: 'high', label: 'Yuqori' },
];

function Range({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-[0.88rem] font-medium"><span>{label}</span><span className="tabular-nums text-ink-3">{format(value)}</span></span>
      <input type="range" className="mt-1 h-11 w-full accent-[var(--color-accent)]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function PauseMenu() {
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const resume = useGame((s) => s.resume);
  const sessionId = useGame((s) => s.snapshot!.sessionId);
  const dismiss = useDismiss(resume);
  return (
    <div {...dismiss} className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/45 p-4">
      <motion.div {...sheet} transition={spring} role="dialog" aria-modal="true" aria-labelledby="pause-title" className="glass-light w-full max-w-md rounded-[28px] p-6">
        <h2 id="pause-title" className="display text-2xl font-semibold">Pauza</h2>
        <p className="mt-1 text-[0.86rem] text-ink-2">Sessiya serverda saqlanadi - sahifani yangilasangiz ham davom etadi.</p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-[0.88rem] font-medium">Grafika sifati</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-full bg-black/5 p-1" role="radiogroup" aria-label="Grafika sifati">
              {QUALITY.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.quality === q.id}
                  onClick={() => setSettings({ quality: q.id, autoQuality: false })}
                  className={`min-h-10 rounded-full text-[0.88rem] font-semibold transition-colors ${settings.quality === q.id ? 'bg-white shadow-sm' : 'text-ink-2'}`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <Range label="Koʻrish burchagi" value={settings.fov} min={60} max={82} step={1} onChange={(fov) => setSettings({ fov })} format={(v) => `${v}°`} />
          <Range label="Sichqoncha sezgirligi" value={settings.sensitivity} min={0.4} max={2} step={0.05} onChange={(sensitivity) => setSettings({ sensitivity })} format={(v) => `${v.toFixed(2)}×`} />
          <Range label="Ovoz balandligi" value={settings.volume} min={0} max={1} step={0.05} onChange={(volume) => setSettings({ volume })} format={(v) => `${Math.round(v * 100)}%`} />
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-[0.88rem] font-medium">
            Harakatni kamaytirish
            <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={settings.reducedMotion} onChange={(e) => setSettings({ reducedMotion: e.target.checked })} />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary flex-1" onClick={resume} autoFocus>Davom etish</button>
          <Link href={`/simulation/${sessionId}?view=2d`} className="btn btn-quiet" replace>2D rejim</Link>
          <Link href="/kampus" className="btn btn-quiet">Yoʻlakka chiqish</Link>
        </div>
      </motion.div>
    </div>
  );
}

export function Outcome({ delay = 0.5 }: { delay?: number }) {
  const snapshot = useGame((s) => s.snapshot)!;
  const outcome = snapshot.outcome;
  if (!outcome) return null;
  const tone = outcome.id === 'excellent' ? 'text-accent-ink' : outcome.id === 'average' ? 'text-warn' : 'text-danger';
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay }}>
      <motion.div {...sheet} transition={{ ...spring, delay }} role="dialog" aria-modal="true" aria-labelledby="outcome-title" className="glass-light w-full max-w-lg rounded-[28px] p-7 text-center">
        <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-ink-3">Qabul yakunlandi</p>
        <h2 id="outcome-title" className={`display mt-2 text-3xl font-semibold ${tone}`}>{outcome.title}</h2>
        <p className="mx-auto mt-3 max-w-[42ch] text-[0.98rem] leading-relaxed text-ink-2">{outcome.description}</p>
        <Link href={`/simulation/${snapshot.sessionId}/report`} className="btn btn-primary mt-6 min-w-52" autoFocus>
          Hisobotni koʻrish
        </Link>
      </motion.div>
    </motion.div>
  );
}

export function Toasts() {
  const error = useGame((s) => s.error);
  const notice = useGame((s) => s.qualityNotice);
  const dismiss = useGame((s) => s.dismissError);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {error && (
          <motion.div key="error" {...sheet} transition={spring} role="alert" className="pointer-events-auto flex items-center gap-3 rounded-full bg-danger px-4 py-2 text-[0.9rem] font-medium text-white shadow-lg">
            {error}
            <button type="button" className="rounded-full bg-white/20 px-3 py-1 text-[0.8rem]" onClick={dismiss}>Yopish</button>
          </motion.div>
        )}
        {notice && (
          <motion.div key="notice" {...sheet} transition={spring} role="status" className="glass pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2 text-[0.86rem]">
            Silliq ishlashi uchun grafika sifati pasaytirildi.
            <button type="button" className="rounded-full bg-white/15 px-3 py-1 text-[0.8rem]" onClick={() => useGame.setState({ qualityNotice: false })}>Tushunarli</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function EngineBadge() {
  const engine = useGame((s) => s.snapshot?.engine);
  if (engine !== 'scripted') return null;
  return (
    <p className="glass pointer-events-none absolute bottom-4 right-4 hidden rounded-full px-3 py-1.5 text-[0.72rem] text-white/75 md:block">
      Ssenariyli demo personaj · jonli AI modeli ulanmagan
    </p>
  );
}
