'use client';
import { useRef, type MouseEvent, type PointerEvent } from 'react';

/**
 * Props for the backdrop behind a dialog or drawer: pressing *and* releasing
 * on the backdrop itself closes it. A press that starts inside the content
 * (selecting text, dragging a slider) and ends outside never does.
 * Pass nothing to keep the dialog open until an explicit choice.
 */
export function useDismiss(onDismiss?: () => void) {
  const down = useRef(false);
  if (!onDismiss) return {};
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      down.current = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (down.current && e.target === e.currentTarget) onDismiss();
      down.current = false;
    },
  };
}
