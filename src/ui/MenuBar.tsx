import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { get, openMenu, useApp } from '../state/app';
import type { MenuEntry } from '../state/types';
import { MnemonicLabel, accessKey, plainLabel } from './Menu';

export interface MenuBarMenu {
  label: string;
  items: () => MenuEntry[];
}

interface MenuBarProps {
  menus: MenuBarMenu[];
  ownerWindowId: string | null;
  label?: string;
}

export function MenuBar({ menus, ownerWindowId, label = 'Menu bar' }: MenuBarProps) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [keyboardUsed, setKeyboardUsed] = useState(false);
  const openIndex = useApp((s) => (s.menu?.menubar?.id === id ? s.menu.menubar.index : -1));

  const open = (index: number, keyboard: boolean) => {
    const el = refs.current[index];
    if (!el) return;
    setFocusIndex(index);
    const rect = el.getBoundingClientRect();
    if (get().menu?.menubar?.id === id && keyboard) el.focus();
    openMenu({
      kind: 'menu',
      items: menus[index].items(),
      anchor: { type: 'rect', rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, placement: 'below' },
      ownerWindowId,
      invoker: el,
      keyboard,
      label: plainLabel(menus[index].label),
      menubar: { id, index, count: menus.length, open },
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = menus.length;
    let handled = true;
    if (e.key === 'ArrowRight') {
      const next = (focusIndex + 1) % n;
      setFocusIndex(next);
      refs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft') {
      const next = (focusIndex - 1 + n) % n;
      setFocusIndex(next);
      refs.current[next]?.focus();
    } else if (e.key === 'Home') {
      setFocusIndex(0);
      refs.current[0]?.focus();
    } else if (e.key === 'End') {
      setFocusIndex(n - 1);
      refs.current[n - 1]?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      open(focusIndex, true);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = e.key.toLowerCase();
      const i = menus.findIndex((m) => accessKey(m.label) === k);
      if (i >= 0) open(i, true);
      else handled = false;
    } else handled = false;
    if (handled) {
      setKeyboardUsed(true);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div role="menubar" aria-label={label} className="xp-menubar" onKeyDown={onKeyDown}>
      {menus.map((menu, i) => (
        <button
          key={menu.label}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={openIndex === i}
          tabIndex={i === focusIndex ? 0 : -1}
          data-menubar-id={id}
          data-menubar-index={i}
          className={`xp-menubar__item${openIndex === i ? ' is-open' : ''}`}
          onFocus={() => setFocusIndex(i)}
          onBlur={() => setKeyboardUsed(false)}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            open(i, false);
          }}
          onClick={(e) => {
            // Keyboard activation of the button (pointer opens on pointerdown).
            if (e.detail === 0) open(i, true);
          }}
        >
          <MnemonicLabel label={menu.label} show={keyboardUsed} />
        </button>
      ))}
    </div>
  );
}
