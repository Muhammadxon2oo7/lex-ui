'use client';
/**
 * Solutions of a case (court server v1.5): how others approached it - side, what they relied on, how it
 * ended («Bahsda yutgan ✓» only when the server bound a real verdict). Your own are private by default;
 * you open, close, edit or delete them.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import type { Solution } from '@/contracts/library';
import { ApiError } from '@/game/api';
import { library } from '@/game/library';
import { getProfile } from '@/game/profile';
import { ease, note } from '@/lib/motion';
import { Segmented } from '@/components/ui/glass';

const SIDE = { claimant: 'daʼvogar tomoni', respondent: 'javobgar tomoni' } as const;

/** Write a solution. `verdictId`: the moot verdict to bind (the server checks you took part); `side` is then fixed. */
export function SolutionForm({ caseId, code, verdictId, fixedSide, onSaved }: { caseId: string; code?: string; verdictId?: string; fixedSide?: 'claimant' | 'respondent'; onSaved: (s: Solution) => void }) {
  const [approach, setApproach] = useState('');
  const [side, setSide] = useState<'claimant' | 'respondent' | 'none'>(fixedSide ?? 'none');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [name, setName] = useState(() => (typeof window === 'undefined' ? '' : getProfile()?.name ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const len = approach.trim().length;
  const save = async () => {
    if (busy || len < 50) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await library.addSolution(caseId, { approach: approach.trim(), side: side === 'none' ? null : side, visibility, ...(name.trim() ? { name: name.trim() } : {}), ...(verdictId ? { verdictId } : {}), ...(code ? { code } : {}) }));
      setApproach('');
    } catch (e) {
      setError(e instanceof ApiError ? (e.code === 'ethics' ? 'Matnda haqoratli soʻz bor - yechim saqlanmadi.' : e.message) : 'Saqlanmadi');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[0.8rem] font-semibold text-ink-2">Yondashuvingiz</span>
        <textarea value={approach} onChange={(e) => setApproach(e.target.value)} rows={5} maxLength={4000} className="field mt-1.5 resize-y"
          placeholder="Qaysi faktlar va dalillarga tayandingiz, qaysi normani qanday qoʻlladingiz, raqibning qaysi vajiga qanday javob berdingiz…" />
        <span className={`mt-1 block text-right text-[0.74rem] tabular-nums ${len < 50 ? 'text-ink-3' : 'text-accent-ink'}`}>{len < 50 ? `yana ${50 - len} belgi` : `${len} / 4000`}</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {!fixedSide && <Segmented label="Tomon" size="sm" value={side} onChange={setSide} options={[['none', 'Koʻrsatmayman'], ['claimant', 'Daʼvogar'], ['respondent', 'Javobgar']]} />}
        <Segmented label="Boshqalar koʻrsinmi?" size="sm" value={visibility} onChange={setVisibility} options={[['private', 'Faqat men'], ['public', 'Ha, ochiq']]} />
        <label className="block">
          <span className="text-[0.8rem] font-semibold text-ink-2">Taxallus (ixtiyoriy)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Anonim" className="field mt-1.5" />
        </label>
      </div>
      {verdictId && <p className="text-[0.8rem] text-ink-3">Bahs natijasi server tomonidan biriktiriladi - uni oʻzgartirib boʻlmaydi.</p>}
      <AnimatePresence>{error && <motion.p key="e" {...note} role="alert" className="rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[0.88rem] text-danger">{error}</motion.p>}</AnimatePresence>
      <button type="button" className="btn btn-primary press" disabled={busy || len < 50} aria-busy={busy} onClick={() => void save()}>{busy ? 'Saqlanmoqda…' : 'Yechimni saqlash'}</button>
    </div>
  );
}

function Item({ s, onChange }: { s: Solution; onChange: (s: Solution | null) => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (body: { delete: true } | { visibility: 'public' | 'private' }) => {
    setBusy(true);
    try {
      const next = await library.editSolution(s.id, body);
      onChange('delete' in body ? null : next ?? s);
    } catch {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-2xl bg-black/[0.03] p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem]">
        <span className="font-semibold text-ink">{s.name || 'Anonim'}</span>
        {s.side && <span className="text-ink-3">· {SIDE[s.side]}</span>}
        {s.verdict?.verified && s.verdict.won && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent-ink">Bahsda yutgan ✓</span>}
        {s.verdict?.verified && s.verdict.won === false && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-semibold text-ink-2">Bahsda qatnashgan</span>}
        {s.mine && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-semibold text-ink-2">{s.visibility === 'public' ? 'Ochiq' : s.visibility === 'hidden' ? 'Mentor yashirgan' : 'Faqat men'}</span>}
      </p>
      <p className="mt-1.5 text-[0.92rem] leading-relaxed whitespace-pre-line text-ink-2">{s.approach}</p>
      {s.mine && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {s.visibility !== 'hidden' && <button type="button" className="btn btn-quiet press !min-h-9 !px-3 text-[0.82rem]" disabled={busy} onClick={() => void act({ visibility: s.visibility === 'public' ? 'private' : 'public' })}>{s.visibility === 'public' ? 'Yopish' : 'Ochish'}</button>}
          <button type="button" className="btn btn-quiet press !min-h-9 !px-3 text-[0.82rem] text-danger" disabled={busy} onClick={() => void act({ delete: true })}>Oʻchirish</button>
        </div>
      )}
    </li>
  );
}

export function Solutions({ caseId, code }: { caseId: string; code?: string }) {
  const [list, setList] = useState<Solution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const load = useCallback(() => {
    library.solutions(caseId, code).then(setList, (e) => setError(e instanceof ApiError ? e.message : 'Yechimlar yuklanmadi'));
  }, [caseId, code]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <section className="surface mt-3 rounded-[22px] p-4" aria-labelledby={`sol-${caseId}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`sol-${caseId}`} className="text-[0.72rem] font-semibold tracking-wider text-ink-3 uppercase">Yechimlar{list ? ` (${list.length})` : ''}</h3>
        {!writing && <button type="button" className="btn btn-quiet press !min-h-9 !px-3 text-[0.82rem]" onClick={() => setWriting(true)}>+ Yechimim</button>}
      </div>
      <AnimatePresence initial={false}>
        {writing && (
          <motion.div key="f" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={ease.surface} className="overflow-hidden">
            <div className="pt-3"><SolutionForm caseId={caseId} code={code} onSaved={(s) => { setList((l) => [s, ...(l ?? [])]); setWriting(false); }} /></div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="mt-2 text-[0.86rem] text-ink-3">{error}</p>}
      {!list && !error && <div className="mt-3 h-16 animate-pulse rounded-2xl bg-black/[0.04] motion-reduce:animate-none" />}
      {list?.length === 0 && !writing && <p className="mt-2 text-[0.88rem] text-ink-3">Hali yechim yoʻq. Birinchi boʻlib yozing - qaysi dalilga tayanganingizni boshqalar ham koʻrsin.</p>}
      {list && list.length > 0 && <ul className="mt-3 space-y-2">{list.map((s) => <Item key={s.id} s={s} onChange={(n) => setList((l) => (n ? l!.map((x) => (x.id === s.id ? n : x)) : l!.filter((x) => x.id !== s.id)))} />)}</ul>}
    </section>
  );
}
