'use client';
/**
 * "Case qoʻshish": the student tells what happened in plain words; the court server's model drafts a
 * simulation case (45-95 s) using only articles from its lex.uz base. The student answers the model's
 * questions (and may redraft), edits the case, and saves it: it goes to a mentor. Nothing here invents
 * articles: legal references can only be removed, never typed in.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Domain, Draft, LibCase } from '@/contracts/library';
import { ApiError } from '@/game/api';
import { library } from '@/game/library';
import { Sheet } from '@/components/ui/Sheet';
import { Segmented } from '@/components/ui/glass';
import { ease, note } from '@/lib/motion';

type Editable = Omit<LibCase, 'id' | 'source' | 'status' | 'mine' | 'reviewNote' | 'createdAt' | 'updatedAt' | 'shareCode' | 'solutions'>;
const field = 'field';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">{children}{hint && <span className="ml-1 font-normal text-ink-3">{hint}</span>}</span>;
}

function Items({ label, items, onChange }: { label: string; items: { id: string; title: string; text: string }[]; onChange: (v: { id: string; title: string; text: string }[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-[0.8rem] font-semibold text-ink-2">{label}</legend>
      <AnimatePresence initial={false}>
        {items.map((it, i) => (
          <motion.div key={it.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={ease.surface} className="overflow-hidden">
            <div className="surface space-y-2 rounded-[18px] p-3">
              <div className="flex gap-2">
                <input aria-label={`${label} ${i + 1}: sarlavha`} value={it.title} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={`${field} !min-h-10`} />
                <button type="button" aria-label="Olib tashlash" onClick={() => onChange(items.filter((_, j) => j !== i))} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger">✕</button>
              </div>
              <textarea aria-label={`${label} ${i + 1}: matn`} value={it.text} rows={2} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className={`${field} resize-y`} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <button type="button" onClick={() => onChange([...items, { id: `n${Date.now().toString(36)}`, title: '', text: '' }])} className="btn btn-quiet !min-h-9 text-[0.84rem]">+ Qoʻshish</button>
    </fieldset>
  );
}

function Lines({ label, lines, onChange, tone }: { label: string; lines: string[]; onChange: (v: string[]) => void; tone?: 'secret' }) {
  return (
    <label className="block">
      <Label hint="har qator alohida">{label}</Label>
      <textarea value={lines.join('\n')} rows={Math.max(2, lines.length + 1)} onChange={(e) => onChange(e.target.value.split('\n'))} className={`${field} resize-y ${tone === 'secret' ? '!bg-[#fffaf0]' : ''}`} />
    </label>
  );
}

export function Composer({ domain, onClose, onSaved }: { domain: Domain; onClose: () => void; onSaved: (c: LibCase) => void }) {
  const [story, setStory] = useState('');
  const [answers, setAnswers] = useState('');
  const [phase, setPhase] = useState<'write' | 'working' | 'edit' | 'saving'>('write');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [edit, setEdit] = useState<Editable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (phase !== 'working') return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setElapsed(0);
    };
  }, [phase]);

  const run = async (withAnswers: boolean) => {
    setError(null);
    setPhase('working');
    try {
      const first = await library.draft(domain.id, story.trim(), withAnswers && answers.trim() ? answers.trim() : undefined);
      let d = first.draft;
      let delay = Math.min(15, Math.max(6, first.retryAfter));
      for (let i = 0; i < 24 && alive.current && d.status === 'working'; i++) {
        await wait(delay * 1000);
        delay = 9;
        d = await library.pollDraft(d.id);
      }
      if (!alive.current) return;
      if (d.status !== 'ready' || !d.case) throw new ApiError(502, 'draft_failed', d.error?.message ?? (d.status === 'working' ? 'AI juda uzoq ishladi. Qayta urinib koʻring.' : 'Qoralama tuzilmadi'));
      const { id: _id, source: _s, status: _st, mine: _m, reviewNote: _r, createdAt: _c, updatedAt: _u, shareCode: _sc, solutions: _so, ...rest } = d.case;
      void [_id, _s, _st, _m, _r, _c, _u, _sc, _so];
      setDraft(d);
      setEdit(rest);
      setPhase('edit');
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof ApiError ? e.message : 'Qoralama tuzilmadi');
      setPhase(draft ? 'edit' : 'write');
    }
  };

  const save = async () => {
    if (!edit || !draft) return;
    setPhase('saving');
    setError(null);
    try {
      const clean = { ...edit, side: { claimant: { task: edit.side.claimant.task.filter(Boolean), confidential: edit.side.claimant.confidential.filter(Boolean) }, respondent: { task: edit.side.respondent.task.filter(Boolean), confidential: edit.side.respondent.confidential.filter(Boolean) } } };
      onSaved(await library.save({ ...clean, draftId: draft.id }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Saqlanmadi');
      setPhase('edit');
    }
  };

  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setEdit((x) => (x ? { ...x, [k]: v } : x));
  const confCount = edit ? [edit.side.claimant.confidential.filter(Boolean).length, edit.side.respondent.confidential.filter(Boolean).length] : [0, 0];
  const len = story.trim().length;

  return (
    <Sheet title={phase === 'edit' || phase === 'saving' ? 'Caseni tekshiring va saqlang' : 'Case qoʻshish'} kicker={domain.title} onClose={onClose} wide busy={phase === 'working' || phase === 'saving'}
      footer={phase === 'write' ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-[0.8rem] tabular-nums ${len > 0 && len < 80 ? 'text-warn' : 'text-ink-3'}`}>{len} / 4000 belgi{len < 80 ? ' (kamida 80)' : ''}</span>
          <button type="button" className="btn btn-primary ml-auto" disabled={len < 80 || len > 4000} onClick={() => void run(false)}>AI case tuzsin</button>
        </div>
      ) : phase === 'edit' || phase === 'saving' ? (
        <div className="flex flex-wrap items-center gap-3">
          {edit && <div className="w-52"><Segmented label="Kim koʻradi" size="sm" value={edit.visibility} onChange={(v) => set('visibility', v)} options={[['public', 'Hamma'], ['private', 'Havola bilan']]} /></div>}
          <span className="max-w-[34ch] text-[0.8rem] text-ink-3">{edit?.visibility === 'private' ? 'Yopiq: faqat siz va havolani olganlar koʻradi, mentor tekshiruvi kerak emas.' : 'Saqlangach mentorga boradi. Siz darhol koʻrasiz va oʻynay olasiz.'}</span>
          <button type="button" className="btn btn-primary ml-auto" disabled={phase === 'saving' || !edit?.title.trim()} aria-busy={phase === 'saving'} onClick={() => void save()}>{phase === 'saving' ? 'Saqlanmoqda…' : 'Saqlash'}</button>
        </div>
      ) : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'write' && (
          <motion.div key="write" {...note} className="space-y-4">
            <p className="text-[0.92rem] leading-relaxed text-ink-2">Nima boʻlganini oddiy soʻz bilan yozing: kim, kim bilan, nima kelishilgan, nima buzilgan, qanday hujjatlar bor. AI faqat siz yozganga tayanadi; yetishmagan narsa «[aniqlanmagan]» boʻlib qoladi va savol sifatida qaytadi.</p>
            <p className="rounded-2xl bg-accent-soft px-4 py-2.5 text-[0.84rem] text-accent-ink">Telefon, pasport, JSHSHIR, karta va e-pochta AIga yuborilishidan oldin yashiriladi; ismlar va kompaniya nomlari shartli nomga almashtiriladi.</p>
            <label className="block"><Label>Holat</Label>
              <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={9} maxLength={4000} autoFocus placeholder="Masalan: bizning firma mart oyida 20 tonna un buyurtma qildi, oldindan toʻladik, lekin un 22 kun kechikib keldi…" className={`${field} resize-y leading-relaxed`} />
            </label>
            {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-[0.9rem] text-danger">{error} <button type="button" className="ml-1 font-semibold underline" onClick={() => void run(false)}>Qayta urinish</button></p>}
          </motion.div>
        )}
        {phase === 'working' && (
          <motion.div key="working" {...note} className="grid place-items-center py-14 text-center" role="status" aria-live="polite">
            <span aria-hidden className="relative grid size-16 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/20 motion-reduce:animate-none" />
              <span className="size-10 rounded-full bg-accent/80" />
            </span>
            <p className="display mt-6 text-[1.25rem] font-semibold">AI caseni tuzyapti…</p>
            <p className="mt-1 text-[0.9rem] text-ink-2">Odatda 45-95 soniya. Lex.uz bazasidan mos moddalar tanlanmoqda.</p>
            <div className="mt-5 h-1.5 w-64 overflow-hidden rounded-full bg-black/[0.06]">
              <motion.div className="h-full rounded-full bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(0.95, elapsed / 95) }} transition={ease.surface} style={{ transformOrigin: '0 50%' }} />
            </div>
            <p className="mt-2 text-[0.8rem] text-ink-3 tabular-nums">{elapsed} s</p>
          </motion.div>
        )}
        {(phase === 'edit' || phase === 'saving') && edit && draft && (
          <motion.div key="edit" {...note} className="space-y-5">
            {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-[0.9rem] text-danger">{error}</p>}
            {draft.questions.length > 0 && (
              <section className="rounded-[22px] bg-accent-soft p-4">
                <h3 className="text-[0.8rem] font-semibold text-accent-ink">AI aniqlashtirmoqchi</h3>
                <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[0.9rem] text-ink-2">{draft.questions.map((q) => <li key={q}>{q}</li>)}</ol>
                <textarea value={answers} onChange={(e) => setAnswers(e.target.value)} rows={3} placeholder="Javoblaringiz…" aria-label="Savollarga javob" className={`${field} mt-3 resize-y`} />
                <button type="button" className="btn btn-dark mt-2 !min-h-10 text-[0.88rem]" disabled={!answers.trim()} onClick={() => void run(true)}>Javob berib, qayta tuzish</button>
              </section>
            )}
            {(draft.issues.length > 0 || confCount.some((n) => n < 2 || n > 4) || draft.sources === 0) && (
              <ul className="space-y-1.5">
                {draft.sources === 0 && <li className="rounded-2xl bg-warn-soft px-4 py-2.5 text-[0.88rem] text-warn">Bazada mos modda topilmadi: huquqiy asosni mentor qoʻshadi.</li>}
                {draft.issues.map((i) => <li key={i} className="rounded-2xl bg-warn-soft px-4 py-2.5 text-[0.88rem] text-warn">{i}</li>)}
                {confCount.some((n) => n < 2 || n > 4) && <li className="rounded-2xl bg-warn-soft px-4 py-2.5 text-[0.88rem] text-warn">Har tomonda 2-4 ta maxfiy fakt boʻlsin (hozir: {confCount[0]} va {confCount[1]}).</li>}
              </ul>
            )}
            {draft.redacted ? <p className="text-[0.8rem] text-ink-3">Shaxsiy maʼlumot yashirildi: {draft.redacted} ta.</p> : null}

            <label className="block"><Label>Sarlavha</Label><input value={edit.title} onChange={(e) => set('title', e.target.value)} className={field} /></label>
            <label className="block"><Label>Qisqacha</Label><textarea value={edit.summary} rows={2} onChange={(e) => set('summary', e.target.value)} className={`${field} resize-y`} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><Label>Daʼvogar</Label><input value={edit.parties.claimant} onChange={(e) => set('parties', { ...edit.parties, claimant: e.target.value })} className={field} /></label>
              <label className="block"><Label>Javobgar</Label><input value={edit.parties.respondent} onChange={(e) => set('parties', { ...edit.parties, respondent: e.target.value })} className={field} /></label>
            </div>
            <label className="block"><Label>Talab</Label><textarea value={edit.claim} rows={2} onChange={(e) => set('claim', e.target.value)} className={`${field} resize-y`} /></label>
            <Items label="Holatlar" items={edit.facts} onChange={(v) => set('facts', v)} />
            <Items label="Dalillar" items={edit.evidence} onChange={(v) => set('evidence', v)} />
            <div className="grid gap-4 sm:grid-cols-2">
              {(['claimant', 'respondent'] as const).map((s) => (
                <div key={s} className="space-y-3">
                  <Lines label={`${s === 'claimant' ? 'Daʼvogar' : 'Javobgar'}: vazifa`} lines={edit.side[s].task} onChange={(v) => set('side', { ...edit.side, [s]: { ...edit.side[s], task: v } })} />
                  <Lines label={`${s === 'claimant' ? 'Daʼvogar' : 'Javobgar'}: maxfiy faktlar`} tone="secret" lines={edit.side[s].confidential} onChange={(v) => set('side', { ...edit.side, [s]: { ...edit.side[s], confidential: v } })} />
                </div>
              ))}
            </div>

            <section>
              <Label hint="faqat lex.uz bazasidan; olib tashlash mumkin, qoʻshishni mentor qiladi">Huquqiy asos</Label>
              {edit.legal.length === 0 ? <p className="text-[0.88rem] text-ink-3">Moddalar yoʻq.</p> : (
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {edit.legal.map((l) => (
                      <motion.li key={l.normId} layout exit={{ opacity: 0, x: -16 }} transition={ease.surface} className="surface flex items-start gap-3 rounded-[18px] p-3">
                        <div className="min-w-0 flex-1 text-[0.9rem]">
                          {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline underline-offset-4">{l.label} ↗</a> : <b>{l.label}</b>}
                          {l.why && <span className="block text-ink-2">{l.why}</span>}
                        </div>
                        <button type="button" aria-label={`${l.label}ni olib tashlash`} onClick={() => set('legal', edit.legal.filter((x) => x.normId !== l.normId))} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger">✕</button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>

            {edit.balance && (
              <section className="grid gap-3 sm:grid-cols-2">
                {(['claimant_strong', 'claimant_weak', 'respondent_strong', 'respondent_weak'] as const).map((k) => (
                  <label key={k} className="block">
                    <Label>{`${k.startsWith('claimant') ? 'Daʼvogar' : 'Javobgar'}ning ${k.endsWith('strong') ? 'kuchli' : 'zaif'} joyi`}</Label>
                    <textarea value={edit.balance![k]} rows={2} onChange={(e) => set('balance', { ...edit.balance!, [k]: e.target.value })} className={`${field} resize-y`} />
                  </label>
                ))}
              </section>
            )}
            <p className="text-[0.8rem] text-ink-3">{edit.disclaimer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
