import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/** APG toolbar: one tab stop, arrow keys move between controls. */
export function Toolbar({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const controls = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [data-toolbar-item]') ?? [])];

  const setRoving = (active: HTMLElement | undefined) => {
    for (const el of controls()) el.tabIndex = el === active ? 0 : -1;
  };

  useLayoutEffect(() => {
    const list = controls();
    if (!list.some((el) => el.tabIndex === 0)) setRoving(list[0]);
  });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const list = controls();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const next =
      e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
    e.preventDefault();
    setRoving(next);
    next.focus();
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={label}
      className={`xp-toolbar${className ? ` ${className}` : ''}`}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        if (e.target instanceof HTMLElement && controls().includes(e.target)) setRoving(e.target);
      }}
    >
      {children}
    </div>
  );
}

/** "there is no next page" → "There is no next page." (tooltips use the phrase form). */
const sentence = (phrase: string) => `${phrase[0].toUpperCase()}${phrase.slice(1)}.`;

interface ToolButtonProps {
  icon: IconName;
  label: string;
  showLabel?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  pressed?: boolean;
  onClick: (el: HTMLElement, keyboard: boolean) => void;
  dropdown?: (el: HTMLElement, keyboard: boolean) => void;
  size?: 16 | 24;
  tip?: string;
  /** Opens a menu from the whole button, with the arrow drawn inside it (one target). */
  hasMenu?: boolean;
}

export function ToolButton({ icon, label, showLabel, disabled, disabledReason, pressed, onClick, dropdown, size = 24, tip, hasMenu }: ToolButtonProps) {
  return (
    <span className={`xp-toolbtn-wrap${dropdown ? ' has-drop' : ''}`}>
      <button
        type="button"
        className={`xp-toolbtn${pressed ? ' is-pressed' : ''}`}
        aria-label={label}
        aria-pressed={pressed}
        aria-haspopup={hasMenu ? 'menu' : undefined}
        disabled={disabled}
        title={disabled && disabledReason ? sentence(disabledReason) : undefined}
        data-tip={disabled && disabledReason ? `${tip ?? label} — ${disabledReason}` : (tip ?? label)}
        onClick={(e) => onClick(e.currentTarget, e.detail === 0)}
      >
        <Icon name={icon} size={size} />
        {showLabel && <span className="xp-toolbtn__label">{label}</span>}
        {hasMenu && <span className="xp-toolbtn__arrow" aria-hidden="true" />}
      </button>
      {dropdown && (
        <button
          type="button"
          className="xp-toolbtn xp-toolbtn--drop"
          aria-label={`${label} list`}
          aria-haspopup="menu"
          disabled={disabled}
          title={disabled && disabledReason ? sentence(disabledReason) : undefined}
          onClick={(e) => dropdown(e.currentTarget.parentElement ?? e.currentTarget, e.detail === 0)}
        >
          <span className="xp-toolbtn__arrow" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
