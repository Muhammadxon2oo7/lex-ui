'use client';
/**
 * Client boundary of the simulation route. Loads the authoritative session
 * snapshot (refresh-safe), then mounts either the lazy 3D world or the
 * accessible 2D workflow — same session, same server state.
 */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { DialoguePanel } from '@/components/hud/DialoguePanel';
import { DialogueStage } from '@/components/hud/DialogueStage';
import { DocumentForm } from '@/components/hud/DocumentForm';
import { Briefing, EngineBadge, ExploreHud, Objectives, Outcome, PauseMenu, RestHud, Toasts } from '@/components/hud/Overlays';
import { ApiError, api } from '@/game/api';
import { audio } from '@/game/audio';
import { useGame } from '@/game/store';

const WorldCanvas = dynamic(() => import('@/components/world/WorldCanvas'), { ssr: false });
const ItemViewer = dynamic(() => import('@/components/world/ItemViewer'), { ssr: false });

function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6">
      <div className="max-w-md rounded-[28px] border border-line bg-card p-8 text-center">
        <h1 className="display text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-ink-2">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </main>
  );
}

function webglAvailable(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

function Immersive({ onUnsupported }: { onUnsupported: () => void }) {
  const mode = useGame((s) => s.mode);
  // the result card waits for the citizen to stand up and walk out
  const settingsReduced = useGame((s) => s.settings.reducedMotion);
  const begin = useGame((s) => s.begin);
  const pause = useGame((s) => s.pause);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    if (!webglAvailable()) onUnsupported();
  }, [onUnsupported]);

  // Esc while seated (no pointer lock to release) opens the pause menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useGame.getState().mode === 'seated') pause();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      audio.suspend();
    };
  }, [pause]);

  if (contextLost) {
    return (
      <Notice title="Grafika uzildi" body="Brauzer 3D kontekstni yoʻqotdi. Sessiyangiz saqlangan — qayta yuklang yoki 2D rejimda davom eting.">
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Qayta yuklash</button>
        <button type="button" className="btn btn-quiet" onClick={onUnsupported}>2D rejim</button>
      </Notice>
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0c0f14] text-white select-none">
      <div className="absolute inset-0" inert={mode !== 'exploring' && mode !== 'seated' && mode !== 'resting'}>
        <WorldCanvas onContextLost={() => setContextLost(true)} />
      </div>

      {mode === 'exploring' && <ExploreHud />}
      {mode === 'resting' && <RestHud />}
      {(mode === 'exploring' || mode === 'resting') && <Objectives />}
      {mode === 'exploring' && <EngineBadge />}

      {mode === 'seated' && <DialogueStage />}

      {mode === 'briefing' && <Briefing immersive onStart={() => void begin()} />}
      {mode === 'document' && <div className="select-text"><DocumentForm /></div>}
      {mode === 'paused' && <div className="select-text text-ink"><PauseMenu /></div>}
      {mode === 'ended' && <Outcome delay={settingsReduced ? 0.5 : 7} />}
      <ItemViewer />
    </main>
  );
}

function Flat() {
  const mode = useGame((s) => s.mode);
  const snapshot = useGame((s) => s.snapshot)!;
  const start = async () => {
    const game = useGame.getState();
    await game.begin();
    await useGame.getState().sit();
  };
  // A session resumed from 3D may be "paused"/"exploring": in 2D you are always at the desk.
  useEffect(() => {
    if (snapshot.status !== 'in-progress') return;
    if (snapshot.turns.length === 0) void useGame.getState().sit();
    else if (mode === 'paused' || mode === 'exploring') useGame.setState({ mode: 'seated' });
  }, [mode, snapshot.status, snapshot.turns.length]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-accent-ink">LexSim · 2D rejim</p>
          <h1 className="display text-2xl font-semibold">{snapshot.scenario.role} · 3-xona</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/simulation/${snapshot.sessionId}`} className="btn btn-quiet" replace>3D rejim</Link>
          <Link href="/hub" className="btn btn-quiet">Chiqish</Link>
        </div>
      </header>

      {mode === 'briefing' ? (
        <div className="grid flex-1 place-items-center"><Briefing immersive={false} onStart={() => void start()} /></div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_18rem]">
          <div className="h-[72dvh] min-h-96 lg:h-auto"><DialoguePanel variant="plain" /></div>
          <aside className="space-y-4">
            <section className="rounded-[22px] border border-line bg-card p-4" aria-label="Vazifalar">
              <h2 className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-3">Vazifa</h2>
              <ol className="mt-2 space-y-2 text-[0.9rem]">
                {snapshot.objectives.map((o) => (
                  <li key={o.id} className={`flex gap-2 ${o.done ? 'text-ink-3 line-through' : ''}`}>
                    <span aria-hidden>{o.done ? '✓' : '○'}</span>{o.label}
                  </li>
                ))}
              </ol>
            </section>
            <p className="rounded-[22px] bg-navy p-4 text-[0.84rem] leading-relaxed text-white/85">
              Fuqaro stolingiz qarshisida oʻtiribdi. U muammosini oʻz soʻzlari bilan aytadi — muhim tafsilotlarni faqat toʻgʻri savol bersangiz ochadi.
            </p>
          </aside>
        </div>
      )}
      {mode === 'document' && <DocumentForm />}
      {mode === 'ended' && <Outcome />}
    </main>
  );
}

export default function SimulationClient() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const hydrate = useGame((s) => s.hydrate);
  const loaded = useGame((s) => s.snapshot?.sessionId === sessionId);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const flat = search.get('view') === '2d';

  useEffect(() => {
    let cancelled = false;
    useGame.setState({ snapshot: null, mode: 'loading', worldReady: false, focus: null, error: null });
    api
      .getSession(sessionId)
      .then((snapshot) => {
        if (cancelled) return;
        if (snapshot.status === 'report-ready') router.replace(`/simulation/${sessionId}/report`);
        else hydrate(snapshot);
      })
      .catch((err: unknown) => !cancelled && setFailure(err instanceof ApiError ? err : new ApiError(0, 'unknown', 'Xatolik')));
    return () => {
      cancelled = true;
    };
  }, [sessionId, hydrate, router]);

  if (failure) {
    return (
      <Notice title="Sessiya ochilmadi" body={failure.message}>
        <Link href="/kampus" className="btn btn-primary">Yoʻlakka qaytish</Link>
      </Notice>
    );
  }
  if (!loaded) return <main className="grid min-h-dvh place-items-center bg-[#0c0f14] text-white/70" role="status">Sessiya yuklanmoqda…</main>;

  return (
    <MotionConfig reducedMotion="user">
      <Toasts />
      {flat ? <Flat /> : <Immersive onUnsupported={() => router.replace(`/simulation/${sessionId}?view=2d`)} />}
    </MotionConfig>
  );
}
