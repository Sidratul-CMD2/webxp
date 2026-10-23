import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { closeMenu, get, useApp } from '../state/app';
import type { MenuAnchor, MenuEntry, OpenMenu } from '../state/types';
import { Icon } from './icons';

const SUBMENU_DELAY = 250;

type Item = Extract<MenuEntry, { label: string }>;

const isItem = (e: MenuEntry): e is Item => e.kind !== 'separator';

/** `&x` marks an access key; `&&` is a literal ampersand. */
function parseLabel(label: string): { text: string; keyIndex: number } {
  let text = '';
  let keyIndex = -1;
  for (let i = 0; i < label.length; i++) {
    const c = label[i];
    if (c === '&' && i + 1 < label.length) {
      if (label[i + 1] !== '&' && keyIndex < 0) keyIndex = text.length;
      text += label[i + 1];
      i++;
    } else {
      text += c;
    }
  }
  return { text, keyIndex };
}

/** Converts displayed shortcut text ("Ctrl+X", "Shift+Del") to aria-keyshortcuts syntax. */
export function keyShortcuts(shortcut: string): string {
  return shortcut
    .split('+')
    .map((k) => ({ Ctrl: 'Control', Del: 'Delete' })[k] ?? k)
    .join('+');
}

/** Escapes user text (such as folder names) for use as a menu label. */
export function escapeMnemonic(text: string): string {
  return text.replace(/&/g, '&&');
}

export function plainLabel(label: string): string {
  return parseLabel(label).text;
}

export function accessKey(label: string): string | null {
  const { text, keyIndex } = parseLabel(label);
  return keyIndex >= 0 ? text[keyIndex].toLowerCase() : null;
}

/** Renders access keys, underlined only during keyboard use (XP default). */
export function MnemonicLabel({ label, show }: { label: string; show: boolean }) {
  const { text, keyIndex } = parseLabel(label);
  if (keyIndex < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, keyIndex)}
      <span className={show ? 'mnemonic is-shown' : 'mnemonic'}>{text[keyIndex]}</span>
      {text.slice(keyIndex + 1)}
    </>
  );
}

interface Pos {
  left: number;
  top: number;
  maxHeight: number;
}

function place(anchor: MenuAnchor, w: number, h: number): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxHeight = vh - 4;
  const height = Math.min(h, maxHeight);
  let left: number;
  let top: number;
  if (anchor.type === 'point') {
    left = anchor.x + w > vw ? Math.max(0, anchor.x - w) : anchor.x;
    top = anchor.y + height > vh ? Math.max(0, anchor.y - height) : anchor.y;
  } else if (anchor.placement === 'right') {
    left = anchor.rect.right - 3;
    if (left + w > vw) left = Math.max(0, anchor.rect.left - w + 3);
    top = anchor.rect.top - 3;
    if (top + height > vh) top = Math.max(0, vh - height);
  } else {
    left = Math.min(anchor.rect.left, Math.max(0, vw - w));
    const below = anchor.rect.bottom;
    const above = anchor.rect.top - height;
    top = anchor.placement === 'above' ? (above >= 0 ? above : below) : below + height > vh && above >= 0 ? above : below;
    if (top + height > vh) top = Math.max(0, vh - height);
  }
  return { left, top, maxHeight };
}

export interface MenuPopupProps {
  items: MenuEntry[];
  anchor: MenuAnchor;
  label: string;
  keyboard: boolean;
  level: number;
  onClose: (reason: 'activate' | 'escape' | 'tab' | 'left') => void;
  onMenubarStep?: (dir: -1 | 1) => void;
  className?: string;
}

export function MenuPopup({ items, anchor, label, keyboard, level, onClose, onMenubarStep, className }: MenuPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [active, setActive] = useState<number>(() => (keyboard ? items.findIndex(isItem) : -1));
  const [sub, setSub] = useState<{ index: number; keyboard: boolean } | null>(null);
  const [showKeys, setShowKeys] = useState(keyboard);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reasonIdBase = useId();

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(place(anchor, el.offsetWidth, el.scrollHeight));
    // Anchor objects are recreated by owners; position from the first render only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pos) return;
    const el = ref.current;
    if (!el) return;
    const target = active >= 0 ? el.querySelector<HTMLElement>(`[data-index="${active}"]`) : null;
    (target ?? el).focus({ preventScroll: false });
  }, [active, pos]);

  const itemAt = (i: number) => (i >= 0 && i < items.length && isItem(items[i]) ? (items[i] as Item) : null);

  const move = (from: number, dir: 1 | -1) => {
    const n = items.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + dir * step + n * 2) % n;
      if (isItem(items[i])) return i;
    }
    return from;
  };

  const activate = (i: number, viaKeyboard: boolean) => {
    const item = itemAt(i);
    if (!item) return;
    if (item.submenu) {
      clearTimer();
      setActive(i);
      setSub({ index: i, keyboard: viaKeyboard });
      return;
    }
    if (item.disabled) return;
    onClose('activate');
    item.run?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== ref.current && !ref.current?.contains(e.target as Node)) return;
    setShowKeys(true);
    const key = e.key;
    let handled = true;
    if (key === 'ArrowDown') setActive((a) => move(a < 0 ? -1 : a, 1));
    else if (key === 'ArrowUp') setActive((a) => move(a < 0 ? items.length : a, -1));
    else if (key === 'Home') setActive(move(-1, 1));
    else if (key === 'End') setActive(move(items.length, -1));
    else if (key === 'ArrowRight') {
      const item = itemAt(active);
      if (item?.submenu) setSub({ index: active, keyboard: true });
      else if (onMenubarStep) onMenubarStep(1);
      else handled = false;
    } else if (key === 'ArrowLeft') {
      if (level > 0) onClose('left');
      else if (onMenubarStep) onMenubarStep(-1);
      else handled = false;
    } else if (key === 'Enter' || key === ' ') activate(active, true);
    else if (key === 'Escape') onClose('escape');
    else if (key === 'Tab') onClose('tab');
    else if (key.length === 1 && /\S/.test(key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = key.toLowerCase();
      const byAccel = items.map((it, i) => (isItem(it) && accessKey(it.label) === k ? i : -1)).filter((i) => i >= 0);
      if (byAccel.length === 1) activate(byAccel[0], true);
      else {
        const matches = items
          .map((it, i) => (isItem(it) && plainLabel(it.label).toLowerCase().startsWith(k) ? i : -1))
          .filter((i) => i >= 0);
        if (matches.length) setActive(matches.find((i) => i > active) ?? matches[0]);
      }
    } else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const subItem = sub ? itemAt(sub.index) : null;
  const subRect = sub ? ref.current?.querySelector<HTMLElement>(`[data-index="${sub.index}"]`)?.getBoundingClientRect() : null;
  const hasGutterIcons = items.some((i) => isItem(i) && i.icon);

  return (
    <>
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        tabIndex={-1}
        className={`xp-menu${hasGutterIcons ? ' xp-menu--icons' : ''}${className ? ` ${className}` : ''}`}
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          maxHeight: pos?.maxHeight,
          visibility: pos ? 'visible' : 'hidden',
        }}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        onPointerEnter={clearTimer}
      >
        {items.map((entry, i) => {
          if (!isItem(entry)) return <div key={entry.id} role="separator" className="xp-menu__sep" />;
          const role = entry.radio ? 'menuitemradio' : entry.checked !== undefined ? 'menuitemcheckbox' : 'menuitem';
          const reasonId = entry.disabled ? `${reasonIdBase}-${i}` : undefined;
          return (
            <div
              key={entry.id}
              role={role}
              tabIndex={-1}
              data-index={i}
              aria-disabled={entry.disabled ? true : undefined}
              aria-checked={role === 'menuitem' ? undefined : !!entry.checked}
              aria-haspopup={entry.submenu ? 'menu' : undefined}
              aria-expanded={entry.submenu ? sub?.index === i : undefined}
              aria-describedby={reasonId}
              aria-keyshortcuts={entry.shortcut ? keyShortcuts(entry.shortcut) : undefined}
              title={entry.disabled || undefined}
              className={`xp-menu__item${active === i ? ' is-active' : ''}${entry.disabled ? ' is-disabled' : ''}${entry.bold ? ' is-bold' : ''}`}
              onPointerEnter={(e) => {
                if (e.pointerType === 'touch') return;
                setActive(i);
                clearTimer();
                if (entry.submenu) {
                  if (sub?.index !== i) timer.current = setTimeout(() => setSub({ index: i, keyboard: false }), SUBMENU_DELAY);
                } else if (sub) {
                  timer.current = setTimeout(() => setSub(null), SUBMENU_DELAY);
                }
              }}
              onClick={() => activate(i, false)}
            >
              <span className="xp-menu__gutter">
                {entry.icon ? (
                  <Icon name={entry.icon} size={16} />
                ) : entry.checked ? (
                  <span className={entry.radio ? 'xp-menu__radio' : 'xp-menu__check'} />
                ) : null}
              </span>
              <span className="xp-menu__label">
                <MnemonicLabel label={entry.label} show={showKeys} />
              </span>
              {entry.shortcut && (
                <span className="xp-menu__shortcut" aria-hidden="true">
                  {entry.shortcut}
                </span>
              )}
              {entry.submenu && <span className="xp-menu__arrow" aria-hidden="true" />}
            </div>
          );
        })}
        {/* Reasons live outside the items so they describe, rather than rename, them. */}
        <div className="sr-only">
          {items.map((entry, i) =>
            isItem(entry) && entry.disabled ? (
              <span key={entry.id} id={`${reasonIdBase}-${i}`}>
                {entry.disabled}
              </span>
            ) : null,
          )}
        </div>
      </div>
      {subItem?.submenu && subRect && (
        <MenuPopup
          key={sub!.index}
          items={subItem.submenu}
          anchor={{ type: 'rect', rect: subRect, placement: 'right' }}
          label={plainLabel(subItem.label)}
          keyboard={sub!.keyboard}
          level={level + 1}
          className={className}
          onClose={(reason) => {
            if (reason === 'activate' || reason === 'tab') onClose(reason);
            else {
              setSub(null);
              setActive(sub!.index);
              ref.current?.querySelector<HTMLElement>(`[data-index="${sub!.index}"]`)?.focus();
            }
          }}
          onMenubarStep={onMenubarStep && ((dir) => dir === 1 && onMenubarStep(1))}
        />
      )}
    </>
  );
}

/** The single authoritative overlay for open menus, with an outside-click catcher. */
export function MenuLayer({ renderSpecial }: { renderSpecial: (menu: OpenMenu) => ReactNode }) {
  const menu = useApp((s) => s.menu);
  if (!menu) return null;

  const menubarTarget = (x: number, y: number): number | null => {
    if (!menu.menubar) return null;
    for (const el of document.elementsFromPoint(x, y)) {
      if (el instanceof HTMLElement && el.dataset.menubarId === menu.menubar.id) return Number(el.dataset.menubarIndex);
    }
    return null;
  };

  return (
    <div className="menu-layer">
      <div
        className="menu-catcher"
        data-testid="menu-catcher"
        onPointerDown={(e) => {
          e.preventDefault();
          const target = menubarTarget(e.clientX, e.clientY);
          if (target !== null && menu.menubar && target !== menu.menubar.index) {
            menu.menubar.open(target, false);
            return;
          }
          closeMenu(true);
        }}
        onPointerMove={(e) => {
          const target = menubarTarget(e.clientX, e.clientY);
          if (target !== null && menu.menubar && target !== menu.menubar.index) menu.menubar.open(target, false);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          closeMenu(true);
        }}
      />
      {menu.kind === 'menu' ? (
        <MenuPopup
          key={menu.id}
          items={menu.items}
          anchor={menu.anchor}
          label={menu.label}
          keyboard={menu.keyboard}
          level={0}
          onClose={() => closeMenu(true)}
          onMenubarStep={
            menu.menubar
              ? (dir) => {
                  const mb = get().menu?.menubar;
                  if (!mb) return;
                  mb.open((mb.index + dir + mb.count) % mb.count, true);
                }
              : undefined
          }
        />
      ) : (
        renderSpecial(menu)
      )}
    </div>
  );
}
