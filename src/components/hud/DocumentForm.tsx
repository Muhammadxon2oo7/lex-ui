'use client';
/**
 * Operator workstation ("Yagona oyna").
 *
 * Not a form dropped on top of the game: it is the computer on the desk.
 * The student works the way a front-desk operator does - scan the ID, find
 * the service in the catalogue, enter the case details from what the
 * citizen actually said, attach what was actually handed over, review,
 * sign and print the receipt. Steps can be visited in any order; nothing is
 * filled in for the student except what a scanner would read.
 *
 * Same server contract as before (`DocumentDraft`); drafts autosave on close.
 */
import { AnimatePresence, motion } from 'motion/react';
import { ease } from '@/lib/motion';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { DocumentDraft, EvidenceId, ServiceId } from '@/contracts';
import { useGame } from '@/game/store';
import { useDismiss } from '@/lib/useDismiss';

const spring = ease.surface;

type Category = 'pension' | 'archive' | 'appeal' | 'other';
const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'Barchasi' },
  { id: 'pension', label: 'Pensiya' },
  { id: 'archive', label: 'Arxiv' },
  { id: 'appeal', label: 'Murojaatlar' },
  { id: 'other', label: 'Yoʻnaltirish' },
];

const SERVICES: { id: ServiceId; code: string; category: Category; title: string; about: string; keywords: string }[] = [
  { id: 'archive-reference', code: 'AR-014', category: 'archive', title: 'Arxiv maʼlumotnomasi uchun soʻrov', about: 'Ish staji yoki ish haqi toʻgʻrisidagi maʼlumotni arxiv hujjatlari asosida tasdiqlash. Soʻrov tegishli arxivga yuboriladi.', keywords: 'staj arxiv maʼlumotnoma ish haqi tasdiqlash xoʻjalik tugatilgan' },
  { id: 'pension-recalculation', code: 'PN-031', category: 'pension', title: 'Pensiyani qayta hisoblash toʻgʻrisida ariza', about: 'Tayinlangan pensiya miqdorini yangi hujjatlar asosida qayta koʻrib chiqish. Tasdiqlovchi hujjat ilova qilinishi shart.', keywords: 'pensiya nafaqa qayta hisoblash miqdor' },
  { id: 'written-complaint', code: 'MR-002', category: 'appeal', title: 'Yozma shikoyatni qabul qilish', about: 'Davlat organi yoki mansabdor shaxsning qarori, harakati (harakatsizligi) ustidan murojaat.', keywords: 'shikoyat murojaat ariza norozi' },
  { id: 'refer-elsewhere', code: 'YN-000', category: 'other', title: 'Boshqa idoraga yoʻnaltirish', about: 'Masala markaz koʻrsatadigan xizmatlar roʻyxatiga kirmaydi. Fuqaroga vakolatli idora koʻrsatiladi, murojaat roʻyxatga olinmaydi.', keywords: 'yoʻnaltirish boshqa idora vakolat' },
];

const EVIDENCE: { id: EvidenceId; label: string; hint: string; needs?: 'phone' }[] = [
  { id: 'passport', label: 'Shaxsni tasdiqlovchi hujjat', hint: 'ID-karta skaneri' },
  { id: 'workbook-photos', label: 'Mehnat daftarchasi sahifalari', hint: 'Fuqaro telefonidan qabul qilinadi', needs: 'phone' },
  { id: 'employer-details', label: 'Ish joyi va davr toʻgʻrisida maʼlumot', hint: 'Fuqaro soʻzidan yoziladi' },
  { id: 'pension-decision', label: 'Pensiya tayinlash toʻgʻrisidagi qaror', hint: 'Asl nusxa yoki nusxa' },
  { id: 'witness-statement', label: 'Guvohlar koʻrsatmasi', hint: 'Yozma shaklda' },
];

const STEPS = ['Murojaatchi', 'Xizmat', 'Maʼlumotlar', 'Ilovalar', 'Tasdiqlash'] as const;

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>;
}

export function DocumentForm() {
  const snapshot = useGame((s) => s.snapshot)!;
  const busy = useGame((s) => s.busy);
  const saveDocument = useGame((s) => s.saveDocument);
  const closeTerminal = useGame((s) => s.closeTerminal);

  const [draft, setDraft] = useState<DocumentDraft>(snapshot.document);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [scanning, setScanning] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  const locked = snapshot.documentSubmitted;
  const phoneHandedOver = snapshot.objects.phone === 'active';
  const set = <K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const service = SERVICES.find((s) => s.id === draft.service);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SERVICES.filter((s) => (category === 'all' || s.category === category) && (!q || `${s.title} ${s.keywords} ${s.code}`.toLowerCase().includes(q)));
  }, [query, category]);

  const done = [
    draft.applicantName.trim().length > 1,
    draft.service !== null,
    Boolean(draft.periodFrom.trim() && draft.periodTo.trim() && draft.employer.trim()),
    draft.evidence.length > 0,
    locked,
  ];

  const close = async () => {
    if (!locked) await saveDocument(draft, false); // work in progress survives leaving the computer
    closeTerminal();
  };
  const onEscape = useEffectEvent(() => void close());
  const dismiss = useDismiss(() => void close());

  // The computer has your attention: focus stays inside, Esc pushes back from the desk.
  useEffect(() => {
    const node = frame.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>('input, select, textarea, button')].filter((el) => !el.hasAttribute('disabled'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  const scan = () => {
    setScanning(true);
    setTimeout(() => {
      // A scanner reads the card; it does not interview the citizen.
      setDraft((d) => ({ ...d, applicantName: snapshot.scenario.npc.name, evidence: d.evidence.includes('passport') ? d.evidence : [...d.evidence, 'passport'] }));
      setScanning(false);
    }, 1400);
  };

  const toggleEvidence = (id: EvidenceId) => set('evidence', draft.evidence.includes(id) ? draft.evidence.filter((x) => x !== id) : [...draft.evidence, id]);

  const submit = async () => {
    if (!draft.service) {
      setProblem('Xizmat tanlanmagan.');
      setStep(1);
      return;
    }
    setProblem(null);
    setPrinting(true);
    const ok = await saveDocument(draft, true);
    setTimeout(() => {
      setPrinting(false);
      if (ok) closeTerminal();
    }, 1100);
  };

  const field = 'w-full min-h-11 rounded-lg border border-[#cfd6e0] bg-white px-3 text-base text-[#1b2433] outline-none focus-visible:border-[#1f6feb] focus-visible:ring-2 focus-visible:ring-[#1f6feb]/25 disabled:bg-[#eef1f5]';

  return (
    <div {...dismiss} className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-2 sm:p-5">
      {/* the monitor */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring}
        className="flex max-h-full w-full max-w-5xl flex-col rounded-[22px] bg-[#0c0d10] p-2.5 shadow-[0_40px_120px_rgba(0,0,0,0.7)] ring-1 ring-white/10 sm:p-3.5"
      >
        <div
          ref={frame}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Yagona oyna - operator ish joyi"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-[#eef1f5] text-[#1b2433] outline-none select-text"
        >
          {/* system bar */}
          <header className="flex items-center gap-3 bg-[#16213e] px-4 py-2 text-[0.8rem] text-white/85">
            <span className="font-semibold text-white">Yagona oyna</span>
            <span className="hidden text-white/50 sm:inline">Operator ish joyi · 3-xona</span>
            <span className="ml-auto rounded bg-white/12 px-2 py-0.5 font-semibold text-[#ffcf6b]">Navbat A-047</span>
            <Clock />
            <button type="button" onClick={() => void close()} className="ml-1 min-h-9 rounded-md bg-white/12 px-3 font-medium hover:bg-white/20">
              Ekrandan chiqish <span className="ml-1 opacity-60">Esc</span>
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* steps */}
            <nav aria-label="Rasmiylashtirish bosqichlari" className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#d7dde6] bg-white p-2 md:w-56 md:flex-col md:border-r md:border-b-0 md:p-3">
              {STEPS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={step === i ? 'step' : undefined}
                  className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 text-left text-[0.9rem] font-medium transition-colors ${step === i ? 'bg-[#e6eefc] text-[#12408f]' : 'text-[#4a5568] hover:bg-[#f2f5f9]'}`}
                >
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[0.72rem] font-bold ${done[i] ? 'bg-[#1f8a5b] text-white' : step === i ? 'bg-[#1f6feb] text-white' : 'bg-[#e3e8ef] text-[#4a5568]'}`}>
                    {done[i] ? '✓' : i + 1}
                  </span>
                  {label}
                  <span className="sr-only">{done[i] ? ' - toʻldirilgan' : ''}</span>
                </button>
              ))}
              <p className="mt-auto hidden rounded-lg bg-[#fff6df] p-2.5 text-[0.72rem] leading-snug text-[#7a5600] md:block">
                Oʻquv tizimi. Xizmat nomlari va kodlari namunaviy - mentor tasdigʻidan oʻtmagan.
              </p>
            </nav>

            {/* workspace */}
            <main className="scroll-soft min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.section key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.16 }} aria-labelledby="step-title">
                  <h2 id="step-title" className="text-xl font-semibold tracking-tight">{STEPS[step]}</h2>

                  {step === 0 && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-[14rem_1fr]">
                      <div className="rounded-xl border border-dashed border-[#b8c2d0] bg-white p-4 text-center">
                        <div className="relative mx-auto h-28 w-44 overflow-hidden rounded-lg bg-gradient-to-br from-[#dfe7f3] to-[#c9d6ea]">
                          <div className="absolute top-3 left-3 size-12 rounded bg-[#aebbd0]" />
                          <div className="absolute top-4 right-3 left-[4.5rem] space-y-1.5">
                            <div className="h-2 rounded bg-[#9fb0c9]" />
                            <div className="h-2 w-2/3 rounded bg-[#9fb0c9]" />
                            <div className="h-2 w-1/2 rounded bg-[#9fb0c9]" />
                          </div>
                          {scanning && <motion.div className="absolute inset-x-0 h-1 bg-[#1f6feb] shadow-[0_0_14px_#1f6feb]" initial={{ top: 0 }} animate={{ top: '100%' }} transition={{ duration: 0.7, repeat: 1, repeatType: 'reverse', ease: 'linear' }} />}
                        </div>
                        <button type="button" className="mt-3 min-h-11 w-full rounded-lg bg-[#1f6feb] px-3 text-[0.9rem] font-semibold text-white hover:bg-[#1a5fd0] disabled:opacity-50" disabled={locked || scanning} onClick={scan}>
                          {scanning ? 'Oʻqilmoqda…' : 'ID-kartani skanerlash'}
                        </button>
                      </div>
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1 block text-[0.85rem] font-semibold">Familiyasi, ismi</span>
                          <input className={field} value={draft.applicantName} maxLength={120} disabled={locked} onChange={(e) => set('applicantName', e.target.value)} placeholder="Skanerlang yoki qoʻlda kiriting" autoComplete="off" />
                        </label>
                        <p className="text-[0.84rem] leading-relaxed text-[#4a5568]">
                          Skaner faqat kartadagi maʼlumotni oʻqiydi. Murojaat mazmunini fuqaroning oʻzidan aniqlaysiz - tizim buni bilmaydi.
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="mt-4">
                      <label htmlFor="svc-search" className="sr-only">Xizmatlar katalogidan qidirish</label>
                      <input id="svc-search" type="search" className={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Xizmat nomi, kodi yoki kalit soʻz…" />
                      <div className="mt-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Toifa">
                        {CATEGORIES.map((c) => (
                          <button key={c.id} type="button" role="radio" aria-checked={category === c.id} onClick={() => setCategory(c.id)} className={`min-h-9 rounded-full px-3.5 text-[0.82rem] font-medium ${category === c.id ? 'bg-[#16213e] text-white' : 'bg-white text-[#4a5568] ring-1 ring-[#d7dde6]'}`}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <ul className="mt-3 space-y-2">
                        {results.map((s) => {
                          const selected = draft.service === s.id;
                          return (
                            <li key={s.id}>
                              <button
                                type="button"
                                disabled={locked}
                                aria-pressed={selected}
                                onClick={() => set('service', s.id)}
                                className={`w-full rounded-xl border bg-white p-3.5 text-left transition-colors ${selected ? 'border-[#1f6feb] ring-2 ring-[#1f6feb]/25' : 'border-[#d7dde6] hover:border-[#9aa8bd]'}`}
                              >
                                <span className="flex items-baseline gap-2">
                                  <span className="rounded bg-[#eef1f5] px-1.5 py-0.5 font-mono text-[0.72rem] text-[#4a5568]">{s.code}</span>
                                  <span className="font-semibold">{s.title}</span>
                                  {selected && <span className="ml-auto text-[0.78rem] font-semibold text-[#1f6feb]">Tanlangan</span>}
                                </span>
                                <span className="mt-1 block text-[0.86rem] leading-snug text-[#4a5568]">{s.about}</span>
                              </button>
                            </li>
                          );
                        })}
                        {results.length === 0 && <li className="rounded-xl bg-white p-4 text-[0.9rem] text-[#4a5568]">Bu soʻrov boʻyicha xizmat topilmadi.</li>}
                      </ul>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_17rem]">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="mb-1 block text-[0.85rem] font-semibold">Davr - boshlanishi (yil)</span>
                            <input className={field} inputMode="numeric" maxLength={10} disabled={locked} value={draft.periodFrom} onChange={(e) => set('periodFrom', e.target.value)} />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[0.85rem] font-semibold">Davr - tugashi (yil)</span>
                            <input className={field} inputMode="numeric" maxLength={10} disabled={locked} value={draft.periodTo} onChange={(e) => set('periodTo', e.target.value)} />
                          </label>
                        </div>
                        <label className="block">
                          <span className="mb-1 block text-[0.85rem] font-semibold">Ish joyi (tashkilot nomi va hozirgi holati)</span>
                          <input className={field} maxLength={200} disabled={locked} value={draft.employer} onChange={(e) => set('employer', e.target.value)} autoComplete="off" />
                        </label>
                      </div>
                      {/* your own notes from the interview - reference only, nothing is auto-filled */}
                      <aside className="rounded-xl bg-[#fffbe8] p-3.5 shadow-[0_1px_0_#e6dca8]" aria-label="Suhbatdan yozib olinganlar">
                        <h3 className="text-[0.78rem] font-semibold tracking-wider text-[#7a6a1c] uppercase">Daftaringiz</h3>
                        {snapshot.facts.length ? (
                          <ul className="mt-2 space-y-2 text-[0.86rem] leading-snug text-[#4d4520]">
                            {snapshot.facts.map((f) => (
                              <li key={f.id} className="border-b border-dashed border-[#e0d59a] pb-2 last:border-0">{f.text}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-[0.86rem] leading-snug text-[#7a6a1c]">Hali yozuv yoʻq. Tafsilotlarni fuqarodan soʻrab aniqlang.</p>
                        )}
                      </aside>
                    </div>
                  )}

                  {step === 3 && (
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {EVIDENCE.map((item) => {
                        const attached = draft.evidence.includes(item.id);
                        const unavailable = item.needs === 'phone' && !phoneHandedOver;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              disabled={locked || unavailable}
                              aria-pressed={attached}
                              onClick={() => toggleEvidence(item.id)}
                              className={`flex min-h-16 w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors disabled:opacity-55 ${attached ? 'border-[#1f8a5b] bg-[#eef8f2]' : 'border-[#d7dde6] hover:border-[#9aa8bd]'}`}
                            >
                              <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-[0.95rem] font-bold ${attached ? 'bg-[#1f8a5b] text-white' : 'bg-[#eef1f5] text-[#4a5568]'}`}>{attached ? '✓' : '+'}</span>
                              <span>
                                <span className="block text-[0.92rem] font-semibold leading-snug">{item.label}</span>
                                <span className="block text-[0.78rem] text-[#4a5568]">{unavailable ? 'Taqdim etilmagan' : item.hint}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {step === 4 && (
                    <div className="mt-4 space-y-4">
                      <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-white p-4 text-[0.9rem] sm:grid-cols-[10rem_1fr]">
                        <dt className="text-[#4a5568]">Murojaatchi</dt><dd className="font-medium">{draft.applicantName || '-'}</dd>
                        <dt className="text-[#4a5568]">Xizmat</dt><dd className="font-medium">{service ? `${service.code} · ${service.title}` : '-'}</dd>
                        <dt className="text-[#4a5568]">Davr</dt><dd className="font-medium">{draft.periodFrom || '-'} - {draft.periodTo || '-'}</dd>
                        <dt className="text-[#4a5568]">Ish joyi</dt><dd className="font-medium">{draft.employer || '-'}</dd>
                        <dt className="text-[#4a5568]">Ilovalar</dt><dd className="font-medium">{draft.evidence.length ? draft.evidence.map((id) => EVIDENCE.find((e) => e.id === id)?.label).join('; ') : '-'}</dd>
                      </dl>
                      <label className="block">
                        <span className="mb-1 block text-[0.85rem] font-semibold">Fuqaroga tushuntirilgan keyingi qadam (tilxatga chiqadi)</span>
                        <textarea className={`${field} min-h-24 py-2`} maxLength={1200} disabled={locked} value={draft.nextStep} onChange={(e) => set('nextStep', e.target.value)} placeholder="Nima boʻladi, qancha kutiladi, natijadan keyin nima qilinadi…" />
                      </label>
                      <label className="block max-w-xs">
                        <span className="mb-1 block text-[0.85rem] font-semibold">Natija haqida xabar berish</span>
                        <select className={field} disabled={locked} value={draft.notify} onChange={(e) => set('notify', e.target.value as DocumentDraft['notify'])}>
                          <option value="none">Tanlanmagan</option>
                          <option value="sms">SMS orqali</option>
                          <option value="written">Yozma javob</option>
                        </select>
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        {locked ? (
                          <p className="rounded-lg bg-[#e4f3ec] px-4 py-2.5 font-semibold text-[#136443]" role="status">Rasmiylashtirildi - tilxat chop etilgan. Yozuv yopiq.</p>
                        ) : (
                          <button type="button" className="min-h-11 rounded-lg bg-[#1f8a5b] px-5 font-semibold text-white hover:bg-[#17704a] disabled:opacity-50" disabled={busy || printing} onClick={() => void submit()}>
                            {printing ? 'Tilxat chop etilmoqda…' : 'Imzolash va tilxat chiqarish'}
                          </button>
                        )}
                        {problem && <p className="text-[0.9rem] font-medium text-[#b3261e]" role="alert">{problem}</p>}
                      </div>
                    </div>
                  )}
                </motion.section>
              </AnimatePresence>
            </main>
          </div>

          {/* status bar */}
          <footer className="flex items-center gap-3 border-t border-[#d7dde6] bg-white px-4 py-2 text-[0.78rem] text-[#4a5568]">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#1f8a5b]" />Tarmoq ulangan</span>
            <span className="hidden sm:inline">Qoralama ekrandan chiqqanda saqlanadi</span>
            <span className="ml-auto flex gap-2">
              <button type="button" className="min-h-9 rounded-md px-3 font-medium ring-1 ring-[#d7dde6] disabled:opacity-40" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Orqaga</button>
              <button type="button" className="min-h-9 rounded-md bg-[#16213e] px-3 font-medium text-white disabled:opacity-40" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>Keyingi</button>
            </span>
          </footer>
        </div>
      </motion.div>
    </div>
  );
}
