import { ROOT_ID, SEED_IDS, binEntry, isLive, pathOf, type FolderId } from '../domain/fs';
import { LOC, locationContainer, locationTitle, type ShellLocation } from '../domain/locations';
import { MAX_RECENT, type RecentApp } from '../domain/prefs';
import type { BrowserRoute } from '../domain/browserRoutes';
import {
  activate,
  cascade,
  clampAll,
  closeWindow as wmClose,
  findInstance,
  minimize,
  openWindow,
  restore,
  setBounds,
  setTitle,
  tile,
  toggleMaximize,
  toggleShowDesktop as wmToggleShowDesktop,
  type AppId,
  type Rect,
} from '../domain/windows';
import type { IconName } from '../ui/icons';
import { APP_SPECS } from './appSpecs';
import { locationIcon } from './items';
import { focusDesktopSoon, focusWindowSoon, forgetWindowFocus, get, set, workArea } from './app';
import { treePathFor } from './tree';
import type { AppState, ExplorerPane, ExplorerState } from './types';

// ---------------------------------------------------------------- titles

export function windowTitle(state: AppState, id: string): string {
  const win = state.wm.windows[id];
  if (!win) return '';
  if (win.appId === 'explorer') {
    const explorer = state.explorers[id];
    if (!explorer) return win.title;
    const loc = explorer.location;
    if (loc.kind === 'search') return 'Search Results';
    if (loc.kind === 'folder' && state.prefs.explorer.fullPathInTitle && isLive(state.fs, loc.id)) {
      return pathOf(state.fs, loc.id);
    }
    return locationTitle(state.fs, loc);
  }
  if (win.appId === 'folderProps') {
    const target = state.params[id]?.folderId as FolderId | undefined;
    const binId = state.params[id]?.binId as FolderId | undefined;
    if (target && isLive(state.fs, target)) return `${locationTitle(state.fs, LOC.folder(target))} Properties`;
    if (binId) {
      const entry = binEntry(state.fs, binId);
      if (entry) return `${entry.nodes[binId].name} Properties`;
    }
    return 'Properties';
  }
  return win.title;
}

/** Title-bar and taskbar icon: Explorer windows show their location's icon, as XP does. */
export function windowIcon(state: AppState, id: string): IconName {
  const win = state.wm.windows[id];
  if (!win) return 'folder';
  if (win.appId === 'explorer') {
    const loc = state.explorers[id]?.location;
    return loc ? locationIcon(state.fs, loc) : APP_SPECS.explorer.icon;
  }
  if (win.appId === 'folderProps') return 'folder';
  return APP_SPECS[win.appId].icon;
}

// ---------------------------------------------------------------- windows

function focusInside(id: string): boolean {
  const root = document.querySelector(`[data-window-id="${id}"]`);
  return !!root && root.contains(document.activeElement);
}

/** After a window closes or minimizes, move focus on only if it was lost with the window. */
function afterHide(id: string, hadFocus: boolean): void {
  if (!hadFocus) return;
  const active = get().wm.activeId;
  if (active && active !== id) focusWindowSoon(active, true);
  else focusDesktopSoon(true);
}

export function activateWindow(id: string, focus = true): void {
  set((s) => {
    const wm = activate(s.wm, id);
    const menu = s.menu && s.menu.ownerWindowId !== id ? null : s.menu;
    return wm === s.wm && menu === s.menu ? s : { ...s, wm, menu };
  });
  if (focus) focusWindowSoon(id);
}

export function minimizeWindow(id: string): void {
  const hadFocus = focusInside(id);
  set((s) => ({ ...s, wm: minimize(s.wm, id), menu: s.menu?.ownerWindowId === id ? null : s.menu, moveSize: null }));
  afterHide(id, hadFocus);
}

export function toggleMaximizeWindow(id: string): void {
  set((s) => ({ ...s, wm: toggleMaximize(s.wm, id, workArea(s)) }));
  focusWindowSoon(id);
}

export function maximizeWindow(id: string): void {
  const win = get().wm.windows[id];
  if (win && !win.maximized) toggleMaximizeWindow(id);
}

export function restoreWindow(id: string): void {
  set((s) => ({ ...s, wm: restore(s.wm, id, workArea(s)) }));
  focusWindowSoon(id);
}

export function closeWindow(id: string): void {
  const hadFocus = focusInside(id) || document.activeElement === document.body;
  set((s) => {
    if (!s.wm.windows[id]) return s;
    const explorers = { ...s.explorers };
    delete explorers[id];
    const params = { ...s.params };
    delete params[id];
    return {
      ...s,
      wm: wmClose(s.wm, id),
      explorers,
      params,
      menu: s.menu?.ownerWindowId === id ? null : s.menu,
      moveSize: s.moveSize?.windowId === id ? null : s.moveSize,
    };
  });
  forgetWindowFocus(id);
  afterHide(id, hadFocus);
}

export function setWindowBounds(id: string, rect: Rect): void {
  set((s) => ({ ...s, wm: setBounds(s.wm, id, rect, workArea(s)) }));
}

export function setWindowTitle(id: string, title: string): void {
  set((s) => {
    const wm = setTitle(s.wm, id, title);
    return wm === s.wm ? s : { ...s, wm };
  });
}

export function cascadeWindows(): void {
  set((s) => ({ ...s, wm: cascade(s.wm, workArea(s)) }));
}

export function tileWindows(direction: 'horizontal' | 'vertical'): void {
  set((s) => ({ ...s, wm: tile(s.wm, workArea(s), direction) }));
}

export function toggleShowDesktop(): void {
  const restoring = !!get().wm.showDesktopSnapshot;
  set((s) => ({ ...s, wm: wmToggleShowDesktop(s.wm), menu: null }));
  const active = get().wm.activeId;
  if (restoring && active) focusWindowSoon(active);
  else if (!restoring) focusDesktopSoon();
}

export function clampWindowsToViewport(): void {
  set((s) => {
    const wm = clampAll(s.wm, workArea(s));
    return wm === s.wm ? s : { ...s, wm };
  });
}

export function setParams(id: string, patch: Record<string, unknown>): void {
  set((s) => (s.wm.windows[id] ? { ...s, params: { ...s.params, [id]: { ...s.params[id], ...patch } } } : s));
}

// ---------------------------------------------------------------- explorer instances

export function defaultView(loc: ShellLocation): ExplorerState['view'] {
  return loc.kind === 'recycleBin' || loc.kind === 'search' ? 'details' : 'tiles';
}

export function createExplorer(state: AppState, location: ShellLocation, pane?: ExplorerPane): ExplorerState {
  const container = locationContainer(location);
  return {
    location,
    history: [location],
    index: 0,
    selected: [],
    focused: null,
    anchor: null,
    renaming: null,
    view: defaultView(location),
    sort: { key: 'name', dir: 1 },
    pane: pane ?? (state.prefs.explorer.showTasks ? 'tasks' : 'none'),
    expanded: treePathFor(state.fs, location).slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join('/')),
    search: null,
    searchDraft: { query: '', scopeId: container && isLive(state.fs, container) ? container : ROOT_ID },
  };
}

// ---------------------------------------------------------------- launching

export type LaunchTarget =
  | { app: 'explorer'; location?: ShellLocation; pane?: ExplorerPane }
  | { app: 'search'; scopeId?: FolderId }
  | { app: 'help'; topic?: string }
  | { app: 'ie'; route?: BrowserRoute }
  | { app: 'folderProps'; folderId?: FolderId; binId?: FolderId }
  | { app: 'display'; tab?: string }
  | { app: Exclude<AppId, 'explorer' | 'help' | 'ie' | 'folderProps' | 'display'> };

function noteRecent(state: AppState, app: AppId): AppState {
  const recentable: RecentApp[] = ['explorer', 'calculator', 'help', 'controlPanel', 'taskManager'];
  if (!recentable.includes(app as RecentApp)) return state;
  const recentApps = [app as RecentApp, ...state.prefs.recentApps.filter((a) => a !== app)].slice(0, MAX_RECENT);
  if (recentApps.join() === state.prefs.recentApps.join()) return state;
  return { ...state, prefs: { ...state.prefs, recentApps } };
}

/** Opens (or refocuses) an app window. Every launcher in the shell routes through here. */
export function launch(target: LaunchTarget): string | null {
  const s = get();
  if (s.session !== 'running') return null;
  const appId: AppId = target.app === 'search' ? 'explorer' : target.app;
  const spec = APP_SPECS[appId];
  let instanceKey: string | null = spec.single ? appId : null;
  let params: Record<string, unknown> = {};
  let explorer: ExplorerState | undefined;

  switch (target.app) {
    case 'explorer': {
      const location = target.location ?? LOC.folder(SEED_IDS.myDocuments);
      explorer = createExplorer(s, location, target.pane);
      break;
    }
    case 'search': {
      const scopeId = target.scopeId && isLive(s.fs, target.scopeId) ? target.scopeId : ROOT_ID;
      explorer = { ...createExplorer(s, LOC.search, 'search'), searchDraft: { query: '', scopeId } };
      break;
    }
    case 'help':
      params = { topic: target.topic ?? 'home', nonce: Date.now() };
      break;
    case 'ie':
      params = { route: target.route ?? 'welcome', nonce: Date.now() };
      break;
    case 'display':
      params = { tab: target.tab ?? 'desktop', nonce: Date.now() };
      break;
    case 'folderProps':
      instanceKey = target.folderId ? `folderProps:${target.folderId}` : `binProps:${target.binId}`;
      params = { folderId: target.folderId ?? null, binId: target.binId ?? null };
      break;
    default:
      break;
  }

  const existing = instanceKey ? findInstance(s.wm, instanceKey) : undefined;
  if (existing) {
    set((state) => noteRecent({ ...state, params: { ...state.params, [existing.id]: { ...state.params[existing.id], ...params } } }, appId));
    activateWindow(existing.id);
    return existing.id;
  }

  const { wm, id } = openWindow(
    s.wm,
    {
      appId,
      title: spec.title,
      size: spec.size,
      minSize: spec.minSize,
      resizable: spec.resizable,
      instanceKey,
      center: spec.dialog,
    },
    workArea(s),
  );
  set((state) =>
    noteRecent(
      {
        ...state,
        wm,
        menu: null,
        params: { ...state.params, [id]: params },
        explorers: explorer ? { ...state.explorers, [id]: explorer } : state.explorers,
      },
      appId,
    ),
  );
  focusWindowSoon(id);
  return id;
}
