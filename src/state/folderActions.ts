import {
  SEED_IDS,
  ancestorsOf,
  binEntry,
  copyFolders,
  createFolder,
  deletePermanently,
  deleteToBin,
  emptyBin,
  isLive,
  isUserFolder,
  isWritable,
  moveFolders,
  normalizeSelection,
  purgeBinEntries,
  renameFolder,
  restoreFromBin,
  snapshotFolders,
  type FolderId,
  type FolderSnapshot,
  type FsState,
} from '../domain/fs';
import { LOC, locationTitle } from '../domain/locations';
import type { Point } from '../domain/prefs';
import { closeWindow as wmClose } from '../domain/windows';
import { YES_NO, announce, ask, get, now, pushModal, set, showError, workArea } from './app';
import { surfaceContainer, surfaceItems, surfaceState, updateSurface, type Surface } from './explorerActions';
import { clampToDesktop, desktopGrid, desktopItems, explorerItems, snapToGrid } from './items';
import type { AppState, ExplorerState } from './types';

// ---------------------------------------------------------------- commit + reconcile

type UndoSpec = { label: string } | 'clear' | 'keep';

/** Keeps every open view consistent with the current tree. */
export function reconcile(state: AppState, prevFs: FsState): AppState {
  const fs = state.fs;
  let changed = false;
  const explorers: Record<string, ExplorerState> = {};
  const notices: string[] = [];
  for (const [id, e] of Object.entries(state.explorers)) {
    let next = e;
    if (e.location.kind === 'folder' && !isLive(fs, e.location.id)) {
      const gone = e.location.id;
      const survivor = ancestorsOf(prevFs, gone).find((a) => isLive(fs, a));
      const loc = survivor ? LOC.folder(survivor) : LOC.myComputer;
      const history = [...e.history.slice(0, e.index), loc];
      next = { ...e, location: loc, history, index: history.length - 1, selected: [], focused: null, anchor: null, renaming: null };
      notices.push(`The folder “${prevFs.nodes[gone]?.name ?? ''}” no longer exists. Showing “${locationTitle(fs, loc)}”.`);
    }
    const keys = new Set(explorerItems({ ...state, explorers: { [id]: next } }, id).map((i) => i.key));
    const selected = next.selected.filter((k) => keys.has(k));
    const focused = next.focused && keys.has(next.focused) ? next.focused : null;
    const anchor = next.anchor && keys.has(next.anchor) ? next.anchor : null;
    const renaming = next.renaming && keys.has(next.renaming) ? next.renaming : null;
    if (selected.length !== next.selected.length || focused !== next.focused || anchor !== next.anchor || renaming !== next.renaming) {
      next = { ...next, selected, focused, anchor, renaming };
    }
    explorers[id] = next;
    changed ||= next !== e;
  }
  const deskKeys = new Set(desktopItems(fs).map((i) => i.key));
  const d = state.desktop;
  const desktop = {
    selected: d.selected.filter((k) => deskKeys.has(k)),
    focused: d.focused && deskKeys.has(d.focused) ? d.focused : null,
    anchor: d.anchor && deskKeys.has(d.anchor) ? d.anchor : null,
    renaming: d.renaming && deskKeys.has(d.renaming) ? d.renaming : null,
  };
  const deskChanged =
    desktop.selected.length !== d.selected.length || desktop.focused !== d.focused || desktop.anchor !== d.anchor || desktop.renaming !== d.renaming;

  let clipboard = state.clipboard;
  if (clipboard?.mode === 'cut') {
    const ids = clipboard.ids.filter((id) => isLive(fs, id));
    clipboard = ids.length === 0 ? null : ids.length === clipboard.ids.length ? clipboard : { mode: 'cut', ids };
  }

  let wm = state.wm;
  for (const win of Object.values(state.wm.windows)) {
    if (win.appId !== 'folderProps') continue;
    const p = state.params[win.id] ?? {};
    const folderId = p.folderId as FolderId | null;
    const binId = p.binId as FolderId | null;
    const stale = folderId ? !isLive(fs, folderId) : binId ? !binEntry(fs, binId) : false;
    if (stale) wm = wmClose(wm, win.id);
  }

  const positions = state.prefs.desktop.positions;
  const binIds = new Set(fs.bin.flatMap((e) => Object.keys(e.nodes)));
  const prunedKeys = Object.keys(positions).filter((k) => !k.startsWith('shell:') && !isLive(fs, k) && !binIds.has(k));
  let prefs = state.prefs;
  if (prunedKeys.length) {
    const next = { ...positions };
    for (const k of prunedKeys) delete next[k];
    prefs = { ...prefs, desktop: { ...prefs.desktop, positions: next } };
  }

  for (const text of notices) queueMicrotask(() => announce(text));

  return {
    ...state,
    explorers: changed ? explorers : state.explorers,
    desktop: deskChanged ? desktop : state.desktop,
    clipboard,
    wm,
    prefs,
  };
}

/** The single path for committing a folder-tree change. */
export function commitFs(next: FsState, undo: UndoSpec): void {
  set((s) => {
    const prev = s.fs;
    const undoEntry = undo === 'clear' ? null : undo === 'keep' ? s.undo : { label: undo.label, before: prev, after: next };
    return reconcile({ ...s, fs: next, undo: undoEntry }, prev);
  });
}

// ---------------------------------------------------------------- helpers

const nameOf = (s: AppState, id: FolderId) => s.fs.nodes[id]?.name ?? binEntry(s.fs, id)?.nodes[id]?.name ?? '';

export function mutableIds(state: AppState, ids: readonly string[]): FolderId[] {
  return ids.filter((id) => isUserFolder(state.fs, id));
}

function selectOn(surface: Surface | undefined, destId: FolderId, ids: FolderId[]): void {
  if (!surface || ids.length === 0) return;
  const s = get();
  if (surfaceContainer(s, surface) !== destId) return;
  updateSurface(surface, { selected: ids, focused: ids[0], anchor: ids[0] });
}

// ---------------------------------------------------------------- create / rename

export function newFolder(surface: Surface, at?: Point): FolderId | null {
  const s = get();
  const dest = surfaceContainer(s, surface);
  if (!dest) return null;
  const r = createFolder(s.fs, dest, now());
  if (!r.ok) {
    void showError('Error Creating Folder', r.error.message);
    return null;
  }
  commitFs(r.fs, { label: 'New Folder' });
  if (surface.kind === 'desktop' && at) {
    const work = workArea(get());
    const grid = desktopGrid(get().prefs.textScale);
    const p = get().prefs.desktop.alignToGrid ? snapToGrid(at, work, grid) : clampToDesktop(at, work, grid);
    setDesktopPositions({ [r.value]: p });
  }
  updateSurface(surface, { selected: [r.value], focused: r.value, anchor: r.value, renaming: r.value });
  announce('New Folder created. Type a name, then press Enter.');
  return r.value;
}

export function beginRename(surface: Surface, id: FolderId): void {
  if (!isUserFolder(get().fs, id)) return;
  updateSurface(surface, { selected: [id], focused: id, anchor: id, renaming: id });
}

/** Returns an error message (keeping the editor open) or null on success. */
export function commitRename(surface: Surface | null, id: FolderId, text: string): string | null {
  const s = get();
  const r = renameFolder(s.fs, id, text, now());
  if (!r.ok) return r.error.message;
  if (r.fs !== s.fs) {
    commitFs(r.fs, { label: 'Rename' });
    announce(`Renamed to ${r.value}.`);
  }
  if (surface) updateSurface(surface, { renaming: null, selected: [id], focused: id, anchor: id });
  return null;
}

export function cancelRename(surface: Surface): void {
  updateSurface(surface, { renaming: null });
}

// ---------------------------------------------------------------- clipboard

export function cutFolders(ids: readonly string[]): void {
  const s = get();
  const roots = normalizeSelection(s.fs, mutableIds(s, ids));
  if (!roots.length) return;
  set((st) => ({ ...st, clipboard: { mode: 'cut', ids: roots } }));
  announce(`${roots.length} folder${roots.length === 1 ? '' : 's'} cut. Choose Paste in the destination.`);
}

export function copyFolderIds(ids: readonly string[]): void {
  const s = get();
  const snapshot = snapshotFolders(s.fs, mutableIds(s, ids));
  if (!snapshot.roots.length) return;
  set((st) => ({ ...st, clipboard: { mode: 'copy', snapshot } }));
  announce(`${snapshot.roots.length} folder${snapshot.roots.length === 1 ? '' : 's'} copied.`);
}

type TransferSource = { mode: 'move'; ids: FolderId[] } | { mode: 'copy'; snapshot: FolderSnapshot };

/** Shared by Paste, drag and drop, and Move/Copy To Folder. Atomic; asks before keeping both on conflict. */
export async function transfer(source: TransferSource, destId: FolderId, surface?: Surface): Promise<FolderId[] | null> {
  let keepBoth = false;
  for (;;) {
    const s = get();
    const r =
      source.mode === 'move'
        ? moveFolders(s.fs, source.ids, destId, now(), { keepBoth })
        : copyFolders(s.fs, source.snapshot, destId, now(), { keepBoth });
    if (r.ok) {
      if (r.fs !== s.fs) {
        commitFs(r.fs, { label: source.mode === 'move' ? 'Move' : 'Copy' });
        const n = r.value.length;
        announce(`${n} folder${n === 1 ? '' : 's'} ${source.mode === 'move' ? 'moved' : 'copied'} to ${locationTitle(get().fs, LOC.folder(destId))}.`);
      }
      selectOn(surface, destId, r.value);
      return r.value;
    }
    if (r.error.code === 'conflict' && !keepBoth) {
      const choice = await ask({
        title: 'Confirm Folder Name Conflict',
        text: `${r.error.message} Do you want to keep both folders?`,
        detail: `Keep Both gives the ${source.mode === 'move' ? 'moved' : 'copied'} folder a numbered name, such as “${r.error.conflicts?.[0]} (2)”. Cancel makes no changes.`,
        icon: 'question',
        buttons: [
          { label: 'Keep Both', value: 'keep' },
          { label: 'Cancel', value: 'cancel' },
        ],
      });
      if (choice !== 'keep') return null;
      keepBoth = true;
      continue;
    }
    await showError(source.mode === 'move' ? 'Error Moving Folder' : 'Error Copying Folder', r.error.message);
    return null;
  }
}

export async function pasteInto(destId: FolderId | null, surface?: Surface): Promise<void> {
  const s = get();
  const clip = s.clipboard;
  if (!clip || !destId) return;
  if (!isWritable(s.fs, destId)) {
    await showError('Error Pasting', `You cannot paste into “${locationTitle(s.fs, LOC.folder(destId))}”. It is a read-only part of this simulation.`);
    return;
  }
  if (clip.mode === 'cut') {
    const moved = await transfer({ mode: 'move', ids: clip.ids }, destId, surface);
    if (moved) set((st) => (st.clipboard === clip ? { ...st, clipboard: null } : st));
  } else {
    await transfer({ mode: 'copy', snapshot: clip.snapshot }, destId, surface);
  }
}

/** Drag-and-drop: move by default, copy when Ctrl is held. */
export function dropFolders(ids: readonly string[], destId: FolderId, copy: boolean, surface?: Surface): void {
  const s = get();
  const usable = mutableIds(s, ids);
  if (!usable.length) return;
  if (copy) void transfer({ mode: 'copy', snapshot: snapshotFolders(s.fs, usable) }, destId, surface);
  else void transfer({ mode: 'move', ids: usable }, destId, surface);
}

export function browseForFolder(options: {
  title: string;
  prompt: string;
  okLabel: string;
  initial?: FolderId | null;
  validate?: (id: FolderId) => string | null;
}): Promise<FolderId | null> {
  return new Promise((resolve) => {
    pushModal({
      kind: 'browseFolder',
      title: options.title,
      prompt: options.prompt,
      okLabel: options.okLabel,
      initial: options.initial ?? null,
      validate: options.validate ?? (() => null),
      resolve,
      invoker: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      ownerWindowId: get().wm.activeId,
    });
  });
}

/** Keyboard/pointer alternative to dragging. */
export async function moveOrCopyTo(ids: readonly string[], mode: 'move' | 'copy', surface?: Surface): Promise<void> {
  const s = get();
  const roots = normalizeSelection(s.fs, mutableIds(s, ids));
  if (!roots.length) return;
  const label = roots.length === 1 ? `‘${nameOf(s, roots[0])}’` : 'the selected items';
  const verb = mode === 'move' ? 'Move' : 'Copy';
  const dest = await browseForFolder({
    title: `${verb} Items`,
    prompt: `Select the place where you want to ${mode} ${label}. Then click the ${verb} button.`,
    okLabel: verb,
    initial: s.fs.nodes[roots[0]]?.parentId ?? SEED_IDS.myDocuments,
    validate: (id) => (isWritable(get().fs, id) ? null : 'This folder is a read-only part of the simulation. Choose Desktop, My Documents or one of their folders.'),
  });
  if (!dest) return;
  if (mode === 'move') await transfer({ mode: 'move', ids: roots }, dest, surface);
  else await transfer({ mode: 'copy', snapshot: snapshotFolders(get().fs, roots) }, dest, surface);
}

// ---------------------------------------------------------------- delete / bin

export async function deleteFolders(ids: readonly string[], permanent: boolean): Promise<void> {
  const s = get();
  const roots = normalizeSelection(s.fs, mutableIds(s, ids));
  if (!roots.length) return;
  const single = roots.length === 1 ? nameOf(s, roots[0]) : null;
  const text = permanent
    ? single
      ? `Are you sure you want to permanently delete ‘${single}’ and all its contents? This cannot be undone.`
      : `Are you sure you want to permanently delete these ${roots.length} items and all their contents? This cannot be undone.`
    : single
      ? `Are you sure you want to send ‘${single}’ and all its contents to the Recycle Bin?`
      : `Are you sure you want to send these ${roots.length} items to the Recycle Bin?`;
  const choice = await ask({
    title: roots.length === 1 ? 'Confirm Folder Delete' : 'Confirm Multiple Folder Delete',
    text,
    icon: permanent ? 'warning' : 'question',
    buttons: YES_NO,
    focusIndex: 1,
    cancelValue: 'no',
  });
  if (choice !== 'yes') return;
  const current = get();
  const r = permanent ? deletePermanently(current.fs, roots, now()) : deleteToBin(current.fs, roots, now());
  if (!r.ok) {
    await showError('Error Deleting Folder', r.error.message);
    return;
  }
  commitFs(r.fs, permanent ? 'clear' : { label: 'Delete' });
  announce(permanent ? `${r.value.length} item${r.value.length === 1 ? '' : 's'} permanently deleted.` : `${r.value.length} item${r.value.length === 1 ? '' : 's'} moved to the Recycle Bin.`);
}

export async function restoreBinItems(rootIds: readonly FolderId[]): Promise<void> {
  let fallback = false;
  let keepBoth = false;
  for (;;) {
    const s = get();
    const r = restoreFromBin(s.fs, rootIds, now(), { fallbackToMyDocuments: fallback, keepBoth });
    if (r.ok) {
      commitFs(r.fs, 'clear');
      announce(`${r.value.length} item${r.value.length === 1 ? '' : 's'} restored.`);
      return;
    }
    if (r.error.code === 'missing-parent' && !fallback) {
      const choice = await ask({
        title: 'Restore',
        text: `${r.error.message} Do you want to restore it to My Documents instead?`,
        icon: 'question',
        buttons: [
          { label: 'Restore to My Documents', value: 'fallback' },
          { label: 'Cancel', value: 'cancel' },
        ],
        focusIndex: 1,
      });
      if (choice !== 'fallback') return;
      fallback = true;
      continue;
    }
    if (r.error.code === 'conflict' && !keepBoth) {
      const choice = await ask({
        title: 'Confirm Folder Name Conflict',
        text: `${r.error.message} Do you want to keep both folders?`,
        detail: 'Keep Both restores the folder with a numbered name. Cancel leaves it in the Recycle Bin.',
        icon: 'question',
        buttons: [
          { label: 'Keep Both', value: 'keep' },
          { label: 'Cancel', value: 'cancel' },
        ],
      });
      if (choice !== 'keep') return;
      keepBoth = true;
      continue;
    }
    await showError('Error Restoring Folder', r.error.message);
    return;
  }
}

export async function purgeBinItems(rootIds: readonly FolderId[]): Promise<void> {
  const s = get();
  const entries = rootIds.filter((id) => binEntry(s.fs, id));
  if (!entries.length) return;
  const choice = await ask({
    title: entries.length === 1 ? 'Confirm Folder Delete' : 'Confirm Multiple Folder Delete',
    text:
      entries.length === 1
        ? `Are you sure you want to permanently delete ‘${nameOf(s, entries[0])}’? This cannot be undone.`
        : `Are you sure you want to permanently delete these ${entries.length} items? This cannot be undone.`,
    icon: 'warning',
    buttons: YES_NO,
    focusIndex: 1,
    cancelValue: 'no',
  });
  if (choice !== 'yes') return;
  const r = purgeBinEntries(get().fs, entries);
  if (r.ok) {
    commitFs(r.fs, 'clear');
    announce('Items permanently deleted.');
  }
}

export async function emptyRecycleBin(): Promise<void> {
  const count = get().fs.bin.length;
  if (!count) return;
  const choice = await ask({
    title: count === 1 ? 'Confirm Folder Delete' : 'Confirm Multiple Folder Delete',
    text: `Are you sure you want to permanently delete ${count === 1 ? 'the item' : `all ${count} items`} in the Recycle Bin? This cannot be undone.`,
    icon: 'warning',
    buttons: YES_NO,
    focusIndex: 1,
    cancelValue: 'no',
  });
  if (choice !== 'yes') return;
  const r = emptyBin(get().fs);
  if (r.ok) {
    commitFs(r.fs, 'clear');
    announce('The Recycle Bin is empty.');
  }
}

// ---------------------------------------------------------------- undo

export function undoLabel(state: AppState): string | null {
  return state.undo ? `Undo ${state.undo.label}` : null;
}

/** One level of undo for the latest create/rename/move/copy/soft-delete. */
export function undoLast(): void {
  const s = get();
  const undo = s.undo;
  if (!undo) return;
  if (s.fs !== undo.after) {
    set((st) => ({ ...st, undo: null }));
    void showError('Undo', 'The last action can no longer be undone because the folders have changed since then.');
    return;
  }
  set((st) => reconcile({ ...st, fs: undo.before, undo: null }, st.fs));
  announce(`${undo.label} undone.`);
}

// ---------------------------------------------------------------- desktop positions

export function setDesktopPositions(patch: Record<string, Point>): void {
  set((s) => ({
    ...s,
    prefs: { ...s.prefs, desktop: { ...s.prefs.desktop, positions: { ...s.prefs.desktop.positions, ...patch } } },
  }));
}

export function selectAllOn(surface: Surface): void {
  const s = get();
  const items = surfaceItems(s, surface);
  const current = surfaceState(s, surface);
  updateSurface(surface, {
    selected: items.map((i) => i.key),
    anchor: items[0]?.key ?? null,
    focused: current?.focused ?? items[0]?.key ?? null,
  });
}

export function invertSelectionOn(surface: Surface): void {
  const s = get();
  const current = surfaceState(s, surface);
  const selected = new Set(current?.selected ?? []);
  const next = surfaceItems(s, surface)
    .map((i) => i.key)
    .filter((k) => !selected.has(k));
  updateSurface(surface, { selected: next, anchor: next[0] ?? null, focused: next[0] ?? current?.focused ?? null });
}
