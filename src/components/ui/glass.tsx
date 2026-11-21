'use client';
/**
 * Liquid Glass primitives for the 2D screens (landing, sheets, sources, moot lobby).
 * Glass is the navigation layer only: toolbar capsules, segmented controls, sheets. Content sits on
 * solid `.surface` cards. Material in globals.css (`.lg`, `.lg-strong`, `.orbs`).
 */
import Link from 'next/link';
import { motion } from 'motion/react';
import { useEffect, useId } from 'react';
import { deviceTier, markDocument } from '@/lib/deviceTier';

export const spring = { type: 'spring', bounce: 0, duration: 0.45 } as const;
export const lensSpring = { type: 'spring', bounce: 0.28, duration: 0.42 } as const;

let lit = false;
/**
 * The static colour field behind the page, the pointer light on glass (one global rAF-throttled
 * listener writing --mx/--my on the glass under the cursor), and the device tier on <html>.
 */
export function GlassLayer() {
  useEffect(() => {
    if (!document.documentElement.dataset.quality) markDocument(deviceTier());
    if (lit) return;
    lit = true;
    let raf = 0;
    let last: PointerEvent | null = null;
    const move = (e: PointerEvent) => {
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = (last?.target as Element | null)?.closest?.('.lg') as HTMLElement | null;
        if (!el || !last) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${last.clientX - r.left}px`);
        el.style.setProperty('--my', `${last.clientY - r.top}px`);
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      lit = false;
    };
  }, []);
  return (
    <div aria-hidden className="orbs">
      <i />
      <i />
      <i />
    </div>
  );
}

/** Segmented control with a sliding glass lens (iOS 26). */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md' }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  const id = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-black/[0.05] p-1">
        {options.map(([v, text]) => {
          const on = value === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onChange(v)}
              className={`relative ${size === 'sm' ? 'min-h-9 text-[0.86rem]' : 'min-h-11 text-[0.92rem]'} rounded-[10px] px-3 font-semibold transition-colors duration-200 ${on ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}>
              {on && <motion.span layoutId={`lens-${id}`} transition={lensSpring} aria-hidden className="absolute inset-0 rounded-[10px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08),0_4px_12px_-4px_rgb(0_0_0/0.16)]" />}
              <span className="relative">{text}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The floating toolbar: a wordmark capsule and a grouped action capsule, detached from the edges. */
export function GlassToolbar({ back, children }: { back?: { href: string; label: string }; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
        <Link href={back?.href ?? '/'} className="lg press flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-ink text-[0.72rem] font-bold text-white">{back ? '‹' : 'L'}</span>
          <span className="text-[0.86rem] font-bold tracking-[0.22em]">{back ? back.label : 'LEXSIM'}</span>
        </Link>
        {children && <nav aria-label="Asosiy" className="lg ml-auto flex h-11 items-center gap-0.5 rounded-full p-1 text-[0.88rem] font-semibold">{children}</nav>}
      </div>
    </header>
  );
}

export function ToolbarLink({ href, children, prominent = false, className = '' }: { href: string; children: React.ReactNode; prominent?: boolean; className?: string }) {
  return (
    <Link href={href} className={`press flex h-9 items-center rounded-full px-3.5 transition-colors duration-200 ${prominent ? 'bg-ink text-white hover:bg-black' : 'text-ink-2 hover:bg-white/70 hover:text-ink'} ${className}`}>
      {children}
    </Link>
  );
}
