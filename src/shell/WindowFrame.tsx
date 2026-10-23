import { useCallback, useEffect, useId, useLayoutEffect, useRef, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import type { Rect } from '../domain/windows';
import { APP_SPECS } from '../state/appSpecs';
import { focusWindowSoon, get, isCompact, openMenu, rememberFocus, set, useApp, workArea } from '../state/app';
import { activateWindow, closeWindow, launch, minimizeWindow, setWindowBounds, toggleMaximizeWindow, windowIcon, windowTitle } from '../state/windowActions';
import { Icon } from '../ui/icons';
import { systemMenuItems } from './systemMenu';

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
type Handle = (typeof HANDLES)[number];
const DRAG_THRESHOLD = 3;
const KEY_STEP = 10;

interface DragState {
  kind: 'move' | 'resize';
  dir: Handle | null;
  startX: number;
  startY: number;
  start: Rect;
  pending: Rect | null;
  frame: number | null;
  moved: boolean;
  el: HTMLElement;
  pointerId: number;
  finished: boolean;
}

function CaptionGlyph({ kind }: { kind: 'min' | 'max' | 'restore' | 'close' | 'help' }) {
  switch (kind) {
    case 'min':
      return (
        <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
          <rect x="5" y="13" width="7" height="3" fill="#fff" />
        </svg>
      );
    case 'max':
      return (
        <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
          <path d="M5 5h11v11H5z M6 8v7h9V8z" fill="#fff" fillRule="evenodd" />
        </svg>
      );
    case 'restore':
      return (
        <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
          <path d="M8 4h9v9h-2V7H8z" fill="#fff" />
          <path d="M4 8h9v9H4z M5 10.5v5.5h7v-5.5z" fill="#fff" fillRule="evenodd" />
        </svg>
      );
    case 'close':
      return (
        <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
          <path d="M5.5 5.5l10 10M15.5 5.5l-10 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="square" />
        </svg>
      );
    case 'help':
      return (
        <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
          <path d="M7.5 7.8c0-1.9 1.4-3 3.2-3 1.9 0 3.2 1.1 3.2 2.7 0 1.3-.8 1.9-1.6 2.5-.8.6-1 .9-1 1.8v.4H9.4v-.6c0-1.3.5-2 1.4-2.6.7-.5 1-.8 1-1.4 0-.6-.5-1.1-1.2-1.1-.8 0-1.2.5-1.3 1.3z" fill="#fff" />
          <rect x="9.3" y="13.4" width="2.2" height="2.2" fill="#fff" />
        </svg>
      );
  }
}

interface CapButtonProps {
  kind: 'min' | 'max' | 'restore' | 'close' | 'help';
  label: string;
  tip: string;
  disabledReason?: string;
  onClick: () => void;
}

function CapButton({ kind, label, tip, disabledReason, onClick }: CapButtonProps) {
  return (
    <button
      type="button"
      className={`xp-cap xp-cap--${kind}${disabledReason ? ' is-disabled' : ''}`}
      aria-label={label}
      aria-disabled={disabledReason ? true : undefined}
      data-tip={disabledReason ? `${tip} — ${disabledReason}` : tip}
      onClick={() => {
        if (!disabledReason) onClick();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <CaptionGlyph kind={kind} />
    </button>
  );
}

function resizeRect(start: Rect, dir: Handle, dx: number, dy: number, min: { w: number; h: number }, work: Rect): Rect {
  let { x, y, w, h } = start;
  if (dir.includes('e')) w = Math.max(min.w, Math.min(start.w + dx, work.x + work.w - start.x));
  if (dir.includes('s')) h = Math.max(min.h, Math.min(start.h + dy, work.y + work.h - start.y));
  if (dir.includes('w')) {
    w = Math.max(min.w, start.w - dx);
    x = start.x + start.w - w;
  }
  if (dir.includes('n')) {
    h = Math.max(min.h, start.h - dy);
    y = start.y + start.h - h;
    if (y < work.y) {
      h = Math.max(min.h, h - (work.y - y));
      y = work.y;
    }
  }
  return { x, y, w, h };
}

const HELP_TOPICS: Partial<Record<string, string>> = {
  display: 'settings',
  taskbarProps: 'taskbar',
  sounds: 'settings',
  dateTime: 'settings',
  accessibility: 'accessibility',
  folderOptions: 'folders',
  folderProps: 'folders',
};

export function WindowFrame({ id, children }: { id: string; children: ReactNode }) {
  const win = useApp((s) => s.wm.windows[id]);
  const active = useApp((s) => s.wm.activeId === id);
  const z = useApp((s) => s.wm.order.indexOf(id));
  const title = useApp((s) => windowTitle(s, id));
  const icon = useApp((s) => windowIcon(s, id));
  const compact = useApp(isCompact);
  const work = useApp(workArea);
  const moveSize = useApp((s) => (s.moveSize?.windowId === id ? s.moveSize : null));
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<DragState | null>(null);
  const titleId = useId();

  const spec = APP_SPECS[win.appId];
  const filled = compact || win.maximized;
  const rect: Rect = filled ? work : moveSize ? moveSize.current : win.bounds;

  const applyRect = useCallback((r: Rect) => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
  }, []);

  const endDrag = useCallback(
    (commit: boolean) => {
      const d = drag.current;
      if (!d || d.finished) return;
      d.finished = true;
      if (d.frame !== null) cancelAnimationFrame(d.frame);
      if (d.el.hasPointerCapture(d.pointerId)) d.el.releasePointerCapture(d.pointerId);
      drag.current = null;
      document.documentElement.classList.remove('is-dragging-window');
      if (commit && d.moved && d.pending) setWindowBounds(id, d.pending);
      const current = get().wm.windows[id];
      if (current && !current.maximized && !isCompact(get())) applyRect(current.bounds);
    },
    [applyRect, id],
  );

  // Cancel cleanly on Escape or window blur during a pointer drag.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (drag.current && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        endDrag(false);
      }
    };
    const onBlur = () => endDrag(false);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
      endDrag(false);
    };
  }, [endDrag]);

  const beginPointer = (e: RPointerEvent<HTMLElement>, kind: 'move' | 'resize', dir: Handle | null) => {
    if (e.button !== 0 || filled) return;
    if (kind === 'resize' && !win.resizable) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    drag.current = {
      kind,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      start: win.bounds,
      pending: null,
      frame: null,
      moved: false,
      el,
      pointerId: e.pointerId,
      finished: false,
    };
  };

  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    if (!d.moved) document.documentElement.classList.add('is-dragging-window');
    d.moved = true;
    const w = workArea(get());
    d.pending =
      d.kind === 'move'
        ? { ...d.start, x: d.start.x + dx, y: Math.min(Math.max(w.y, d.start.y + dy), w.y + w.h - 30) }
        : resizeRect(d.start, d.dir!, dx, dy, win.minSize, w);
    if (d.frame === null) {
      d.frame = requestAnimationFrame(() => {
        d.frame = null;
        if (d.pending && !d.finished) applyRect(d.pending);
      });
    }
  };

  const pointerHandlers = {
    onPointerMove,
    onPointerUp: (e: RPointerEvent<HTMLElement>) => {
      if (drag.current?.pointerId === e.pointerId) endDrag(true);
    },
    onPointerCancel: () => endDrag(false),
    onLostPointerCapture: () => endDrag(false),
  };

  const openSystemMenu = (anchor: { x: number; y: number } | DOMRect, keyboard: boolean, invoker: HTMLElement | null) => {
    activateWindow(id, false);
    openMenu({
      kind: 'menu',
      items: systemMenuItems(id),
      anchor: 'x' in anchor && !('width' in anchor) ? { type: 'point', x: anchor.x, y: anchor.y } : { type: 'rect', rect: anchor as DOMRect, placement: 'below' },
      ownerWindowId: id,
      invoker,
      keyboard,
      label: `System menu for ${title}`,
    });
  };

  // Keyboard Move/Size from the system menu captures the keyboard (as XP does):
  // arrows adjust, Enter commits, Escape rolls back.
  // Registered in a layout effect so arrow keys pressed immediately after
  // choosing Move/Size are captured (a passive effect could miss them).
  const moving = !!moveSize;
  useLayoutEffect(() => {
    if (!moving) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const ms = get().moveSize;
      const current = get().wm.windows[id];
      if (!ms || ms.windowId !== id || !current) return;
      const step = e.ctrlKey ? 1 : KEY_STEP;
      const r = { ...ms.current };
      const edges = { ...ms.edges };
      const w = workArea(get());
      if (e.key === 'Enter') {
        setWindowBounds(id, r);
        set((s) => ({ ...s, moveSize: null }));
      } else if (e.key === 'Escape') {
        set((s) => ({ ...s, moveSize: null }));
      } else if (e.key.startsWith('Arrow')) {
        const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
        const sign = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
        if (ms.mode === 'move') {
          if (horizontal) r.x += sign * step;
          else r.y = Math.min(Math.max(w.y, r.y + sign * step), w.y + w.h - 30);
        } else if (horizontal) {
          edges.h ??= sign < 0 ? 'left' : 'right';
          if (edges.h === 'right') r.w = Math.max(current.minSize.w, r.w + sign * step);
          else {
            const nw = Math.max(current.minSize.w, r.w - sign * step);
            r.x += r.w - nw;
            r.w = nw;
          }
        } else {
          edges.v ??= sign < 0 ? 'top' : 'bottom';
          if (edges.v === 'bottom') r.h = Math.max(current.minSize.h, r.h + sign * step);
          else {
            const nh = Math.max(current.minSize.h, r.h - sign * step);
            r.y += r.h - nh;
            r.h = nh;
          }
        }
        set((s) => (s.moveSize ? { ...s, moveSize: { ...s.moveSize, current: r, edges } } : s));
      } else if (e.key !== 'Shift' && e.key !== 'Control') {
        // Any other key finishes the operation where it is.
        setWindowBounds(id, r);
        set((s) => ({ ...s, moveSize: null }));
        return;
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    const onPointer = () => {
      const ms = get().moveSize;
      if (ms?.windowId === id) {
        setWindowBounds(id, ms.current);
        set((s) => ({ ...s, moveSize: null }));
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [moving, id]);

  const hidden = win.minimized;
  const caps = spec.dialog ? (
    <>
      <CapButton kind="help" label={`Help for ${title}`} tip="Help" onClick={() => launch({ app: 'help', topic: HELP_TOPICS[win.appId] ?? 'home' })} />
      <CapButton kind="close" label={`Close ${title}`} tip="Close" onClick={() => closeWindow(id)} />
    </>
  ) : (
    <>
      <CapButton kind="min" label={`Minimize ${title}`} tip="Minimize" onClick={() => minimizeWindow(id)} />
      <CapButton
        kind={win.maximized ? 'restore' : 'max'}
        label={`${win.maximized ? 'Restore' : 'Maximize'} ${title}`}
        tip={win.maximized ? 'Restore Down' : 'Maximize'}
        disabledReason={!win.resizable ? 'this window has a fixed size' : compact ? 'windows fill the screen in compact mode' : undefined}
        onClick={() => toggleMaximizeWindow(id)}
      />
      <CapButton kind="close" label={`Close ${title}`} tip="Close" onClick={() => closeWindow(id)} />
    </>
  );

  return (
    <section
      ref={ref}
      data-window-id={id}
      data-app={win.appId}
      role="region"
      aria-labelledby={titleId}
      aria-roledescription="window"
      tabIndex={-1}
      hidden={hidden}
      className={`xp-window${active ? ' is-active' : ' is-inactive'}${filled ? ' is-filled' : ''}${spec.dialog ? ' xp-window--dialog' : ''}${moveSize ? ' is-move-size' : ''}`}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: 10 + Math.max(0, z) }}
      onPointerDownCapture={() => {
        if (!active) {
          activateWindow(id, false);
          setTimeout(() => {
            if (ref.current && !ref.current.contains(document.activeElement)) focusWindowSoon(id);
          }, 0);
        }
      }}
      onFocusCapture={(e) => {
        if (e.target instanceof HTMLElement && e.target !== ref.current) rememberFocus(id, e.target);
        if (!get().wm.windows[id]?.minimized && get().wm.activeId !== id) activateWindow(id, false);
      }}
    >
      <div
        className="xp-window__titlebar"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          beginPointer(e, 'move', null);
        }}
        {...pointerHandlers}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          if (win.resizable && !compact) toggleMaximizeWindow(id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          openSystemMenu({ x: e.clientX, y: e.clientY }, false, ref.current);
        }}
      >
        <button
          type="button"
          className="xp-window__sysicon"
          aria-label={`System menu for ${title}`}
          aria-haspopup="menu"
          onClick={(e) => openSystemMenu(e.currentTarget.getBoundingClientRect(), e.detail === 0, e.currentTarget)}
          onDoubleClick={() => closeWindow(id)}
        >
          <Icon name={icon} size={16} />
        </button>
        <h2 id={titleId} className="xp-window__title">
          {title}
        </h2>
        <div className="xp-window__caps">{caps}</div>
      </div>
      <div className="xp-window__body">{children}</div>
      {win.resizable &&
        !filled &&
        HANDLES.map((dir) => (
          <div
            key={dir}
            aria-hidden="true"
            className={`xp-resize xp-resize--${dir}`}
            onPointerDown={(e) => beginPointer(e, 'resize', dir)}
            {...pointerHandlers}
          />
        ))}
      {moveSize && (
        <div className="xp-window__movesize" role="status">
          {moveSize.mode === 'move' ? 'Moving: use the arrow keys, then press Enter. Esc cancels.' : 'Sizing: use the arrow keys, then press Enter. Esc cancels.'}
        </div>
      )}
    </section>
  );
}
