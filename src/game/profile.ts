/**
 * The student's avatar profile. A per-viewer convenience kept in the
 * browser (it never decides anything the server scores), so storage
 * failures simply mean "no profile yet".
 */
import { useSyncExternalStore } from 'react';

export type AvatarModel = 'man' | 'woman';
export type Role = 'student' | 'teacher';
export interface Profile {
  name: string;
  avatar: AvatarModel;
  role: Role;
}

const KEY = 'lexsim.profile.v1';
const RETURN_KEY = 'lexsim.returnDoor';
const listeners = new Set<() => void>();
let cache: Profile | null | undefined;

function read(): Profile | null {
  if (cache !== undefined) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Profile> | null;
    cache = raw && typeof raw.name === 'string' && (raw.avatar === 'man' || raw.avatar === 'woman') ? { name: raw.name.slice(0, 40), avatar: raw.avatar, role: raw.role === 'teacher' ? 'teacher' : 'student' } : null;
  } catch {
    cache = null;
  }
  return cache;
}

/** Direct read (outside React render), e.g. once on mount. */
export const getProfile = (): Profile | null => (typeof window === 'undefined' ? null : read());

export function saveProfile(profile: Profile) {
  cache = { name: profile.name.trim().slice(0, 40), avatar: profile.avatar, role: profile.role };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  listeners.forEach((l) => l());
}

export function useProfile(): Profile | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => null,
  );
}

/** Which corridor door the student left through, so coming back puts them in front of it. */
export function setReturnDoor(id: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, id);
  } catch {}
}
/** Read once per page load (repeat calls — e.g. StrictMode effects — get the same answer). */
let taken: { id: string | null } | null = null;
export function takeReturnDoor(): string | null {
  if (taken) return taken.id;
  try {
    taken = { id: sessionStorage.getItem(RETURN_KEY) };
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    taken = { id: null };
  }
  setTimeout(() => (taken = null), 0); // a later visit in the same tab reads storage again
  return taken.id;
}
