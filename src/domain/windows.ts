/**
 * Pure window-manager transitions. Window identity is independent of app
 * identity. Invariants: `order` and `mru` contain exactly the open window IDs;
 * the active window is never minimized; bounds stay valid for the work area.
 */

export type AppId =
  | 'explorer'
  | 'calculator'
  | 'controlPanel'
  | 'display'
  | 'taskbarProps'
  | 'sounds'
  | 'dateTime'
  | 'accessibility'
  | 'folderOptions'
  | 'help'
  | 'ie'
  | 'taskManager'
  | 'folderProps';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface WinState {
  id: string;
  appId: AppId;
  title: string;
  /** Normal (restored) bounds; retained while maximized. */
  bounds: Rect;
  maximized: boolean;
  minimized: boolean;
  resizable: boolean;
  minSize: Size;
  /** Single-instance apps are found again by this key. */
  instanceKey: string | null;
}

export interface WmState {
  windows: Record<string, WinState>;
  /** Z-order, bottom to top. */
  order: string[];
  /** Most recently active first. */
  mru: string[];
  activeId: string | null;
  nextSeq: number;
  /** Windows minimized by Show Desktop, restored by invoking it again. */
  showDesktopSnapshot: string[] | null;
}

export interface WindowSpec {
  appId: AppId;
  title: string;
  size: Size;
  minSize?: Size;
  resizable?: boolean;
  instanceKey?: string | null;
  /** Center in the work area instead of cascading (dialog-like applets). */
  center?: boolean;
}

export const TITLE_REACH = 64;
export const DEFAULT_MIN: Size = { w: 360, h: 260 };
const CASCADE_STEP = 26;

export const emptyWm: WmState = {
  windows: {},
  order: [],
  mru: [],
  activeId: null,
  nextSeq: 1,
  showDesktopSnapshot: null,
};

const visible = (wm: WmState, id: string) => !!wm.windows[id] && !wm.windows[id].minimized;

/** Clamp size to [min, work area] and keep the title strip reachable. */
export function clampBounds(rect: Rect, minSize: Size, work: Rect, strict = false): Rect {
  const w = Math.round(Math.max(Math.min(rect.w, work.w), Math.min(minSize.w, work.w)));
  const h = Math.round(Math.max(Math.min(rect.h, work.h), Math.min(minSize.h, work.h)));
  let x = Math.round(rect.x);
  let y = Math.round(rect.y);
  if (strict) {
    x = Math.min(Math.max(x, work.x), work.x + work.w - w);
    y = Math.min(Math.max(y, work.y), work.y + work.h - h);
  } else {
    x = Math.min(Math.max(x, work.x - w + TITLE_REACH), work.x + work.w - TITLE_REACH);
    y = Math.min(Math.max(y, work.y), work.y + work.h - 30);
  }
  return { x, y, w, h };
}

export function openWindow(wm: WmState, spec: WindowSpec, work: Rect): { wm: WmState; id: string } {
  const id = `w${wm.nextSeq}`;
  const minSize = spec.minSize ?? DEFAULT_MIN;
  let bounds: Rect;
  if (spec.center) {
    bounds = {
      x: work.x + Math.round((work.w - spec.size.w) / 2),
      y: work.y + Math.max(0, Math.round((work.h - spec.size.h) / 3)),
      w: spec.size.w,
      h: spec.size.h,
    };
  } else {
    // Cascade from just right of the first desktop icon column.
    const slot = Object.keys(wm.windows).length % 8;
    bounds = { x: work.x + 96 + slot * CASCADE_STEP, y: work.y + 24 + slot * CASCADE_STEP, ...spec.size };
  }
  const win: WinState = {
    id,
    appId: spec.appId,
    title: spec.title,
    bounds: clampBounds(bounds, minSize, work, true),
    maximized: false,
    minimized: false,
    resizable: spec.resizable ?? true,
    minSize,
    instanceKey: spec.instanceKey ?? null,
  };
  const next: WmState = {
    ...wm,
    windows: { ...wm.windows, [id]: win },
    order: [...wm.order, id],
    mru: [id, ...wm.mru],
    activeId: id,
    nextSeq: wm.nextSeq + 1,
  };
  return { wm: next, id };
}

export function findInstance(wm: WmState, instanceKey: string): WinState | undefined {
  return Object.values(wm.windows).find((w) => w.instanceKey === instanceKey);
}

function patch(wm: WmState, id: string, change: Partial<WinState>): WmState {
  return { ...wm, windows: { ...wm.windows, [id]: { ...wm.windows[id], ...change } } };
}

/** Activate: restore if minimized, raise to top, mark most recent. */
export function activate(wm: WmState, id: string): WmState {
  if (!wm.windows[id]) return wm;
  let next = wm.windows[id].minimized ? patch(wm, id, { minimized: false }) : wm;
  if (next.activeId === id && next.order[next.order.length - 1] === id && !wm.windows[id].minimized) return wm;
  next = {
    ...next,
    order: [...next.order.filter((w) => w !== id), id],
    mru: [id, ...next.mru.filter((w) => w !== id)],
    activeId: id,
  };
  return next;
}

/** Next most recently active visible window, excluding `except`. */
export function nextActive(wm: WmState, except: string | null): string | null {
  return wm.mru.find((id) => id !== except && visible(wm, id)) ?? null;
}

function activateFallback(wm: WmState, closingOrHiding: string): WmState {
  if (wm.activeId !== closingOrHiding) return wm;
  const next = nextActive(wm, closingOrHiding);
  return next ? activate({ ...wm, activeId: null }, next) : { ...wm, activeId: null };
}

export function minimize(wm: WmState, id: string): WmState {
  if (!wm.windows[id] || wm.windows[id].minimized) return wm;
  return activateFallback(patch(wm, id, { minimized: true }), id);
}

export function maximize(wm: WmState, id: string): WmState {
  const win = wm.windows[id];
  if (!win || !win.resizable) return wm;
  return activate(patch(wm, id, { maximized: true }), id);
}

/** Restore: from minimized (keeps maximized state) or from maximized to normal bounds. */
export function restore(wm: WmState, id: string, work: Rect): WmState {
  const win = wm.windows[id];
  if (!win) return wm;
  if (win.minimized) return activate(wm, id);
  if (!win.maximized) return wm;
  return activate(patch(wm, id, { maximized: false, bounds: clampBounds(win.bounds, win.minSize, work, true) }), id);
}

export function toggleMaximize(wm: WmState, id: string, work: Rect): WmState {
  const win = wm.windows[id];
  if (!win || !win.resizable) return wm;
  return win.maximized ? restore(wm, id, work) : maximize(wm, id);
}

export function closeWindow(wm: WmState, id: string): WmState {
  if (!wm.windows[id]) return wm;
  const windows = { ...wm.windows };
  delete windows[id];
  const wasActive = wm.activeId === id;
  let next: WmState = {
    ...wm,
    windows,
    order: wm.order.filter((w) => w !== id),
    mru: wm.mru.filter((w) => w !== id),
    activeId: wasActive ? null : wm.activeId,
    showDesktopSnapshot: wm.showDesktopSnapshot?.filter((w) => w !== id) ?? null,
  };
  if (wasActive) {
    const fallback = nextActive(next, null);
    if (fallback) next = activate(next, fallback);
  }
  return next;
}

export function setBounds(wm: WmState, id: string, rect: Rect, work: Rect): WmState {
  const win = wm.windows[id];
  if (!win) return wm;
  return patch(wm, id, { bounds: clampBounds(rect, win.minSize, work) });
}

export function setTitle(wm: WmState, id: string, title: string): WmState {
  if (!wm.windows[id] || wm.windows[id].title === title) return wm;
  return patch(wm, id, { title });
}

/** After a viewport change, keep every window's controls inside the work area. */
export function clampAll(wm: WmState, work: Rect): WmState {
  let changed = false;
  const windows: Record<string, WinState> = {};
  for (const [id, win] of Object.entries(wm.windows)) {
    const bounds = clampBounds(win.bounds, win.minSize, work, true);
    const same = bounds.x === win.bounds.x && bounds.y === win.bounds.y && bounds.w === win.bounds.w && bounds.h === win.bounds.h;
    windows[id] = same ? win : { ...win, bounds };
    changed ||= !same;
  }
  return changed ? { ...wm, windows } : wm;
}

export function toggleShowDesktop(wm: WmState): WmState {
  if (wm.showDesktopSnapshot) {
    let next: WmState = { ...wm, showDesktopSnapshot: null };
    // Restore in reverse MRU order so the previously active window ends on top.
    const snapshot = wm.showDesktopSnapshot.filter((id) => next.windows[id]);
    const ordered = [...snapshot].sort((a, b) => wm.mru.indexOf(b) - wm.mru.indexOf(a));
    for (const id of ordered) next = activate(next, id);
    return next;
  }
  const shown = wm.order.filter((id) => visible(wm, id));
  const windows = { ...wm.windows };
  for (const id of shown) windows[id] = { ...windows[id], minimized: true };
  return { ...wm, windows, activeId: null, showDesktopSnapshot: shown };
}

function arrangeable(wm: WmState): string[] {
  return wm.order.filter((id) => visible(wm, id) && wm.windows[id].resizable);
}

export function cascade(wm: WmState, work: Rect): WmState {
  const ids = arrangeable(wm);
  let next = wm;
  ids.forEach((id, i) => {
    const win = next.windows[id];
    const w = Math.max(win.minSize.w, Math.min(Math.round(work.w * 0.6), work.w - CASCADE_STEP * ids.length));
    const h = Math.max(win.minSize.h, Math.min(Math.round(work.h * 0.6), work.h - CASCADE_STEP * ids.length));
    const bounds = clampBounds({ x: work.x + i * CASCADE_STEP, y: work.y + i * CASCADE_STEP, w, h }, win.minSize, work, true);
    next = patch(next, id, { maximized: false, bounds });
  });
  for (const id of ids) next = activate(next, id);
  return next;
}

/** Horizontal: stacked one above another. Vertical: side by side. Falls back to cascade if they cannot fit. */
export function tile(wm: WmState, work: Rect, direction: 'horizontal' | 'vertical'): WmState {
  const ids = arrangeable(wm);
  if (ids.length === 0) return wm;
  const n = ids.length;
  const fits = ids.every((id) => {
    const min = wm.windows[id].minSize;
    return direction === 'horizontal' ? Math.floor(work.h / n) >= min.h && work.w >= min.w : Math.floor(work.w / n) >= min.w && work.h >= min.h;
  });
  if (!fits) return cascade(wm, work);
  let next = wm;
  ids.forEach((id, i) => {
    const bounds =
      direction === 'horizontal'
        ? { x: work.x, y: work.y + Math.floor((work.h * i) / n), w: work.w, h: Math.floor(work.h / n) }
        : { x: work.x + Math.floor((work.w * i) / n), y: work.y, w: Math.floor(work.w / n), h: work.h };
    next = patch(next, id, { maximized: false, bounds });
  });
  return next;
}
