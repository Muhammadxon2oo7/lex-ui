'use client';
/**
 * The drafting desk: the student assembles the statement of claim from what
 * they actually learned in the consultation, and watches the paper fill in
 * on the right — the way it will be printed, signed and filed. Validation
 * is the court's job (server): nothing here says what is missing.
 */
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CaseItem, ClaimDraft } from '@/contracts/case';
import type { PaperModel } from './paper';

const spring = { type: 'spring', bounce: 0, duration: 0.4 } as const;

const COURTS: { id: ClaimDraft['court']; label: string; hint: string }[] = [
  { id: 'district', label: 'Fuqarolik ishlari boʻyicha Namuna tumanlararo sudi', hint: 'Javobgar (ish beruvchi) joylashgan tumandagi fuqarolik sudi' },
  { id: 'regional', label: 'Namuna viloyat sudining fuqarolik ishlari boʻyicha sudlov hayʼati', hint: 'Yuqori turuvchi sud — apellyatsiya instansiyasi' },
  { id: 'economic', label: 'Namuna tumanlararo iqtisodiy sudi', hint: 'Xoʻjalik nizolari sudi' },
];
const RESPONDENTS: { id: ClaimDraft['respondent']; label: string }[] = [
  { id: 'company', label: '«Namuna Savdo» MChJ (ish beruvchi tashkilot)' },
  { id: 'director', label: 'Korxona direktori A. Karimov (shaxsan)' },
];
const DEMANDS: { id: ClaimDraft['demand']; label: string; text: string }[] = [
  { id: 'reinstate', label: 'Ishga tiklash va majburiy progul vaqti uchun haq undirish', text: '1) daʼvogarni avvalgi lavozimiga tiklashni; 2) majburiy progul vaqti uchun oʻrtacha ish haqini javobgardan undirishni.' },
  { id: 'punish', label: 'Direktorni javobgarlikka tortish', text: 'korxona direktorini javobgarlikka tortishni.' },
  { id: 'apology', label: 'Ish beruvchidan rasmiy uzr talab qilish', text: 'javobgarni daʼvogardan rasmiy uzr soʻrashga majburlashni.' },
];
const ATTACH: { id: string; label: string; needs?: string }[] = [
  { id: 'order', label: 'Boʻshatish buyrugʻi nusxasi', needs: 'order' },
  { id: 'contract', label: 'Mehnat shartnomasi nusxasi', needs: 'contract' },
  { id: 'sickleave', label: 'Kasallik varaqasi nusxasi', needs: 'sickleave' },
  { id: 'warrant', label: 'Advokat orderi (vakolat hujjati)', needs: 'warrant' },
  { id: 'receipt', label: 'Pochta xarajatlari toʻlanganligi kvitansiyasi' },
  { id: 'duty', label: 'Davlat boji toʻlanganligi kvitansiyasi' },
  { id: 'passport', label: 'Daʼvogar pasportining asli' },
  { id: 'tax', label: 'Korxonaning soliq hisobotlari' },
];
/** How each learned fact reads in the body of the claim. */
const FACT_TEXT: Record<string, string> = {
  tenure: 'Daʼvogar javobgar tashkilotda besh yil davomida omborchi lavozimida ishlagan, oylik ish haqi 4 200 000 soʻmni tashkil etgan.',
  dismissal: 'Javobgarning 2026-yil 14-oktabrdagi 47-k-sonli buyrugʻi bilan daʼvogar 9 va 10-oktabr kunlari uzrli sabablarsiz ishda boʻlmagan deb mehnat shartnomasi bekor qilingan.',
  sick: 'Biroq daʼvogar oʻsha kunlari kasal boʻlgan, unga poliklinika tomonidan kasallik varaqasi berilgan.',
  notified: 'Daʼvogar 9-oktabr kuni ertalab boʻlim boshligʻiga telefon orqali kasal boʻlib qolgani haqida xabar bergan.',
  witness: 'Bu holatni daʼvogarning hamkasbi Bahodir R. tasdiqlay oladi.',
  refused: '13-oktabr kuni daʼvogar kasallik varaqasini kadrlar boʻlimiga topshirmoqchi boʻlgan, biroq u qabul qilinmagan.',
  employer: 'Daʼvogar javobgar — «Namuna Savdo» MChJda (Namuna tumanida davlat roʻyxatidan oʻtgan) besh yil omborchi boʻlib ishlagan, oylik ish haqi 4 200 000 soʻm.',
  authority: 'Daʼvogarning manfaatlarini sudda advokat shartnoma asosida ifodalaydi.',
  explanation: 'Mehnat kodeksining 313-moddasiga zid ravishda, intizomiy jazo qoʻllanguniga qadar daʼvogardan yozma tushuntirish talab qilinmagan.',
  served: 'Buyruqning koʻchirma nusxasi daʼvogarga 2026-yil 14-oktabrda topshirilgan; Mehnat kodeksining 560-moddasida belgilangan uch oylik muddat oʻtmagan.',
};
const FACT_ORDER = ['employer', 'dismissal', 'served', 'explanation', 'sick', 'notified', 'witness', 'refused', 'authority'];

function Section({ n, title, article, children }: { n: number; title: string; article: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/[0.045] p-4 ring-1 ring-white/10">
      {/* the article reference wraps under the title on a narrow panel instead of squeezing it */}
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="grid size-6 shrink-0 place-items-center self-center rounded-full bg-white/12 text-[0.75rem] font-bold tabular-nums">{n}</span>
        <h3 className="min-w-0 flex-1 basis-32 text-[0.98rem] leading-tight font-semibold text-balance">{title}</h3>
        <span className="ml-auto text-[0.7rem] font-semibold text-amber-200/80 tabular-nums max-sm:ml-9 max-sm:basis-full">{article}</span>
      </header>
      {children}
    </section>
  );
}

function Choice<T extends string>({ value, onChange, options, name }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; hint?: string }[]; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-1.5">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`flex min-h-11 items-start gap-3 rounded-xl px-3 py-2 text-left ring-1 transition-[background-color,box-shadow] duration-150 ${value === o.id ? 'bg-emerald-500/15 ring-emerald-400/70' : 'bg-black/20 ring-white/10 hover:bg-white/[0.07]'}`}>
          <span aria-hidden className={`mt-1 size-3.5 shrink-0 rounded-full ring-2 ${value === o.id ? 'bg-emerald-400 ring-emerald-400' : 'ring-white/40'}`} />
          <span>
            <span className="block text-[0.9rem] leading-snug">{o.label}</span>
            {o.hint && <span className="block text-[0.74rem] text-white/50">{o.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick}
      className={`min-h-9 rounded-full px-3 py-1.5 text-left text-[0.84rem] leading-snug ring-1 transition-[background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${on ? 'bg-emerald-500/20 ring-emerald-400/70' : 'bg-black/20 ring-white/12 hover:bg-white/[0.08]'}`}>
      {on ? '✓ ' : '+ '}
      {children}
    </button>
  );
}

/** Pen on paper: a small signature pad. */
function SignaturePad({ onSigned }: { onSigned: (dataUrl: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);
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
          strokes.current += 1;
          onSigned(canvas.current!.toDataURL('image/png'));
        }}
      />
      <div className="mt-1.5 flex items-center gap-3 text-[0.78rem] text-white/55">
        <span>Imzo qoʻying (sichqoncha yoki barmoq bilan)</span>
        <button type="button" className="ml-auto font-medium text-white/75 underline underline-offset-2" onClick={() => {
          const c = canvas.current!;
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
          strokes.current = 0;
          onSigned(null);
        }}>Tozalash</button>
      </div>
    </div>
  );
}

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
  const [d, setD] = useState<ClaimDraft>(() => initial ? { ...initial, signed: false } : {
    court: 'district', representative: false, respondent: 'company', demand: 'reinstate', facts: [], evidence: [], pretrial: false, email: false, attachments: [], copies: 0, signed: false,
  });
  // radios start unpicked for a fresh draft so the choice is the student's
  const [picked, setPicked] = useState(() => new Set<string>(initial ? ['court', 'respondent', 'demand'] : []));
  const [signature, setSignature] = useState<string | null>(null);
  const set = <K extends keyof ClaimDraft>(k: K, v: ClaimDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const pick = <K extends 'court' | 'respondent' | 'demand'>(k: K, v: ClaimDraft[K]) => {
    set(k, v);
    setPicked((p) => new Set(p).add(k));
  };
  const toggle = (k: 'facts' | 'evidence' | 'attachments', id: string) => setD((x) => ({ ...x, [k]: x[k].includes(id) ? x[k].filter((i) => i !== id) : [...x[k], id] }));
  const known = useMemo(() => new Set(evidence.map((e) => e.id)), [evidence]);
  const knownFacts = useMemo(() => new Set(facts.map((f) => f.id)), [facts]);
  const ready = picked.size === 3 && Boolean(signature);

  const body = useMemo(() => FACT_ORDER.filter((f) => d.facts.includes(f)).map((f) => FACT_TEXT[f]), [d.facts]);
  const court = COURTS.find((c) => c.id === d.court)!;
  const [zoom, setZoom] = useState(false);

  // the same page, as a model for the printed sheet on the desk
  const paper = useMemo<PaperModel>(() => {
    const evidenceText = d.evidence.map((id) => evidence.find((e) => e.id === id)?.label.toLowerCase()).filter(Boolean).join(', ');
    return {
      header: [
        picked.has('court') ? { text: `${court.label}ga`, bold: true } : { text: '[sud nomi]', empty: true },
        { text: 'Daʼvogar: Sardor N., Namuna tumani, Bogʻbon mahallasi, 12-uy' },
        ...(d.representative ? [{ text: `Daʼvogar vakili: advokat ${advocate}, «Namuna» advokatlik byurosi` }] : []),
        !picked.has('respondent')
          ? { text: 'Javobgar: [javobgar]', empty: true }
          : { text: `Javobgar: ${d.respondent === 'company' ? `«Namuna Savdo» MChJ${knownFacts.has('employer') ? ', Namuna tumani, Ipak yoʻli koʻchasi, 5-uy' : ', manzili: ______'}` : 'A. Karimov, «Namuna Savdo» MChJ direktori'}` },
        ...(d.email ? [{ text: 'Elektron manzil: advokat@namuna-byuro.uz' }] : []),
      ],
      title: 'DAʼVO ARIZASI',
      subtitle: d.demand === 'reinstate' && picked.has('demand') ? '(ishga tiklash toʻgʻrisida)' : '',
      body: [
        ...(body.length ? body.map((text) => ({ text })) : [{ text: '[talabga asos boʻlgan holatlar]', empty: true }]),
        ...(evidenceText ? [{ text: `Yuqoridagi holatlar quyidagi dalillar bilan tasdiqlanadi: ${evidenceText}.` }] : []),
        ...(d.pretrial && knownFacts.has('refused') ? [{ text: 'Daʼvogar 13-oktabr kuni nizoni hal qilish uchun ish beruvchiga murojaat qilgan, natija boʻlmagan.' }] : []),
      ],
      demandLead: 'Yuqoridagilarga asosan SOʻRAYMAN:',
      demand: picked.has('demand') ? { text: DEMANDS.find((x) => x.id === d.demand)!.text } : { text: '[talab]', empty: true },
      attachments: [
        ...d.attachments.map((id) => ({ text: ATTACH.find((a) => a.id === id)?.label ?? id })),
        ...(d.copies > 0 ? [{ text: `Arizaning javobgar uchun nusxasi — ${d.copies} dona` }] : []),
        ...(d.attachments.length === 0 && d.copies === 0 ? [{ text: '[ilovalar roʻyxati]', empty: true }] : []),
      ],
      date: '2026-yil 20-noyabr',
      signer: d.representative ? 'Daʼvogar vakili' : 'Daʼvogar',
      signature,
    };
  }, [d, picked, court, advocate, knownFacts, body, evidence, signature]);
  useEffect(() => {
    onPaper?.(paper);
  }, [paper, onPaper]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring}
      className="absolute inset-0 z-30 grid grid-cols-1 gap-4 overflow-y-auto bg-[#070a10]/80 p-3 backdrop-blur-sm lg:pointer-events-none lg:grid-cols-[minmax(0,min(36rem,44vw))_1fr] lg:overflow-hidden lg:bg-transparent lg:p-5 lg:pt-[4.6rem] lg:backdrop-blur-none"
      role="dialog" aria-modal="true" aria-labelledby="claim-title">
      {/* editor */}
      <div className="flex min-h-0 flex-col rounded-[22px] bg-[#0d1320]/95 text-white ring-1 ring-white/10 lg:pointer-events-auto lg:overflow-hidden">
        <header className="border-b border-white/10 px-5 py-3.5">
          <p className="text-[0.66rem] font-semibold tracking-[0.18em] text-amber-200 uppercase">Hujjatlar xonasi · 2-bosqich</p>
          <h2 id="claim-title" className="text-[1.15rem] font-semibold">Daʼvo arizasini tuzish</h2>
          <p className="text-[0.8rem] text-white/55">Faqat maslahatda aniqlaganingiz bilan ishlaysiz. Kamchiliklarni sud aniqlaydi — xuddi hayotdagidek.</p>
        </header>
        <div className="scroll-soft flex-1 space-y-3 overflow-y-auto px-4 py-4 select-text">
          <Section n={1} title="Ariza berilayotgan sud" article="189-m. 1-band · 26, 28, 33-m.">
            <Choice name="Sud" value={picked.has('court') ? d.court : ('' as ClaimDraft['court'])} onChange={(v) => pick('court', v)} options={COURTS} />
            <button type="button" className="mt-2 text-[0.76rem] text-emerald-300 underline underline-offset-2" onClick={() => onCode('33-modda')}>33-modda: sudlovga tegishlilik</button>
          </Section>
          <Section n={2} title="Daʼvogar va uning vakili" article="189-m. 1-band 2-band">
            <p className="text-[0.88rem] text-white/80">Daʼvogar: Sardor N., Namuna tumani, Bogʻbon mahallasi, 12-uy.</p>
            <label className="mt-2 flex min-h-11 items-center gap-3 rounded-xl bg-black/20 px-3 ring-1 ring-white/10">
              <input type="checkbox" className="size-4 accent-emerald-500" checked={d.representative} onChange={(e) => set('representative', e.target.checked)} />
              <span className="text-[0.88rem]">Vakil maʼlumotlarini kiritish: advokat {advocate}, manzili</span>
            </label>
          </Section>
          <Section n={3} title="Javobgar" article="189-m. 1-band 3-band">
            <Choice name="Javobgar" value={picked.has('respondent') ? d.respondent : ('' as ClaimDraft['respondent'])} onChange={(v) => pick('respondent', v)} options={RESPONDENTS} />
          </Section>
          <Section n={4} title="Daʼvogarning talabi" article="189-m. 1-band 4-band">
            <Choice name="Talab" value={picked.has('demand') ? d.demand : ('' as ClaimDraft['demand'])} onChange={(v) => pick('demand', v)} options={DEMANDS} />
          </Section>
          <Section n={5} title="Talabga asos boʻlgan holatlar" article="189-m. 1-band 6-band">
            {facts.length === 0 ? <p className="text-[0.85rem] text-white/50">Maslahatda hech qanday holat aniqlanmagan.</p> : (
              <div className="flex flex-wrap gap-1.5">
                {FACT_ORDER.filter((f) => knownFacts.has(f)).map((id) => (
                  <Chip key={id} on={d.facts.includes(id)} onClick={() => toggle('facts', id)}>{facts.find((f) => f.id === id)!.label}</Chip>
                ))}
              </div>
            )}
          </Section>
          <Section n={6} title="Holatlarni tasdiqlovchi dalillar" article="189-m. 1-band 6-band">
            <div className="flex flex-wrap gap-1.5">
              {evidence.map((e) => <Chip key={e.id} on={d.evidence.includes(e.id)} onClick={() => toggle('evidence', e.id)}>{e.label}</Chip>)}
              {evidence.length === 0 && <p className="text-[0.85rem] text-white/50">Mijozdan hujjat olinmagan.</p>}
            </div>
          </Section>
          <Section n={7} title="Sudgacha hal qilish tartibi va aloqa" article="189-m. 7-band · oxirgi qism">
            <label className="flex min-h-11 items-center gap-3 rounded-xl bg-black/20 px-3 ring-1 ring-white/10">
              <input type="checkbox" className="size-4 accent-emerald-500" checked={d.pretrial} onChange={(e) => set('pretrial', e.target.checked)} />
              <span className="text-[0.86rem]">Ish beruvchiga murojaat haqidagi maʼlumotni koʻrsatish (qonunda yoki shartnomada nazarda tutilgan boʻlsa)</span>
            </label>
            <label className="mt-1.5 flex min-h-11 items-center gap-3 rounded-xl bg-black/20 px-3 ring-1 ring-white/10">
              <input type="checkbox" className="size-4 accent-emerald-500" checked={d.email} onChange={(e) => set('email', e.target.checked)} />
              <span className="text-[0.86rem]">Elektron manzilni koʻrsatish — sud xabarnomalarini elektron olishga rozilik</span>
            </label>
          </Section>
          <Section n={8} title="Ilovalar" article="191-modda · 190-modda">
            <div className="grid gap-1.5">
              {ATTACH.map((a) => {
                const available = !a.needs || known.has(a.needs);
                return (
                  <label key={a.id} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 ring-1 ring-white/10 ${available ? 'bg-black/20' : 'bg-black/10 opacity-40'}`}>
                    <input type="checkbox" className="size-4 accent-emerald-500" disabled={!available} checked={d.attachments.includes(a.id)} onChange={() => toggle('attachments', a.id)} />
                    <span className="text-[0.86rem]">{a.label}{!available && ' — qoʻlingizda yoʻq'}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <span className="flex-1 text-[0.86rem]">Arizaning javobgar uchun nusxalari</span>
              <button type="button" aria-label="Kamaytirish" className="grid size-9 place-items-center rounded-full bg-white/10 text-lg" onClick={() => set('copies', Math.max(0, d.copies - 1))}>−</button>
              <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">{d.copies}</span>
              <button type="button" aria-label="Koʻpaytirish" className="grid size-9 place-items-center rounded-full bg-white/10 text-lg" onClick={() => set('copies', Math.min(5, d.copies + 1))}>+</button>
            </div>
          </Section>
          <Section n={9} title="Imzo" article="189-modda 2-qism">
            <SignaturePad onSigned={(url) => {
              setSignature(url);
              set('signed', Boolean(url));
            }} />
          </Section>
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
          <button type="button" className="btn btn-quiet !min-h-11 !rounded-xl text-[0.86rem]" onClick={() => onCode('189-modda')}>189-moddani ochish</button>
          <button type="button" disabled={busy || picked.size < 3} onClick={() => onSubmit(d)} className="btn btn-primary ml-auto !min-h-11 !rounded-xl">
            {ready ? 'Chop etish va papkaga solish' : picked.size < 3 ? 'Sud, javobgar va talabni tanlang' : 'Imzosiz chop etish'}
          </button>
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
            <p className={picked.has('court') ? 'font-semibold' : 'text-black/30'}>{picked.has('court') ? `${court.label}ga` : '[sud nomi]'}</p>
            <p><b>Daʼvogar:</b> Sardor N., Namuna tumani, Bogʻbon mahallasi, 12-uy</p>
            {d.representative && <p><b>Daʼvogar vakili:</b> advokat {advocate}, «Namuna» advokatlik byurosi, Namuna tumani, Mustaqillik koʻchasi, 3-uy</p>}
            <p className={picked.has('respondent') ? '' : 'text-black/30'}>
              <b>Javobgar:</b>{' '}
              {!picked.has('respondent') ? '[javobgar]' : d.respondent === 'company' ? `«Namuna Savdo» MChJ${knownFacts.has('employer') ? ', Namuna tumani, Ipak yoʻli koʻchasi, 5-uy' : ', manzili: __________'}` : 'A. Karimov, «Namuna Savdo» MChJ direktori'}
            </p>
            {d.email && <p><b>Elektron manzil:</b> advokat@namuna-byuro.uz</p>}
          </div>
          <h4 className="mt-7 text-center text-[1.05rem] font-bold tracking-wide">DAʼVO ARIZASI</h4>
          <p className="text-center text-[0.82rem]">{d.demand === 'reinstate' && picked.has('demand') ? '(ishga tiklash toʻgʻrisida)' : ''}</p>
          <div className="mt-4 space-y-2 text-justify indent-6">
            {body.length ? body.map((t) => <p key={t}>{t}</p>) : <p className="text-black/30">[talabga asos boʻlgan holatlar]</p>}
            {d.evidence.length > 0 && <p>Yuqoridagi holatlar quyidagi dalillar bilan tasdiqlanadi: {d.evidence.map((id) => evidence.find((e) => e.id === id)?.label.toLowerCase()).filter(Boolean).join(', ')}.</p>}
            {d.pretrial && knownFacts.has('refused') && <p>Daʼvogar 13-oktabr kuni nizoni hal qilish uchun ish beruvchiga murojaat qilgan, natija boʻlmagan.</p>}
          </div>
          <p className="mt-4 font-bold">Yuqoridagilarga asosan SOʻRAYMAN:</p>
          <p className="indent-6">{picked.has('demand') ? DEMANDS.find((x) => x.id === d.demand)!.text : <span className="text-black/30">[talab]</span>}</p>
          <p className="mt-4 font-bold">Ilovalar:</p>
          <ol className="list-decimal pl-6 text-[0.82rem]">
            {d.attachments.map((id) => <li key={id}>{ATTACH.find((a) => a.id === id)?.label}</li>)}
            {d.copies > 0 && <li>Arizaning javobgar uchun nusxasi — {d.copies} dona</li>}
            {d.attachments.length === 0 && d.copies === 0 && <li className="text-black/30">[ilovalar roʻyxati]</li>}
          </ol>
          <div className="mt-8 flex items-end justify-between gap-4 text-[0.82rem]">
            <span>2026-yil 20-noyabr</span>
            <span className="flex items-end gap-2">
              {d.representative ? 'Daʼvogar vakili' : 'Daʼvogar'}:
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
