'use client';
/**
 * A glass sheet for a modal task (case details, the case composer, a mentor's note).
 * Phone: rises from the bottom edge, grab the handle and pull it down to close (the decision uses
 * the projected landing point of the flick). Desktop: centred, rises a little and returns the same way.
 * A scrim dims the page (a modal task), Esc and a tap outside close it, page scroll is held.
 * Render inside <AnimatePresence>.
 */
import { motion, useDragControls } from 'motion/react';
import { useEffect, useId } from 'react';
import { useDismiss } from '@/lib/useDismiss';
import { ease, project } from '@/lib/motion';

export function Sheet({ title, kicker, onClose, children, wide = false, busy = false, footer }: {
  title: string;
  kicker?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  /** While true the sheet cannot be dismissed (a request is on its way). */
  busy?: boolean;
  footer?: React.ReactNode;
}) {
  const drag = useDragControls();
  const id = useId();
  const dismiss = useDismiss(busy ? undefined : onClose);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', esc);
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      html.style.overflow = before;
    };
  }, [busy, onClose]);
  return (
    <motion.div {...dismiss} className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.24 } }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby={id}
        initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: ease.sheet }} exit={{ y: 48, opacity: 0, transition: ease.away }}
        drag={busy ? false : 'y'} dragControls={drag} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.7 }}
        onDragEnd={(_, info) => (info.offset.y + project(info.velocity.y) > 160 || info.velocity.y > 600) && onClose()}
        className={`lg lg-strong flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[32px] sm:rounded-[32px] ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div onPointerDown={(e) => drag.start(e)} className="shrink-0 cursor-grab touch-none px-6 pt-2.5 active:cursor-grabbing sm:px-7 sm:pt-6">
          <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-black/20 sm:hidden" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {kicker && <p className="text-[0.74rem] font-semibold tracking-wider text-accent-ink uppercase">{kicker}</p>}
              <h2 id={id} className="display text-[1.4rem] leading-tight font-semibold text-balance">{title}</h2>
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Yopish" className="grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.06] text-ink-2 hover:bg-black/10 disabled:opacity-40">
              <svg aria-hidden width="12" height="12" viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
        <div className="scroll-soft min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-4 pb-6 sm:px-7">{children}</div>
        {footer && <div className="shrink-0 border-t border-black/[0.06] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">{footer}</div>}
      </motion.section>
    </motion.div>
  );
}
