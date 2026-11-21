'use client';
/**
 * "Bahs" — the door to the moot court: open a room (you get a code to share) or join one by its code.
 * No accounts: a name and an avatar, kept in this browser like the rest of LexSim.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { ApiError } from '@/game/api';
import { moot } from '@/game/moot';
import { getProfile, saveProfile, type AvatarModel } from '@/game/profile';

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
  const who = (name ?? saved?.name ?? '').trim();
  const look = avatar ?? saved?.avatar ?? 'man';
  const ok = who.length >= 2;

  const go = async (kind: 'create' | 'join') => {
    if (!ok || busy) return;
    setBusy(kind);
    setError(null);
    saveProfile({ name: who, avatar: look, role: saved?.role ?? 'student' });
    try {
      const room = kind === 'create' ? await moot.create(who, look, size, assign) : await moot.join(code.trim().toUpperCase(), who, look);
      router.push(`/bahs/${room.code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:py-16">
      <Link href="/hub" className="text-[0.85rem] font-semibold text-accent-ink">← Rollar</Link>
      <p className="mt-6 text-[0.78rem] font-semibold tracking-wider text-accent-ink uppercase">Jamoaviy sud · 2–6 kishi</p>
      <h1 className="display mt-2 text-[clamp(2rem,5vw,3.2rem)] font-semibold text-balance">Bahs: jamoangiz bilan sudda bahslashing</h1>
      <p className="mt-3 max-w-[60ch] text-[1.02rem] leading-relaxed text-pretty text-ink-2">
        Ikki jamoa — daʼvogar va javobgar. Tomon va rol qurʼa bilan tushadi. Tayyor javob yoʻq: ish papkasini oʻrganasiz, sudya soʻz berganda oʻz soʻzingiz bilan gapirasiz. Sudya — sunʼiy intellekt: majlisni olib boradi va gʻolibni aniqlaydi.
      </p>

      {mounted && (
        <div className="mt-8 rounded-[24px] border border-line bg-card p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="text-[0.8rem] font-semibold text-ink-2">Ismingiz (boshqalar shuni koʻradi)</span>
              <input value={name ?? saved?.name ?? ''} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder="Masalan: Karimova Aziza" className="field mt-1.5" />
            </label>
            <div role="radiogroup" aria-label="Qiyofa" className="grid grid-cols-2 gap-1 rounded-2xl bg-paper p-1">
              {(['man', 'woman'] as const).map((a) => (
                <button key={a} type="button" role="radio" aria-checked={look === a} onClick={() => setAvatar(a)}
                  className={`min-h-11 rounded-xl px-4 text-[0.9rem] font-semibold transition-colors duration-150 ${look === a ? 'bg-card shadow-sm' : 'text-ink-3 hover:text-ink'}`}>{a === 'man' ? 'Erkak' : 'Ayol'}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section aria-labelledby="create-title" className="flex flex-col rounded-[24px] border border-line bg-card p-5 sm:p-6">
          <h2 id="create-title" className="display text-xl font-semibold">Xona ochish</h2>
          <p className="mt-1 text-[0.9rem] text-ink-2">Kod olasiz va uni doʻstlaringizga yuborasiz.</p>
          <div className="mt-4 space-y-4">
            <Choice label="Jamoa hajmi" value={size} onChange={setSize} options={[[1, '1 ga 1', 'yakkama-yakka'], [2, '2 ga 2', 'bosh va ikkinchi vakil'], [3, '3 ga 3', '+ taraf']]} />
            <Choice label="Jamoalar" value={assign} onChange={setAssign} options={[['pick', 'Oʻzimiz tanlaymiz', 'A yoki B jamoaga qoʻshilasiz'], ['random', 'Qurʼa bilan', 'kim kim bilan — boshlanganda maʼlum boʻladi']]} />
          </div>
          <button type="button" className="btn btn-primary mt-5" disabled={!ok || busy !== null} aria-busy={busy === 'create'} onClick={() => void go('create')}>
            {busy === 'create' ? 'Ochilmoqda…' : 'Xona ochish'}
          </button>
        </section>

        <section aria-labelledby="join-title" className="flex flex-col rounded-[24px] border border-line bg-card p-5 sm:p-6">
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
          <li key={n} className="rounded-2xl border border-line bg-card p-4">
            <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-[0.8rem] font-bold text-accent-ink">{n}</span>
            <p className="mt-2 font-semibold">{t}</p>
            <p className="mt-0.5 text-[0.84rem] leading-snug text-ink-2">{d}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
