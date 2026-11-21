'use client';
/**
 * Mentors: the third step of «system → AI → mentor» (court server v1.5 /review). Moot verdicts and AI
 * characters' replies come here when the AI sent them (no quote found, runs disagreed, ethics) or as a
 * random audit. A mentor confirms, corrects items, or rejects; agreement with the AI is measured
 * (Cohen's kappa, target ≥ 0.61) - until then AI scores are for practice only.
 *
 * The server's shapes are read leniently: a field we do not know is shown as raw data, never a crash.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/game/api';
import { Sheet } from '@/components/ui/Sheet';
import { ease, note } from '@/lib/motion';

type Json = Record<string, unknown>;
type Kind = 'moot_verdict' | 'npc_reply';

const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
/** The first of several places a field may live in. */
const pick = (o: Json, ...keys: string[]): unknown => {
  for (const k of keys) {
    const path = k.split('.');
    let cur: unknown = o;
    for (const p of path) cur = obj(cur)[p];
    if (cur !== undefined && cur !== null) return cur;
  }
  return undefined;
};

async function api(path: string, body?: unknown): Promise<Json> {
  const res = await fetch(`/api/v1/library/audit${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res) throw new ApiError(0, 'network', 'Aloqa uzildi');
  const json = obj(await res.json().catch(() => null));
  if (!res.ok) throw new ApiError(res.status, str(obj(json.error).code) || 'error', res.status === 409 ? 'Bu ish allaqachon koʻrib chiqilgan' : str(obj(json.error).message) || 'Xatolik');
  return json;
}

const SIDE: Record<string, string> = { claimant: 'Daʼvogar', respondent: 'Javobgar' };
const REVIEWER = 'lexsim-reviewer';

function Raw({ data }: { data: unknown }) {
  return (
    <details className="disclosure mt-3 rounded-2xl bg-black/[0.03] px-4 py-2 text-[0.8rem]">
      <summary className="cursor-pointer font-semibold text-ink-2">Toʻliq maʼlumot (JSON)</summary>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-ink-2">{JSON.stringify(data, null, 1)}</pre>
    </details>
  );
}

/** A moot verdict: every AI item with its quote; the mentor marks it right or wrong. */
function VerdictItems({ item, marks, setMark }: { item: Json; marks: Record<string, 'yes' | 'no'>; setMark: (k: string, v: 'yes' | 'no') => void }) {
  const explain = obj(pick(item, 'explain', 'payload.explain', 'data.explain', 'verdict.explain'));
  const sides = obj(explain.sides);
  const keys = Object.keys(sides);
  if (!keys.length) return <p className="text-[0.9rem] text-ink-3">Bandlar topilmadi - pastdagi toʻliq maʼlumotni koʻring.</p>;
  return (
    <div className="space-y-4">
      {keys.map((side) => (
        <section key={side}>
          <h3 className="text-[0.76rem] font-semibold tracking-wider text-ink-3 uppercase">{SIDE[side] ?? side} · {str(obj(sides[side]).total)} ball</h3>
          <ul className="mt-2 space-y-2">
            {arr(obj(sides[side]).items).map((raw) => {
              const it = obj(raw);
              const key = `${side}:${str(it.id)}`;
              const ai = str(it.met);
              const now = marks[key] ?? (ai === 'yes' || ai === 'no' ? ai : undefined);
              return (
                <li key={key} className="rounded-2xl bg-black/[0.03] p-3">
                  <p className="text-[0.88rem] font-medium">{str(it.id)} · {str(it.ask)}</p>
                  {arr(it.evidence).map((e, i) => str(obj(e).quote) && <blockquote key={i} className="mt-1 border-l-2 border-accent/40 pl-2.5 text-[0.86rem] text-ink-2 italic">«{str(obj(e).quote)}»</blockquote>)}
                  {str(it.why) && <p className="mt-1 text-[0.82rem] text-ink-3">AI: {ai === 'yes' ? '✓' : ai === 'no' ? '✗' : '–'} {str(it.why)}</p>}
                  {(ai === 'yes' || ai === 'no' || marks[key]) && (
                    <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label={`${key} bahosi`}>
                      {(['yes', 'no'] as const).map((v) => (
                        <button key={v} type="button" role="radio" aria-checked={now === v} onClick={() => setMark(key, v)}
                          className={`min-h-9 rounded-full px-3.5 text-[0.82rem] font-semibold transition-colors ${now === v ? (v === 'yes' ? 'bg-accent text-white' : 'bg-danger text-white') : 'bg-black/[0.05] text-ink-2'}`}>
                          {v === 'yes' ? '✓ Bajarilgan' : '✗ Bajarilmagan'}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** An AI character's reply: what the student said, what the character answered, the facts it had. */
function NpcReply({ item }: { item: Json }) {
  const reply = pick(item, 'reply.text', 'payload.reply.text', 'data.reply.text', 'reply', 'payload.reply');
  const facts = arr(pick(item, 'facts', 'payload.facts', 'request.facts', 'data.facts'));
  return (
    <div className="space-y-3 text-[0.92rem]">
      <p><span className="text-ink-3">Talaba: </span>{str(pick(item, 'utterance', 'payload.utterance', 'request.utterance', 'data.utterance')) || '-'}</p>
      <p><span className="text-ink-3">{str(pick(item, 'speaker', 'payload.speaker', 'request.speaker')) || 'Qahramon'}: </span>{str(reply) || '-'}</p>
      {facts.length > 0 && <div><p className="text-[0.76rem] font-semibold tracking-wider text-ink-3 uppercase">Qahramon bilgan faktlar</p><ul className="mt-1 list-disc space-y-1 pl-5 text-ink-2">{facts.map((f, i) => <li key={i}>{str(f)}</li>)}</ul></div>}
    </div>
  );
}

function Queue({ kind }: { kind: Kind }) {
  const [list, setList] = useState<Json[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Json | null>(null);
  const [marks, setMarks] = useState<Record<string, 'yes' | 'no'>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewer, setReviewer] = useState(() => { try { return localStorage.getItem(REVIEWER) ?? ''; } catch { return ''; } });

  const load = useCallback(() => {
    setList(null);
    api(`?kind=${kind}`).then((j) => {
      const q = j.queue;
      setList(arr(Array.isArray(q) ? q : pick(obj(q), 'items', 'queue')).map(obj));
    }, (e) => setError(e instanceof ApiError ? e.message : 'Navbat yuklanmadi'));
  }, [kind]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch when the tab opens
    load();
  }, [load]);

  const show = async (it: Json) => {
    setMarks({});
    setReason('');
    setOpen(it);
    try {
      const full = obj((await api(`/${encodeURIComponent(str(it.id))}`)).item);
      setOpen({ ...it, ...obj(full.item ?? full) });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ish ochilmadi');
    }
  };
  const decide = async (decision: 'approve' | 'adjust' | 'reject') => {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    try {
      try { localStorage.setItem(REVIEWER, reviewer); } catch { /* per-viewer convenience only */ }
      await api(`/${encodeURIComponent(str(open.id))}`, { decision, ...(decision === 'adjust' ? { items: marks } : {}), ...(reason.trim() ? { note: reason.trim() } : {}), ...(reviewer.trim() ? { reviewer: reviewer.trim() } : {}) });
      setList((l) => l?.filter((x) => x.id !== open.id) ?? null);
      setOpen(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Saqlanmadi');
    } finally {
      setBusy(false);
    }
  };
  // a changed AI item makes it an «adjust»; otherwise the mentor approves the AI as it is
  const changed = open ? Object.entries(marks).filter(([k, v]) => {
    const [side, id] = k.split(':');
    const it = arr(obj(obj(obj(pick(open, 'explain', 'payload.explain', 'data.explain', 'verdict.explain')).sides)[side]).items).map(obj).find((x) => str(x.id) === id);
    return str(it?.met) !== v;
  }) : [];

  return (
    <div>
      <AnimatePresence>{error && <motion.p key="e" {...note} role="alert" className="mb-3 rounded-2xl bg-danger-soft px-4 py-3 text-[0.9rem] text-danger">{error}</motion.p>}</AnimatePresence>
      <ul className="space-y-2.5">
        {!list && !error && <li className="surface h-20 animate-pulse rounded-[22px] motion-reduce:animate-none" />}
        {list?.length === 0 && <li className="surface rounded-[22px] p-6 text-center text-ink-2">Navbat boʻsh.</li>}
        {list?.map((it) => {
          const reasons = arr(it.routing).map((r) => str(obj(r).reason)).filter(Boolean).concat(str(it.reason) ? [str(it.reason)] : []);
          return (
            <li key={str(it.id)}>
              <button type="button" onClick={() => void show(it)} className="surface press flex w-full items-center gap-4 rounded-[22px] p-4 text-left">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-[0.74rem] font-semibold text-ink-3">
                    {it.sample ? <span className="rounded-full bg-black/[0.05] px-2 py-0.5">tasodifiy audit</span> : <span className="rounded-full bg-[#fff7e6] px-2 py-0.5 text-[#8a5a00]">AI yubordi</span>}
                    {str(it.createdAt) && <span>{new Date(str(it.createdAt)).toLocaleString('uz-UZ')}</span>}
                  </span>
                  <span className="mt-1 block font-semibold">{str(pick(it, 'title', 'case.title', 'summary')) || str(pick(it, 'utterance')) || str(it.id)}</span>
                  {reasons.length > 0 && <span className="mt-0.5 block text-[0.84rem] text-ink-3">{reasons.join(' · ')}</span>}
                </span>
                <span aria-hidden className="text-ink-3">→</span>
              </button>
            </li>
          );
        })}
      </ul>
      <AnimatePresence>
        {open && (
          <Sheet key={str(open.id)} title={kind === 'moot_verdict' ? 'Bahs bahosi' : 'AI qahramon javobi'} kicker="Mentor tekshiruvi" wide busy={busy} onClose={() => setOpen(null)}
            footer={
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                  <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} maxLength={60} placeholder="Ismingiz (jurnal uchun)" aria-label="Mentor ismi" className="field" />
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={1} placeholder="Izoh (rad etishda majburiy)" aria-label="Izoh" className="field resize-y" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {kind === 'moot_verdict' && changed.length > 0
                    ? <button type="button" className="btn btn-primary press" disabled={busy} onClick={() => void decide('adjust')}>Tuzatib saqlash ({changed.length})</button>
                    : <button type="button" className="btn btn-primary press" disabled={busy} onClick={() => void decide('approve')}>{kind === 'npc_reply' ? 'Yaxshi' : 'Toʻgʻri'}</button>}
                  <button type="button" className="btn btn-danger press" disabled={busy || reason.trim().length < 5} onClick={() => void decide('reject')}>{kind === 'npc_reply' ? 'Yomon' : 'Rad etish'}</button>
                </div>
              </div>
            }>
            {kind === 'moot_verdict'
              ? <VerdictItems item={open} marks={Object.fromEntries(changed)} setMark={(k, v) => setMarks((m) => ({ ...m, [k]: v }))} />
              : <NpcReply item={open} />}
            <Raw data={open} />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stats() {
  const [s, setS] = useState<Json | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api('/stats').then((j) => setS(obj(j.stats)), (e) => setError(e instanceof ApiError ? e.message : 'Statistika yuklanmadi'));
  }, []);
  if (error) return <p className="surface rounded-[22px] p-5 text-ink-2">{error}</p>;
  if (!s) return <div className="surface h-40 animate-pulse rounded-[22px] motion-reduce:animate-none" />;
  const kappa = Number(pick(s, 'kappa', 'agreement.kappa'));
  const agreement = Number(pick(s, 'agreement.rate', 'agreementRate', 'agreement'));
  const tiles: [string, string][] = [
    ['Kelishuv', Number.isFinite(agreement) ? `${Math.round(agreement <= 1 ? agreement * 100 : agreement)} %` : '-'],
    ['Koen kappasi', Number.isFinite(kappa) ? kappa.toFixed(2) : '-'],
    ['Oltin toʻplam', str(pick(s, 'goldItems')) || '-'],
    ['Tasodifiy audit', str(pick(s, 'auditRate')) ? `${Math.round(Number(pick(s, 'auditRate')) <= 1 ? Number(pick(s, 'auditRate')) * 100 : Number(pick(s, 'auditRate')))} %` : '-'],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="surface rounded-[22px] p-4">
            <p className="text-[0.76rem] font-semibold text-ink-3">{k}</p>
            <p className="display mt-1 text-2xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="surface rounded-[22px] p-5">
        <p className="text-[0.86rem] font-semibold">Kappa: maqsad 0,61</p>
        <div className="relative mt-3 h-2.5 rounded-full bg-black/[0.06]" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number.isFinite(kappa) ? kappa : 0} aria-label="Koen kappasi">
          <motion.div className="absolute inset-y-0 left-0 rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, Number.isFinite(kappa) ? kappa : 0)) * 100}%` }} transition={ease.surface} />
          <span aria-hidden className="absolute -top-1 bottom-[-4px] w-0.5 rounded bg-ink" style={{ left: '61%' }} />
        </div>
        <p className="mt-3 text-[0.84rem] text-ink-2">{Number.isFinite(kappa) && kappa >= 0.61 ? 'Maqsadga yetildi: AI bahosi mentorlar bilan yetarli darajada kelishadi.' : 'Maqsadga yetguncha AI bahosi faqat mashq uchun. Har bir koʻrib chiqilgan ish oltin toʻplamga qoʻshiladi.'}</p>
      </div>
      <Raw data={s} />
    </div>
  );
}

export function Audit({ tab }: { tab: 'moot' | 'npc' | 'stats' }) {
  return tab === 'moot' ? <Queue key="m" kind="moot_verdict" /> : tab === 'npc' ? <Queue key="n" kind="npc_reply" /> : <Stats />;
}
