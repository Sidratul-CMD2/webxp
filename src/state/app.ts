import { seedFs } from '../domain/fs';
import type { LoadResult } from '../domain/persistence';
import { defaultPrefs } from '../domain/prefs';
import { emptyWm, type Rect } from '../domain/windows';
import { createStore, useStoreSelector } from './store';
import type { AppState, Balloon, Modal, ModalButton, OpenMenu, StorageStatus } from './types';

export const TASKBAR_HEIGHT = 30;
export const TASKBAR_HEIGHT_LARGE = 36;
export const AUTOHIDE_STRIP = 2;
export const COMPACT_WIDTH = 700;

export const now = (): number => Date.now();

let seq = 0;
export const uid = (prefix = 'u'): string => `${prefix}${++seq}`;

function storageFromLoad(load: LoadResult): StorageStatus {
  switch (load.status) {
    case 'loaded':
    case 'empty':
      return { mode: 'ok', detail: '', canSave: true };
    case 'unavailable':
      return { mode: 'unavailable', detail: load.message, canSave: false };
    case 'invalid':
      return { mode: 'invalid', detail: load.reason, canSave: false };
    case 'future':
      return { mode: 'future', detail: `version ${load.version}`, canSave: false };
  }
}

export function createInitialState(load: LoadResult, viewport: { w: number; h: number }): AppState {
  const loaded = load.status === 'loaded';
  return {
    fs: loaded ? load.fs : seedFs(now()),
    prefs: loaded ? load.prefs : defaultPrefs,
    wm: emptyWm,
    explorers: {},
    params: {},
    desktop: { selected: [], focused: null, anchor: null, renaming: null },
    clipboard: null,
    undo: null,
    modals: [],
    menu: null,
    session: 'running',
    storage: storageFromLoad(load),
    viewport,
    balloon: null,
    announcement: { text: '', n: 0 },
    moveSize: null,
    refreshTick: 0,
  };
}

export const store = createStore<AppState>(createInitialState({ status: 'empty' }, { w: 1024, h: 768 }));

export const get = store.get;
export const set = store.set;

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStoreSelector(store, selector);
}

// ---------------------------------------------------------------- metrics

export function isCompact(state: AppState): boolean {
  return state.viewport.w < COMPACT_WIDTH;
}

/** Must match --taskbar-h in tokens.css and compact.css. */
export function taskbarHeight(state: AppState): number {
  return state.prefs.largerControls || isCompact(state) ? TASKBAR_HEIGHT_LARGE : TASKBAR_HEIGHT;
}

/** The area above the taskbar that maximize, drag constraints and menus share. */
export function workArea(state: AppState): Rect {
  const reserved = state.prefs.taskbar.autoHide ? AUTOHIDE_STRIP : taskbarHeight(state);
  return { x: 0, y: 0, w: Math.max(1, state.viewport.w), h: Math.max(1, state.viewport.h - reserved) };
}

// ---------------------------------------------------------------- announcements

export function announce(text: string): void {
  set((s) => ({ ...s, announcement: { text, n: s.announcement.n + 1 } }));
}

// ---------------------------------------------------------------- focus

const lastFocus = new Map<string, HTMLElement>();

export function rememberFocus(windowId: string, el: HTMLElement): void {
  lastFocus.set(windowId, el);
}

export function forgetWindowFocus(windowId: string): void {
  lastFocus.delete(windowId);
}

function isFocusable(el: Element | null | undefined): el is HTMLElement {
  // <body> is where focus goes when it is lost, so it never counts as a restore target.
  return (
    !!el &&
    el instanceof HTMLElement &&
    el !== document.body &&
    el.isConnected &&
    !el.closest('[hidden],[inert]') &&
    el.getClientRects().length > 0
  );
}

const raf = (fn: () => void) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 0));

/**
 * Focus the window's last focused control, else its default control. Skipped
 * if another window became active before the frame ran, so a deferred focus
 * can never re-activate a window the user has already left.
 */
const focusLost = () => {
  const current = document.activeElement;
  return !current || current === document.body || !current.isConnected || !!current.closest('[hidden]');
};

export function focusWindowSoon(windowId: string, onlyIfLost = false): void {
  raf(() => {
    // A menu opened before the frame ran owns focus now; never pull focus out of it.
    if (get().wm.activeId !== windowId || get().menu) return;
    if (onlyIfLost && !focusLost()) return;
    const root = document.querySelector<HTMLElement>(`[data-window-id="${windowId}"]`);
    if (!root || root.hidden) return;
    const remembered = lastFocus.get(windowId);
    if (isFocusable(remembered) && root.contains(remembered)) {
      remembered.focus({ preventScroll: true });
      return;
    }
    const area = root.querySelector<HTMLElement>('[data-autofocus]');
    const roving = area?.querySelector<HTMLElement>('[tabindex="0"]');
    const target = isFocusable(roving) ? roving : isFocusable(area) ? area : root;
    target.focus({ preventScroll: true });
  });
}

/**
 * After a window's view is replaced (navigation), put focus back in the view
 * if it was lost with the old items. Focus elsewhere (e.g. the address bar) stays.
 */
export function focusViewSoon(windowId: string): void {
  // Synchronously park focus on the view container (it survives navigation),
  // so keys pressed before the next frame still reach the view.
  const area = document.querySelector<HTMLElement>(`[data-window-id="${windowId}"] [data-autofocus]`);
  const active = document.activeElement;
  if (area && (active === document.body || (active && area.contains(active) && active !== area))) {
    area.focus({ preventScroll: true });
  }
  raf(() => {
    if (get().wm.activeId !== windowId) return;
    const current = document.activeElement;
    const root = document.querySelector<HTMLElement>(`[data-window-id="${windowId}"]`);
    const area = root?.querySelector<HTMLElement>('[data-autofocus]');
    if (!root || !area) return;
    if (current && current !== document.body && !area.contains(current)) return;
    const target = area.querySelector<HTMLElement>('[tabindex="0"]') ?? area;
    target.focus({ preventScroll: true });
  });
}

export function focusDesktopSoon(onlyIfLost = false): void {
  raf(() => {
    if (get().menu || (onlyIfLost && !focusLost())) return;
    const root = document.querySelector<HTMLElement>('[data-desktop-collection]');
    if (!root) return;
    const current = root.querySelector<HTMLElement>('[tabindex="0"]');
    (current ?? root).focus({ preventScroll: true });
  });
}

/**
 * Return focus to an invoker if it still exists, otherwise to the active window
 * or desktop. Yields when a command has already moved focus somewhere real
 * (for example into a rename box), so restoring never steals it back.
 */
export function restoreFocus(invoker: HTMLElement | null): void {
  const toInvoker = () => {
    const ownerWindow = invoker?.closest<HTMLElement>('[data-window-id]')?.dataset.windowId;
    if (!isFocusable(invoker) || (ownerWindow && ownerWindow !== get().wm.activeId)) return false;
    invoker.focus({ preventScroll: true });
    return true;
  };
  // A closed menu or dialog leaves focus on <body>; anything else means a
  // command (or a newly opened dialog) has already placed focus deliberately.
  const placed = () => {
    const current = document.activeElement;
    return current instanceof HTMLElement && current !== document.body && current.isConnected;
  };
  // With no usable invoker (Safari does not focus buttons on click), a dialog
  // that is still open takes focus at its intended first control, never at a
  // title-bar button that sits earlier in the DOM but is not in the tab order.
  const toTopDialog = () => {
    const dialog = document.querySelector<HTMLElement>('.modal-slot:last-child [role="dialog"]');
    if (!dialog || dialog.closest('[inert]')) return false;
    const candidates = [
      dialog.querySelector('[data-initial-focus]'),
      ...dialog.querySelectorAll('input:not([disabled]), button:not([disabled]):not([tabindex="-1"])'),
    ];
    (candidates.find(isFocusable) ?? dialog).focus({ preventScroll: true });
    return true;
  };
  // Restore synchronously when possible so keys typed right after closing a
  // menu are not lost; commands that move focus afterwards still win.
  if (toInvoker()) return;
  // An invoker inside a stacked dialog stays inert until React re-renders; that
  // render is flushed in a microtask queued before this one, so retry there
  // rather than leaving keys to fall on <body> for a whole frame.
  queueMicrotask(() => {
    if (placed() || toInvoker() || toTopDialog()) return;
    raf(fallback);
  });
  function fallback() {
    // toInvoker never restores into a window that is no longer active (e.g. after
    // a menu command opened a new window): that would re-activate the old window.
    if (placed() || toInvoker() || toTopDialog()) return;
    // This fallback runs a frame later still: apply it only if focus is still lost,
    // so it never pulls focus back from somewhere the user has since moved to.
    const active = get().wm.activeId;
    if (active) focusWindowSoon(active, true);
    else focusDesktopSoon(true);
  }
}

// ---------------------------------------------------------------- modals

type ModalInput = Modal extends infer M ? (M extends Modal ? Omit<M, 'id'> : never) : never;

export function pushModal(modal: ModalInput): string {
  const id = uid('m');
  set((s) => ({ ...s, menu: null, modals: [...s.modals, { ...modal, id } as Modal] }));
  return id;
}

export function closeModal(id: string): void {
  const modal = get().modals.find((m) => m.id === id);
  set((s) => ({ ...s, modals: s.modals.filter((m) => m.id !== id) }));
  // Stacked modals (an error over Run) return focus to the invoker inside the dialog beneath.
  if (modal) restoreFocus(modal.invoker);
}

export interface AskOptions {
  title: string;
  text: string;
  detail?: string;
  icon?: 'info' | 'warning' | 'error' | 'question' | null;
  buttons?: ModalButton[];
  focusIndex?: number;
  cancelValue?: string;
  ownerWindowId?: string | null;
}

/** Shows a message box and resolves with the chosen button value. */
export function ask(options: AskOptions): Promise<string> {
  const buttons = options.buttons ?? [{ label: 'OK', value: 'ok' }];
  return new Promise((resolve) => {
    pushModal({
      kind: 'message',
      title: options.title,
      icon: options.icon === undefined ? 'info' : options.icon,
      text: options.text,
      detail: options.detail,
      buttons,
      focusIndex: options.focusIndex ?? 0,
      cancelValue: options.cancelValue ?? buttons[buttons.length - 1].value,
      resolve,
      invoker: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      ownerWindowId: options.ownerWindowId ?? get().wm.activeId,
    });
  });
}

export function showError(title: string, text: string): Promise<string> {
  return ask({ title, text, icon: 'error' });
}

export const YES_NO: ModalButton[] = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

// ---------------------------------------------------------------- menus

export function openMenu(menu: Omit<OpenMenu, 'id'>): void {
  if (get().modals.length) return;
  set((s) => ({ ...s, menu: { ...menu, id: uid('menu') } }));
}

export function closeMenu(restore = true): void {
  const menu = get().menu;
  if (!menu) return;
  set((s) => ({ ...s, menu: null }));
  if (restore) restoreFocus(menu.invoker);
}

// ---------------------------------------------------------------- balloons

export function showBalloon(balloon: Omit<Balloon, 'id'>): void {
  set((s) => ({ ...s, balloon: { ...balloon, id: uid('b') } }));
}

export function dismissBalloon(): void {
  set((s) => (s.balloon ? { ...s, balloon: null } : s));
}
