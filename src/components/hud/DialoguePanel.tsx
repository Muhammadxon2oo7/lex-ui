'use client';
/**
 * Conversation UI (DOM, not 3D text): transcript, typed replies, discovered
 * facts and - in tutorial mode only - the patience / trust read-out.
 * Shared by the immersive view (floating sheet) and the 2D fallback.
 */
import { useEffect, useRef, useState } from 'react';
import type { Turn } from '@/contracts';
import { useGame } from '@/game/store';
import { ReplyChoices } from './DialogueStage';

/** Types the newest NPC line at reading speed; older lines render instantly. */
function useTypewriter(turn: Turn | undefined, enabled: boolean): string {
  const [shown, setShown] = useState({ id: '', n: 0 });
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!turn) return;
    if (seen.current === null || !enabled) {
      // First render (e.g. after a refresh): do not replay history.
      seen.current = turn.id;
      return;
    }
    if (seen.current === turn.id) return;
    seen.current = turn.id;
    let n = 0;
    const timer = setInterval(() => {
      n += 2;
      setShown({ id: turn.id, n });
      if (n >= turn.text.length) clearInterval(timer);
    }, 34);
    return () => clearInterval(timer);
  }, [turn, enabled]);

  if (!turn) return '';
  return shown.id === turn.id && shown.n < turn.text.length ? turn.text.slice(0, shown.n) : turn.text;
}

function Meter({ label, value, tone }: { label: string; value: number; tone: 'patience' | 'trust' }) {
  const low = value < 30;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between text-[0.72rem] font-medium opacity-80">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} / 100${low ? ', past' : ''}`}
      >
        <div
          className="h-full rounded-full transition-[width,background-color] duration-500 ease-out"
          style={{ width: `${value}%`, background: low ? '#ff7a6b' : tone === 'trust' ? '#5dd6a0' : '#f3c969' }}
        />
      </div>
    </div>
  );
}

export function DialoguePanel({ variant }: { variant: 'immersive' | 'plain' }) {
  const snapshot = useGame((s) => s.snapshot)!;
  const busy = useGame((s) => s.busy);
  const pendingText = useGame((s) => s.pendingText);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const say = useGame((s) => s.say);
  const choose = useGame((s) => s.choose);
  const stand = useGame((s) => s.stand);
  const finish = useGame((s) => s.finish);
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const active = snapshot.status === 'in-progress';
  const turns = snapshot.turns;
  const lastNpc = [...turns].reverse().find((t) => t.speaker === 'npc');
  const typed = useTypewriter(lastNpc, !reducedMotion);
  const dark = variant === 'immersive';

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [turns.length, typed, pendingText, reducedMotion]);

  useEffect(() => {
    if (active && !busy) input.current?.focus({ preventScroll: true });
  }, [active, busy, turns.length]);

  const submit = () => {
    const value = text.trim();
    if (!value || busy || !active) return;
    setText('');
    void say(value);
  };

  return (
    <section
      aria-label={`${snapshot.scenario.npc.name} bilan suhbat`}
      className={dark ? 'glass flex max-h-[min(58dvh,560px)] w-full flex-col rounded-[26px]' : 'flex h-full w-full flex-col rounded-[22px] border border-line bg-card'}
    >
      <header className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 pt-4 pb-3 ${dark ? 'border-b border-white/10' : 'border-b border-line'}`}>
        <div className="mr-auto">
          <h2 className="text-[1.05rem] font-semibold leading-tight">{snapshot.scenario.npc.name}</h2>
          <p className={`text-[0.78rem] ${dark ? 'text-white/60' : 'text-ink-3'}`}>
            {snapshot.scenario.npc.age} yosh · fuqaro · navbat A-047
          </p>
        </div>
        {snapshot.meters && (
          <div className={`flex w-full max-w-64 gap-4 ${dark ? '' : 'rounded-xl bg-navy px-3 py-2 text-white'}`}>
            <Meter label="Sabr" value={snapshot.meters.patience} tone="patience" />
            <Meter label="Ishonch" value={snapshot.meters.trust} tone="trust" />
          </div>
        )}
      </header>

      <div ref={scroller} className="scroll-soft min-h-24 flex-1 space-y-2.5 overflow-y-auto px-5 py-4" tabIndex={0} aria-label="Suhbat matni">
        {turns.map((turn) => {
          if (turn.speaker === 'system') {
            return (
              <p key={turn.id} className={`mx-auto max-w-[46ch] rounded-xl px-3 py-2 text-center text-[0.82rem] italic ${dark ? 'bg-amber-300/15 text-amber-100' : 'bg-warn-soft text-warn'}`}>
                {turn.text}
              </p>
            );
          }
          const mine = turn.speaker === 'user';
          const body = turn.id === lastNpc?.id ? typed : turn.text;
          return (
            <div key={turn.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <p
                className={`max-w-[min(86%,60ch)] rounded-[18px] px-3.5 py-2.5 text-[0.95rem] leading-snug ${
                  mine ? 'rounded-br-md bg-accent text-white' : dark ? 'rounded-bl-md bg-white/12' : 'rounded-bl-md bg-paper'
                }`}
              >
                {/* The full line is exposed to assistive tech; the typing effect is visual only. */}
                <span className="sr-only">{mine ? 'Siz: ' : `${snapshot.scenario.npc.name}: `}{turn.text}</span>
                <span aria-hidden>{body || ' '}</span>
              </p>
            </div>
          );
        })}
        {pendingText && (
          <div className="flex justify-end">
            <p className="max-w-[min(86%,60ch)] rounded-[18px] rounded-br-md bg-accent/70 px-3.5 py-2.5 text-[0.95rem] leading-snug text-white">{pendingText}</p>
          </div>
        )}
        {busy && pendingText && (
          <p className={`text-[0.8rem] ${dark ? 'text-white/55' : 'text-ink-3'}`} role="status">
            {snapshot.scenario.npc.name} oʻylamoqda…
          </p>
        )}
      </div>

      {snapshot.facts.length > 0 && (
        <div className={`px-5 pb-2 ${dark ? 'text-white/85' : 'text-ink-2'}`} aria-live="polite">
          <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider opacity-60">
            Aniqlangan faktlar · {snapshot.facts.length}/{snapshot.factsTotal}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {snapshot.facts.map((f) => (
              <li key={f.id} className={`rounded-full px-2.5 py-1 text-[0.76rem] leading-tight ${dark ? 'bg-emerald-300/15 text-emerald-100' : 'bg-accent-soft text-accent-ink'}`}>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {active && (
        <footer className="px-4 pt-1 pb-4">
          {!busy && snapshot.options.length > 0 && (
            <div className="mb-3">
              <ReplyChoices key={snapshot.options.map((o) => o.id).join('|')} options={snapshot.options} disabled={busy} onPick={(o) => void choose(o)} dark={dark} />
            </div>
          )}
          <div className={`flex items-end gap-2 rounded-[20px] p-1.5 ${dark ? 'bg-white/10' : 'bg-paper'}`}>
            <label htmlFor="reply" className="sr-only">Javobingiz</label>
            <textarea
              id="reply"
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              maxLength={800}
              placeholder="Yoki oʻz soʻzingiz bilan yozing (Enter - yuborish)"
              className={`min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-base outline-none ${dark ? 'placeholder:text-white/45' : 'placeholder:text-ink-3'}`}
            />
            <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !text.trim()}>
              Yuborish
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-quiet !min-h-10 text-[0.88rem]" onClick={() => useGame.getState().openTerminal()}>
              {snapshot.documentSubmitted ? 'Terminal · yuborilgan' : 'Terminal - hujjat'}
            </button>
            {variant === 'immersive' && (
              <button type="button" className="btn btn-quiet !min-h-10 text-[0.88rem]" onClick={stand}>
                Oʻrnidan turish
              </button>
            )}
            <span className="flex-1" />
            {confirming ? (
              <span className="flex items-center gap-2 text-[0.85rem]" role="group" aria-label="Qabulni yakunlashni tasdiqlang">
                <span className="opacity-80">Yakunlansinmi? Keyin oʻzgartirib boʻlmaydi.</span>
                <button type="button" className="btn btn-danger !min-h-10" disabled={busy} onClick={() => void finish()}>
                  Ha, yakunlash
                </button>
                <button type="button" className="btn btn-quiet !min-h-10" onClick={() => setConfirming(false)}>
                  Yoʻq
                </button>
              </span>
            ) : (
              <button type="button" className={`btn !min-h-10 text-[0.88rem] ${dark ? 'btn-quiet' : 'btn-dark'}`} onClick={() => setConfirming(true)}>
                Qabulni yakunlash
              </button>
            )}
          </div>
        </footer>
      )}
    </section>
  );
}
