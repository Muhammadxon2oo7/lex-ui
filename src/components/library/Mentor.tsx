'use client';
/** Mentors: the review queue. Approve, or reject with a note. Sign-in and the admin token live on the server. */
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import type { LibCase } from '@/contracts/library';
import { ApiError } from '@/game/api';
import { library } from '@/game/library';
import { GlassLayer, GlassToolbar, ToolbarLink } from '@/components/ui/glass';
import { Sheet } from '@/components/ui/Sheet';
import { ease, note } from '@/lib/motion';
import { CaseView } from './CaseView';

export default function Mentor() {
  const [mentor, setMentor] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [queue, setQueue] = useState<LibCase[] | null>(null);
  const [open, setOpen] = useState<LibCase | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');

  useEffect(() => {
    library.mentor().then(setMentor, () => setMentor(false));
  }, []);
  const load = useCallback(() => {
    library.queue().then(setQueue, fail);
  }, []);
  useEffect(() => {
    if (mentor) load();
  }, [mentor, load]);

  const decide = async (decision: 'approve' | 'reject') => {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    try {
      await library.review(open.id, decision, reason.trim());
      setQueue((q) => q?.filter((c) => c.id !== open.id) ?? null);
      setOpen(null);
      setReason('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative isolate w-full flex-1">
        <GlassLayer />
        <GlassToolbar back={{ href: '/sohalar', label: 'SOHALAR' }}><ToolbarLink href="/manbalar">Manbalar</ToolbarLink></GlassToolbar>
        <div className="mx-auto w-full max-w-4xl px-5 pt-8 pb-16 sm:pt-12">
          <p className="text-[0.8rem] font-semibold tracking-wider text-accent-ink uppercase">Mentor</p>
          <h1 className="display mt-2 text-[clamp(2rem,5vw,3rem)] font-semibold tracking-tight">Tekshiruv navbati</h1>
          <p className="mt-2 max-w-[60ch] text-[0.96rem] text-ink-2">Foydalanuvchilar kiritgan caselar boshqalarga faqat siz tasdiqlagandan keyin chiqadi. Faktlar, muvozanat va moddalarni lex.uz havolasi orqali tekshiring.</p>
          <AnimatePresence>{error && <motion.p key="e" {...note} role="alert" className="mt-5 rounded-2xl bg-danger-soft px-4 py-3 text-[0.92rem] text-danger">{error}</motion.p>}</AnimatePresence>

          {mentor === false && (
            <form className="surface mt-8 max-w-md rounded-[26px] p-6" onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              library.mentorLogin(code).then(() => setMentor(true), fail);
            }}>
              <label className="block"><span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">Mentor kodi</span>
                <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" className="field" /></label>
              <button type="submit" className="btn btn-primary mt-4 w-full" disabled={code.length < 4}>Kirish</button>
            </form>
          )}

          {mentor && (
            <LayoutGroup>
              <ul className="mt-8 space-y-3">
                {!queue && <li className="surface h-24 animate-pulse rounded-[22px] motion-reduce:animate-none" />}
                {queue?.length === 0 && <li className="surface rounded-[22px] p-6 text-center text-ink-2">Navbat boʻsh.</li>}
                <AnimatePresence initial={false}>
                  {queue?.map((c) => (
                    <motion.li key={c.id} layout exit={{ opacity: 0, x: 40 }} transition={ease.surface}>
                      <button type="button" onClick={() => setOpen(c)} className="surface press flex w-full items-center gap-4 rounded-[22px] p-5 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.74rem] font-semibold tracking-wide text-ink-3 uppercase">{c.domain}</span>
                          <span className="block font-semibold text-balance">{c.title}</span>
                          <span className="mt-0.5 block text-[0.84rem] text-ink-3">{c.legal.length} ta modda · {c.facts.length} ta fakt</span>
                        </span>
                        <span aria-hidden className="text-ink-3">→</span>
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
          )}
        </div>
        <AnimatePresence>
          {open && (
            <Sheet key={open.id} title={open.title} kicker="Tekshiruv" wide busy={busy} onClose={() => setOpen(null)}
              footer={
                <div className="space-y-3">
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Izoh (rad etishda majburiy)" aria-label="Mentor izohi" className="field resize-y" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary press" disabled={busy} onClick={() => void decide('approve')}>Tasdiqlash</button>
                    <button type="button" className="btn btn-danger press" disabled={busy || reason.trim().length < 5} onClick={() => void decide('reject')}>Rad etish</button>
                  </div>
                </div>
              }>
              <CaseView c={{ ...open, mine: true }} />
            </Sheet>
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
