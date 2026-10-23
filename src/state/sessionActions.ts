import { seedFs } from '../domain/fs';
import { STORAGE_KEY, clearSaved, getStorage, loadSaved, parseEnvelope, save } from '../domain/persistence';
import { defaultPrefs, type Prefs } from '../domain/prefs';
import { emptyWm } from '../domain/windows';
import {
  YES_NO,
  ask,
  closeMenu,
  createInitialState,
  dismissBalloon,
  focusDesktopSoon,
  focusWindowSoon,
  get,
  now,
  set,
  showBalloon,
  store,
} from './app';
import { reconcile } from './folderActions';
import { clampWindowsToViewport } from './windowActions';
import type { AppState, Session } from './types';

// ---------------------------------------------------------------- preferences

export function updatePrefs(fn: (p: Prefs) => Prefs): void {
  set((s) => {
    const prefs = fn(s.prefs);
    return prefs === s.prefs ? s : { ...s, prefs };
  });
}

// ---------------------------------------------------------------- persistence

let storage: Storage | null = null;
let lastSavedText: string | null = null;
let prefsTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function saveNow(): void {
  if (prefsTimer) {
    clearTimeout(prefsTimer);
    prefsTimer = null;
  }
  const s = get();
  if (!s.storage.canSave) return;
  const result = save(storage, s.fs, s.prefs, now());
  if (result.ok) {
    lastSavedText = result.text;
    if (s.storage.mode === 'failed') set((st) => ({ ...st, storage: { mode: 'ok', detail: '', canSave: true } }));
    return;
  }
  if (s.storage.mode !== 'failed') {
    set((st) => ({ ...st, storage: { mode: 'failed', detail: result.message, canSave: true } }));
    showBalloon({
      title: 'Changes not saved',
      text: `${result.message} This session keeps working, but recent folders and settings may be lost when the page closes.`,
      actions: [{ label: 'OK', run: dismissBalloon }],
      tone: 'warning',
    });
  }
}

function startupNotice(state: AppState): void {
  const { mode, detail } = state.storage;
  const resetAction = { label: 'Reset saved data…', run: () => void resetSimulation() };
  if (mode === 'unavailable') {
    showBalloon({
      title: 'Saving is unavailable',
      text: `${detail} The desktop works normally, but folders and settings will not be kept after this page closes.`,
      actions: [{ label: 'OK', run: dismissBalloon }],
      tone: 'warning',
    });
  } else if (mode === 'invalid') {
    showBalloon({
      title: 'Saved desktop could not be loaded',
      text: `The saved data failed validation (${detail}). A fresh desktop is shown. Saving is paused so the saved data is not overwritten.`,
      actions: [resetAction, { label: 'Keep paused', run: dismissBalloon }],
      tone: 'error',
    });
  } else if (mode === 'future') {
    showBalloon({
      title: 'Saved desktop is from a newer version',
      text: `The saved data uses a newer format (${detail}). A fresh desktop is shown. Saving is paused so the newer data is not overwritten.`,
      actions: [resetAction, { label: 'Keep paused', run: dismissBalloon }],
      tone: 'warning',
    });
  }
}

function onStorageEvent(event: StorageEvent): void {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  if (event.newValue !== null && event.newValue === lastSavedText) return;
  set((s) => ({ ...s, storage: { mode: 'conflict', detail: 'Another tab changed the saved desktop.', canSave: false } }));
  showBalloon({
    title: 'Desktop changed in another tab',
    text: 'The saved folders or settings were changed in another browser tab. Load the saved version, or keep this session (your next change will overwrite the other tab’s save).',
    actions: [
      { label: 'Load saved version', run: loadSavedVersion },
      { label: 'Keep this session', run: keepThisSession },
    ],
    tone: 'warning',
  });
}

export function loadSavedVersion(): void {
  dismissBalloon();
  const text = (() => {
    try {
      return storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  })();
  const loaded = text === null ? { status: 'empty' as const } : parseEnvelope(text);
  if (loaded.status === 'loaded') {
    lastSavedText = text;
    set((s) =>
      reconcile(
        { ...s, fs: loaded.fs, prefs: loaded.prefs, undo: null, clipboard: null, storage: { mode: 'ok', detail: '', canSave: true } },
        s.fs,
      ),
    );
  } else if (loaded.status === 'empty') {
    set((s) => reconcile({ ...s, fs: seedFs(now()), prefs: defaultPrefs, undo: null, clipboard: null, storage: { mode: 'ok', detail: '', canSave: true } }, s.fs));
    saveNow();
  } else {
    set((s) => ({ ...s, storage: { mode: 'invalid', detail: 'the other tab saved data that failed validation', canSave: false } }));
    startupNotice(get());
  }
}

export function keepThisSession(): void {
  dismissBalloon();
  set((s) => ({ ...s, storage: { mode: 'ok', detail: '', canSave: true } }));
  saveNow();
}

/** Loads saved state and wires saving. Safe to call once at startup. */
export function bootstrap(viewport: { w: number; h: number }): void {
  storage = getStorage();
  const load = loadSaved(storage);
  const initial = createInitialState(load, viewport);
  store.set(() => initial);
  if (installed) return;
  installed = true;
  let lastFs = initial.fs;
  let lastPrefs = initial.prefs;
  store.subscribe(() => {
    const s = get();
    if (s.fs !== lastFs) {
      lastFs = s.fs;
      lastPrefs = s.prefs;
      // Committed folder mutations flush promptly.
      queueMicrotask(saveNow);
    } else if (s.prefs !== lastPrefs) {
      lastPrefs = s.prefs;
      if (prefsTimer) clearTimeout(prefsTimer);
      prefsTimer = setTimeout(saveNow, 300);
    }
  });
  window.addEventListener('storage', onStorageEvent);
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('resize', () => {
    // An open menu's anchor no longer matches the layout: close it rather than
    // leave it stranded off-screen. Windows are re-clamped into the work area.
    if (get().menu) closeMenu(true);
    set((s) => ({ ...s, viewport: { w: window.innerWidth, h: window.innerHeight } }));
    clampWindowsToViewport();
  });
  startupNotice(initial);
}

// ---------------------------------------------------------------- session

function clearTransient(state: AppState, session: Session): AppState {
  return {
    ...state,
    session,
    wm: emptyWm,
    explorers: {},
    params: {},
    clipboard: null,
    undo: null,
    modals: [],
    menu: null,
    moveSize: null,
    desktop: { selected: [], focused: null, anchor: null, renaming: null },
  };
}

const prefersReducedMotion = () =>
  get().prefs.motion === 'reduce' ||
  (get().prefs.motion === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

export function logOff(): void {
  saveNow();
  set((s) => clearTransient(s, 'loggedOff'));
}

export function resumeSession(): void {
  set((s) => ({ ...s, session: 'running' }));
  focusDesktopSoon();
}

let beforeStandby: Session = 'running';

export function standBy(): void {
  saveNow();
  const current = get().session;
  beforeStandby = current === 'loggedOff' ? 'loggedOff' : 'running';
  set((s) => ({ ...s, session: 'standby', menu: null, modals: [] }));
}

/** Returns from Stand By to whatever was showing before (desktop or welcome screen). */
export function wake(): void {
  set((s) => (s.session === 'standby' ? { ...s, session: beforeStandby } : s));
  if (get().session !== 'running') return;
  const active = get().wm.activeId;
  if (active) focusWindowSoon(active);
  else focusDesktopSoon();
}

export function turnOff(): void {
  saveNow();
  set((s) => clearTransient(s, 'off'));
}

/** Clears transient state and reinitializes the shell; folders and preferences remain. */
export function restart(): void {
  saveNow();
  set((s) => clearTransient(s, 'restarting'));
  setTimeout(
    () => {
      set((s) => (s.session === 'restarting' ? { ...s, session: 'running' } : s));
      focusDesktopSoon();
    },
    prefersReducedMotion() ? 150 : 1400,
  );
}

export function turnOn(): void {
  restart();
}

/** Explicit, confirmed reset of this app's storage namespace only. */
export async function resetSimulation(): Promise<void> {
  const choice = await ask({
    title: 'Reset Simulation',
    text: 'Reset the simulation? All folders you created, the Recycle Bin and all settings saved by this desktop will be permanently erased and the original empty folders restored.',
    detail: 'Only this simulation’s saved data in this browser is affected.',
    icon: 'warning',
    buttons: YES_NO,
    focusIndex: 1,
    cancelValue: 'no',
  });
  if (choice !== 'yes') return;
  dismissBalloon();
  clearSaved(storage);
  lastSavedText = null;
  set((s) => ({
    ...clearTransient(s, 'running'),
    fs: seedFs(now()),
    prefs: defaultPrefs,
    storage: storage ? { mode: 'ok', detail: '', canSave: true } : s.storage,
  }));
  saveNow();
  focusDesktopSoon();
}

export function isReducedMotion(): boolean {
  return prefersReducedMotion();
}
