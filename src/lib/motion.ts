/**
 * One motion language for every screen (Apple "Designing Fluid Interfaces", translated to Motion):
 * - surfaces settle critically damped (no overshoot): bounce 0;
 * - a sheet or drawer gets a touch of life (damping ~0.8 -> bounce ~0.15) because it is physical;
 * - bounce beyond that only after a gesture that carried momentum (a flick) or for tiny "droplets";
 * - a surface leaves along the same path it came in; the whole UI respects reduced motion
 *   (<MotionConfig reducedMotion="user"> turns transforms into cross-fades).
 */
export const ease = {
  /** Default for UI surfaces: response ~0.35 s, no overshoot. */
  surface: { type: 'spring', bounce: 0, duration: 0.35 },
  /** Sheets and drawers coming in (Apple: damping 0.8, response 0.3). */
  sheet: { type: 'spring', bounce: 0.15, duration: 0.38 },
  /** Going away: no overshoot, a little quicker. */
  away: { type: 'spring', bounce: 0, duration: 0.28 },
  /** Small elements popping in (chips, toasts, a lens). */
  droplet: { type: 'spring', bounce: 0.28, duration: 0.42 },
  /** Shared-element morphs (card -> sheet). */
  morph: { type: 'spring', bounce: 0.12, duration: 0.5 },
} as const;

/** A modal (dialog, ruling, result): rises a little from below, returns the same way. */
export const modal = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: ease.sheet },
  exit: { opacity: 0, y: 24, scale: 0.97, transition: ease.away },
} as const;

/** A scrim behind a modal: dims to focus. */
export const scrim = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.24 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
} as const;

/** A note, toast or line of feedback: in from slightly below, out in place. */
export const note = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: ease.surface },
  exit: { opacity: 0, y: 4, transition: ease.away },
} as const;

/** Apple's momentum projection: where a flick would come to rest (decelerationRate 0.998). */
export const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);
