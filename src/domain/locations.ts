import {
  ROOT_ID,
  SEED_IDS,
  childIds,
  displayName,
  isLive,
  pathOf,
  type FolderId,
  type FsState,
} from './fs';

/**
 * Shell locations are explicit types, never fake folders. Folder locations
 * reference a stable folder ID; the rest are shell views.
 */
export type ShellLocation =
  | { kind: 'folder'; id: FolderId }
  | { kind: 'desktop' }
  | { kind: 'myComputer' }
  | { kind: 'network' }
  | { kind: 'recycleBin' }
  | { kind: 'search' };

export const LOC = {
  desktop: { kind: 'desktop' } as ShellLocation,
  myComputer: { kind: 'myComputer' } as ShellLocation,
  network: { kind: 'network' } as ShellLocation,
  recycleBin: { kind: 'recycleBin' } as ShellLocation,
  search: { kind: 'search' } as ShellLocation,
  folder: (id: FolderId): ShellLocation => ({ kind: 'folder', id }),
};

export function sameLocation(a: ShellLocation, b: ShellLocation): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'folder' || a.id === (b as { id: FolderId }).id;
}

/** Folders whose shell name is shown instead of a full path. */
const SPECIAL_FOLDERS: Record<string, string> = {
  [SEED_IDS.myDocuments]: 'My Documents',
  [SEED_IDS.myPictures]: 'My Pictures',
  [SEED_IDS.myMusic]: 'My Music',
  [SEED_IDS.desktop]: 'Desktop',
};

export function isSpecialFolder(id: FolderId): boolean {
  return id in SPECIAL_FOLDERS;
}

export function locationTitle(fs: FsState, loc: ShellLocation): string {
  switch (loc.kind) {
    case 'folder':
      return displayName(fs, loc.id);
    case 'desktop':
      return 'Desktop';
    case 'myComputer':
      return 'My Computer';
    case 'network':
      return 'My Network Places';
    case 'recycleBin':
      return 'Recycle Bin';
    case 'search':
      return 'Search Results';
  }
}

/** Text shown in the address bar. */
export function locationAddress(fs: FsState, loc: ShellLocation, fullPath = false): string {
  if (loc.kind === 'folder') {
    if (!fullPath && SPECIAL_FOLDERS[loc.id]) return SPECIAL_FOLDERS[loc.id];
    return pathOf(fs, loc.id);
  }
  return locationTitle(fs, loc);
}

export function locationParent(loc: ShellLocation, fs: FsState): ShellLocation | null {
  switch (loc.kind) {
    case 'folder': {
      if (loc.id === ROOT_ID) return LOC.myComputer;
      if (loc.id === SEED_IDS.myDocuments || loc.id === SEED_IDS.desktop) return LOC.desktop;
      const parent = fs.nodes[loc.id]?.parentId;
      return parent ? LOC.folder(parent) : null;
    }
    case 'myComputer':
    case 'network':
    case 'recycleBin':
      return LOC.desktop;
    case 'desktop':
    case 'search':
      return null;
  }
}

/** The folder that New Folder / Paste target when this location is shown. */
export function locationContainer(loc: ShellLocation): FolderId | null {
  if (loc.kind === 'folder') return loc.id;
  if (loc.kind === 'desktop') return SEED_IDS.desktop;
  return null;
}

export function locationExists(fs: FsState, loc: ShellLocation): boolean {
  return loc.kind !== 'folder' || isLive(fs, loc.id);
}

const ALIASES: Record<string, ShellLocation> = {
  desktop: LOC.desktop,
  'my documents': LOC.folder(SEED_IDS.myDocuments),
  'my pictures': LOC.folder(SEED_IDS.myPictures),
  'my music': LOC.folder(SEED_IDS.myMusic),
  'my computer': LOC.myComputer,
  'my network places': LOC.network,
  'recycle bin': LOC.recycleBin,
  'local disk (c:)': LOC.folder(ROOT_ID),
};

/**
 * Resolves a typed address to a virtual location, case-insensitively.
 * Never touches the network or the host filesystem.
 */
export function resolveAddress(fs: FsState, input: string): ShellLocation | null {
  let text = input.trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1).trim();
  if (!text || text.length > 4096) return null;
  const lower = text.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  const normalized = text.replace(/\//g, '\\');
  const match = /^([a-z]):(\\.*)?$/i.exec(normalized);
  if (!match) return null;
  if (match[1].toLowerCase() !== 'c') return null;
  const parts = (match[2] ?? '').split('\\').filter((p) => p.length > 0);
  let current: FolderId = ROOT_ID;
  for (const part of parts) {
    const key = part.trim().toLowerCase();
    const next = childIds(fs, current).find((id) => fs.nodes[id].name.toLowerCase() === key);
    if (!next) return null;
    current = next;
  }
  return LOC.folder(current);
}
