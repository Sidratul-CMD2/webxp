import { SEED_IDS, binEntry, isLive, isWritable, type FolderId } from '../domain/fs';
import { LOC, locationTitle } from '../domain/locations';
import type { Point } from '../domain/prefs';
import { get, set } from './app';
import {
  exploreItem,
  openItem,
  openLocation,
  surfaceContainer,
  surfaceItems,
  surfaceState,
  type Surface,
} from './explorerActions';
import {
  beginRename,
  copyFolderIds,
  cutFolders,
  deleteFolders,
  emptyRecycleBin,
  invertSelectionOn,
  moveOrCopyTo,
  newFolder,
  pasteInto,
  purgeBinItems,
  restoreBinItems,
  selectAllOn,
  undoLast,
} from './folderActions';
import type { ViewItem } from './items';
import { launch } from './windowActions';
import type { AppState } from './types';

export interface Command {
  label: string;
  enabled: boolean;
  /** Why the command is unavailable; shown with the disabled control. */
  reason?: string;
  shortcut?: string;
  run: () => void;
}

export const REASONS = {
  noSelection: 'Select a folder first.',
  protectedItems: 'Protected system folders and shell items cannot be renamed, moved, copied or deleted in this simulation.',
  readOnly: 'This location is a read-only part of the simulation. You can create folders on the Desktop and in My Documents.',
  notFolder: 'This view is not a folder, so nothing can be created or pasted here.',
  emptyClipboard: 'Cut or copy a folder first.',
  nothingToUndo: 'There is nothing to undo.',
  inBin: 'Restore items from the Recycle Bin before working with them.',
  binEmpty: 'The Recycle Bin is empty.',
  noProperties: 'Properties are not available for this item in the simulation.',
  single: 'Select a single item.',
} as const;

const cmd = (label: string, enabled: boolean, run: () => void, reason?: string, shortcut?: string): Command => ({
  label,
  enabled,
  reason: enabled ? undefined : reason,
  shortcut,
  run: () => {
    if (enabled) run();
  },
});

export function selectedItems(state: AppState, surface: Surface): ViewItem[] {
  const sel = surfaceState(state, surface);
  if (!sel || sel.selected.length === 0) return [];
  const keys = new Set(sel.selected);
  return surfaceItems(state, surface).filter((i) => keys.has(i.key));
}

export interface FolderCommands {
  open: Command;
  explore: Command;
  openContaining: Command;
  newFolder: Command;
  rename: Command;
  cut: Command;
  copy: Command;
  paste: Command;
  delete: Command;
  deletePermanently: Command;
  undo: Command;
  properties: Command;
  selectAll: Command;
  invertSelection: Command;
  moveTo: Command;
  copyTo: Command;
  restore: Command;
  restoreAll: Command;
  emptyBin: Command;
}

/**
 * Command descriptors for a desktop or Explorer surface, evaluated against the
 * selection at the moment they are built. Every action re-validates against
 * current state when it runs, so a stale menu can never apply a stale target.
 */
export function folderCommands(state: AppState, surface: Surface, at?: Point): FolderCommands {
  const items = selectedItems(state, surface);
  const ids = items.map((i) => i.id);
  const inBin = surface.kind === 'explorer' && state.explorers[surface.windowId]?.location.kind === 'recycleBin';
  const inSearch = surface.kind === 'explorer' && state.explorers[surface.windowId]?.location.kind === 'search';
  const allMutable = items.length > 0 && items.every((i) => i.mutable);
  const container = surfaceContainer(state, surface);
  const canCreate = !!container && isWritable(state.fs, container);
  const single = items.length === 1 ? items[0] : null;

  const mutationReason = items.length === 0 ? REASONS.noSelection : inBin ? REASONS.inBin : REASONS.protectedItems;
  const createReason = inSearch || !container ? REASONS.notFolder : REASONS.readOnly;

  const openable = items.length > 0;
  const open = cmd(
    'Open',
    openable,
    () => {
      const current = selectedItems(get(), surface);
      if (current.length === 1) openItem(surface, current[0]);
      else for (const item of current) openItem(surface, item, true);
    },
    REASONS.noSelection,
  );

  const explorable = !!single && single.kind !== 'bin' && !(single.kind === 'shell' && single.id === 'ie');
  const explore = cmd('Explore', explorable, () => single && exploreItem(single), items.length > 1 ? REASONS.single : REASONS.noSelection);

  const openContaining = cmd(
    'Open Containing Folder',
    !!single && single.kind === 'folder' && !!state.fs.nodes[single.id]?.parentId,
    () => {
      const parent = single && get().fs.nodes[single.id]?.parentId;
      if (parent) launch({ app: 'explorer', location: LOC.folder(parent) });
    },
    REASONS.single,
  );

  const propertiesTarget = (): (() => void) | null => {
    if (single?.kind === 'folder') return () => launch({ app: 'folderProps', folderId: single.id });
    if (single?.kind === 'bin') return () => launch({ app: 'folderProps', binId: single.id });
    if (single?.kind === 'shell' && single.id === 'myDocuments') return () => launch({ app: 'folderProps', folderId: SEED_IDS.myDocuments });
    if (items.length === 0) {
      if (surface.kind === 'desktop') return () => launch({ app: 'display' });
      const loc = state.explorers[surface.windowId]?.location;
      if (loc?.kind === 'folder') return () => launch({ app: 'folderProps', folderId: loc.id });
    }
    return null;
  };
  const propsRun = propertiesTarget();

  const binIds = state.fs.bin.map((e) => e.rootId);

  return {
    open,
    explore,
    openContaining,
    newFolder: cmd('Folder', canCreate, () => newFolder(surface, at), createReason),
    rename: cmd('Rename', !!single && single.mutable, () => single && beginRename(surface, single.id), items.length > 1 ? REASONS.single : mutationReason, 'F2'),
    cut: cmd('Cut', allMutable, () => cutFolders(ids), mutationReason, 'Ctrl+X'),
    copy: cmd('Copy', allMutable, () => copyFolderIds(ids), mutationReason, 'Ctrl+C'),
    paste: cmd(
      'Paste',
      canCreate && !!state.clipboard,
      () => void pasteInto(surfaceContainer(get(), surface), surface),
      !canCreate ? createReason : REASONS.emptyClipboard,
      'Ctrl+V',
    ),
    delete: inBin
      ? cmd('Delete', items.length > 0, () => void purgeBinItems(ids), REASONS.noSelection, 'Del')
      : cmd('Delete', allMutable, () => void deleteFolders(ids, false), mutationReason, 'Del'),
    deletePermanently: inBin
      ? cmd('Delete', items.length > 0, () => void purgeBinItems(ids), REASONS.noSelection, 'Shift+Del')
      : cmd('Delete Permanently', allMutable, () => void deleteFolders(ids, true), mutationReason, 'Shift+Del'),
    undo: cmd(state.undo ? `Undo ${state.undo.label}` : 'Undo', !!state.undo, undoLast, REASONS.nothingToUndo, 'Ctrl+Z'),
    properties: cmd('Properties', !!propsRun, () => propsRun?.(), items.length > 1 ? REASONS.single : REASONS.noProperties),
    selectAll: cmd('Select All', surfaceItems(state, surface).length > 0, () => selectAllOn(surface), 'There is nothing to select.', 'Ctrl+A'),
    invertSelection: cmd('Invert Selection', surfaceItems(state, surface).length > 0, () => invertSelectionOn(surface), 'There is nothing to select.'),
    moveTo: cmd('Move To Folder…', allMutable, () => void moveOrCopyTo(ids, 'move', surface), mutationReason),
    copyTo: cmd('Copy To Folder…', allMutable, () => void moveOrCopyTo(ids, 'copy', surface), mutationReason),
    restore: cmd(
      items.length > 1 ? 'Restore the selected items' : 'Restore',
      inBin && items.length > 0,
      () => void restoreBinItems(ids),
      REASONS.noSelection,
    ),
    restoreAll: cmd('Restore all items', binIds.length > 0, () => void restoreBinItems(get().fs.bin.map((e) => e.rootId)), REASONS.binEmpty),
    emptyBin: cmd('Empty Recycle Bin', binIds.length > 0, () => void emptyRecycleBin(), REASONS.binEmpty),
  };
}

/** Folder IDs a drag can carry from this surface's current selection. */
export function draggableIds(state: AppState, surface: Surface): FolderId[] {
  return selectedItems(state, surface)
    .filter((i) => i.mutable)
    .map((i) => i.id);
}

export function folderLabel(state: AppState, id: FolderId): string {
  if (isLive(state.fs, id)) return locationTitle(state.fs, LOC.folder(id));
  return binEntry(state.fs, id)?.nodes[id]?.name ?? '';
}

export function openFolderFromAnywhere(id: FolderId): void {
  openLocation({ kind: 'desktop' }, LOC.folder(id), true);
}

export function refreshViews(): void {
  set((s) => ({ ...s, refreshTick: s.refreshTick + 1 }));
}
