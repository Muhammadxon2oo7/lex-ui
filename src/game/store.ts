/**
 * Client game state (Zustand).
 *
 * Three layers, kept apart on purpose:
 *  - `snapshot`   server-authoritative domain state (facts, meters, turns…)
 *  - `mode` etc.  client presentation FSM (what the player is doing)
 *  - `stage`      high-frequency data the render loop reads imperatively
 *                 via `useGame.getState()`; never subscribed by React.
 *
 * Nothing in here is a source of truth for permissions or score.
 */
import { create } from 'zustand';
import type { DocumentDraft, Gesture, MutationResponse, SimEvent, Snapshot, Turn } from '@/contracts';
import { ApiError, api, newId } from './api';
import { audio } from './audio';
import type { ItemId } from './items';
import type { RestSeat } from './manifest';

/** `resting` = sitting on any free seat, looking around; `seated` = at your own desk, receiving. */
export type Mode = 'loading' | 'briefing' | 'exploring' | 'resting' | 'seated' | 'document' | 'paused' | 'ended';
export type Quality = 'low' | 'medium' | 'high';

export interface Focus {
  id: string;
  prompt: string;
}

export interface Settings {
  quality: Quality;
  autoQuality: boolean;
  fov: number;
  sensitivity: number;
  volume: number;
  reducedMotion: boolean;
}

interface Stage {
  /** performance.now() until which the NPC mouth should move. */
  speakingUntil: number;
  /** True while we wait for the server: NPC shows a neutral "thinking" pose. */
  thinking: boolean;
  gesture: { clip: Gesture; id: number } | null;
  /** Gestures that belong to a spoken line; played when that line is presented. */
  lineGestures: Record<string, Gesture>;
}

interface GameState {
  mode: Mode;
  resumeMode: Mode;
  snapshot: Snapshot | null;
  focus: Focus | null;
  busy: boolean;
  error: string | null;
  worldReady: boolean;
  pendingText: string | null;
  qualityNotice: boolean;
  /** Door of room 3 (client-side world state; purely physical, not scored). */
  doorOpen: boolean;
  /** The citizen's phone photo is being inspected. */
  exhibitOpen: boolean;
  /** The lobby seat the player is resting on, if any. */
  restSeat: RestSeat | null;
  /** The object currently held up for a closer look. */
  inspecting: ItemId | null;
  settings: Settings;
  stage: Stage;
  /** Registered by the player controller; must be called from a user gesture. */
  requestPointerLock: (() => void) | null;

  hydrate: (snapshot: Snapshot) => void;
  setMode: (mode: Mode) => void;
  setFocus: (focus: Focus | null) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setWorldReady: () => void;
  dismissError: () => void;

  begin: () => Promise<void>;
  sit: () => Promise<void>;
  stand: () => void;
  rest: (seat: RestSeat) => void;
  openTerminal: () => Promise<void>;
  closeTerminal: () => void;
  pause: () => void;
  resume: () => void;
  say: (text: string) => Promise<void>;
  choose: (option: { id: string; text: string }) => Promise<void>;
  /** Called by the dialogue stage when it starts presenting a spoken line. */
  beginLine: (turn: Turn) => void;
  toggleDoor: () => void;
  inspectPhone: () => Promise<void>;
  closeExhibit: () => void;
  inspect: (item: ItemId) => void;
  closeInspect: () => void;
  saveDocument: (draft: DocumentDraft, submit: boolean) => Promise<boolean>;
  finish: () => Promise<void>;
}

const SETTINGS_KEY = 'lexsim.settings.v1';

function loadSettings(): Settings {
  const base: Settings = { quality: 'high', autoQuality: true, fov: 68, sensitivity: 1, volume: 0.6, reducedMotion: false };
  if (typeof window === 'undefined') return base;
  base.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return base;
  }
}

/** Rough reading time so the mouth moves about as long as the subtitle types. */
const speechMs = (text: string) => Math.min(9000, 500 + text.length * 42);

let gestureId = 0;

export const useGame = create<GameState>((set, get) => {
  /** Apply a mutation: authoritative snapshot + presentation beats from events. */
  const apply = (res: MutationResponse) => {
    const current = get().snapshot;
    if (current && res.snapshot.sequence < current.sequence) return; // stale / out of order
    const stage = { ...get().stage, thinking: false };
    lastLineId = null;
    for (const event of res.events) playEvent(event, stage);
    set({ snapshot: res.snapshot, stage });
    if (res.snapshot.status === 'report-ready') set({ mode: 'ended', focus: null });
  };

  let lastLineId: string | null = null;
  const playEvent = (event: SimEvent, stage: Stage) => {
    switch (event.type) {
      case 'dialogue.npcTurn':
        // Speech and its gesture start when the line is actually shown (see beginLine).
        lastLineId = event.payload.turn.speaker === 'npc' ? event.payload.turn.id : null;
        break;
      case 'npc.gesture':
        if (lastLineId) stage.lineGestures = { ...stage.lineGestures, [lastLineId]: event.payload.clip };
        else stage.gesture = { clip: event.payload.clip, id: ++gestureId };
        break;
      case 'scene.objectState':
        if (event.payload.objectId === 'receipt' && event.payload.state === 'active') audio.printer();
        break;
      case 'objective.updated':
        if (event.payload.done) audio.chime();
        break;
    }
  };

  const guard = async (fn: () => Promise<void>) => {
    if (get().busy) return; // re-entrancy: E-spam / double clicks do nothing
    set({ busy: true, error: null });
    try {
      await fn();
    } catch (err) {
      set((s) => ({
        error: err instanceof ApiError ? err.message : 'Kutilmagan xatolik yuz berdi',
        stage: { ...s.stage, thinking: false },
        pendingText: null,
      }));
    } finally {
      set({ busy: false });
    }
  };

  const sessionId = () => get().snapshot!.sessionId;

  return {
    mode: 'loading',
    resumeMode: 'exploring',
    snapshot: null,
    focus: null,
    busy: false,
    error: null,
    worldReady: false,
    pendingText: null,
    qualityNotice: false,
    doorOpen: false,
    exhibitOpen: false,
    restSeat: null,
    inspecting: null,
    settings: loadSettings(),
    stage: { speakingUntil: 0, thinking: false, gesture: null, lineGestures: {} },
    requestPointerLock: null,

    hydrate: (snapshot) => {
      // Refresh recovery: derive the presentation mode from server state.
      const seated = snapshot.turns.length > 0;
      const mode: Mode =
        snapshot.status === 'briefing' ? 'briefing' : snapshot.status === 'in-progress' ? (seated ? 'seated' : 'paused') : 'ended';
      // Resuming mid-interview: you are already inside the room, so its door is open.
      set({ snapshot, mode, resumeMode: 'exploring', doorOpen: seated });
    },
    setMode: (mode) => set({ mode }),
    setFocus: (focus) => {
      const prev = get().focus;
      if (prev?.id !== focus?.id || prev?.prompt !== focus?.prompt) set({ focus });
    },
    setSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      set({ settings, qualityNotice: patch.quality !== undefined && patch.autoQuality === undefined ? false : get().qualityNotice });
      audio.setVolume(settings.volume);
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {}
    },
    setWorldReady: () => set({ worldReady: true }),
    dismissError: () => set({ error: null }),

    begin: () =>
      guard(async () => {
        audio.start(get().settings.volume);
        get().requestPointerLock?.();
        apply(await api.interact(sessionId(), 'start'));
        set({ mode: 'exploring' });
      }),

    sit: () =>
      guard(async () => {
        if (document.pointerLockElement) document.exitPointerLock();
        audio.chair();
        set({ mode: 'seated', focus: null });
        apply(await api.interact(sessionId(), 'sit-at-desk'));
      }),

    rest: (seat) => {
      audio.chair();
      set({ mode: 'resting', restSeat: seat, focus: null });
    },

    stand: () => {
      audio.chair();
      set({ mode: 'exploring', exhibitOpen: false });
      get().requestPointerLock?.();
    },

    openTerminal: async () => {
      if (get().mode === 'exploring') await get().sit();
      if (get().mode === 'seated') set({ mode: 'document' });
    },
    closeTerminal: () => set({ mode: 'seated' }),

    pause: () => {
      const { mode } = get();
      if (mode === 'paused' || mode === 'briefing' || mode === 'ended' || mode === 'loading') return;
      set({ resumeMode: mode, mode: 'paused', focus: null });
    },
    resume: () => {
      const { resumeMode } = get();
      set({ mode: resumeMode });
      if (resumeMode === 'exploring' || resumeMode === 'resting') get().requestPointerLock?.();
    },

    say: (text) =>
      guard(async () => {
        // Show the user's line instantly; the server echo replaces it.
        set((s) => ({ pendingText: text, stage: { ...s.stage, thinking: true } }));
        const res = await api.turn(sessionId(), newId(), { text });
        set({ pendingText: null });
        apply(res);
      }),

    choose: (option) =>
      guard(async () => {
        set((s) => ({ pendingText: option.text, stage: { ...s.stage, thinking: true } }));
        const res = await api.turn(sessionId(), newId(), { optionId: option.id });
        set({ pendingText: null });
        apply(res);
      }),

    beginLine: (turn) => {
      const stage = { ...get().stage, speakingUntil: performance.now() + speechMs(turn.text) };
      const clip = stage.lineGestures[turn.id];
      if (clip) stage.gesture = { clip, id: ++gestureId };
      set({ stage });
    },

    toggleDoor: () => {
      const doorOpen = !get().doorOpen;
      audio.door(doorOpen);
      set({ doorOpen });
    },

    inspectPhone: () =>
      guard(async () => {
        set({ exhibitOpen: true });
        apply(await api.interact(sessionId(), 'inspect-phone'));
      }),
    closeExhibit: () => set({ exhibitOpen: false }),

    inspect: (item) => {
      set({ inspecting: item, focus: null }); // set first: releasing the pointer must not read as "pause"
      if (document.pointerLockElement) document.exitPointerLock();
    },
    closeInspect: () => {
      set({ inspecting: null });
      if (get().mode === 'exploring') get().requestPointerLock?.();
    },

    saveDocument: async (draft, submit) => {
      let ok = false;
      await guard(async () => {
        apply(await api.document(sessionId(), draft, submit));
        ok = true;
      });
      return ok;
    },

    finish: () =>
      guard(async () => {
        apply(await api.finish(sessionId()));
      }),
  };
});
