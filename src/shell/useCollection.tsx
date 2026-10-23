import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as RFocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as RPointerEvent,
  type RefObject,
} from 'react';
import { announce, get, openMenu, useApp } from '../state/app';
import { folderCommands, selectedItems } from '../state/commands';
import { openItem, surfaceState, updateSurface, type Surface } from '../state/explorerActions';
import { cancelRename, commitRename } from '../state/folderActions';
import type { ViewItem } from '../state/items';
import type { DesktopState } from '../state/types';
import { backgroundContextMenu, itemContextMenu } from './contextMenus';
import { beginItemDrag } from './dnd';

type Dir = 'left' | 'right' | 'up' | 'down';

const EMPTY: DesktopState = { selected: [], focused: null, anchor: null, renaming: null };

function itemEl(container: HTMLElement | null, key: string): HTMLElement | null {
  return container?.querySelector<HTMLElement>(`[data-item-key="${CSS.escape(key)}"]`) ?? null;
}

/** Layout-aware neighbor: nearest item in the arrow's direction, by on-screen geometry. */
function neighbor(container: HTMLElement | null, fromKey: string, dir: Dir): string | null {
  if (!container) return null;
  const els = [...container.querySelectorAll<HTMLElement>('[data-item-key]')];
  const from = els.find((e) => e.dataset.itemKey === fromKey);
  if (!from) return null;
  const fr = from.getBoundingClientRect();
  const fx = fr.left + fr.width / 2;
  const fy = fr.top + fr.height / 2;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const el of els) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - fx;
    const dy = r.top + r.height / 2 - fy;
    let primary: number;
    let secondary: number;
    if (dir === 'right') [primary, secondary] = [dx, Math.abs(dy)];
    else if (dir === 'left') [primary, secondary] = [-dx, Math.abs(dy)];
    else if (dir === 'down') [primary, secondary] = [dy, Math.abs(dx)];
    else [primary, secondary] = [-dy, Math.abs(dx)];
    if (primary <= 2) continue;
    const score = primary + secondary * 3;
    if (score < bestScore) {
      bestScore = score;
      best = el.dataset.itemKey ?? null;
    }
  }
  return best;
}

const LONG_PRESS_MS = 550;

interface CollectionOptions {
  surface: Surface;
  /** Items in visual order. */
  items: ViewItem[];
  containerRef: RefObject<HTMLElement | null>;
  label: string;
  onBackspace?: () => void;
  /** Desktop: icons can be repositioned by dropping on blank desktop. */
  onReposition?: (keys: string[], dx: number, dy: number) => void;
}

export function useCollection({ surface, items, containerRef, label, onBackspace, onReposition }: CollectionOptions) {
  const sel = useApp((s) => surfaceState(s, surface) ?? EMPTY);
  const selected = useMemo(() => new Set(sel.selected), [sel.selected]);
  const keys = useMemo(() => items.map((i) => i.key), [items]);
  const focusedKey = sel.focused && keys.includes(sel.focused) ? sel.focused : null;
  const tabKey = focusedKey ?? keys[0] ?? null;
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const marqueeBase = useRef<string[]>([]);
  const marqueeFrame = useRef<number | null>(null);
  const pendingFocus = useRef(false);
  // Separate timers: the container's pointerup must not cancel an item's pending tap/long-press.
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgLongPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingFocus.current && focusedKey) {
      pendingFocus.current = false;
      const el = itemEl(containerRef.current, focusedKey);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focusedKey, containerRef, sel]);

  const setSel = (patch: Partial<DesktopState>) => updateSurface(surface, patch);

  const range = (a: string, b: string) => {
    const i = keys.indexOf(a);
    const j = keys.indexOf(b);
    if (i < 0 || j < 0) return [b];
    return keys.slice(Math.min(i, j), Math.max(i, j) + 1);
  };

  const moveTo = (key: string, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    pendingFocus.current = true;
    const mod = e.ctrlKey || e.metaKey;
    if (e.shiftKey) {
      const anchor = sel.anchor && keys.includes(sel.anchor) ? sel.anchor : (focusedKey ?? key);
      const r = range(anchor, key);
      setSel({ selected: mod ? [...new Set([...sel.selected, ...r])] : r, focused: key, anchor });
    } else if (mod) {
      setSel({ focused: key });
    } else {
      setSel({ selected: [key], focused: key, anchor: key });
    }
    if (focusedKey === key) itemEl(containerRef.current, key)?.focus();
  };

  const openSelection = () => {
    const s = get();
    const chosen = selectedItems(s, surface);
    if (chosen.length === 1) openItem(surface, chosen[0]);
    else if (chosen.length === 0 && focusedKey) {
      const item = items.find((i) => i.key === focusedKey);
      if (item) openItem(surface, item);
    } else if (chosen.length > 1) {
      announce('Several items are selected. Choose Open from the File menu or the context menu to open each in its own window.');
    }
  };

  const showItemMenu = (at: { x: number; y: number } | null, invoker: HTMLElement | null) => {
    const entries = itemContextMenu(surface);
    if (!entries.length) return;
    const rect = invoker?.getBoundingClientRect();
    openMenu({
      kind: 'menu',
      items: entries,
      anchor: at ? { type: 'point', ...at } : { type: 'point', x: (rect?.left ?? 0) + 16, y: (rect?.top ?? 0) + 16 },
      ownerWindowId: surface.kind === 'explorer' ? surface.windowId : null,
      invoker,
      keyboard: !at,
      label: 'Item menu',
    });
  };

  const showBackgroundMenu = (at: { x: number; y: number } | null, invoker: HTMLElement | null) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const point = at ?? { x: (rect?.left ?? 0) + 24, y: (rect?.top ?? 0) + 24 };
    openMenu({
      kind: 'menu',
      items: backgroundContextMenu(surface, at ?? undefined),
      anchor: { type: 'point', ...point },
      ownerWindowId: surface.kind === 'explorer' ? surface.windowId : null,
      invoker,
      keyboard: !at,
      label: surface.kind === 'desktop' ? 'Desktop menu' : 'Folder background menu',
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    if (e.altKey) return;
    const mod = e.ctrlKey || e.metaKey;
    const c = () => folderCommands(get(), surface);
    const arrows: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    let handled = true;
    if (arrows[e.key]) {
      if (!keys.length) return;
      const next = focusedKey ? neighbor(containerRef.current, focusedKey, arrows[e.key]) : keys[0];
      if (next) moveTo(next, e);
    } else if (e.key === 'Home' || e.key === 'End') {
      if (!keys.length) return;
      moveTo(e.key === 'Home' ? keys[0] : keys[keys.length - 1], e);
    } else if (e.key === ' ' && !e.shiftKey) {
      const key = focusedKey ?? keys[0];
      if (!key) return;
      if (mod) setSel({ selected: selected.has(key) ? sel.selected.filter((k) => k !== key) : [...sel.selected, key], focused: key, anchor: key });
      else setSel({ selected: [key], focused: key, anchor: key });
    } else if (e.key === 'Enter' && !mod) {
      openSelection();
    } else if (mod && (e.key === 'a' || e.key === 'A')) {
      c().selectAll.run();
    } else if (e.key === 'F2') {
      c().rename.run();
    } else if (e.key === 'Delete') {
      if (e.shiftKey) c().deletePermanently.run();
      else c().delete.run();
    } else if (mod && !e.shiftKey && (e.key === 'c' || e.key === 'C')) {
      c().copy.run();
    } else if (mod && !e.shiftKey && (e.key === 'x' || e.key === 'X')) {
      c().cut.run();
    } else if (mod && !e.shiftKey && (e.key === 'v' || e.key === 'V')) {
      c().paste.run();
    } else if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      c().undo.run();
    } else if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
      if (sel.selected.length) showItemMenu(null, (focusedKey && itemEl(containerRef.current, focusedKey)) || (e.currentTarget as HTMLElement));
      else showBackgroundMenu(null, e.currentTarget as HTMLElement);
    } else if (e.key === 'Backspace' && onBackspace) {
      onBackspace();
    } else if (e.key.length === 1 && /\S/.test(e.key) && !mod) {
      const k = e.key.toLowerCase();
      const start = focusedKey ? keys.indexOf(focusedKey) : -1;
      const ordered = [...items.slice(start + 1), ...items.slice(0, start + 1)];
      const hit = ordered.find((i) => i.name.toLowerCase().startsWith(k));
      if (hit) moveTo(hit.key, { shiftKey: false, ctrlKey: false, metaKey: false });
      else handled = false;
    } else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const clearLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  };

  const clearBgLongPress = () => {
    if (bgLongPress.current) clearTimeout(bgLongPress.current);
    bgLongPress.current = null;
  };

  const itemProps = (item: ViewItem) => ({
    'data-item-key': item.key,
    role: 'option' as const,
    'aria-selected': selected.has(item.key),
    tabIndex: item.key === tabKey ? 0 : -1,
    onFocus: (e: RFocusEvent<HTMLElement>) => {
      if (e.target === e.currentTarget && sel.focused !== item.key) setSel({ focused: item.key });
    },
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('input')) return;
      if (e.button !== 0) return;
      const mod = e.ctrlKey || e.metaKey;
      const touch = e.pointerType === 'touch';
      if (mod) {
        setSel({
          selected: selected.has(item.key) ? sel.selected.filter((k) => k !== item.key) : [...sel.selected, item.key],
          focused: item.key,
          anchor: item.key,
        });
        return;
      }
      if (e.shiftKey) {
        moveTo(item.key, e);
        return;
      }
      const wasSelected = selected.has(item.key);
      const groupKeys = wasSelected ? sel.selected : [item.key];
      if (!wasSelected) setSel({ selected: [item.key], focused: item.key, anchor: item.key, renaming: null });
      else if (sel.focused !== item.key) setSel({ focused: item.key });
      if (touch) {
        const at = { x: e.clientX, y: e.clientY };
        const el = e.currentTarget;
        clearLongPress();
        longPress.current = setTimeout(() => {
          longPress.current = null;
          showItemMenu(at, el);
        }, LONG_PRESS_MS);
        const startX = e.clientX;
        const startY = e.clientY;
        const cancel = (ev: PointerEvent) => {
          if (ev.type !== 'pointermove' || Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
            const pending = !!longPress.current;
            clearLongPress();
            window.removeEventListener('pointermove', cancel);
            window.removeEventListener('pointerup', cancel);
            window.removeEventListener('pointercancel', cancel);
            // Touch adaptation: tapping an already-selected single item opens it.
            if (ev.type === 'pointerup' && pending && wasSelected && sel.selected.length === 1) openItem(surface, item);
          }
        };
        window.addEventListener('pointermove', cancel);
        window.addEventListener('pointerup', cancel);
        window.addEventListener('pointercancel', cancel);
        return;
      }
      const groupItems = items.filter((i) => groupKeys.includes(i.key));
      const ids = groupItems.filter((i) => i.mutable).map((i) => i.id);
      if (ids.length || onReposition) {
        beginItemDrag({
          event: e,
          ids,
          count: groupKeys.length,
          icon: item.icon,
          source: surface,
          onDesktopDrop: onReposition ? (dx, dy) => onReposition(groupKeys, dx, dy) : undefined,
          onClickWithoutDrag: wasSelected ? () => setSel({ selected: [item.key], focused: item.key, anchor: item.key }) : undefined,
        });
      }
    },
    onDoubleClick: (e: MouseEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('input')) return;
      openItem(surface, item);
    },
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      clearLongPress();
      if (!selected.has(item.key)) setSel({ selected: [item.key], focused: item.key, anchor: item.key });
      showItemMenu({ x: e.clientX, y: e.clientY }, e.currentTarget);
    },
  });

  const updateMarquee = (rect: { x0: number; y0: number; x1: number; y1: number }, additive: boolean) => {
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const left = Math.min(rect.x0, rect.x1) + cr.left - container.scrollLeft;
    const right = Math.max(rect.x0, rect.x1) + cr.left - container.scrollLeft;
    const top = Math.min(rect.y0, rect.y1) + cr.top - container.scrollTop;
    const bottom = Math.max(rect.y0, rect.y1) + cr.top - container.scrollTop;
    const hits: string[] = [];
    for (const el of container.querySelectorAll<HTMLElement>('[data-item-key]')) {
      const target = el.querySelector<HTMLElement>('[data-hit]') ?? el;
      const r = target.getBoundingClientRect();
      if (r.right >= left && r.left <= right && r.bottom >= top && r.top <= bottom) hits.push(el.dataset.itemKey!);
    }
    const base = marqueeBase.current;
    const next = additive ? [...base.filter((k) => !hits.includes(k)), ...hits.filter((k) => !base.includes(k))] : hits;
    setSel({ selected: next, anchor: next[0] ?? null, focused: next[next.length - 1] ?? sel.focused });
  };

  const containerProps = {
    role: 'listbox' as const,
    'aria-multiselectable': true,
    'aria-label': label,
    tabIndex: keys.length ? -1 : 0,
    onKeyDown,
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('[data-item-key], input, button, a')) return;
      if (e.button !== 0) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) setSel({ selected: [], anchor: null });
      if (e.pointerType === 'touch') {
        const at = { x: e.clientX, y: e.clientY };
        const el = e.currentTarget;
        clearBgLongPress();
        bgLongPress.current = setTimeout(() => showBackgroundMenu(at, el), LONG_PRESS_MS);
        return;
      }
      const container = e.currentTarget;
      const cr = container.getBoundingClientRect();
      const x = e.clientX - cr.left + container.scrollLeft;
      const y = e.clientY - cr.top + container.scrollTop;
      marqueeBase.current = mod ? sel.selected : [];
      container.setPointerCapture(e.pointerId);
      container.focus({ preventScroll: true });
      setMarquee({ x0: x, y0: y, x1: x, y1: y });
    },
    onPointerMove: (e: RPointerEvent<HTMLElement>) => {
      if (!marquee) return;
      const container = e.currentTarget;
      const cr = container.getBoundingClientRect();
      const next = { ...marquee, x1: e.clientX - cr.left + container.scrollLeft, y1: e.clientY - cr.top + container.scrollTop };
      setMarquee(next);
      if (marqueeFrame.current === null) {
        const additive = e.ctrlKey || e.metaKey;
        marqueeFrame.current = requestAnimationFrame(() => {
          marqueeFrame.current = null;
          updateMarquee(next, additive);
        });
      }
    },
    onPointerUp: () => {
      clearBgLongPress();
      setMarquee(null);
    },
    onPointerCancel: () => {
      clearBgLongPress();
      setMarquee(null);
    },
    onLostPointerCapture: () => setMarquee(null),
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('[data-item-key], input')) return;
      e.preventDefault();
      clearBgLongPress();
      setSel({ selected: [], anchor: null });
      showBackgroundMenu({ x: e.clientX, y: e.clientY }, e.currentTarget);
    },
  };

  const marqueeStyle = marquee
    ? {
        left: Math.min(marquee.x0, marquee.x1),
        top: Math.min(marquee.y0, marquee.y1),
        width: Math.abs(marquee.x1 - marquee.x0),
        height: Math.abs(marquee.y1 - marquee.y0),
      }
    : null;

  return { sel, selected, focusedKey, itemProps, containerProps, marqueeStyle };
}

interface RenameBoxProps {
  surface: Surface;
  item: ViewItem;
  className?: string;
}

/** Inline rename: selects the name, Enter commits, Escape cancels, invalid names keep editing. */
export function RenameBox({ surface, item, className }: RenameBoxProps) {
  const [value, setValue] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const errorId = `rename-error-${item.id}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  /**
   * After a keyboard commit or cancel, return focus to the item in this same
   * view immediately (it is still mounted), so the next keystroke is not lost.
   */
  const refocusItem = () => {
    ref.current?.closest<HTMLElement>('[data-item-key]')?.focus({ preventScroll: true });
  };

  const commit = (fromBlur: boolean) => {
    if (done.current) return;
    if (value === item.name) {
      done.current = true;
      cancelRename(surface);
      if (!fromBlur) refocusItem();
      return;
    }
    const message = commitRename(surface, item.id, value);
    if (message) {
      setError(message);
      announce(message);
      if (fromBlur) requestAnimationFrame(() => ref.current?.focus());
      return;
    }
    done.current = true;
    if (!fromBlur) refocusItem();
  };

  return (
    <span className={`rename${className ? ` ${className}` : ''}`}>
      <input
        ref={ref}
        className="rename__input"
        value={value}
        maxLength={255}
        spellCheck={false}
        aria-label={`Rename ${item.name}`}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(false);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            done.current = true;
            cancelRename(surface);
            refocusItem();
          }
        }}
        onBlur={() => commit(true)}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      />
      {error && (
        <span id={errorId} role="alert" className="rename__error">
          {error}
        </span>
      )}
    </span>
  );
}
