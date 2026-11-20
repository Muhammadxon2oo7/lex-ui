'use client';
/**
 * Everything on top of the campus world. There are no "pages" here — the
 * title screen, the character creator and free play are phases of one
 * continuous scene; this layer only adds what a game would put on screen.
 */
import { useProgress } from '@react-three/drei';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import { currentCase, ensureCase, roomUrl } from '@/game/rooms';
import { kindOfStage, type CaseKind, type CaseSnapshot } from '@/contracts/case';
import { audio } from '@/game/audio';
import { DOORS, STAGE_DOOR } from '@/game/campus';
import { useCampus } from '@/game/campusStore';
import { getProfile, saveProfile, useProfile, type AvatarModel, type Profile, type Role } from '@/game/profile';
import { useGame } from '@/game/store';
import { rig } from './CampusPlayer';
import { useDismiss } from '@/lib/useDismiss';
void rig;

const CampusCanvas = dynamic(() => import('./CampusCanvas'), { ssr: false });
const spring = { type: 'spring', bounce: 0, duration: 0.5 } as const;

function webgl2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

/* ───────────────────────── loading veil ───────────────────────── */

function Veil({ ready }: { ready: boolean }) {
  const { progress, active } = useProgress();
  const done = ready && !active && progress >= 100;
  return (
    <AnimatePresence>
      {!done && (
        <motion.div key="veil" className="fixed inset-0 z-50 grid place-items-center bg-[#07090d] text-white" exit={{ opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }}>
          <div className="w-64 text-center">
            <p className="text-[0.72rem] font-semibold tracking-[0.4em] text-white/50">LEXSIM</p>
            <div className="mt-4 h-[2px] overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Yuklanmoqda" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
              <div className="h-full bg-white/80 transition-[width] duration-300" style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
            <p className="mt-3 text-[0.78rem] text-white/45">Bino tayyorlanmoqda…</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────── orientation terminal ───────────────────────── */

const ROLE_LABEL = { student: 'Talaba', teacher: 'Oʻqituvchi' } as const;

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (!now) return null;
  const days = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
  const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return <span className="tabular-nums">{`${now.getDate()}-${months[now.getMonth()]}, ${days[now.getDay()]} · ${hh}:${mm}`}</span>;
}

function Segment<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.78rem] font-semibold tracking-wide text-white/60 uppercase">{label}</p>
      <div className="grid grid-flow-col gap-1 rounded-xl bg-white/[0.06] p-1 ring-1 ring-white/10" role="radiogroup" aria-label={label}>
        {options.map(([id, text]) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)} className={`min-h-11 rounded-lg text-[0.95rem] font-semibold transition-colors ${value === id ? 'bg-white text-[#0f1a2e]' : 'text-white/70 hover:text-white'}`}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The terminal everyone arrives at. First visit: registration. Then the
 * rooms — choose one and you are placed inside it. Walking the building is
 * optional ("Binoda yurish").
 */
/** "Ish yoʻli": the one case the corridor is about, and how far the student has taken it. */
const CASES: Record<CaseKind, { tag: string; title: string; role: string }> = {
  labour: { tag: 'Ish 1 · fuqarolik ishi (FPK)', title: 'Sardor N. — «Namuna Savdo» MChJ: ishga tiklash', role: 'Siz — daʼvogarning advokati.' },
  theft: { tag: 'Ish 2 · jinoyat-protsessual (JPK)', title: 'Nodira K. — telefon oʻgʻirligi', role: 'Siz — jabrlanuvchining advokati.' },
};

function CaseCard({ kind, snap, setSnap, onEnter }: { kind: CaseKind; snap: CaseSnapshot | null | undefined; setSnap: (c: CaseSnapshot) => void; onEnter: (doorId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const info = CASES[kind];
  const stages = snap?.stages ?? DOORS.filter((d) => d.stage && kindOfStage(d.stage) === kind).map((d, i) => ({ id: d.stage!, number: i + 1, place: d.title, title: d.subtitle, status: 'open' as const, score: null }));
  return (
    <section aria-labelledby={`case-${kind}`} className="mx-6 mt-3 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.66rem] font-semibold tracking-[0.2em] text-amber-200/90 uppercase">{info.tag}</p>
          <h3 id={`case-${kind}`} className="mt-0.5 text-[1.05rem] leading-tight font-semibold">{info.title}</h3>
          <p className="mt-1 text-[0.8rem] leading-snug text-white/55">{info.role} Istalgan bosqichdan boshlang.</p>
        </div>
        {snap && (
          <button type="button" className="btn btn-quiet !min-h-9 !rounded-lg !px-3 text-[0.8rem]" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              setSnap(await ensureCase(true, kind, snap.level));
            } finally {
              setBusy(false);
            }
          }}>Yangi ish</button>
        )}
      </div>
      {/* the level: how much help the case gives — changing it starts the case afresh at that level */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Daraja">
        <span className="mr-1 text-[0.72rem] text-white/50">Daraja:</span>
        {(['beginner', 'intermediate', 'advanced'] as const).map((lv) => {
          const on = (snap?.level ?? 'beginner') === lv;
          return (
            <button key={lv} type="button" role="radio" aria-checked={on} disabled={busy}
              title={on ? undefined : 'Ish shu darajada yangidan boshlanadi'}
              onClick={async () => {
                if (on) return;
                setBusy(true);
                try {
                  setSnap(await ensureCase(true, kind, lv));
                } finally {
                  setBusy(false);
                }
              }}
              className={`min-h-8 rounded-full px-3 text-[0.76rem] font-semibold transition-colors duration-150 ${on ? 'bg-white text-[#0b1322]' : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.12]'}`}>
              {lv === 'beginner' ? 'Boshlangʻich' : lv === 'intermediate' ? 'Oʻrta' : 'Professional'}
            </button>
          );
        })}
        <span className="ml-1 text-[0.7rem] text-white/40">{(snap?.level ?? 'beginner') === 'beginner' ? 'variant + oʻz soʻzingiz' : (snap?.level ?? 'beginner') === 'intermediate' ? 'oʻz soʻzingiz, variant −10' : 'faqat oʻz soʻzingiz, maslahatsiz'}</span>
      </div>
      <ol className={`mt-3 grid grid-cols-1 gap-1.5 ${stages.length > 3 ? 'sm:grid-cols-5' : 'sm:grid-cols-3'}`} aria-label="Bosqichlar">
        {stages.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onEnter(STAGE_DOOR[s.id])}
              className="flex h-full w-full items-center gap-2.5 rounded-lg bg-white/[0.05] px-2.5 py-2 text-left ring-1 ring-white/10 transition-colors duration-150 hover:bg-white/[0.1] hover:ring-[#1f8a5b]/60 sm:flex-col sm:items-start sm:gap-1">
              <span className={`grid size-6 shrink-0 place-items-center rounded-md text-[0.75rem] font-bold ${s.status === 'done' ? 'bg-emerald-500' : s.status === 'returned' ? 'bg-red-500' : 'bg-white/15'}`}>{s.number}</span>
              <span className="min-w-0">
                <span className="block text-[0.8rem] leading-tight font-semibold">{s.place}</span>
                <span className="block text-[0.7rem] leading-tight text-white/50">{s.score !== null ? `${s.score} ball` : s.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

const noSubscribe = () => () => {};
/** The terminal reads the saved profile, which exists only in the browser: render it there only. */
function Kiosk(props: { profile: Profile | null; onEnter: (doorId: string) => void; onWalk: () => void }) {
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  return mounted ? <KioskPanel {...props} /> : null;
}

function KioskPanel({ profile: live, onEnter, onWalk }: { profile: Profile | null; onEnter: (doorId: string) => void; onWalk: () => void }) {
  // Rendered only on the client after boot, so storage can be read directly.
  const stored = live ?? getProfile();
  const profile = stored;
  const [editing, setEditing] = useState(() => !stored);
  const [name, setName] = useState(stored?.name ?? '');
  const [avatar, setAvatar] = useState<AvatarModel>(stored?.avatar ?? 'man');
  const [role, setRole] = useState<Role>(stored?.role ?? 'student');
  const valid = name.trim().length >= 3;
  // the case in progress decides which doors are open
  const [caseSnap, setCaseSnap] = useState<CaseSnapshot | null | undefined>(undefined);
  const [theftSnap, setTheftSnap] = useState<CaseSnapshot | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void currentCase('labour').then((c) => alive && setCaseSnap(c), () => alive && setCaseSnap(null));
    void currentCase('theft').then((c) => alive && setTheftSnap(c), () => alive && setTheftSnap(null));
    return () => {
      alive = false;
    };
  }, []);
  const doorState = (d: (typeof DOORS)[number]): 'open' | 'done' | 'soon' => {
    if (!d.action) return 'soon';
    const snap = d.stage && kindOfStage(d.stage) === 'theft' ? theftSnap : caseSnap;
    return d.stage && snap?.stages.find((x) => x.id === d.stage)?.status === 'done' ? 'done' : 'open';
  };

  useEffect(() => {
    useCampus.getState().set({ avatar });
  }, [avatar]);

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ ...spring, delay: 0.15 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kiosk-title"
      className="absolute top-1/2 right-4 z-20 flex max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] -translate-y-1/2 flex-col overflow-hidden rounded-[18px] bg-[#0b1322]/95 text-white shadow-[0_40px_120px_rgba(0,0,0,0.6)] ring-1 ring-white/10 select-text sm:right-8"
    >
      <header className="flex items-center gap-4 border-b border-white/10 px-6 py-3.5">
        <span className="h-8 w-1 rounded-full bg-[#1f8a5b]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-semibold tracking-[0.3em] text-white/45">LEXSIM · HUQUQIY AMALIYOT MARKAZI</p>
          <h2 id="kiosk-title" className="text-[1.15rem] font-semibold tracking-tight">Yoʻnaltirish terminali</h2>
        </div>
        <p className="hidden text-right text-[0.78rem] text-white/50 sm:block"><Clock /></p>
      </header>

      {editing ? (
        <form
          className="scroll-soft flex-1 space-y-5 overflow-y-auto px-6 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            saveProfile({ name: name.trim(), avatar, role });
            setEditing(false);
          }}
        >
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">Roʻyxatdan oʻtish</h3>
            <p className="mt-1 text-[0.92rem] text-white/60">Maʼlumotlar faqat shu qurilmada saqlanadi va hisobotlarda koʻrsatiladi.</p>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[0.78rem] font-semibold tracking-wide text-white/60 uppercase">Familiya, ism</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus autoComplete="name" placeholder="Masalan: Karimova Aziza" className="min-h-12 w-full rounded-xl bg-white/[0.06] px-4 text-[1.05rem] ring-1 ring-white/10 outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-[#1f8a5b]" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Segment label="Maqom" value={role} onChange={setRole} options={[['student', 'Talaba'], ['teacher', 'Oʻqituvchi']]} />
            <Segment label="Jins" value={avatar} onChange={setAvatar} options={[['man', 'Erkak'], ['woman', 'Ayol']]} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn btn-primary !min-h-12 flex-1 !rounded-xl" disabled={!valid}>Davom etish</button>
            {profile && <button type="button" className="btn btn-quiet !min-h-12 !rounded-xl" onClick={() => setEditing(false)}>Bekor qilish</button>}
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-3 px-6 pt-5">
            <div className="min-w-0 flex-1">
              <p className="text-[0.78rem] text-white/50">{profile ? ROLE_LABEL[profile.role] : ''}</p>
              <h3 className="text-2xl leading-tight font-semibold tracking-tight text-balance break-words">Xush kelibsiz, {profile?.name}</h3>
            </div>
            <button type="button" className="btn btn-quiet !min-h-10 !rounded-xl text-[0.85rem]" onClick={() => setEditing(true)}>Profil</button>
          </div>
          <p className="px-6 pt-1 text-[0.9rem] text-white/60">Har bir eshik — ishning bir bosqichi. Ikki ish: fuqarolik va jinoyat-protsessual.</p>
          <CaseCard kind="labour" snap={caseSnap} setSnap={setCaseSnap} onEnter={onEnter} />
          <CaseCard kind="theft" snap={theftSnap} setSnap={setTheftSnap} onEnter={onEnter} />
          {/* the case rooms are already on the case cards above; here only the rest of the building */}
          <h4 className="px-6 pt-4 text-[0.78rem] font-semibold text-white/55">Boshqa xonalar</h4>
          <ul className="scroll-soft grid flex-1 gap-2 overflow-y-auto px-6 pt-2 pb-4 sm:grid-cols-2" aria-label="Boshqa xonalar">
            {DOORS.filter((d) => d.action !== 'case').map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  disabled={!d.action}
                  onClick={() => onEnter(d.id)}
                  className={`group flex h-full w-full flex-col rounded-xl p-4 text-left ring-1 transition-[background-color,transform] duration-150 active:scale-[0.985] disabled:cursor-not-allowed ${d.action ? 'bg-white/[0.05] ring-white/10 hover:bg-white/[0.1] hover:ring-[#1f8a5b]/60' : 'bg-white/[0.02] ring-white/5 opacity-55'}`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-[1rem] font-bold ${d.action ? 'bg-[#1f8a5b]' : 'bg-white/10'}`}>{d.number}</span>
                    <span className="min-w-0">
                      <span className="block text-[1rem] leading-tight font-semibold">{d.title}</span>
                      <span className="block text-[0.78rem] text-white/55">{d.subtitle}</span>
                    </span>
                  </span>
                  <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.74rem] text-white/55">
                    <span>Rol: <span className="text-white/80">{d.role}</span></span>
                    {d.action && <span>{d.minutes} daq.</span>}
                  </span>
                  <span className="mt-1 text-[0.74rem] leading-snug text-white/45">{d.basis}</span>
                  <span className={`mt-3 text-[0.8rem] font-semibold ${doorState(d) === 'open' ? 'text-[#5dd6a0]' : doorState(d) === 'done' ? 'text-sky-300' : 'text-white/40'}`}>
                    {{ open: 'Kirish →', done: '✓ Oʻtilgan — qayta kirish', soon: 'Tayyorlanmoqda' }[doorState(d)]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <footer className="flex flex-wrap items-center gap-2 border-t border-white/10 px-6 py-3.5">
            <button type="button" className="btn btn-quiet !min-h-10 !rounded-xl text-[0.86rem]" onClick={onWalk}>Binoda yurish</button>
            <Link href="/hub" className="btn btn-quiet !min-h-10 !rounded-xl text-[0.86rem]">2D rejim</Link>
            <p className="ml-auto text-[0.72rem] text-white/40">Oʻquv simulyatsiyasi · huquqiy matnlar lex.uz saytidan</p>
          </footer>
        </>
      )}
    </motion.section>
  );
}

/* ───────────────────────── in play ───────────────────────── */

function where(): string {
  const { x, z } = rig.position;
  if (z > 0.2) return 'Markaz oldidagi maydon';
  if (z > -9) return 'Foye';
  const near = DOORS.reduce((best, d) => (Math.abs(d.z - z) < Math.abs(best.z - z) ? d : best), DOORS[0]);
  return Math.abs(x) < 3 ? `Yoʻlak · ${near.number}-xona yonida` : 'Yoʻlak';
}

function PlayHud({ name }: { name: string }) {
  const focus = useCampus((s) => s.focus);
  const [place, setPlace] = useState('');
  const [locked, setLocked] = useState(false);
  const [hints, setHints] = useState(true);
  useEffect(() => {
    const tick = setInterval(() => setPlace(where()), 400);
    const fade = setTimeout(() => setHints(false), 14000);
    const onLock = () => setLocked(Boolean(document.pointerLockElement));
    document.addEventListener('pointerlockchange', onLock);
    onLock();
    return () => {
      clearInterval(tick);
      clearTimeout(fade);
      document.removeEventListener('pointerlockchange', onLock);
    };
  }, []);
  const door = focus?.kind === 'door' ? DOORS.find((d) => d.id === focus.id) : null;
  return (
    <>
      <div className="glass pointer-events-none absolute top-4 left-4 rounded-[18px] px-4 py-2.5">
        <p className="text-[0.66rem] font-semibold tracking-[0.18em] text-white/50 uppercase">{name} · stajyor</p>
        <p className="text-[0.92rem] font-semibold">{place}</p>
      </div>
      <div className="glass pointer-events-none absolute top-4 right-4 max-w-[17rem] rounded-[18px] px-4 py-2.5">
        <p className="text-[0.66rem] font-semibold tracking-[0.18em] text-amber-200 uppercase">Vazifa</p>
        <p className="text-[0.88rem] leading-snug">Binoga kiring va amaliyot xonasini tanlang. Foyedagi koʻrsatkichda hamma xonalar bor.</p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[14%] flex justify-center px-4" aria-live="polite">
        <AnimatePresence>
          {door && (
            <motion.div key={door.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={spring} className="glass flex items-center gap-3 rounded-[22px] py-2.5 pr-5 pl-2.5">
              <span className={`grid size-11 place-items-center rounded-2xl text-xl font-bold ${door.action ? 'bg-emerald-500/90' : 'bg-white/15'}`}>{door.number}</span>
              <span>
                <span className="block text-[1rem] leading-tight font-semibold">{door.title}</span>
                <span className="block text-[0.8rem] text-white/65">{door.action ? <><kbd>E</kbd> kirish · {door.subtitle}</> : 'Tez orada'}</span>
              </span>
            </motion.div>
          )}
          {focus?.kind === 'board' && (
            <motion.p key="board" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={spring} className="glass rounded-full px-5 py-2.5 text-[0.95rem] font-medium">
              <kbd>E</kbd> <span className="ml-2">Xonalar koʻrsatkichini oʻqish</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {!locked && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full bg-black/55 px-5 py-2.5 text-[0.95rem] font-medium backdrop-blur" role="status">
          Boshqarish uchun ekranni bosing
        </p>
      )}

      <AnimatePresence>
        {hints && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass pointer-events-none absolute bottom-4 left-4 hidden rounded-full px-4 py-2 text-[0.78rem] text-white/80 sm:block">
            <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> yurish · sichqoncha — qarash · <kbd>Shift</kbd> tez · gʻildirak — kamera · <kbd>E</kbd> amal · <kbd>Esc</kbd> pauza
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
}

function Board({ onClose }: { onClose: () => void }) {
  const dismiss = useDismiss(onClose);
  return (
    <motion.div {...dismiss} className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/55 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} role="dialog" aria-modal="true" aria-labelledby="board-title" className="glass-light w-full max-w-2xl rounded-[28px] p-6 sm:p-8">
        <p className="text-[0.72rem] font-semibold tracking-wider text-accent-ink uppercase">Foye · koʻrsatkich</p>
        <h2 id="board-title" className="display mt-1 text-3xl font-semibold">Xonalar</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {DOORS.map((d) => (
            <li key={d.id} className={`flex gap-3 rounded-2xl p-3 ${d.action ? 'bg-accent-soft' : 'bg-paper'}`}>
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg font-bold text-white ${d.action ? 'bg-accent' : 'bg-ink-3'}`}>{d.number}</span>
              <span>
                <span className="block font-semibold leading-tight">{d.title}</span>
                <span className="block text-[0.82rem] text-ink-2">{d.action ? d.subtitle : 'Tez orada'}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 grid gap-3 text-[0.88rem] leading-relaxed text-ink-2 sm:grid-cols-2">
          <p><strong className="text-ink">Qanday ishlaydi.</strong> Eshik oldiga boring va <kbd className="!border-line !bg-paper text-ink-2">E</kbd> bosing. Har bir xona — alohida ish kuni: brifing, ish jarayoni, yakunda hisobot.</p>
          <p><strong className="text-ink">Manbalar.</strong> Qonun matnlari lex.uz saytidan soʻzma-soʻz olingan. Mentor tasdiqlamagan joylar shunday deb belgilanadi.</p>
        </div>
        <button type="button" className="btn btn-primary mt-6" onClick={onClose} autoFocus>Yopish</button>
      </motion.section>
    </motion.div>
  );
}

function Pause({ onResume, onTerminal }: { onResume: () => void; onTerminal: () => void }) {
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const dismiss = useDismiss(onResume);
  return (
    <motion.div {...dismiss} className="absolute inset-0 z-30 grid place-items-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} role="dialog" aria-modal="true" aria-labelledby="pause-title" className="glass-light w-full max-w-sm rounded-[28px] p-6">
        <h2 id="pause-title" className="display text-2xl font-semibold">Pauza</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-[0.88rem] font-medium">
            <span className="flex justify-between"><span>Sichqoncha sezgirligi</span><span className="text-ink-3 tabular-nums">{settings.sensitivity.toFixed(2)}×</span></span>
            <input type="range" min={0.4} max={2} step={0.05} value={settings.sensitivity} onChange={(e) => setSettings({ sensitivity: Number(e.target.value) })} className="h-10 w-full accent-[var(--color-accent)]" />
          </label>
          <label className="block text-[0.88rem] font-medium">
            <span className="flex justify-between"><span>Ovoz</span><span className="text-ink-3 tabular-nums">{Math.round(settings.volume * 100)}%</span></span>
            <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => setSettings({ volume: Number(e.target.value) })} className="h-10 w-full accent-[var(--color-accent)]" />
          </label>
          <label className="flex min-h-11 items-center justify-between text-[0.88rem] font-medium">
            Harakatni kamaytirish
            <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={settings.reducedMotion} onChange={(e) => setSettings({ reducedMotion: e.target.checked })} />
          </label>
        </div>
        <div className="mt-5 grid gap-2">
          <button type="button" className="btn btn-primary" onClick={onResume} autoFocus>Davom etish</button>
          <button type="button" className="btn btn-quiet" onClick={onTerminal}>Terminalga qaytish</button>
          <Link href="/hub" className="btn btn-quiet">2D rejim</Link>
        </div>
      </motion.section>
    </motion.div>
  );
}

/* ───────────────────────── root ───────────────────────── */

export default function CampusClient() {
  const router = useRouter();
  const profile = useProfile();
  const phase = useCampus((s) => s.phase);
  const avatar = useCampus((s) => s.avatar);
  const toast = useCampus((s) => s.toast);
  const opening = useCampus((s) => s.opening);
  const settings = useGame((s) => s.settings);
  const [boot, setBoot] = useState<'pending' | 'ok' | 'no-webgl'>('pending');
  const [ready, setReady] = useState(false);
  const [black, setBlack] = useState(false);

  // Runs on first load AND every time the student comes back to this route:
  // with Cache Components the page is kept alive in a hidden <Activity>, so
  // local state (the black transition veil) survives navigation unless reset.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlack(false);
    // One-time read of browser-only state; it cannot exist during SSR, so it lands after mount.
    if (!webgl2()) {
       
      setBoot('no-webgl');
      return;
    }
    const campus = useCampus.getState();
    const p = getProfile();
    // Everyone arrives at the orientation terminal in the foyer.
    campus.set({ avatar: p?.avatar ?? 'man', spawnDoor: null, phase: 'kiosk', opening: null, focus: null, toast: null });
     
    setBoot('ok');
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useCampus.getState().set({ toast: null }), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const play = () => {
    audio.start(useGame.getState().settings.volume);
    useCampus.getState().set({ phase: 'play' });
    useCampus.getState().requestPointerLock?.();
  };

  // Walking through a door: it swings open, the screen dips to black, the room loads.
  const enter = useEffectEvent(async (target: string) => {
    const fromKiosk = target.startsWith('kiosk:');
    const door = DOORS.find((d) => d.id === (fromKiosk ? target.slice(6) : target))!;
    if (!fromKiosk) await new Promise((r) => setTimeout(r, 900)); // let the door swing open
    setBlack(true);
    await new Promise((r) => setTimeout(r, 700));
    try {
      if (document.pointerLockElement) document.exitPointerLock();
      router.push(await roomUrl(door.action!, door.stage));
    } catch (err) {
      setBlack(false);
      useCampus.getState().set({ phase: fromKiosk ? 'kiosk' : 'paused', opening: null, toast: err instanceof Error ? err.message : 'Xonaga kirib boʻlmadi' });
    }
  });
  useEffect(() => {
    if (phase !== 'entering' || !opening) return;
    const t = setTimeout(() => void enter(opening), 0);
    return () => clearTimeout(t);
  }, [phase, opening]);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (phase === 'board') {
      useCampus.getState().set({ phase: 'play' });
      useCampus.getState().requestPointerLock?.();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (boot === 'no-webgl') {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper p-6 text-center">
        <div className="max-w-md">
          <h1 className="display text-3xl font-semibold">LexSim</h1>
          <p className="mt-2 text-ink-2">Bu qurilmada 3D muhit (WebGL2) mavjud emas. Barcha mashqlarni 2D rejimda bajarishingiz mumkin.</p>
          <Link href="/hub" className="btn btn-primary mt-6">2D rejimga oʻtish</Link>
        </div>
      </main>
    );
  }

  const activeAvatar: AvatarModel = phase === 'kiosk' ? avatar : (profile?.avatar ?? avatar);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative h-dvh w-full overflow-hidden bg-[#07090d] text-white select-none">
        <h1 className="sr-only">LexSim — huquqiy amaliyot markazi</h1>
        {boot === 'ok' && (
          <div className="absolute inset-0" inert={phase !== 'play'}>
            <CampusCanvas avatar={activeAvatar} reducedMotion={settings.reducedMotion} sensitivity={settings.sensitivity} onReady={() => setReady(true)} />
          </div>
        )}

        <AnimatePresence>
          {boot === 'ok' && phase === 'kiosk' && (
            <Kiosk
              key="kiosk"
              profile={profile}
              onWalk={play}
              onEnter={(doorId) => {
                audio.start(useGame.getState().settings.volume);
                useCampus.getState().set({ phase: 'entering', opening: `kiosk:${doorId}` });
              }}
            />
          )}
          {phase === 'board' && (
            <Board
              key="board"
              onClose={() => {
                useCampus.getState().set({ phase: 'play' });
                useCampus.getState().requestPointerLock?.();
              }}
            />
          )}
          {phase === 'paused' && (
            <Pause key="pause" onResume={play} onTerminal={() => useCampus.getState().set({ phase: 'kiosk' })} />
          )}
        </AnimatePresence>
        {(phase === 'play' || phase === 'entering') && profile && <PlayHud name={profile.name} />}

        <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
          <AnimatePresence>
            {toast && (
              <motion.p key={toast} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} role="status" className="glass rounded-full px-5 py-2.5 text-[0.92rem]">
                {toast}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-black" initial={false} animate={{ opacity: black ? 1 : 0 }} transition={{ duration: 0.7, ease: 'easeInOut' }} />
        {black && <p className="fixed inset-x-0 bottom-10 z-50 text-center text-[0.8rem] tracking-[0.3em] text-white/50" role="status">XONA TAYYORLANMOQDA</p>}
        <Veil ready={ready} />
      </main>
    </MotionConfig>
  );
}
