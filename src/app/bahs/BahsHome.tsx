'use client';
/**
 * "Bahs" - the door to the moot court: open a room (you get a code to share) or join one by its code.
 * No accounts: a name and an avatar, kept in this browser like the rest of LexSim.
 */
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { library } from '@/game/library';
import { ApiError } from '@/game/api';
import { moot } from '@/game/moot';
import { getProfile, saveProfile, type AvatarModel } from '@/game/profile';
import { GlassLayer, GlassToolbar, Segmented, ToolbarLink } from '@/components/ui/glass';
import { Catalog } from '@/components/moot/CaseParts';
import type { MootCatalogItem } from '@/contracts/moot';

const noSubscribe = () => () => {};

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string, string?][]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="text-[0.8rem] font-semibold text-ink-2">{label}</legend>
      <div className="mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([id, name, note]) => (
          <button key={String(id)} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}
            className={`rounded-2xl border px-3 py-2.5 text-left transition-colors duration-150 ${value === id ? 'border-accent bg-accent-soft' : 'border-line bg-card hover:bg-paper'}`}>
            <span className="block text-[0.92rem] font-semibold">{name}</span>
            {note && <span className="block text-[0.74rem] leading-snug text-ink-3">{note}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function BahsHome() {
  const router = useRouter();
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const saved = mounted ? getProfile() : null;
  const [name, setName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<AvatarModel | null>(null);
  const [size, setSize] = useState(2);
  const [assign, setAssign] = useState<'pick' | 'random'>('pick');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the case to argue: the built-in one, or one approved on the court server (?case= from a domain page)
  const search = useSearchParams();
  const asked = search.get('case');
  const askedCode = search.get('code') ?? undefined;
  const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
  const [catalog, setCatalog] = useState<MootCatalogItem[] | null>(null);
  const [caseId, setCaseId] = useState<string>(asked ?? 'ijara');
  useEffect(() => {
    let alive = true;
    library.mootCatalog().then((list) => alive && setCatalog(list), () => alive && setCatalog([]));
    library.mootCases().then((list) => alive && setCases(list.filter((c) => c.id !== 'ijara')), () => {});
    return () => {
      alive = false;
    };
  }, []);
  const chosen = catalog?.find((c) => c.id === caseId)?.title ?? cases.find((c) => c.id === caseId)?.title ?? 'Tanlangan case';
  const who = (name ?? saved?.name ?? '').trim();
  const look = avatar ?? saved?.avatar ?? 'man';
  const ok = who.length >= 2;

  const go = async (kind: 'create' | 'join') => {
    if (!ok || busy) return;
    setBusy(kind);
    setError(null);
    saveProfile({ name: who, avatar: look, role: saved?.role ?? 'student' });
    try {
      const room = kind === 'create' ? await moot.create(who, look, size, assign, caseId === 'ijara' ? undefined : caseId, caseId === asked ? askedCode : undefined) : await moot.join(code.trim().toUpperCase(), who, look);
      router.push(`/bahs/${room.code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
      setBusy(null);
    }
  };

  return (
    <main className="relative isolate w-full flex-1">
      <GlassLayer />
      <GlassToolbar back={{ href: '/', label: 'YOʻNALISHLAR' }}>
        <ToolbarLink href="/manbalar">Manbalar</ToolbarLink>
      </GlassToolbar>
      <div className="mx-auto w-full max-w-4xl px-5 pt-8 pb-14 sm:pt-12">
      <p className="mt-2 text-[0.78rem] font-semibold tracking-wider text-accent-ink uppercase">Jamoaviy sud · 2-6 kishi</p>
      <h1 className="display mt-2 text-[clamp(2rem,5vw,3.2rem)] font-semibold text-balance">Bahs: jamoangiz bilan sudda bahslashing</h1>
      <p className="mt-3 max-w-[60ch] text-[1.02rem] leading-relaxed text-pretty text-ink-2">
        Ikki jamoa - daʼvogar va javobgar. Tomon va rol qurʼa bilan tushadi. Tayyor javob yoʻq: ish papkasini oʻrganasiz, sudya soʻz berganda oʻz soʻzingiz bilan gapirasiz. Sudya - sunʼiy intellekt: majlisni olib boradi va gʻolibni aniqlaydi.
      </p>

      {mounted && (
        <div className="surface mt-8 rounded-[28px] p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="text-[0.8rem] font-semibold text-ink-2">Ismingiz (boshqalar shuni koʻradi)</span>
              <input value={name ?? saved?.name ?? ''} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder="Masalan: Karimova Aziza" className="field mt-1.5" />
            </label>
            <div className="min-w-48"><Segmented label="Jins" value={look} onChange={setAvatar} options={[['man', 'Erkak'], ['woman', 'Ayol']]} /></div>
          </div>
        </div>
      )}

      <section aria-labelledby="cases-title" className="surface mt-4 rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="cases-title" className="display text-xl font-semibold">Ishni tanlang</h2>
          <p className="text-[0.8rem] text-ink-3">Haqiqiy sud qarorlari asosida · normalar lex.uz matni bilan</p>
        </div>
        <p className="mt-1 max-w-[64ch] text-[0.88rem] text-ink-2">Har bir ishda ikki instansiya bir-biriga zid qaror chiqargan. Haqiqiy sud nima qilgani bahsdan keyin ochiladi.</p>
        <div className="mt-4">
          {catalog === null ? <div className="grid gap-2.5 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-[20px] bg-black/[0.04] motion-reduce:animate-none" />)}</div>
            : <Catalog items={catalog} extra={[...cases, ...(asked && !catalog.some((c) => c.id === asked) && !cases.some((c) => c.id === asked) ? [{ id: asked, title: 'Tanlangan case' }] : [])]} value={caseId} onChange={setCaseId} />}
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section aria-labelledby="create-title" className="surface flex flex-col rounded-[28px] p-5 sm:p-6">
          <h2 id="create-title" className="display text-xl font-semibold">Xona ochish</h2>
          <p className="mt-1 text-[0.9rem] text-ink-2">Kod olasiz va uni doʻstlaringizga yuborasiz.</p>
          <div className="mt-4 space-y-4">
            <p className="rounded-2xl bg-paper px-3.5 py-2.5 text-[0.88rem]"><span className="text-ink-3">Ish: </span><span className="font-semibold">{chosen}</span></p>
            <Choice label="Jamoa hajmi" value={size} onChange={setSize} options={[[1, '1 ga 1', 'yakkama-yakka'], [2, '2 ga 2', 'bosh va ikkinchi vakil'], [3, '3 ga 3', '+ taraf']]} />
            <Choice label="Jamoalar" value={assign} onChange={setAssign} options={[['pick', 'Oʻzimiz tanlaymiz', 'A yoki B jamoaga qoʻshilasiz'], ['random', 'Qurʼa bilan', 'kim kim bilan - boshlanganda maʼlum boʻladi']]} />
          </div>
          <button type="button" className="btn btn-primary mt-5" disabled={!ok || busy !== null} aria-busy={busy === 'create'} onClick={() => void go('create')}>
            {busy === 'create' ? 'Ochilmoqda…' : 'Xona ochish'}
          </button>
        </section>

        <section aria-labelledby="join-title" className="surface flex flex-col rounded-[28px] p-5 sm:p-6">
          <h2 id="join-title" className="display text-xl font-semibold">Kod bilan qoʻshilish</h2>
          <p className="mt-1 text-[0.9rem] text-ink-2">Xona egasi yuborgan 5 belgili kodni kiriting.</p>
          <form className="mt-4 flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); void go('join'); }}>
            <label className="sr-only" htmlFor="room-code">Xona kodi</label>
            <input id="room-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))} inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABCDE"
              className="field text-center font-mono !text-[1.8rem] tracking-[0.4em] uppercase" />
            <button type="submit" className="btn btn-primary mt-auto" disabled={!ok || code.length !== 5 || busy !== null} aria-busy={busy === 'join'} style={{ marginTop: '1.25rem' }}>
              {busy === 'join' ? 'Qoʻshilmoqda…' : 'Qoʻshilish'}
            </button>
          </form>
        </section>
      </div>
      {!ok && mounted && <p className="mt-3 text-[0.84rem] text-ink-3">Avval ismingizni kiriting.</p>}
      {error && <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-[0.9rem] font-medium text-danger" role="alert">{error}</p>}

      <ol className="mt-10 grid gap-3 text-[0.9rem] sm:grid-cols-4">
        {[['1', 'Xona', 'Kod bilan yigʻilasiz, jamoalarga boʻlinasiz.'], ['2', 'Qurʼa', 'Tomon va rol tasodifiy tushadi.'], ['3', 'Ish papkasi', 'Faktlar, dalillar va faqat sizning jamoangiz biladigan maʼlumot.'], ['4', 'Majlis', 'Sudya navbat bilan soʻz beradi; oxirida qaror va tahlil.']].map(([n, t, d]) => (
          <li key={n} className="surface rounded-[22px] p-4">
            <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-[0.8rem] font-bold text-accent-ink">{n}</span>
            <p className="mt-2 font-semibold">{t}</p>
            <p className="mt-0.5 text-[0.84rem] leading-snug text-ink-2">{d}</p>
          </li>
        ))}
      </ol>
      </div>
    </main>
  );
}
