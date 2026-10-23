import {
  ROOT_ID,
  SEED_IDS,
  children,
  isLive,
  isSelfOrDescendant,
  isUserFolder,
  nameMatches,
  pathOf,
  searchFolders,
  type FolderId,
  type FsState,
} from '../domain/fs';
import type { ShellLocation } from '../domain/locations';
import type { Point, TextScale } from '../domain/prefs';
import type { Rect } from '../domain/windows';
import type { IconName } from '../ui/icons';
import type { AppState, SearchState, SortKey } from './types';

export type ShellTarget = 'myDocuments' | 'myComputer' | 'network' | 'recycleBin' | 'ie';

export interface ViewItem {
  key: string;
  kind: 'folder' | 'shell' | 'bin';
  /** Folder ID, bin root ID, or shell target. */
  id: string;
  name: string;
  type: string;
  icon: IconName;
  modified: number | null;
  location: string | null;
  deleted: number | null;
  group: string | null;
  /** May be renamed, cut, copied, deleted and dragged. */
  mutable: boolean;
}

export const shellKey = (target: ShellTarget) => `shell:${target}`;

export function folderIcon(id: FolderId): IconName {
  switch (id) {
    case SEED_IDS.myDocuments:
      return 'my-documents';
    case SEED_IDS.myPictures:
      return 'my-pictures';
    case SEED_IDS.myMusic:
      return 'my-music';
    case ROOT_ID:
      return 'drive';
    default:
      return 'folder';
  }
}

export function binIcon(fs: FsState): IconName {
  return fs.bin.length ? 'recycle-full' : 'recycle-empty';
}

export function locationIcon(fs: FsState, loc: ShellLocation): IconName {
  switch (loc.kind) {
    case 'folder':
      return folderIcon(loc.id);
    case 'desktop':
      return 'show-desktop';
    case 'myComputer':
      return 'my-computer';
    case 'network':
      return 'network';
    case 'recycleBin':
      return binIcon(fs);
    case 'search':
      return 'search';
  }
}

export function folderItem(fs: FsState, id: FolderId, extra: Partial<ViewItem> = {}): ViewItem {
  const node = fs.nodes[id];
  return {
    key: id,
    kind: 'folder',
    id,
    name: id === ROOT_ID ? 'Local Disk (C:)' : node.name,
    type: id === ROOT_ID ? 'Local Disk' : 'File Folder',
    icon: folderIcon(id),
    modified: node.modified,
    location: null,
    deleted: null,
    group: null,
    mutable: isUserFolder(fs, id),
    ...extra,
  };
}

const SHELL_NAMES: Record<ShellTarget, string> = {
  myDocuments: 'My Documents',
  myComputer: 'My Computer',
  network: 'My Network Places',
  recycleBin: 'Recycle Bin',
  ie: 'Internet Explorer',
};

export function shellItem(fs: FsState, target: ShellTarget, extra: Partial<ViewItem> = {}): ViewItem {
  const icons: Record<ShellTarget, IconName> = {
    myDocuments: 'my-documents',
    myComputer: 'my-computer',
    network: 'network',
    recycleBin: binIcon(fs),
    ie: 'browser',
  };
  return {
    key: shellKey(target),
    kind: 'shell',
    id: target,
    name: SHELL_NAMES[target],
    type: target === 'ie' ? 'Web Browser' : 'System Folder',
    icon: icons[target],
    modified: null,
    location: null,
    deleted: null,
    group: null,
    mutable: false,
    ...extra,
  };
}

export const DESKTOP_SHELL: ShellTarget[] = ['myDocuments', 'myComputer', 'network', 'recycleBin', 'ie'];

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function sortItems(items: ViewItem[], sort: { key: SortKey; dir: 1 | -1 }): ViewItem[] {
  const field = (item: ViewItem): string | number => {
    switch (sort.key) {
      case 'name':
        return item.name;
      case 'type':
        return item.type;
      case 'modified':
        return item.modified ?? 0;
      case 'location':
        return item.location ?? '';
      case 'deleted':
        return item.deleted ?? 0;
    }
  };
  return [...items].sort((a, b) => {
    // Shell items keep their fixed order ahead of user folders, as XP does.
    if (a.kind === 'shell' || b.kind === 'shell') {
      if (a.kind !== b.kind) return a.kind === 'shell' ? -1 : 1;
      return 0;
    }
    const fa = field(a);
    const fb = field(b);
    let c = typeof fa === 'number' && typeof fb === 'number' ? fa - fb : collator.compare(String(fa), String(fb));
    if (c === 0 && sort.key !== 'name') c = collator.compare(a.name, b.name);
    if (c === 0) c = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    return c * sort.dir;
  });
}

export function searchResultIds(fs: FsState, search: SearchState | null): FolderId[] {
  if (!search) return [];
  if (search.status === 'done') return searchFolders(fs, search.scopeId, search.query);
  return search.found.filter(
    (id) => isLive(fs, id) && id !== search.scopeId && isSelfOrDescendant(fs, id, search.scopeId) && nameMatches(fs.nodes[id].name, search.query),
  );
}

export function locationItems(fs: FsState, loc: ShellLocation, search: SearchState | null = null): ViewItem[] {
  switch (loc.kind) {
    case 'folder':
      return isLive(fs, loc.id) ? children(fs, loc.id).map((n) => folderItem(fs, n.id)) : [];
    case 'desktop':
      return [
        ...DESKTOP_SHELL.map((t) => shellItem(fs, t)),
        ...children(fs, SEED_IDS.desktop).map((n) => folderItem(fs, n.id)),
      ];
    case 'myComputer':
      return [
        shellItem(fs, 'myDocuments', { name: "User's Documents", group: 'Files Stored on This Computer' }),
        folderItem(fs, ROOT_ID, { group: 'Hard Disk Drives' }),
      ];
    case 'network':
      return [];
    case 'recycleBin':
      return fs.bin.map((entry) => ({
        key: entry.rootId,
        kind: 'bin',
        id: entry.rootId,
        name: entry.nodes[entry.rootId].name,
        type: 'File Folder',
        icon: 'folder',
        modified: entry.nodes[entry.rootId].modified,
        location: entry.originalPath,
        deleted: entry.deletedAt,
        group: null,
        mutable: false,
      }));
    case 'search':
      return searchResultIds(fs, search).map((id) => folderItem(fs, id, { location: pathOf(fs, fs.nodes[id].parentId!) }));
  }
}

export function explorerItems(state: AppState, windowId: string): ViewItem[] {
  const explorer = state.explorers[windowId];
  if (!explorer) return [];
  return sortItems(locationItems(state.fs, explorer.location, explorer.search), explorer.sort);
}

export function desktopItems(fs: FsState): ViewItem[] {
  return [
    ...DESKTOP_SHELL.map((t) => shellItem(fs, t)),
    ...sortItems(
      children(fs, SEED_IDS.desktop).map((n) => folderItem(fs, n.id)),
      { key: 'name', dir: 1 },
    ),
  ];
}

// ---------------------------------------------------------------- desktop grid

export interface Grid {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

export const GRID: Grid = { w: 76, h: 74, ox: 4, oy: 6 };

const TEXT_FACTOR: Record<TextScale, number> = { normal: 1, large: 1.2, extraLarge: 1.4 };

/** The icon grid grows with the text size so two-line labels never overlap the next icon. */
export function desktopGrid(textScale: TextScale): Grid {
  const f = TEXT_FACTOR[textScale];
  return { w: Math.round(GRID.w * f), h: Math.round(GRID.h * f), ox: GRID.ox, oy: GRID.oy };
}

function cellOrigin(col: number, row: number, grid: Grid): Point {
  return { x: grid.ox + col * grid.w, y: grid.oy + row * grid.h };
}

export function rowsFor(work: Rect, grid: Grid = GRID): number {
  return Math.max(1, Math.floor((work.h - grid.oy) / grid.h));
}

export function snapToGrid(p: Point, work: Rect, grid: Grid = GRID): Point {
  const maxCol = Math.max(0, Math.floor((work.w - grid.ox - grid.w) / grid.w));
  const col = Math.min(maxCol, Math.max(0, Math.round((p.x - grid.ox) / grid.w)));
  const row = Math.min(rowsFor(work, grid) - 1, Math.max(0, Math.round((p.y - grid.oy) / grid.h)));
  return cellOrigin(col, row, grid);
}

export function clampToDesktop(p: Point, work: Rect, grid: Grid = GRID): Point {
  return {
    x: Math.min(Math.max(0, Math.round(p.x)), Math.max(0, work.w - grid.w)),
    y: Math.min(Math.max(0, Math.round(p.y)), Math.max(0, work.h - grid.h)),
  };
}

/** Sequential top-to-bottom, then left-to-right placement. */
export function sequentialLayout(keys: string[], work: Rect, grid: Grid = GRID): Record<string, Point> {
  const rows = rowsFor(work, grid);
  const result: Record<string, Point> = {};
  keys.forEach((key, i) => {
    result[key] = cellOrigin(Math.floor(i / rows), i % rows, grid);
  });
  return result;
}

export function desktopLayout(
  items: ViewItem[],
  positions: Record<string, Point>,
  autoArrange: boolean,
  work: Rect,
  grid: Grid = GRID,
): Record<string, Point> {
  if (autoArrange) return sequentialLayout(items.map((i) => i.key), work, grid);
  const rows = rowsFor(work, grid);
  const result: Record<string, Point> = {};
  const occupied = new Set<string>();
  const cellKey = (p: Point) => `${Math.round((p.x - grid.ox) / grid.w)}:${Math.round((p.y - grid.oy) / grid.h)}`;
  const pending: string[] = [];
  for (const item of items) {
    const stored = positions[item.key];
    if (stored) {
      const p = clampToDesktop(stored, work, grid);
      result[item.key] = p;
      occupied.add(cellKey(p));
    } else {
      pending.push(item.key);
    }
  }
  let index = 0;
  for (const key of pending) {
    for (;;) {
      const p = cellOrigin(Math.floor(index / rows), index % rows, grid);
      index++;
      if (!occupied.has(cellKey(p))) {
        result[key] = p;
        occupied.add(cellKey(p));
        break;
      }
    }
  }
  return result;
}
