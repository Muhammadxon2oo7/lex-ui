/**
 * Shared, per-frame interaction state (never React state: it changes on
 * every pointer move). While `holding` is true the seat camera does not turn,
 * so dragging a paper never also swings the view.
 */
export const hand = { holding: false };
