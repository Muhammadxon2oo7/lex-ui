'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Level, RemoteStatus, SessionMode } from '@/contracts';
import { ApiError, api } from '@/game/api';
import { ensureCase } from '@/game/rooms';

// the two "Ish yoʻli" cases are the same ones as at the campus kiosk (resumed where the student left off)
const ROLES = [
  { id: 'dxm', role: 'DXM xodimi', scenario: 'Yoʻqolgan staj', meta: 'Davlat xizmati · 12–18 daqiqa', body: 'Nafaqasi kam chiqqan fuqaro. Shikoyat ortida nima turganini aniqlang.' },
  { id: 'labour', role: 'Advokat', scenario: 'Ishga tiklash nizosi', meta: 'Fuqarolik ishi · 5 xona', body: 'Ishdan boʻshatilgan mijoz: maslahatdan daʼvo arizasi va sud majlisidagi hal qiluv qarorigacha.' },
  { id: 'theft', role: 'Jabrlanuvchi vakili', scenario: 'Telefon oʻgʻirligi', meta: 'Jinoyat-protsessual ish · 3 xona', body: 'Arizani roʻyxatdan oʻtkazishdan tergovchi ustidan shikoyatgacha.' },
] as const;

/** Real feature detection (not user-agent guessing), read once on the client. */
// immersive: walking the 3D building needs a mouse; touch: rooms with a fixed camera (cases, courts) still run; none: no WebGL2
let capability: 'immersive' | 'touch' | 'none' | null = null;
const noSubscribe = () => () => {};
function detectCapability() {
  if (capability) return capability;
  let webgl = false;
  try {
    webgl = Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {}
  capability = !webgl ? 'none' : window.matchMedia('(pointer: fine)').matches ? 'immersive' : 'touch';
  return capability;
}

function Segment<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="text-[0.8rem] font-semibold text-ink-2">{label}</p>
      <div className="mt-1.5 inline-grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-black/5 p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            className={`min-h-10 rounded-full px-4 text-[0.9rem] font-semibold transition-colors disabled:opacity-40 ${value === o.id ? 'bg-white shadow-sm' : 'text-ink-2'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HubClient() {
  const router = useRouter();
  const [mode, setMode] = useState<SessionMode>('tutorial');
  const [choice, setView] = useState<'3d' | '2d' | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState<string | null>(null); // which card is being opened
  const [error, setError] = useState<string | null>(null);
  const device = useSyncExternalStore(noSubscribe, detectCapability, () => null);
  const immersiveOk = device === 'immersive';
  const roomsOk = device !== 'none'; // courts and case rooms have a fixed camera: touch is enough
  const view = immersiveOk ? (choice ?? '3d') : '2d';
  // the economic-court case runs on the court server: shown only when it answers
  const [remote, setRemote] = useState<RemoteStatus | null>(null);
  const [level, setLevel] = useState<Level>('beginner');
  useEffect(() => {
    let alive = true;
    api.remoteStatus().then((r) => alive && setRemote(r), () => {});
    return () => {
      alive = false;
    };
  }, []);

  const startEconomic = async (scenarioId: string) => {
    if (busy) return;
    setBusy(true);
    setStarting(scenarioId);
    setError(null);
    try {
      const snapshot = await api.createSession(scenarioId, mode, level);
      router.push(`/sud/${snapshot.sessionId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sud majlisini boshlab boʻlmadi');
      setBusy(false);
      setStarting(null);
    }
  };

  const startCourt = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/hearings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = (await res.json()) as { hearing?: { hearingId: string }; error?: { message: string } };
      if (!res.ok || !json.hearing) throw new Error(json.error?.message ?? 'Majlisni boshlab boʻlmadi');
      router.push(`/court/${json.hearing.hearingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Majlisni boshlab boʻlmadi');
      setBusy(false);
    }
  };

  const start = async (id: (typeof ROLES)[number]['id']) => {
    if (busy) return;
    setBusy(true);
    setStarting(id);
    setError(null);
    try {
      if (id === 'dxm') {
        const snapshot = await api.createSession('dxm-yoqolgan-staj', mode);
        router.push(`/simulation/${snapshot.sessionId}${view === '2d' ? '?view=2d' : ''}`);
        return;
      }
      // resume the student's case of this kind in its first unfinished room
      const c = await ensureCase(false, id);
      router.push(`/ish/${c.caseId}/${c.stages.find((s) => s.status !== 'done')?.id ?? c.stages[0].id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sessiyani boshlab boʻlmadi');
      setBusy(false);
      setStarting(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:py-16">
      <Link href="/" className="text-[0.85rem] font-semibold text-accent-ink">← LexSim</Link>
      <h1 className="display mt-3 text-[clamp(2rem,5vw,3.2rem)] font-semibold">Bugun kim boʻlib ishlaysiz?</h1>

      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
        <Segment label="Rejim" value={mode} onChange={setMode} options={[{ id: 'tutorial', label: 'Mashq' }, { id: 'assessment', label: 'Baholash' }]} />
        <Segment label="Koʻrinish" value={view} onChange={setView} options={[{ id: '3d', label: '3D muhit', disabled: !immersiveOk }, { id: '2d', label: '2D' }]} />
      </div>
      <p className="mt-3 min-h-5 text-[0.82rem] text-ink-3" role="status">
        {mode === 'tutorial' ? 'Mashq: sabr va ishonch koʻrsatkichlari koʻrinadi.' : 'Baholash: koʻrsatkichlar yashirin, fuqaroni oʻzingiz oʻqiysiz.'}{' '}
        {device === 'touch' && 'Binoda yurish uchun sichqoncha kerak — DXM 2D rejimda ochiladi; ish xonalari va sud zallari sensorli ekranda ham ishlaydi.'}
        {device === 'none' && 'Bu brauzerda WebGL2 yoʻq: faqat DXM 2D rejimda ochiladi.'}
      </p>

      <ul className="mt-6 grid gap-3 md:grid-cols-3">
        {ROLES.map((r) => {
          const can = r.id === 'dxm' || roomsOk;
          return (
            <li key={r.id} className="flex flex-col rounded-[24px] border border-line bg-card p-6">
              <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-accent-ink">{r.meta}</p>
              <h2 className="display mt-2 text-2xl font-semibold text-balance">{r.role}</h2>
              <p className="font-medium text-ink-2">{r.scenario}</p>
              <p className="mt-2 flex-1 text-[0.92rem] leading-relaxed text-pretty text-ink-2">{r.body}</p>
              <button type="button" className="btn btn-primary mt-5" disabled={busy || !can} aria-busy={starting === r.id} onClick={() => void start(r.id)}>
                {!can ? 'WebGL2 kerak' : starting === r.id ? 'Tayyorlanmoqda…' : r.id === 'dxm' ? 'Boshlash' : 'Ishni ochish'}
              </button>
            </li>
          );
        })}
      </ul>
      <section className="mt-10" aria-labelledby="court-title">
        <h2 id="court-title" className="display text-2xl font-semibold">Sud zali</h2>
        <div className="mt-3 flex flex-wrap items-center gap-5 rounded-[24px] border border-line bg-card p-6">
          <div className="min-w-0 flex-1 basis-80">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-accent-ink">Fuqarolik ishi · 1-instansiya · 10–15 daqiqa</p>
            <h3 className="display mt-1 text-xl font-semibold">Raislik qiluvchi: majlisni tartib boʻyicha olib boring</h3>
            <p className="mt-1.5 text-[0.92rem] leading-relaxed text-ink-2">
              Sudya oʻrnida oʻtirasiz va majlisni ochishdan qarorni oʻqib eshittirishgacha 14 bosqichni Fuqarolik protsessual kodeksi tartibida boshqarasiz. Kodeks qoʻl ostingizda — har bir bosqich lex.uz saytidagi modda matniga bogʻlangan.
            </p>
          </div>
          <button type="button" className="btn btn-primary min-w-40 max-sm:w-full" disabled={busy || !roomsOk} onClick={() => void startCourt()}>
            {roomsOk ? 'Majlis zaliga kirish' : 'WebGL2 kerak'}
          </button>
        </div>
      </section>
      {remote?.ok && remote.scenarios.length > 0 && (
        <section className="mt-10" aria-labelledby="economic-title">
          <h2 id="economic-title" className="display text-2xl font-semibold">Iqtisodiy sud</h2>
          <p className="mt-1 text-[0.88rem] text-ink-2">
            Sud majlisida tomon vakili boʻlasiz: javobni oʻzingiz yozasiz yoki aytasiz{remote.llm ? ', raqib tomon esa sizga til modeli orqali javob qaytaradi' : ''}. Har bir qadam Iqtisodiy protsessual kodeksi moddasiga bogʻlangan.
          </p>
          <div className="mt-4">
            <Segment label="Daraja" value={level} onChange={setLevel} options={[{ id: 'beginner', label: 'Boshlangʻich' }, { id: 'intermediate', label: 'Oʻrta' }, { id: 'advanced', label: 'Professional' }]} />
            <p className="mt-2 min-h-5 text-[0.82rem] text-ink-3" role="status">
              {level === 'beginner' ? 'Variant tanlaysiz yoki oʻzingiz aytasiz/yozasiz; har javobdan keyin izoh, maslahat bor.' : level === 'intermediate' ? 'Oʻzingiz aytasiz yoki yozasiz; variantlar yashirin (ochish −10); izoh faqat jiddiy xatoda.' : 'Faqat oʻz soʻzingiz bilan, maslahatsiz; jimlik ham baholanadi; tahlil oxirida.'}
            </p>
          </div>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {remote.scenarios.map((sc) => (
              <li key={sc.id} className="flex flex-col rounded-[24px] border border-line bg-card p-6">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-accent-ink">Iqtisodiy ish · {sc.durationMinutes} daqiqa</p>
                <h3 className="display mt-2 text-xl font-semibold text-balance">{/* the role is on the next line: «… — daʼvogar vakili» is not repeated */}
                  {(sc.title || sc.role).split(/\s+[—–-]\s+/)[0]}</h3>
                {sc.position && <p className="font-medium text-ink-2">{sc.position}</p>}
                <p className="mt-2 line-clamp-4 flex-1 text-[0.92rem] leading-relaxed text-pretty text-ink-2">{sc.briefing}</p>
                <button type="button" className="btn btn-primary mt-5" disabled={busy || !roomsOk} aria-busy={starting === sc.id} onClick={() => void startEconomic(sc.id)}>
                  {!roomsOk ? 'WebGL2 kerak' : starting === sc.id ? 'Tayyorlanmoqda…' : 'Majlis zaliga kirish'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {error && <p className="mt-4 font-medium text-danger" role="alert">{error}</p>}
    </main>
  );
}
