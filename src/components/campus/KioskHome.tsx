'use client';
/**
 * The terminal's home: what the student can do, in three tabs -
 *   Ishlar           - the two case paths, each with its progress and ONE clear next step;
 *   Sud majlislari   - the court server's cases (random or chosen) and the presiding-judge hearing;
 *   Boshqa           - the library and the DXM office.
 * One scroll area for everything: nothing is squeezed or cut off at the bottom.
 */
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ease } from '@/lib/motion';
import { useEffect, useState } from 'react';
import type { Level, RemoteStatus } from '@/contracts';
import { type CaseKind, type CaseSnapshot } from '@/contracts/case';
import { ApiError, api } from '@/game/api';
import { DOORS, STAGE_DOOR } from '@/game/campus';
import { kindOfStage } from '@/contracts/case';
import { pickScenario } from '@/game/randomCase';
import { ensureCase } from '@/game/rooms';

const spring = ease.surface;
const LEVELS: [Level, string, string][] = [
  ['beginner', 'Boshlangʻich', 'variant + oʻz soʻzingiz'],
  ['intermediate', 'Oʻrta', 'oʻz soʻzingiz, variant −10'],
  ['advanced', 'Professional', 'faqat oʻz soʻzingiz, maslahatsiz'],
];
const levelName = (lv: Level) => LEVELS.find(([id]) => id === lv)![1];

const CASES: Record<CaseKind, { tag: string; title: string; role: string }> = {
  labour: { tag: 'Fuqarolik ishi · FPK', title: 'Sardor N. - «Namuna Savdo» MChJ: ishga tiklash', role: 'Siz - daʼvogarning advokati' },
  theft: { tag: 'Jinoyat-protsessual · JPK', title: 'Nodira K. - telefon oʻgʻirligi', role: 'Siz - jabrlanuvchining advokati' },
};

type Tab = 'cases' | 'court' | 'other';
const TAB_KEY = 'lexsim.kiosk.tab';
/** «Ish 2 · …» in the room subtitles: the card already says which case */
const bare = (t: string) => t.replace(/^Ish \d+ · /, '');

function Chevron() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>;
}
function Check() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5 10 17.5 19 7" /></svg>;
}

/* ───────────────────────── a case path ───────────────────────── */

function CaseCard({ kind, snap, setSnap, onEnter }: { kind: CaseKind; snap: CaseSnapshot | null | undefined; setSnap: (c: CaseSnapshot) => void; onEnter: (doorId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState(false);
  const info = CASES[kind];
  const level = snap?.level ?? 'beginner';
  const stages = snap?.stages ?? DOORS.filter((d) => d.stage && kindOfStage(d.stage) === kind).map((d, i) => ({ id: d.stage!, number: i + 1, place: d.title, title: d.subtitle, status: 'open' as const, score: null }));
  const done = stages.filter((s) => s.status === 'done').length;
  const next = stages.find((s) => s.status !== 'done');
  const restart = async (lv: Level) => {
    setBusy(true);
    try {
      setSnap(await ensureCase(true, kind, lv));
      setLevels(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`case-${kind}`} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 sm:p-5">
      <p className="text-[0.66rem] font-semibold tracking-[0.18em] text-amber-200/90 uppercase">{info.tag}</p>
      <h3 id={`case-${kind}`} className="mt-1 text-[1.08rem] leading-snug font-semibold text-balance">{info.title}</h3>
      <p className="mt-0.5 text-[0.8rem] text-white/55">{info.role}</p>

      {/* progress + level, one quiet line */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-36 flex-1 items-center gap-2.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <span className="block h-full rounded-full bg-emerald-400 transition-[width] duration-500 ease-out" style={{ width: `${(done / stages.length) * 100}%` }} />
          </span>
          <span className="text-[0.74rem] text-white/60 tabular-nums">{done}/{stages.length} bosqich</span>
        </div>
        <button type="button" onClick={() => setLevels((v) => !v)} aria-expanded={levels}
          className="flex min-h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[0.76rem] text-white/75 transition-colors duration-150 hover:bg-white/[0.12]">
          Daraja: <span className="font-semibold text-white">{levelName(level)}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden className={`transition-transform duration-200 ${levels ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {levels && (
          <motion.div key="levels" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
            <div className="mt-3 rounded-xl bg-black/20 p-3 ring-1 ring-white/[0.07]">
              <p className="text-[0.74rem] text-amber-200/80">Daraja oʻzgarsa, ish shu darajada yangidan boshlanadi.</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Daraja">
                {LEVELS.map(([lv, name, note]) => (
                  <button key={lv} type="button" role="radio" aria-checked={lv === level} disabled={busy}
                    onClick={() => (lv === level ? setLevels(false) : void restart(lv))}
                    className={`rounded-lg px-3 py-2 text-left transition-colors duration-150 ${lv === level ? 'bg-white text-[#0b1322]' : 'bg-white/[0.06] hover:bg-white/[0.12]'}`}>
                    <span className="block text-[0.82rem] font-semibold">{name}</span>
                    <span className={`block text-[0.7rem] ${lv === level ? 'text-[#0b1322]/60' : 'text-white/50'}`}>{note}</span>
                  </button>
                ))}
              </div>
              {snap && (
                <button type="button" disabled={busy} onClick={() => void restart(level)} className="mt-2 text-[0.74rem] font-semibold text-white/60 underline-offset-2 hover:text-white hover:underline">
                  Shu darajada yangi ish boshlash
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the path: every room is a step; any step can be opened */}
      <ol className="mt-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="Bosqichlar">
        {stages.map((s, i) => {
          const current = s.id === next?.id;
          return (
            <li key={s.id} className="relative">
              {i > 0 && <span aria-hidden className={`absolute top-[15px] right-1/2 h-px w-full ${stages[i - 1].status === 'done' ? 'bg-emerald-400/60' : 'bg-white/12'}`} />}
              <button type="button" onClick={() => onEnter(STAGE_DOOR[s.id])} aria-current={current ? 'step' : undefined}
                className="group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-1 pt-0 pb-1.5 text-center transition-colors duration-150 hover:bg-white/[0.06]"
                title={`${s.place} - ${bare(s.title)}`}>
                <span className={`grid size-[30px] place-items-center rounded-full text-[0.78rem] font-bold ring-4 ring-[#0d1626] transition-transform duration-150 group-active:scale-95 ${
                  s.status === 'done' ? 'bg-emerald-500 text-white' : s.status === 'returned' ? 'bg-red-500 text-white' : current ? 'bg-white text-[#0b1322]' : 'bg-[#1c2638] text-white/60'}`}>
                  {s.status === 'done' ? <Check /> : s.number}
                </span>
                <span className={`line-clamp-2 text-[0.7rem] leading-tight ${current ? 'font-semibold text-white' : 'text-white/60'}`}>{s.place}</span>
                {s.score !== null && <span className="text-[0.64rem] text-emerald-300/80 tabular-nums">{s.score} ball</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {/* one obvious next step */}
      <button type="button" onClick={() => onEnter(STAGE_DOOR[(next ?? stages[0]).id])}
        className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl bg-[#1f8a5b] px-4 text-left transition-[background-color,transform] duration-150 hover:bg-[#23a06a] active:scale-[0.99]">
        <span className="min-w-0 flex-1">
          <span className="block text-[0.7rem] text-white/75">{next ? (done ? 'Davom etish' : 'Boshlash') : 'Ish yakunlangan · qayta koʻrish'}</span>
          <span className="block truncate text-[0.95rem] font-semibold">{(next ?? stages[0]).number}. {(next ?? stages[0]).place} - {bare((next ?? stages[0]).title)}</span>
        </span>
        <Chevron />
      </button>
    </section>
  );
}

/* ───────────────────────── a row (court cases, other rooms) ───────────────────────── */

function Row({ title, sub, meta, onClick, disabled, busy }: { title: string; sub?: string; meta?: string; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onClick} disabled={disabled} aria-busy={busy}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.07] disabled:opacity-50">
        <span className="min-w-0 flex-1">
          <span className="block text-[0.92rem] leading-snug font-semibold">{title}</span>
          {sub && <span className="block text-[0.76rem] leading-snug text-white/55">{sub}</span>}
        </span>
        {meta && <span className="shrink-0 text-[0.72rem] text-white/45 tabular-nums">{busy ? 'Ochilmoqda…' : meta}</span>}
        <span className="text-white/40"><Chevron /></span>
      </button>
    </li>
  );
}

/* ───────────────────────── the home ───────────────────────── */

export function KioskHome({ caseSnap, setCaseSnap, theftSnap, setTheftSnap, onEnter }: {
  caseSnap: CaseSnapshot | null | undefined;
  setCaseSnap: (c: CaseSnapshot) => void;
  theftSnap: CaseSnapshot | null | undefined;
  setTheftSnap: (c: CaseSnapshot) => void;
  onEnter: (doorId: string) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = localStorage.getItem(TAB_KEY);
      return t === 'court' || t === 'other' ? t : 'cases';
    } catch {
      return 'cases';
    }
  });
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* not remembered */
    }
  };

  // the court server answers or not; the terminal never waits on it
  const [remote, setRemote] = useState<RemoteStatus | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api.remoteStatus().then((r) => alive && setRemote(r), () => alive && setRemote(null));
    return () => {
      alive = false;
    };
  }, []);
  const scenarios = remote?.ok ? remote.scenarios : [];
  const [level, setLevel] = useState<Level>('beginner');
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (key: string, work: () => Promise<string>) => {
    if (starting) return;
    setStarting(key);
    setError(null);
    try {
      router.push(await work());
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Ochib boʻlmadi');
      setStarting(null);
    }
  };
  const economic = (id: string) => go(id, async () => `/sud/${(await api.createSession(id, 'tutorial', level)).sessionId}`);
  const random = () => {
    const id = pickScenario(scenarios.map((s) => s.id));
    if (id) void economic(id);
  };
  const presiding = () =>
    go('presiding', async () => {
      const res = await fetch('/api/v1/hearings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = (await res.json()) as { hearing?: { hearingId: string }; error?: { message: string } };
      if (!res.ok || !json.hearing) throw new Error(json.error?.message ?? 'Majlisni boshlab boʻlmadi');
      return `/court/${json.hearing.hearingId}`;
    });
  const dxm = () => go('dxm', async () => `/simulation/${(await api.createSession('dxm-yoqolgan-staj', 'tutorial')).sessionId}`);

  // [id, label, short label on a phone, count]
  const TABS: [Tab, string, string, number][] = [
    ['cases', 'Ishlar', 'Ishlar', 2],
    ['court', 'Sud majlislari', 'Sud', scenarios.length + 2],
    ['other', 'Boshqa', 'Boshqa', 2],
  ];

  return (
    <>
      <div role="tablist" aria-label="Boʻlimlar" className="mx-6 mt-4 grid grid-cols-3 gap-1 rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
        {TABS.map(([id, label, short, count]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls="kiosk-panel" onClick={() => choose(id)}
            className={`relative min-h-10 rounded-lg px-2 text-[0.84rem] font-semibold transition-colors duration-150 ${tab === id ? 'text-[#0b1322]' : 'text-white/65 hover:text-white'}`}>
            {tab === id && <motion.span layoutId="kiosk-tab" transition={spring} className="absolute inset-0 rounded-lg bg-white" aria-hidden />}
            <span className="relative">
              <span className="sm:hidden">{short}</span>
              <span className="max-sm:hidden">{label}</span>
              <span className={`ml-1.5 text-[0.72rem] tabular-nums ${tab === id ? "text-[#0b1322]/50" : "text-white/35"}`}>{count}</span>
            </span>
          </button>
        ))}
      </div>

      <div id="kiosk-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="scroll-soft min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="space-y-3">
            {tab === 'cases' && (
              <>
                <p className="text-[0.84rem] text-white/55">Har bir xona - ishning bir bosqichi. Navbatdagisidan davom eting yoki istalganini oching.</p>
                <CaseCard kind="labour" snap={caseSnap} setSnap={setCaseSnap} onEnter={onEnter} />
                <CaseCard kind="theft" snap={theftSnap} setSnap={setTheftSnap} onEnter={onEnter} />
              </>
            )}

            {tab === 'court' && (
              <>
                <ul className="rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
                  <Row title="Bahs - jamoaviy sud" sub="Kursdoshlar bilan 1×1, 2×2 yoki 3×3 · sudya - sunʼiy intellekt" meta="2-6 kishi" onClick={() => void go('moot', async () => '/bahs')} disabled={Boolean(starting)} busy={starting === 'moot'} />
                </ul>
                <section aria-labelledby="eco-title" className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 sm:p-5">
                  <p className="text-[0.66rem] font-semibold tracking-[0.18em] text-amber-200/90 uppercase">Iqtisodiy sud · tomon vakili</p>
                  <h3 id="eco-title" className="mt-1 text-[1.08rem] font-semibold">Sud majlisida oʻz soʻzingiz bilan</h3>
                  <p className="mt-0.5 text-[0.8rem] text-white/55">Sudya va raqib sizning gapingizga qarab javob beradi. Har qadam IPK moddasiga bogʻlangan.</p>
                  <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1" role="radiogroup" aria-label="Daraja">
                    {LEVELS.map(([lv, name]) => (
                      <button key={lv} type="button" role="radio" aria-checked={level === lv} onClick={() => setLevel(lv)}
                        className={`min-h-9 rounded-lg text-[0.8rem] font-semibold transition-colors duration-150 ${level === lv ? 'bg-white text-[#0b1322]' : 'text-white/65 hover:text-white'}`}>{name}</button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[0.72rem] text-white/45">{LEVELS.find(([id]) => id === level)![2]}</p>
                  {remote === undefined && <p className="mt-3 text-[0.82rem] text-white/50" role="status">Sud serveri tekshirilmoqda…</p>}
                  {remote !== undefined && !scenarios.length && <p className="mt-3 rounded-xl bg-white/[0.04] p-3 text-[0.82rem] text-white/55" role="status">Sud serveri hozir javob bermayapti. Birozdan keyin qayta oching.</p>}
                  {scenarios.length > 0 && (
                    <>
                      {scenarios.length > 1 && (
                        <button type="button" onClick={random} disabled={Boolean(starting)}
                          className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl bg-[#1f8a5b] px-4 text-left transition-[background-color,transform] duration-150 hover:bg-[#23a06a] active:scale-[0.99] disabled:opacity-60">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[0.95rem] font-semibold">Tasodifiy ish</span>
                            <span className="block text-[0.72rem] text-white/75">{scenarios.length} ta ishdan biri · oxirgi uchtasi takrorlanmaydi</span>
                          </span>
                          <Chevron />
                        </button>
                      )}
                      <ul className="-mx-1.5 mt-2 divide-y divide-white/[0.06]" aria-label="Iqtisodiy sud ishlari">
                        {scenarios.map((sc) => (
                          <Row key={sc.id} title={(sc.title || sc.role).split(/\s+[---]\s+/)[0]} sub={sc.position || sc.role} meta={`${sc.durationMinutes} daq.`}
                            onClick={() => void economic(sc.id)} disabled={Boolean(starting)} busy={starting === sc.id} />
                        ))}
                      </ul>
                    </>
                  )}
                </section>
                <section aria-labelledby="presiding-title" className="rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
                  <h3 id="presiding-title" className="sr-only">Raislik qiluvchi</h3>
                  <ul>
                    <Row title="Raislik qiluvchi sudya" sub="Fuqarolik ishi · majlisni FPK tartibida 14 bosqichda olib borasiz" meta="10-15 daq." onClick={() => void presiding()} disabled={Boolean(starting)} busy={starting === 'presiding'} />
                  </ul>
                </section>
              </>
            )}

            {tab === 'other' && (
              <ul className="rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
                {DOORS.filter((d) => d.action === 'library').map((d) => (
                  <Row key={d.id} title={d.title} sub={`${d.subtitle} · ${d.basis}`} onClick={() => onEnter(d.id)} />
                ))}
                <Row title="DXM xodimi" sub="Davlat xizmati · nafaqasi kam chiqqan fuqaro bilan suhbat" meta="12-18 daq." onClick={() => void dxm()} disabled={Boolean(starting)} busy={starting === 'dxm'} />
              </ul>
            )}

            <AnimatePresence>
              {error && (
                <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="rounded-xl bg-red-500/15 px-3.5 py-2.5 text-[0.82rem] text-red-200">{error}</motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
