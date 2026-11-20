/** Campus (hub world) state: the opening title, character creation and free play. */
import { create } from 'zustand';
import type { AvatarModel } from './profile';

/** `kiosk` — at the orientation terminal (registration, choosing a room). */
export type CampusPhase = 'kiosk' | 'play' | 'paused' | 'entering' | 'board';

export interface CampusFocus {
  kind: 'door' | 'board' | 'kiosk';
  id: string;
}

interface CampusState {
  phase: CampusPhase;
  /** Which avatar is on screen (in the creator: the one being previewed). */
  avatar: AvatarModel;
  focus: CampusFocus | null;
  toast: string | null;
  /** Door currently swinging open (by id). */
  opening: string | null;
  /** Spawn override when coming back out of a room. */
  spawnDoor: string | null;
  requestPointerLock: (() => void) | null;
  set: (patch: Partial<Omit<CampusState, 'set'>>) => void;
}

export const useCampus = create<CampusState>((set) => ({
  phase: 'kiosk',
  avatar: 'man',
  focus: null,
  toast: null,
  opening: null,
  spawnDoor: null,
  requestPointerLock: null,
  set: (patch) => set(patch),
}));
