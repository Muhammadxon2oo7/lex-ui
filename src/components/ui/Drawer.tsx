'use client';
/**
 * A side drawer (case folder, the Code, the coach, the moot side panel).
 * - comes in from its edge and leaves along the same path (spatial consistency);
 * - grab the header and fling it back to the edge to close: it follows the finger 1:1, and the
 *   decision uses the projected landing point of the flick, not only where it was let go;
 * - Esc and a tap outside close it; text inside stays selectable (the drag starts on the header only);
 * - reduced motion: the parent's <MotionConfig reducedMotion="user"> turns the slide into a fade.
 * Render inside <AnimatePresence>.
 */
import { motion, useDragControls } from 'motion/react';
import { useEffect } from 'react';
import { useDismiss } from '@/lib/useDismiss';
import { ease, project } from '@/lib/motion';

export function Drawer({ side = 'right', label, onClose, className = '', children, header, scrim = false, top = 'top-3', z = 'z-40' }: {
  side?: 'left' | 'right';
  label: string;
  onClose: () => void;
  className?: string;
  /** The grab handle and title row; dragging it moves the drawer. */
  header: React.ReactNode;
  children: React.ReactNode;
  /** Dim the room behind (a modal task) or not (a parallel panel). */
  scrim?: boolean;
  top?: string;
  z?: string;
}) {
  const drag = useDragControls();
  const dismiss = useDismiss(onClose);
  const dir = side === 'right' ? 1 : -1;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const out = { x: `${dir * 110}%`, opacity: 0.6 };
  return (
    <motion.div {...dismiss} className={`absolute inset-0 ${z} ${scrim ? 'bg-black/35' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2 } }} exit={{ opacity: 0, transition: { duration: 0.22 } }}>
      <motion.aside
        aria-label={label}
        initial={out}
        animate={{ x: 0, opacity: 1, transition: ease.sheet }}
        exit={{ ...out, transition: ease.away }}
        drag="x"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={side === 'right' ? { left: 0.08, right: 0.9 } : { left: 0.9, right: 0.08 }}
        onDragEnd={(_, info) => {
          const landing = info.offset.x + project(info.velocity.x);
          if (dir * landing > 140 || dir * info.velocity.x > 500) onClose();
        }}
        className={`absolute ${top} bottom-3 ${side === 'right' ? 'right-3' : 'left-3'} flex flex-col select-text ${className}`}
      >
        <div onPointerDown={(e) => drag.start(e)} className="cursor-grab touch-pan-y active:cursor-grabbing">{header}</div>
        {children}
      </motion.aside>
    </motion.div>
  );
}
