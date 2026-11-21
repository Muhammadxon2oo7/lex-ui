'use client';
/**
 * «Hujjatlar» - the drafting desk. The student works the way an advocate does: reads the papers in
 * the folder, fills in the order (the official form, 12 items) and WRITES the statement of claim -
 * the court is chosen from the court system, everything else is typed. The page fills in on the
 * right exactly as it will be printed. Validation is the court's job (server): nothing here says
 * what is missing.
 *
 * Sources: FPK 189-191 (contents and attachments of a claim); Law «Sudlar toʻgʻrisida», art. 2 (the
 * courts); Adliya vazirining 2023-yil 31-yanvardagi 1-mh-son buyrugʻi (the order form).
 */
import { motion } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CaseItem, ClaimDraft, OrderDraft } from '@/contracts/case';
import { COURT_TYPES, courtName, DISTRICTS, FOLDER, type CourtType } from '@/lib/labourCase';
import type { PaperModel } from './paper';

const spring = { type: 'spring', bounce: 0, duration: 0.4 } as const;

const ATTACH: { id: string; label: string; needs?: string }[] = [
  { id: 'order', label: 'Boʻshatish buyrugʻi nusxasi', needs: 'order' },
  { id: 'contract', label: 'Mehnat shartnomasi nusxasi', needs: 'contract' },
  { id: 'sickleave', label: 'Kasallik varaqasi nusxasi', needs: 'sickleave' },
  { id: 'warrant', label: 'Advokat orderi (vakolat hujjati)', needs: 'authority' },
  { id: 'receipt', label: 'Pochta xarajatlari toʻlanganligi kvitansiyasi' },
  { id: 'duty', label: 'Davlat boji toʻlanganligi kvitansiyasi' },
  { id: 'passport', label: 'Daʼvogar pasportining asli' },
  { id: 'tax', label: 'Korxonaning soliq hisobotlari' },
];

const EMPTY_ORDER: OrderDraft = { number: '', firm: '', firmAddress: '', advocate: '', license: '', specialty: '', basis: '', basisDate: '', client: '', caseType: '', issued: '', signed: false };
const EMPTY: ClaimDraft = {
  court: { type: '', district: '' }, claimant: { name: '', address: '' }, representative: { name: '', address: '' }, respondent: { name: '', address: '' },
  demand: '', circumstances: '', evidence: [], pretrial: '', email: '', attachments: [], copies: 0, date: '', signed: false, order: null,
};

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const longDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[1]}-yil ${Number(m[3])}-${MONTHS[Number(m[2]) - 1]}` : '';
};

/* ───────────────────────── fields ───────────────────────── */

const fieldCls = 'w-full rounded-xl bg-black/25 px-3 text-[0.92rem] text-white ring-1 ring-white/12 outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-emerald-400/80';

function Field({ label, hint, after, children }: { label: string; hint?: string; after?: React.ReactNode; children: (id: string, describedBy?: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[0.76rem] font-semibold text-white/70">{label}</label>
      {children(id, hint ? `${id}-hint` : undefined)}
      {after}
      {hint && <p id={`${id}-hint`} className="mt-1 text-[0.72rem] text-white/40">{hint}</p>}
    </div>
  );
}
function Text({ value, onChange, placeholder, label, hint, max = 200 }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string; hint?: string; max?: number }) {
  return (
    <Field label={label} hint={hint}>
      {(id, desc) => <input id={id} aria-describedby={desc} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={max} spellCheck={false} autoComplete="off" className={`${fieldCls} min-h-11`} />}
    </Field>
  );
}
function Area({ value, onChange, placeholder, label, hint, rows = 5, max = 6000 }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string; hint?: string; rows?: number; max?: number }) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <Field label={label} hint={hint} after={<p className="mt-0.5 text-right text-[0.68rem] text-white/35 tabular-nums" aria-live="off">{words} soʻz</p>}>
      {(id, desc) => <textarea id={id} aria-describedby={desc} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={max} rows={rows} className={`${fieldCls} resize-y py-2.5 leading-relaxed`} />}
    </Field>
  );
}
function Select<T extends string>({ value, onChange, options, label, placeholder, hint }: { value: T | ''; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string; placeholder: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      {(id, desc) => <select id={id} aria-describedby={desc} value={value} onChange={(e) => onChange(e.target.value as T)} className={`${fieldCls} min-h-11 appearance-none bg-[length:12px] bg-[right_0.9rem_center] bg-no-repeat pr-9`}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffffff88' stroke-width='1.6' fill='none'/%3E%3C/svg%3E\")" }}>
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id} className="bg-[#0d1320]">{o.label}</option>)}
      </select>}
    </Field>
  );
}
function Radio<T extends string>({ value, onChange, options, label }: { value: T | ''; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-[0.76rem] font-semibold text-white/70">{label}</legend>
      <div className="grid gap-1.5">
        {options.map((o) => (
          <label key={o.id} className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 ring-1 transition-colors duration-150 ${value === o.id ? 'bg-emerald-500/15 ring-emerald-400/60' : 'bg-black/20 ring-white/10 hover:bg-white/[0.06]'}`}>
            <input type="radio" className="size-4 accent-emerald-500" checked={value === o.id} onChange={() => onChange(o.id)} />
            <span className="text-[0.88rem]">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Section({ n, title, article, children }: { n: number | string; title: string; article: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/[0.045] p-4 ring-1 ring-white/10">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="grid h-6 min-w-6 shrink-0 place-items-center self-center rounded-full bg-white/12 px-1.5 text-[0.75rem] font-bold whitespace-nowrap tabular-nums">{n}</span>
        <h3 className="min-w-0 flex-1 basis-32 text-[0.98rem] leading-tight font-semibold text-balance">{title}</h3>
        <span className="ml-auto text-[0.7rem] font-semibold text-amber-200/80 tabular-nums max-sm:ml-9 max-sm:basis-full">{article}</span>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Pen on paper: a small signature pad. */
function SignaturePad({ onSigned }: { onSigned: (dataUrl: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a2b6d';
    ctx.lineWidth = 2.2;
  }, []);
  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  return (
    <div>
      <canvas
        ref={canvas}
        aria-label="Imzo maydoni: sichqoncha yoki barmoq bilan imzo qoʻying"
        className="h-24 w-full touch-none rounded-xl bg-[#fbfaf6] ring-1 ring-white/20"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = canvas.current!.getContext('2d')!;
          ctx.beginPath();
          ctx.moveTo(...point(e));
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvas.current!.getContext('2d')!;
          ctx.lineTo(...point(e));
          ctx.stroke();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          onSigned(canvas.current!.toDataURL('image/png'));
        }}
      />
      <div className="mt-1.5 flex items-center gap-3 text-[0.78rem] text-white/55">
        <span>Imzo qoʻying (sichqoncha yoki barmoq bilan)</span>
        <button type="button" className="ml-auto font-medium text-white/75 underline underline-offset-2" onClick={() => {
          const c = canvas.current!;
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
          onSigned(null);
        }}>Tozalash</button>
      </div>
    </div>
  );
}

/* ───────────────────────── the three tabs ───────────────────────── */

function Folder({ known }: { known: Set<string> }) {
  const papers = FOLDER.filter((p) => !p.requires || known.has(p.requires));
  const missing = FOLDER.filter((p) => p.requires && !known.has(p.requires));
  return (
    <div className="space-y-3">
      <p className="text-[0.84rem] leading-relaxed text-white/60">Maslahatda olgan hujjatlaringiz. Arizani va orderni shu maʼlumotlar asosida oʻzingiz yozasiz - sud har bir rekvizitni shu hujjatlar bilan solishtiradi.</p>
      {papers.map((p) => (
        <article key={p.id} className="rounded-2xl bg-[#fbfaf6] p-4 font-serif text-[#1b1b1b] shadow-[0_10px_30px_rgba(0,0,0,0.35)] select-text">
          <h3 className="text-[0.92rem] font-bold">{p.title}</h3>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-[0.84rem] sm:grid-cols-[auto_1fr]">
            {p.lines.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-black/50">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
      {missing.length > 0 && <p className="rounded-xl bg-black/25 px-3 py-2 text-[0.8rem] text-white/50">Maslahatda olinmagan: {missing.map((p) => p.title.toLowerCase()).join('; ')}.</p>}
      <p className="text-[0.7rem] text-white/35">Oʻquv namunasi: ismlar, manzillar va raqamlar toʻqilgan.</p>
    </div>
  );
}

function OrderForm({ o, set, onSigned }: { o: OrderDraft; set: <K extends keyof OrderDraft>(k: K, v: OrderDraft[K]) => void; onSigned: (v: boolean) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[0.84rem] leading-relaxed text-white/60">
        Advokatning muayyan ishni olib borishga vakolati order bilan tasdiqlanadi. Shakl - Adliya vazirining 2023-yil 31-yanvardagi 1-mh-son buyrugʻi ilovasi. 1-12-bandlar toʻliq toʻldirilmagan order haqiqiy hisoblanmaydi.
      </p>
      <Section n="1-5" title="Order va advokat" article="Order shakli, 1-5-bandlar">
        <Text label="1. Order raqami" value={o.number} onChange={(v) => set('number', v)} max={40} hint="Advokat oʻzi beradi; yil boshidan oʻsib boradi." />
        <Text label="2. Advokatlik tuzilmasining nomi" value={o.firm} onChange={(v) => set('firm', v)} />
        <Text label="3. Advokatlik tuzilmasining manzili va telefon raqami" value={o.firmAddress} onChange={(v) => set('firmAddress', v)} />
        <Text label="4. Advokatning familiyasi, ismi va otasining ismi" value={o.advocate} onChange={(v) => set('advocate', v)} />
        <Text label="5. Advokatlik guvohnomasining rekvizitlari" value={o.license} onChange={(v) => set('license', v)} hint="Raqami, berilgan sanasi, kim tomonidan berilgan." />
      </Section>
      <Section n="6-8" title="Ixtisoslik va asos" article="Order shakli, 6-8-bandlar">
        <Radio label="6. Advokatning litsenziya boʻyicha ixtisosligi" value={o.specialty} onChange={(v) => set('specialty', v)} options={[{ id: 'civil-economic', label: 'Fuqarolik va iqtisodiy sud ishlarini yuritish' }, { id: 'admin-criminal', label: 'Maʼmuriy va jinoiy sud ishlarini yuritish' }]} />
        <Radio label="7. Order berishga asos" value={o.basis} onChange={(v) => set('basis', v)} options={[{ id: 'contract', label: 'Shartnoma (bitim)' }, { id: 'ruling', label: 'Qaror (ajrim)' }]} />
        <Text label="8. Asos boʻlgan hujjat rasmiylashtirilgan sana" value={o.basisDate} onChange={(v) => set('basisDate', v)} max={40} />
      </Section>
      <Section n="9-12" title="Ishonch bildiruvchi va ish" article="Order shakli, 9-12-bandlar">
        <Text label="9. Ishonch bildiruvchi shaxsning familiyasi, ismi va otasining ismi" value={o.client} onChange={(v) => set('client', v)} />
        <Select label="10. Yuridik yordam koʻrsatiladigan ish turi" placeholder="Ish turini tanlang" value={o.caseType} onChange={(v) => set('caseType', v)}
          options={[{ id: 'civil', label: 'Fuqarolik ishi' }, { id: 'economic', label: 'Iqtisodiy ish' }, { id: 'admin-offence', label: 'Maʼmuriy huquqbuzarlik toʻgʻrisidagi ish' }, { id: 'administrative', label: 'Maʼmuriy ish' }, { id: 'criminal', label: 'Jinoiy ish' }, { id: 'other', label: 'Boshqa ish' }]} />
        <Text label="11. Order berilgan sana" value={o.issued} onChange={(v) => set('issued', v)} max={40} />
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-black/20 px-3 ring-1 ring-white/10">
          <input type="checkbox" className="size-4 accent-emerald-500" checked={o.signed} onChange={(e) => onSigned(e.target.checked)} />
          <span className="text-[0.88rem]">12. Qogʻoz order: advokatning imzosi va advokatlik tuzilmasining muhri qoʻyildi</span>
        </label>
      </Section>
    </div>
  );
}

/* ───────────────────────── editor ───────────────────────── */

type Tab = 'folder' | 'order' | 'claim';

export function ClaimEditor({ facts, evidence, advocate, initial, busy, onSubmit, onCode, onPaper }: {
  /** The page as it stands, for the sheet on the 3D desk. */
  onPaper?: (paper: PaperModel) => void;
  facts: CaseItem[];
  evidence: CaseItem[];
  advocate: string;
  initial: ClaimDraft | null;
  busy: boolean;
  onSubmit: (draft: ClaimDraft) => void;
  onCode: (article: string) => void;
}) {
  const [d, setD] = useState<ClaimDraft>(() => (initial ? { ...initial, signed: false } : EMPTY));
  const [o, setO] = useState<OrderDraft>(() => initial?.order ?? EMPTY_ORDER);
  const [tab, setTab] = useState<Tab>(() => (initial ? 'claim' : 'folder'));
  const [signature, setSignature] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const set = <K extends keyof ClaimDraft>(k: K, v: ClaimDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setPart = <K extends 'court' | 'claimant' | 'representative' | 'respondent'>(k: K, part: Partial<ClaimDraft[K]>) => setD((x) => ({ ...x, [k]: { ...x[k], ...part } }));
  const setOrder = <K extends keyof OrderDraft>(k: K, v: OrderDraft[K]) => setO((x) => ({ ...x, [k]: v }));
  const toggle = (k: 'evidence' | 'attachments', id: string) => setD((x) => ({ ...x, [k]: x[k].includes(id) ? x[k].filter((i) => i !== id) : [...x[k], id] }));
  const known = useMemo(() => new Set([...facts.map((f) => f.id), ...evidence.map((e) => e.id)]), [facts, evidence]);
  const court = courtName(d.court.type, d.court.district);

  const blocker = !d.court.type || !d.court.district ? 'Sudni tanlang' : !d.claimant.name.trim() ? 'Daʼvogarni yozing' : !d.demand.trim() ? 'Talabni yozing' : null;
  const draft = (): ClaimDraft => ({ ...d, signed: Boolean(signature), order: d.attachments.includes('warrant') ? o : null });

  // the same page, as a model for the printed sheet on the desk
  const paper = useMemo<PaperModel>(() => {
    const evidenceText = d.evidence.map((id) => evidence.find((e) => e.id === id)?.label.toLowerCase()).filter(Boolean).join(', ');
    const paras = d.circumstances.split(/\n+/).map((t) => t.trim()).filter(Boolean);
    return {
      header: [
        court ? { text: `${court}ga`, bold: true } : { text: '[sud nomi]', empty: true },
        d.claimant.name.trim() ? { text: `Daʼvogar: ${d.claimant.name.trim()}${d.claimant.address.trim() ? `, ${d.claimant.address.trim()}` : ''}` } : { text: 'Daʼvogar: [F.I.Sh., yashash joyi]', empty: true },
        ...(d.representative.name.trim() ? [{ text: `Daʼvogar vakili: ${d.representative.name.trim()}${d.representative.address.trim() ? `, ${d.representative.address.trim()}` : ''}` }] : []),
        d.respondent.name.trim() ? { text: `Javobgar: ${d.respondent.name.trim()}${d.respondent.address.trim() ? `, ${d.respondent.address.trim()}` : ''}` } : { text: 'Javobgar: [nomi, manzili]', empty: true },
        ...(d.email.trim() ? [{ text: `Elektron manzil: ${d.email.trim()}` }] : []),
      ],
      title: 'DAʼVO ARIZASI',
      subtitle: '',
      body: [
        ...(paras.length ? paras.map((text) => ({ text })) : [{ text: '[talabga asos boʻlgan holatlar]', empty: true }]),
        ...(evidenceText ? [{ text: `Yuqoridagi holatlar quyidagi dalillar bilan tasdiqlanadi: ${evidenceText}.` }] : []),
        ...(d.pretrial === 'done' ? [{ text: 'Nizoni hal qilish uchun daʼvogar avval ish beruvchiga murojaat qilgan, natija boʻlmagan.' }] : []),
      ],
      demandLead: 'Yuqoridagilarga asosan SOʻRAYMAN:',
      demand: d.demand.trim() ? { text: d.demand.trim() } : { text: '[talab]', empty: true },
      attachments: [
        ...d.attachments.map((id) => ({ text: ATTACH.find((a) => a.id === id)?.label ?? id })),
        ...(d.copies > 0 ? [{ text: `Arizaning javobgar uchun nusxasi - ${d.copies} dona` }] : []),
        ...(d.attachments.length === 0 && d.copies === 0 ? [{ text: '[ilovalar roʻyxati]', empty: true }] : []),
      ],
      date: longDate(d.date) || '[sana]',
      signer: d.representative.name.trim() ? 'Daʼvogar vakili' : 'Daʼvogar',
      signature,
    };
  }, [d, court, evidence, signature]);
  useEffect(() => {
    onPaper?.(paper);
  }, [paper, onPaper]);

  const TABS: [Tab, string][] = [['folder', 'Ish papkasi'], ['order', 'Advokat orderi'], ['claim', 'Daʼvo arizasi']];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring}
      className="absolute inset-0 z-30 grid grid-cols-1 gap-4 overflow-y-auto bg-[#070a10]/80 p-3 backdrop-blur-sm lg:pointer-events-none lg:grid-cols-[minmax(0,min(38rem,46vw))_1fr] lg:overflow-hidden lg:bg-transparent lg:p-5 lg:pt-[4.6rem] lg:backdrop-blur-none"
      role="dialog" aria-modal="true" aria-labelledby="claim-title">
      <div className="flex min-h-0 flex-col rounded-[22px] bg-[#0d1320]/95 text-white ring-1 ring-white/10 lg:pointer-events-auto lg:overflow-hidden">
        <header className="border-b border-white/10 px-5 pt-3.5">
          <p className="text-[0.66rem] font-semibold tracking-[0.18em] text-amber-200 uppercase">Hujjatlar · 2-bosqich</p>
          <h2 id="claim-title" className="text-[1.15rem] font-semibold">Daʼvo arizasini tuzish</h2>
          <p className="text-[0.8rem] text-white/55">Hujjatlarni oʻqing, orderni toʻldiring, arizani oʻzingiz yozing. Kamchiliklarni sud aniqlaydi - xuddi hayotdagidek.</p>
          <div role="tablist" aria-label="Hujjatlar" className="mt-3 -mb-px flex gap-1">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`min-h-10 rounded-t-xl px-3.5 text-[0.86rem] font-semibold transition-colors duration-150 ${tab === id ? 'bg-white/[0.07] text-white shadow-[inset_0_-2px_0_#34d399]' : 'text-white/55 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="scroll-soft flex-1 space-y-3 overflow-y-auto px-4 py-4 select-text" role="tabpanel">
          {tab === 'folder' && <Folder known={known} />}
          {tab === 'order' && (known.has('authority')
            ? <OrderForm o={o} set={setOrder} onSigned={(v) => setOrder('signed', v)} />
            : <p className="rounded-xl bg-black/25 px-4 py-3 text-[0.88rem] text-white/60">Mijoz bilan shartnoma tuzilmagan - order berishga asos yoʻq (Order shakli, 7-band). Maslahat xonasida vakolatni rasmiylashtiring.</p>)}
          {tab === 'claim' && (
            <>
              <Section n={1} title="Ariza berilayotgan sud" article="189-m. 1-band · 26, 28, 33-m.">
                <Select label="Sud" placeholder="Sudni tanlang" value={d.court.type} onChange={(v: CourtType) => setPart('court', { type: v })}
                  options={COURT_TYPES.map((c) => ({ id: c.id, label: c.label }))} hint="Sud tizimi - «Sudlar toʻgʻrisida»gi Qonun, 2-modda." />
                {d.court.type !== 'supreme' && (
                  <Select label="Hudud" placeholder="Tuman (shahar)ni tanlang" value={d.court.district} onChange={(v) => setPart('court', { district: v })}
                    options={DISTRICTS.map((x) => ({ id: x, label: `${x} tumani` }))} />
                )}
                {court && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[0.86rem] text-emerald-100">Arizada: <b>{court}ga</b></p>}
                <button type="button" className="text-[0.76rem] text-emerald-300 underline underline-offset-2" onClick={() => onCode('33-modda')}>33-modda: sudlovga tegishlilik</button>
              </Section>
              <Section n={2} title="Daʼvogar va uning vakili" article="189-m. 2-band">
                <Text label="Daʼvogarning familiyasi, ismi, otasining ismi" value={d.claimant.name} onChange={(v) => setPart('claimant', { name: v })} max={160} />
                <Text label="Daʼvogarning yashash joyi" value={d.claimant.address} onChange={(v) => setPart('claimant', { address: v })} />
                <Text label="Vakilning familiyasi, ismi, otasining ismi" value={d.representative.name} onChange={(v) => setPart('representative', { name: v })} placeholder={advocate} hint="Ariza vakil tomonidan berilsa, vakil maʼlumotlari ham koʻrsatiladi." max={160} />
                <Text label="Vakilning manzili" value={d.representative.address} onChange={(v) => setPart('representative', { address: v })} />
              </Section>
              <Section n={3} title="Javobgar" article="189-m. 3-band">
                <Text label="Javobgar (tashkilot boʻlsa - nomi)" value={d.respondent.name} onChange={(v) => setPart('respondent', { name: v })} />
                <Text label="Joylashgan yeri (pochta manzili)" value={d.respondent.address} onChange={(v) => setPart('respondent', { address: v })} />
              </Section>
              <Section n={4} title="Daʼvogarning talabi" article="189-m. 4-band">
                <Area label="SOʻRAYMAN:" value={d.demand} onChange={(v) => set('demand', v)} rows={3} max={2000} placeholder="Sud nimani hal qilishini aniq yozing…" />
              </Section>
              <Section n={5} title="Talabga asos boʻlgan holatlar" article="189-m. 6-band">
                <Area label="Holatlar" value={d.circumstances} onChange={(v) => set('circumstances', v)} rows={8} placeholder="Nima boʻlgan, qachon, qaysi hujjat bilan; ish beruvchi qaysi qoidani buzgan…" hint="Sanalar va hujjat raqamlarini ish papkasidan oling. Xatboshilarni yangi qatordan boshlang." />
              </Section>
              <Section n={6} title="Holatlarni tasdiqlovchi dalillar" article="189-m. 6-band">
                <div className="flex flex-wrap gap-1.5">
                  {evidence.map((e) => (
                    <button key={e.id} type="button" aria-pressed={d.evidence.includes(e.id)} onClick={() => toggle('evidence', e.id)}
                      className={`min-h-9 rounded-full px-3 py-1.5 text-left text-[0.84rem] ring-1 transition-colors duration-150 ${d.evidence.includes(e.id) ? 'bg-emerald-500/20 ring-emerald-400/70' : 'bg-black/20 ring-white/12 hover:bg-white/[0.08]'}`}>
                      {d.evidence.includes(e.id) ? '✓ ' : '+ '}{e.label}
                    </button>
                  ))}
                  {evidence.length === 0 && <p className="text-[0.85rem] text-white/50">Mijozdan hujjat olinmagan.</p>}
                </div>
              </Section>
              <Section n={7} title="Sudgacha hal qilish tartibi va aloqa" article="189-m. 7-band · oxirgi qism">
                <Select label="Nizoni sudgacha hal qilish tartibi" placeholder="Tanlang" value={d.pretrial} onChange={(v: 'none' | 'done') => set('pretrial', v)}
                  options={[{ id: 'none', label: 'Qonunda yoki shartnomada majburiy tartib nazarda tutilmagan' }, { id: 'done', label: 'Ish beruvchiga murojaat qilingan, natija boʻlmagan' }]} />
                <Text label="Elektron manzil (ixtiyoriy)" value={d.email} onChange={(v) => set('email', v)} hint="Koʻrsatilsa - sud xabarnomalarini elektron olishga rozilik." max={120} />
              </Section>
              <Section n={8} title="Ilovalar" article="191-modda · 190-modda">
                <div className="grid gap-1.5">
                  {ATTACH.map((a) => {
                    const available = !a.needs || known.has(a.needs);
                    return (
                      <label key={a.id} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 ring-1 ring-white/10 ${available ? 'bg-black/20' : 'bg-black/10 opacity-40'}`}>
                        <input type="checkbox" className="size-4 accent-emerald-500" disabled={!available} checked={d.attachments.includes(a.id)} onChange={() => toggle('attachments', a.id)} />
                        <span className="text-[0.86rem]">{a.label}{!available && ' - qoʻlingizda yoʻq'}{a.id === 'warrant' && available && ' - «Advokat orderi» varagʻidagi shakl'}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-[0.86rem]">Arizaning javobgar uchun nusxalari</span>
                  <button type="button" aria-label="Kamaytirish" className="grid size-9 place-items-center rounded-full bg-white/10 text-lg" onClick={() => set('copies', Math.max(0, d.copies - 1))}>−</button>
                  <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">{d.copies}</span>
                  <button type="button" aria-label="Koʻpaytirish" className="grid size-9 place-items-center rounded-full bg-white/10 text-lg" onClick={() => set('copies', Math.min(5, d.copies + 1))}>+</button>
                </div>
              </Section>
              <Section n={9} title="Sana va imzo" article="189-modda 2-qism">
                <Field label="Ariza sanasi">
                  {(id) => <input id={id} type="date" value={d.date} min="2026-10-14" onChange={(e) => set('date', e.target.value)} className={`${fieldCls} min-h-11 [color-scheme:dark]`} />}
                </Field>
                <SignaturePad onSigned={(url) => setSignature(url)} />
              </Section>
            </>
          )}
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
          <button type="button" className="btn btn-quiet !min-h-11 !rounded-xl text-[0.86rem]" onClick={() => onCode('189-modda')}>189-moddani ochish</button>
          {tab !== 'claim' ? (
            <button type="button" onClick={() => setTab(tab === 'folder' ? 'order' : 'claim')} className="btn btn-primary ml-auto !min-h-11 !rounded-xl">
              {tab === 'folder' ? 'Orderga oʻtish' : 'Arizaga oʻtish'}
            </button>
          ) : (
            <button type="button" disabled={busy || Boolean(blocker)} onClick={() => onSubmit(draft())} className="btn btn-primary ml-auto !min-h-11 !rounded-xl">
              {blocker ?? (signature ? 'Chop etish va papkaga solish' : 'Imzosiz chop etish')}
            </button>
          )}
        </footer>
      </div>

      {/* paper: on wide screens it lies on the desk in 3D; the close-up opens on demand */}
      <div className={`relative flex min-h-0 items-start justify-center lg:overflow-y-auto ${zoom ? 'lg:pointer-events-auto lg:rounded-[22px] lg:bg-black/55 lg:p-4 lg:backdrop-blur-sm' : ''}`}>
        <button type="button" onClick={() => setZoom((z) => !z)} className="glass btn pointer-events-auto absolute right-0 bottom-0 z-10 hidden !min-h-10 !px-4 text-[0.84rem] text-white lg:inline-flex">
          {zoom ? 'Stolga qaytarish' : 'Qogʻozni yaqindan koʻrish'}
        </button>
        <div className={zoom ? 'contents' : 'contents lg:hidden'}>
          <article aria-label="Daʼvo arizasi koʻrinishi" className="w-full max-w-[40rem] rounded-[6px] bg-[#fbfaf6] px-[7%] py-[8%] font-serif text-[0.86rem] leading-relaxed text-[#1b1b1b] shadow-[0_30px_80px_rgba(0,0,0,0.55)] select-text">
            <div className="ml-auto w-[62%] space-y-1.5 text-[0.82rem]">
              {paper.header.map((l, i) => <p key={i} className={l.empty ? 'text-black/30' : l.bold ? 'font-semibold' : ''}>{l.text}</p>)}
            </div>
            <h4 className="mt-7 text-center text-[1.05rem] font-bold tracking-wide">DAʼVO ARIZASI</h4>
            <div className="mt-4 space-y-2 text-justify indent-6">
              {paper.body.map((l, i) => <p key={i} className={l.empty ? 'text-black/30' : ''}>{l.text}</p>)}
            </div>
            <p className="mt-4 font-bold">{paper.demandLead}</p>
            <p className={`indent-6 whitespace-pre-line ${paper.demand.empty ? 'text-black/30' : ''}`}>{paper.demand.text}</p>
            <p className="mt-4 font-bold">Ilovalar:</p>
            <ol className="list-decimal pl-6 text-[0.82rem]">
              {paper.attachments.map((l, i) => <li key={i} className={l.empty ? 'text-black/30' : ''}>{l.text}</li>)}
            </ol>
            <div className="mt-8 flex items-end justify-between gap-4 text-[0.82rem]">
              <span className={d.date ? '' : 'text-black/30'}>{paper.date}</span>
              <span className="flex items-end gap-2">
                {paper.signer}:
                <span className="inline-block h-12 w-36 border-b border-black/50">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data URL of the drawn signature */}
                  {signature && <img src={signature} alt="Imzo" className="h-12 w-36 object-contain" />}
                </span>
              </span>
            </div>
            <p className="mt-6 text-center text-[0.68rem] text-black/40">Oʻquv namunasi · ish holatlari toʻqilgan</p>
          </article>
        </div>
      </div>
    </motion.div>
  );
}
