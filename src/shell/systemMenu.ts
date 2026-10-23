import { APP_SPECS } from '../state/appSpecs';
import { get, isCompact, set } from '../state/app';
import type { MenuEntry } from '../state/types';
import { closeWindow, maximizeWindow, minimizeWindow, restoreWindow } from '../state/windowActions';

const COMPACT_REASON = 'Windows fill the screen in compact mode.';

/** Restore, Move, Size, Minimize, Maximize, Close — enabled according to state. */
export function systemMenuItems(windowId: string): MenuEntry[] {
  const s = get();
  const win = s.wm.windows[windowId];
  if (!win) return [];
  const spec = APP_SPECS[win.appId];
  const compact = isCompact(s);
  const canRestore = win.minimized || win.maximized;
  return [
    { id: 'restore', label: '&Restore', disabled: canRestore ? false : 'The window is already restored.', run: () => restoreWindow(windowId) },
    {
      id: 'move',
      label: '&Move',
      disabled: compact ? COMPACT_REASON : win.maximized ? 'A maximized window cannot be moved.' : win.minimized ? 'Restore the window first.' : false,
      run: () => beginMoveSize(windowId, 'move'),
    },
    {
      id: 'size',
      label: '&Size',
      disabled: compact
        ? COMPACT_REASON
        : !win.resizable
          ? 'This window has a fixed size.'
          : win.maximized
            ? 'A maximized window cannot be resized.'
            : win.minimized
              ? 'Restore the window first.'
              : false,
      run: () => beginMoveSize(windowId, 'size'),
    },
    {
      id: 'min',
      label: 'Mi&nimize',
      disabled: spec.dialog ? 'This dialog cannot be minimized.' : win.minimized ? 'The window is already minimized.' : false,
      run: () => minimizeWindow(windowId),
    },
    {
      id: 'max',
      label: 'Ma&ximize',
      disabled: !win.resizable ? 'This window has a fixed size.' : win.maximized && !win.minimized ? 'The window is already maximized.' : false,
      run: () => maximizeWindow(windowId),
    },
    { kind: 'separator', id: 'sep' },
    { id: 'close', label: '&Close', bold: true, run: () => closeWindow(windowId) },
  ];
}

export function beginMoveSize(windowId: string, mode: 'move' | 'size'): void {
  const s = get();
  const win = s.wm.windows[windowId];
  if (!win || win.maximized || win.minimized || isCompact(s)) return;
  if (mode === 'size' && !win.resizable) return;
  set((st) => ({ ...st, moveSize: { windowId, mode, original: win.bounds, current: win.bounds, edges: { h: null, v: null } } }));
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-window-id="${windowId}"]`)?.focus());
}
