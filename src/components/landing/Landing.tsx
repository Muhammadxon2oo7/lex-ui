'use client';
/**
 * The front door: one card per line of practice (advocate, victim's representative, judge, the
 * economic court, the civil servant, the moot court). Pick one, say who you are - and you are
 * inside that process. The 3D campus is still there for those who want to walk (/kampus).
 *
 * Every card names the normative acts the practice is built on (the full list with editions and
 * links is on /manbalar).
 */
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useDragControls } from 'motion/react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { Level } from '@/contracts';
import { api } from '@/game/api';
import { getProfile, saveProfile, type AvatarModel, type Role } from '@/game/profile';
import { pickScenario } from '@/game/randomCase';
import { ensureCase } from '@/game/rooms';
import { useDismiss } from '@/lib/useDismiss';
import { GlassLayer, GlassToolbar, Segmented, ToolbarLink } from '@/components/ui/glass';

const spring = { type: 'spring', bounce: 0.12, duration: 0.5 } as const;

type Start = (o: { level: Level }) => Promise<string>;
interface Direction {
  id: string;
  role: string;
  title: string;
  body: string;
  meta: string;
  basis: string[];
  image: string | null;
  /** Card accent (also the art for the card without a still). */
  tone: string;
  needs3d: boolean;
  needsServer?: boolean;
  levels?: boolean;
  start: Start;
}

async function hearing(): Promise<string> {
  const res = await fetch('/api/v1/hearings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const json = (await res.json()) as { hearing?: { hearingId: string }; error?: { message: string } };
  if (!res.ok || !json.hearing) throw new Error(json.error?.message ?? 'Majlisni boshlab boʻlmadi');
  return `/court/${json.hearing.hearingId}`;
}
const caseRoom = (kind: 'labour' | 'theft') => async () => {
  const c = await ensureCase(false, kind);
  return `/ish/${c.caseId}/${c.stages.find((s) => s.status !== 'done')?.id ?? c.stages[0].id}`;
};

const DIRECTIONS: Direction[] = [
  {
    id: 'advokat', role: 'Advokat', title: 'Ishga tiklash nizosi',
    body: 'Ishdan boʻshatilgan mijoz bilan maslahatdan boshlab: orderni va daʼvo arizasini oʻzingiz yozasiz, sudga topshirasiz, majlisda himoya qilasiz.',
    meta: 'Fuqarolik ishi · 5 xona · 30-45 daqiqa',
    basis: ['Fuqarolik protsessual kodeksi', 'Mehnat kodeksi', '«Advokatura toʻgʻrisida»gi Qonun'],
    image: '/landing/advokat.webp', tone: '#1f8a5b', needs3d: true, start: caseRoom('labour'),
  },
  {
    id: 'tergov', role: 'Jabrlanuvchi vakili', title: 'Telefon oʻgʻirligi: arizadan hukmgacha',
    body: 'IIB navbatchi qismida arizani roʻyxatdan oʻtkazasiz, tergovchi soʻrogʻida jabrlanuvchi huquqlarini himoya qilasiz, shikoyat berasiz va sud majlisida davlat ayblovchisi, himoyachi va sudlanuvchi ishtirokida ayblovni quvvatlaysiz.',
    meta: 'Jinoyat-protsessual ish · 4 xona · 25-35 daqiqa',
    basis: ['Jinoyat-protsessual kodeksi', '«Advokatura toʻgʻrisida»gi Qonun', '«Advokatlik faoliyatining kafolatlari…» Qonun'],
    image: '/landing/tergov.webp', tone: '#2f5aa8', needs3d: true, start: caseRoom('theft'),
  },
  {
    id: 'sudya', role: 'Sudya', title: 'Sud majlisida raislik qilish',
    body: 'Raislik qiluvchi oʻrnida majlisni ochishdan hal qiluv qarorini eʼlon qilishgacha protsessual tartibda olib borasiz.',
    meta: 'Fuqarolik ishi · 14 bosqich · 10-15 daqiqa',
    basis: ['Fuqarolik protsessual kodeksi', '«Sudlar toʻgʻrisida»gi Qonun', 'Oliy sud Plenumining 2018-yil 14-son qarori'],
    image: '/landing/sudya.webp', tone: '#7a3b2e', needs3d: true, start: hearing,
  },
  {
    id: 'iqtisodiy', role: 'Tomon vakili', title: 'Iqtisodiy sudda nizo',
    body: 'Daʼvogar yoki javobgar vakili sifatida sudya savollariga oʻz soʻzingiz bilan javob berasiz; raqib tomon sizning gapingizga qarab javob qaytaradi.',
    meta: 'Iqtisodiy ish · tasodifiy ssenariy · 15-20 daqiqa',
    basis: ['Iqtisodiy protsessual kodeksi', '«Sudlar toʻgʻrisida»gi Qonun'],
    image: '/landing/majlis.webp', tone: '#8a5a12', needs3d: true, needsServer: true, levels: true,
    start: async ({ level }) => {
      const r = await api.remoteStatus();
      const id = r.ok ? pickScenario(r.scenarios.map((s) => s.id)) : null;
      if (!id) throw new Error('Sud serveri hozir javob bermayapti. Birozdan keyin urinib koʻring.');
      return `/sud/${(await api.createSession(id, 'tutorial', level)).sessionId}`;
    },
  },
  {
    id: 'dxm', role: 'Davlat xizmatchisi', title: 'Yoʻqolgan staj: fuqaro murojaati',
    body: 'Nafaqasi kam chiqqan fuqaroni qabul qilasiz: shikoyat ortidagi muammoni aniqlab, qonuniy yechim va keyingi qadamni tushuntirasiz.',
    meta: 'Davlat xizmatlari markazi · 12-18 daqiqa',
    basis: ['«Fuqarolarning davlat pensiya taʼminoti toʻgʻrisida»gi Qonun', 'VM 2022-yil 13-oktabrdagi 592-son qarori', '«Murojaatlar toʻgʻrisida»gi Qonun'],
    image: '/landing/dxm.webp', tone: '#0f7b8a', needs3d: false,
    start: async () => `/simulation/${(await api.createSession('dxm-yoqolgan-staj', 'tutorial')).sessionId}`,
  },
  {
    id: 'bahs', role: 'Jamoaviy bahs', title: 'Kursdoshlaringiz bilan sudda',
    body: 'Ikki jamoa - daʼvogar va javobgar. Tomon va rol qurʼa bilan tushadi, tayyor javob yoʻq; sudya - sunʼiy intellekt, gʻolibni u aniqlaydi.',
    meta: '2-6 kishi · xona kodi bilan · 15-20 daqiqa',
    basis: ['Iqtisodiy protsessual kodeksi (soddalashtirilgan oʻquv tartibi)'],
    image: null, tone: '#3d2f7a', needs3d: true, start: async () => '/bahs',
  },
];

const noSubscribe = () => () => {};
let webgl: boolean | null = null;
const hasWebgl2 = () => {
  if (webgl === null) {
    try {
      webgl = Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
      webgl = false;
    }
  }
  return webgl;
};

/* ───────────────────────── card ───────────────────────── */

function BahsArt({ tone }: { tone: string }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(120% 90% at 20% 20%, ${tone}, #17122e 70%)` }}>
      <span className="absolute top-[8%] left-[9%] font-semibold text-white/90 [font-size:clamp(5rem,12vw,8.5rem)] leading-none tracking-tight">A</span>
      <span className="absolute right-[9%] bottom-[6%] font-semibold text-white/35 [font-size:clamp(5rem,12vw,8.5rem)] leading-none tracking-tight">B</span>
      <span className="absolute top-1/2 left-1/2 h-[140%] w-px -translate-x-1/2 -translate-y-1/2 rotate-[24deg] bg-white/25" />
      <span className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/12 text-[0.8rem] font-semibold tracking-[0.2em] text-white ring-1 ring-white/30 backdrop-blur">VS</span>
    </div>
  );
}

function Card({ d, index, disabled, note, onPick, open }: { d: Direction; index: number; disabled: boolean; note: string | null; onPick: (d: Direction) => void; open: boolean }) {
  return (
    <motion.li initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 * index }} className="list-none">
      <button type="button" onClick={() => onPick(d)} disabled={disabled} aria-describedby={`${d.id}-basis`}
        className="surface group flex h-full w-full flex-col overflow-hidden rounded-[30px] text-left transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.06),var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:scale-[0.985] active:duration-150 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        <motion.div layoutId={open ? undefined : `art-${d.id}`} transition={spring} className={`relative aspect-[16/10] w-full overflow-hidden bg-[#0c0f14] ${open ? 'opacity-0' : ''}`} style={{ borderRadius: 0 }}>
          {d.image ? (
            <Image src={d.image} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" priority={index < 3}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100" style={{ objectPosition: d.id === 'dxm' ? '20% 60%' : '50% 45%' }} />
          ) : <BahsArt tone={d.tone} />}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <span className="lg absolute top-4 left-4 rounded-full px-3 py-1 text-[0.74rem] font-semibold text-[#1d1d1f]">{d.role}</span>
          <h2 className="absolute right-5 bottom-4 left-5 text-[1.35rem] leading-tight font-semibold tracking-tight text-balance text-white">{d.title}</h2>
        </motion.div>
        <div className="flex flex-1 flex-col p-5">
          <p className="text-[0.74rem] font-semibold tracking-wide text-ink-3 uppercase">{d.meta}</p>
          <p className="mt-2 text-[0.94rem] leading-relaxed text-pretty text-ink-2">{d.body}</p>
          <div id={`${d.id}-basis`} className="mt-4 border-t border-line pt-3">
            <p className="text-[0.7rem] font-semibold tracking-wider text-ink-3 uppercase">Normativ asos</p>
            <ul className="mt-1.5 space-y-0.5 text-[0.84rem] text-ink-2">
              {d.basis.map((b) => <li key={b} className="flex gap-2"><span aria-hidden className="mt-[0.55em] size-1 shrink-0 rounded-full" style={{ background: d.tone }} />{b}</li>)}
            </ul>
          </div>
          <span className="mt-auto flex items-center justify-between pt-5">
            <span className="text-[0.8rem] text-ink-3">{note}</span>
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[0.9rem] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_6px_16px_-8px_currentColor] transition-[filter] group-hover:brightness-110" style={{ background: d.tone }}>
              Boshlash
              <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className="transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none"><path d="M5 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </span>
        </div>
      </button>
    </motion.li>
  );
}

/* ───────────────────────── who are you ───────────────────────── */

function Join({ d, onClose }: { d: Direction; onClose: () => void }) {
  const router = useRouter();
  const saved = getProfile();
  const [first, ...rest] = (saved?.name ?? '').split(/\s+/);
  const [surname, setSurname] = useState(saved ? first : '');
  const [given, setGiven] = useState(saved ? rest.join(' ') : '');
  const [avatar, setAvatar] = useState<AvatarModel>(saved?.avatar ?? 'man');
  const [role, setRole] = useState<Role>(saved?.role ?? 'student');
  const [level, setLevel] = useState<Level>('beginner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismiss = useDismiss(busy ? undefined : onClose);
  const drag = useDragControls();
  const ok = surname.trim().length >= 2 && given.trim().length >= 2;
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => firstField.current?.focus(), 60);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', esc);
    };
  }, [busy, onClose]);

  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    saveProfile({ name: `${surname.trim()} ${given.trim()}`, avatar, role });
    try {
      router.push(await d.start({ level }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ochib boʻlmadi');
      setBusy(false);
    }
  };

  return (
    <motion.div {...dismiss} className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby={titleId}
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={spring}
        drag={busy ? false : 'y'} dragControls={drag} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => (info.offset.y > 110 || info.velocity.y > 550) && onClose()}
        className="lg lg-strong max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[32px]">
        <div onPointerDown={(e) => drag.start(e)} className="sticky top-0 z-10 flex cursor-grab justify-center pt-2.5 pb-1 active:cursor-grabbing sm:hidden" style={{ touchAction: 'none' }}>
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-black/20" />
        </div>
        <motion.div layoutId={`art-${d.id}`} transition={spring} className="relative mx-3 mt-1 h-36 overflow-hidden bg-[#0c0f14] sm:mx-4 sm:mt-4" style={{ borderRadius: 22 }}>
          {d.image ? <Image src={d.image} alt="" fill sizes="32rem" className="object-cover" style={{ objectPosition: d.id === 'dxm' ? '20% 60%' : '50% 45%' }} /> : <BahsArt tone={d.tone} />}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute right-4 bottom-3 left-4">
            <p className="text-[0.72rem] font-semibold tracking-wider text-white/80 uppercase">{d.role}</p>
            <h2 id={titleId} className="display text-[1.45rem] leading-tight font-semibold text-balance text-white">{d.title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Yopish" className="lg absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full text-ink">
            <svg aria-hidden width="12" height="12" viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </motion.div>
        <div className="px-6 pt-4 sm:px-7">
        <p className="text-[0.9rem] text-ink-2">Maʼlumotlar faqat shu qurilmada saqlanadi va hisobot hamda yuklab olinadigan bayonnomada koʻrsatiladi.</p>
        <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">Familiya</span>
              <input ref={firstField} value={surname} onChange={(e) => setSurname(e.target.value)} maxLength={20} autoComplete="family-name" placeholder="Karimova" className="field" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">Ism</span>
              <input value={given} onChange={(e) => setGiven(e.target.value)} maxLength={19} autoComplete="given-name" placeholder="Aziza" className="field" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Segmented label="Jins" value={avatar} onChange={setAvatar} options={[['man', 'Erkak'], ['woman', 'Ayol']]} />
            <Segmented label="Maqom" value={role} onChange={setRole} options={[['student', 'Talaba'], ['teacher', 'Oʻqituvchi']]} />
          </div>
          {d.levels && <Segmented label="Daraja" value={level} onChange={setLevel} options={[['beginner', 'Boshlangʻich'], ['intermediate', 'Oʻrta'], ['advanced', 'Professional']]} />}
          {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-[0.9rem] font-medium text-danger">{error}</p>}
          <button type="submit" disabled={!ok || busy} aria-busy={busy} className="btn btn-primary w-full !min-h-12 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]" style={{ background: d.tone }}>
            {busy ? 'Tayyorlanmoqda…' : ok ? 'Jarayonga kirish' : 'Familiya va ismni kiriting'}
          </button>
        </form>
        </div>
      </motion.section>
    </motion.div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function Landing() {
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const three = mounted ? hasWebgl2() : true;
  const [picked, setPicked] = useState<Direction | null>(null);

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
      <main className="relative isolate w-full flex-1">
        <GlassLayer />
        <GlassToolbar>
          <ToolbarLink href="/sohalar">Sohalar</ToolbarLink>
          <ToolbarLink href="/manbalar" className="max-sm:hidden">Manbalar</ToolbarLink>
          <ToolbarLink href="/protsess" className="max-sm:hidden">Kutubxona</ToolbarLink>
          {three && <ToolbarLink href="/kampus" prominent>3D kampus</ToolbarLink>}
        </GlassToolbar>

        <section className="mx-auto w-full max-w-6xl px-5 pt-12 pb-8 sm:pt-16">
          <p className="text-[0.8rem] font-semibold tracking-wider text-accent-ink uppercase">Virtual huquqiy amaliyot</p>
          <h1 className="display mt-2 max-w-[18ch] text-[clamp(2.3rem,6vw,4rem)] leading-[1.04] font-semibold tracking-tight text-balance">Yoʻnalishni tanlang va ishga kirishing</h1>
          <p className="mt-4 max-w-[58ch] text-[1.05rem] leading-relaxed text-pretty text-ink-2">
            Har bir yoʻnalish - haqiqiy jarayon: xonalar, odamlar, hujjatlar va qaror. Tartib va moddalar rasmiy manbadan, lex.uz saytidan olingan; har qadamda qaysi normaga tayanilgani koʻrinadi.
          </p>
        </section>

        <ul className="mx-auto grid w-full max-w-6xl gap-5 px-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
          {DIRECTIONS.map((d, i) => (
            <Card key={d.id} d={d} index={i} disabled={d.needs3d && !three} note={d.needs3d && !three ? 'Bu qurilmada 3D (WebGL2) yoʻq' : null} onPick={setPicked} open={picked?.id === d.id} />
          ))}
        </ul>

        <section aria-label="Qoʻshimcha" className="mx-auto grid w-full max-w-6xl gap-3 px-5 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['/sohalar', 'Sohalar va caselar', 'Iqtisodiy, fuqarolik, jinoyat sohalari: tizim caselari va oʻz holatingizdan AI tuzgan case.'],
            ['/manbalar', 'Normativ manbalar', 'Har bir yoʻnalish qaysi qonun va moddalarga tayanadi: tahrir sanasi va lex.uz havolasi bilan.'],
            ['/protsess', 'Huquqiy kutubxona', 'Ariza berishdan qarorgacha: protsess xaritasi va kodekslar.'],
            ...(three ? [['/kampus', '3D kampusda yurish', 'Binoda erkin yuring va xonaga eshikdan kiring.']] : [['/hub', '2D rejim', 'WebGL2 boʻlmagan qurilmalar uchun.']]),
          ].map(([href, title, body]) => (
            <Link key={href} href={href} className="surface press group rounded-[24px] p-5">
              <p className="flex items-center justify-between font-semibold">{title}<span aria-hidden className="text-ink-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">→</span></p>
              <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-2">{body}</p>
            </Link>
          ))}
        </section>

        <footer className="border-t border-black/[0.06]">
          <p className="mx-auto w-full max-w-6xl px-5 py-6 text-[0.8rem] text-ink-3">Oʻquv simulyatsiyasi. Ish holatlari, ismlar va manzillar toʻqilgan; huquqiy matnlar lex.uz saytidan. Huquqiy maslahat emas.</p>
        </footer>
      </main>
      <AnimatePresence>{picked && <Join key={picked.id} d={picked} onClose={() => setPicked(null)} />}</AnimatePresence>
      </LayoutGroup>
    </MotionConfig>
  );
}
