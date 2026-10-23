import { ROOT_ID, SEED_IDS, isLive, nameMatches, walkDescendants, type FolderId } from '../domain/fs';
import {
  LOC,
  locationContainer,
  locationExists,
  locationParent,
  locationTitle,
  resolveAddress,
  sameLocation,
  type ShellLocation,
} from '../domain/locations';
import { announce, ask, focusViewSoon, get, set } from './app';
import { explorerItems, desktopItems, type ViewItem } from './items';
import { treePathFor } from './tree';
import { launch } from './windowActions';
import type { AppState, DesktopState, ExplorerPane, ExplorerState, SortKey, ViewMode } from './types';

export type Surface = { kind: 'desktop' } | { kind: 'explorer'; windowId: string };

export const DESKTOP: Surface = { kind: 'desktop' };
export const explorerSurface = (windowId: string): Surface => ({ kind: 'explorer', windowId });

export function surfaceState(state: AppState, surface: Surface): DesktopState | ExplorerState | undefined {
  return surface.kind === 'desktop' ? state.desktop : state.explorers[surface.windowId];
}

export function surfaceItems(state: AppState, surface: Surface): ViewItem[] {
  return surface.kind === 'desktop' ? desktopItems(state.fs) : explorerItems(state, surface.windowId);
}

/** The folder that New Folder and Paste target on this surface. */
export function surfaceContainer(state: AppState, surface: Surface): FolderId | null {
  if (surface.kind === 'desktop') return SEED_IDS.desktop;
  const explorer = state.explorers[surface.windowId];
  return explorer ? locationContainer(explorer.location) : null;
}

export function updateExplorer(windowId: string, fn: (e: ExplorerState, s: AppState) => ExplorerState): void {
  set((s) => {
    const current = s.explorers[windowId];
    if (!current) return s;
    const next = fn(current, s);
    return next === current ? s : { ...s, explorers: { ...s.explorers, [windowId]: next } };
  });
}

export function updateSurface(surface: Surface, patch: Partial<DesktopState>): void {
  if (surface.kind === 'desktop') {
    set((s) => ({ ...s, desktop: { ...s.desktop, ...patch } }));
  } else {
    updateExplorer(surface.windowId, (e) => ({ ...e, ...patch }));
  }
}

function expandTo(e: ExplorerState, s: AppState, loc: ShellLocation): string[] {
  const path = treePathFor(s.fs, loc);
  const keys = path.slice(0, -1).map((_, i) => path.slice(0, i + 1).join('/'));
  const set = new Set(e.expanded);
  for (const k of keys) set.add(k);
  return set.size === e.expanded.length ? e.expanded : [...set];
}

function withLocation(e: ExplorerState, s: AppState, loc: ShellLocation, history: ShellLocation[], index: number): ExplorerState {
  const leavingSearch = e.location.kind === 'search' && loc.kind !== 'search';
  return {
    ...e,
    location: loc,
    history,
    index,
    selected: [],
    focused: null,
    anchor: null,
    renaming: null,
    expanded: expandTo(e, s, loc),
    pane: leavingSearch && e.pane === 'search' ? (s.prefs.explorer.showTasks ? 'tasks' : 'none') : e.pane,
  };
}

/** Navigate this window. A new location after Back discards the forward branch. */
export function navigate(windowId: string, loc: ShellLocation): void {
  updateExplorer(windowId, (e, s) => {
    if (!locationExists(s.fs, loc)) return e;
    if (sameLocation(e.location, loc)) return e.renaming ? { ...e, renaming: null } : e;
    const history = [...e.history.slice(0, e.index + 1), loc].slice(-50);
    return withLocation(e, s, loc, history, history.length - 1);
  });
  focusViewSoon(windowId);
}

function historyStep(e: ExplorerState, s: AppState, dir: -1 | 1): number | null {
  for (let i = e.index + dir; i >= 0 && i < e.history.length; i += dir) {
    const loc = e.history[i];
    if (locationExists(s.fs, loc) && !sameLocation(loc, e.location)) return i;
  }
  return null;
}

export const canGoBack = (s: AppState, id: string) => !!s.explorers[id] && historyStep(s.explorers[id], s, -1) !== null;
export const canGoForward = (s: AppState, id: string) => !!s.explorers[id] && historyStep(s.explorers[id], s, 1) !== null;
export const canGoUp = (s: AppState, id: string) => !!s.explorers[id] && locationParent(s.explorers[id].location, s.fs) !== null;

/** Back/Forward skip history entries whose folders no longer exist. */
export function goHistory(windowId: string, dir: -1 | 1): void {
  updateExplorer(windowId, (e, s) => {
    const index = historyStep(e, s, dir);
    return index === null ? e : withLocation(e, s, e.history[index], e.history, index);
  });
  focusViewSoon(windowId);
}

/** Jump to a specific history entry (Back/Forward dropdowns); keeps the history list intact. */
export function goToHistoryIndex(windowId: string, index: number): void {
  updateExplorer(windowId, (e, s) => {
    const loc = e.history[index];
    if (!loc || !locationExists(s.fs, loc)) return e;
    return withLocation(e, s, loc, e.history, index);
  });
  focusViewSoon(windowId);
}

export function goUp(windowId: string): void {
  const s = get();
  const e = s.explorers[windowId];
  if (!e) return;
  const parent = locationParent(e.location, s.fs);
  if (parent) navigate(windowId, parent);
}

/** Resolves a typed address. Invalid input shows an error and keeps the current location. */
export function submitAddress(windowId: string, text: string): boolean {
  const s = get();
  const loc = resolveAddress(s.fs, text);
  if (!loc) {
    void ask({
      title: locationTitle(s.fs, s.explorers[windowId]?.location ?? LOC.desktop),
      text: `Windows cannot find '${text.trim()}'. Check the spelling and try again. Addresses in this simulation are folder paths such as C:\\WINDOWS, or names such as My Computer.`,
      icon: 'error',
      ownerWindowId: windowId,
    });
    return false;
  }
  navigate(windowId, loc);
  return true;
}

export function setView(windowId: string, view: ViewMode): void {
  updateExplorer(windowId, (e) => (e.view === view ? e : { ...e, view }));
}

export function setSort(windowId: string, key: SortKey, dir?: 1 | -1): void {
  updateExplorer(windowId, (e) => ({
    ...e,
    sort: { key, dir: dir ?? (e.sort.key === key ? ((e.sort.dir * -1) as 1 | -1) : 1) },
  }));
}

/** Toggling a pane that is open returns to the task pane (or none). */
export function togglePane(windowId: string, pane: ExplorerPane): void {
  updateExplorer(windowId, (e, s) => {
    const fallback: ExplorerPane = s.prefs.explorer.showTasks ? 'tasks' : 'none';
    const showing = e.pane === pane || (pane === 'search' && e.location.kind === 'search' && e.pane !== 'folders');
    if (showing) return { ...e, pane: fallback };
    const container = locationContainer(e.location);
    return {
      ...e,
      pane,
      searchDraft:
        pane === 'search' && e.location.kind !== 'search'
          ? { ...e.searchDraft, scopeId: container && isLive(s.fs, container) ? container : ROOT_ID }
          : e.searchDraft,
    };
  });
}

export function toggleTreeNode(windowId: string, key: string, expand?: boolean): void {
  updateExplorer(windowId, (e) => {
    const has = e.expanded.includes(key);
    const want = expand ?? !has;
    if (want === has) return e;
    return { ...e, expanded: want ? [...e.expanded, key] : e.expanded.filter((k) => k !== key && !k.startsWith(`${key}/`)) };
  });
}

// ---------------------------------------------------------------- opening items

export function openLocation(surface: Surface, loc: ShellLocation, newWindow = false): void {
  const s = get();
  if (surface.kind === 'explorer' && !newWindow && !s.prefs.explorer.newWindowPerFolder) navigate(surface.windowId, loc);
  else launch({ app: 'explorer', location: loc });
}

export function itemLocation(item: ViewItem): ShellLocation | null {
  if (item.kind === 'folder') return LOC.folder(item.id);
  if (item.kind === 'shell') {
    switch (item.id) {
      case 'myDocuments':
        return LOC.folder(SEED_IDS.myDocuments);
      case 'myComputer':
        return LOC.myComputer;
      case 'network':
        return LOC.network;
      case 'recycleBin':
        return LOC.recycleBin;
    }
  }
  return null;
}

export function openItem(surface: Surface, item: ViewItem, newWindow = false): void {
  if (item.kind === 'bin') {
    launch({ app: 'folderProps', binId: item.id });
    return;
  }
  if (item.kind === 'shell' && item.id === 'ie') {
    launch({ app: 'ie' });
    return;
  }
  const loc = itemLocation(item);
  if (loc) openLocation(surface, loc, newWindow);
}

export function exploreItem(item: ViewItem): void {
  const loc = itemLocation(item);
  if (loc) launch({ app: 'explorer', location: loc, pane: 'folders' });
}

// ---------------------------------------------------------------- search

/** Searches run in at most SEARCH_STEPS ticks, so small trees still show progress and Stop, and large trees stay quick. */
const SEARCH_STEPS = 20;
const SEARCH_MIN_CHUNK = 4;
const SEARCH_TICK_MS = 150;
let searchRun = 0;

export function setSearchDraft(windowId: string, patch: Partial<ExplorerState['searchDraft']>): void {
  updateExplorer(windowId, (e) => ({ ...e, searchDraft: { ...e.searchDraft, ...patch } }));
}

/** Folder-name search over live folders below the scope. Runs in cancellable chunks. */
export function startSearch(windowId: string): void {
  const s = get();
  const e = s.explorers[windowId];
  if (!e) return;
  const { query, scopeId } = e.searchDraft;
  if (!isLive(s.fs, scopeId)) {
    void ask({ title: 'Search Results', text: 'The folder you chose to look in no longer exists.', icon: 'error', ownerWindowId: windowId });
    return;
  }
  const runId = ++searchRun;
  const snapshot = s.fs;
  updateExplorer(windowId, (ex, st) => {
    const base = ex.location.kind === 'search' ? ex : withLocation(ex, st, LOC.search, [...ex.history.slice(0, ex.index + 1), LOC.search], ex.index + 1);
    return { ...base, pane: 'search', selected: [], focused: null, anchor: null, search: { query, scopeId, status: 'running', found: [], runId } };
  });
  announce('Searching…');
  let total = 0;
  for (const _ of walkDescendants(snapshot, scopeId)) total++;
  const chunk = Math.max(SEARCH_MIN_CHUNK, Math.ceil(total / SEARCH_STEPS));
  const walker = walkDescendants(snapshot, scopeId);
  const step = () => {
    const current = get().explorers[windowId]?.search;
    if (!current || current.runId !== runId || current.status !== 'running') return;
    const found: FolderId[] = [];
    let done = false;
    for (let i = 0; i < chunk; i++) {
      const next = walker.next();
      if (next.done) {
        done = true;
        break;
      }
      if (nameMatches(snapshot.nodes[next.value].name, query)) found.push(next.value);
    }
    updateExplorer(windowId, (ex) => {
      if (!ex.search || ex.search.runId !== runId) return ex;
      return { ...ex, search: { ...ex.search, found: [...ex.search.found, ...found], status: done ? 'done' : 'running' } };
    });
    if (done) {
      const count = get().explorers[windowId]?.search?.found.length ?? 0;
      announce(count === 0 ? 'Search is complete. There are no results to display.' : `Search is complete. ${count} folder${count === 1 ? '' : 's'} found.`);
    } else {
      setTimeout(step, SEARCH_TICK_MS);
    }
  };
  setTimeout(step, SEARCH_TICK_MS);
}

export function stopSearch(windowId: string): void {
  updateExplorer(windowId, (e) => (e.search?.status === 'running' ? { ...e, search: { ...e.search, status: 'stopped' } } : e));
  announce('Search stopped. Results may be incomplete.');
}

/** Look In choices: the standard folders plus the current scope when it is another folder. */
export function scopeOptions(state: AppState, current: FolderId): { id: FolderId; label: string }[] {
  const base: { id: FolderId; label: string }[] = [
    { id: SEED_IDS.desktop, label: 'Desktop' },
    { id: SEED_IDS.myDocuments, label: 'My Documents' },
    { id: SEED_IDS.myPictures, label: 'My Pictures' },
    { id: SEED_IDS.myMusic, label: 'My Music' },
    { id: ROOT_ID, label: 'Local Disk (C:)' },
  ];
  if (isLive(state.fs, current) && !base.some((o) => o.id === current)) {
    base.push({ id: current, label: locationTitle(state.fs, LOC.folder(current)) });
  }
  return base;
}
