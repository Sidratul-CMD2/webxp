import type { PointerEvent as RPointerEvent } from 'react';
import { SEED_IDS, isSelfOrDescendant, isLive, type FolderId } from '../domain/fs';
import { get } from '../state/app';
import type { Surface } from '../state/explorerActions';
import { deleteFolders, dropFolders } from '../state/folderActions';
import { iconUrl, type IconName } from '../ui/icons';

export const DRAG_THRESHOLD = 4;

interface DragOptions {
  event: PointerEvent | RPointerEvent;
  /** User folders carried by the drag (may be empty for shell icons). */
  ids: FolderId[];
  count: number;
  icon: IconName;
  source: Surface;
  /** Desktop icons dropped on blank desktop are repositioned by the desktop. */
  onDesktopDrop?: (dx: number, dy: number) => void;
  onClickWithoutDrag?: () => void;
}

interface Session extends Omit<DragOptions, 'event'> {
  startX: number;
  startY: number;
  pointerId: number;
  moved: boolean;
  ghost: HTMLElement | null;
  target: HTMLElement | null;
  cleanup: () => void;
}

let session: Session | null = null;

export function isDragging(): boolean {
  return !!session?.moved;
}

function findTarget(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  return el instanceof Element ? (el.closest('[data-drop-folder],[data-drop-bin],[data-drop-desktop]') as HTMLElement | null) : null;
}

function validFolderTarget(s: Session, folderId: string): boolean {
  const fs = get().fs;
  if (!isLive(fs, folderId) || s.ids.length === 0) return false;
  return !s.ids.some((id) => isLive(fs, id) && isSelfOrDescendant(fs, folderId, id));
}

function makeGhost(s: Session): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.src = iconUrl(s.icon);
  img.width = 32;
  img.height = 32;
  img.alt = '';
  ghost.appendChild(img);
  if (s.count > 1) {
    const badge = document.createElement('span');
    badge.className = 'drag-ghost__count';
    badge.textContent = String(s.count);
    ghost.appendChild(badge);
  }
  const mode = document.createElement('span');
  mode.className = 'drag-ghost__mode';
  ghost.appendChild(mode);
  document.body.appendChild(ghost);
  return ghost;
}

function setTarget(s: Session, target: HTMLElement | null) {
  if (s.target === target) return;
  s.target?.classList.remove('is-drop-target');
  s.target = target;
  target?.classList.add('is-drop-target');
}

function finish(commit: boolean, e?: PointerEvent) {
  const s = session;
  if (!s) return;
  session = null;
  s.cleanup();
  setTarget(s, null);
  s.ghost?.remove();
  document.documentElement.classList.remove('is-dragging-items');
  if (!commit) return;
  if (!s.moved) {
    s.onClickWithoutDrag?.();
    return;
  }
  const x = e?.clientX ?? s.startX;
  const y = e?.clientY ?? s.startY;
  const target = findTarget(x, y);
  if (!target) return;
  const copy = !!(e && (e.ctrlKey || e.metaKey));
  if (target.dataset.dropBin !== undefined) {
    if (s.ids.length) void deleteFolders(s.ids, false);
    return;
  }
  const folder = target.dataset.dropFolder;
  if (folder) {
    if (validFolderTarget(s, folder)) dropFolders(s.ids, folder, copy, s.source);
    else if (s.ids.length && !s.ids.includes(folder)) dropFolders(s.ids, folder, copy, s.source);
    return;
  }
  if (target.dataset.dropDesktop !== undefined) {
    if (s.source.kind === 'desktop' && !copy) s.onDesktopDrop?.(x - s.startX, y - s.startY);
    else if (s.ids.length) dropFolders(s.ids, SEED_IDS.desktop, copy, s.source);
  }
}

/** Starts tracking a possible item drag; becomes a drag after the movement threshold. */
export function beginItemDrag(options: DragOptions): void {
  if (session) finish(false);
  const { event, ...rest } = options;
  const onMove = (e: PointerEvent) => {
    const s = session;
    if (!s || e.pointerId !== s.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!s.moved) {
      s.moved = true;
      s.ghost = makeGhost(s);
      document.documentElement.classList.add('is-dragging-items');
    }
    if (s.ghost) {
      s.ghost.style.transform = `translate(${e.clientX - 16}px, ${e.clientY - 16}px)`;
      s.ghost.classList.toggle('is-copy', e.ctrlKey || e.metaKey);
    }
    const target = findTarget(e.clientX, e.clientY);
    const folder = target?.dataset.dropFolder;
    const ok =
      !!target &&
      (target.dataset.dropBin !== undefined
        ? s.ids.length > 0
        : folder
          ? validFolderTarget(s, folder)
          : s.source.kind === 'desktop'
            ? !(e.ctrlKey || e.metaKey)
            : s.ids.length > 0);
    setTarget(s, ok ? target : null);
    s.ghost?.classList.toggle('is-blocked', !ok);
  };
  const onUp = (e: PointerEvent) => {
    if (session && e.pointerId === session.pointerId) finish(true, e);
  };
  const onCancel = () => finish(false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && session) {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('blur', onCancel);
  window.addEventListener('keydown', onKey, true);
  session = {
    ...rest,
    startX: event.clientX,
    startY: event.clientY,
    pointerId: event.pointerId,
    moved: false,
    ghost: null,
    target: null,
    cleanup: () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
      window.removeEventListener('keydown', onKey, true);
    },
  };
}

export function cancelItemDrag(): void {
  finish(false);
}
