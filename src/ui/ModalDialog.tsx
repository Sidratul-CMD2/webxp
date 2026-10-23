import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"], a[href]';

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0 && !el.closest('[inert]'));
}

/** Escape cancels; Tab and Shift+Tab stay within the dialog. */
export function trapKeys(e: KeyboardEvent<HTMLElement>, root: HTMLElement | null, onCancel: () => void) {
  if (!root) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    onCancel();
    return;
  }
  if (e.key !== 'Tab') return;
  const list = focusables(root);
  if (!list.length) {
    e.preventDefault();
    return;
  }
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function useInitialFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>('[data-initial-focus]') ?? focusables(root)[0] ?? root;
    target.focus();
    if (target instanceof HTMLInputElement) target.select();
  }, [ref]);
}

interface ModalDialogProps {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  describedBy?: string;
  className?: string;
  onHelp?: () => void;
  width?: number;
}

/** A true modal: labelled dialog semantics, focus contained, Escape cancels. */
export function ModalDialog({ title, children, onCancel, describedBy, className, onHelp, width }: ModalDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; id: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({
      x: Math.max(0, Math.round((window.innerWidth - el.offsetWidth) / 2)),
      y: Math.max(0, Math.round((window.innerHeight - el.offsetHeight) / 3)),
    });
    // Keep the dialog (and its buttons) inside the viewport when it shrinks.
    const onResize = () => {
      const node = ref.current;
      if (!node) return;
      setPos((p) =>
        p && {
          x: Math.max(0, Math.min(p.x, window.innerWidth - node.offsetWidth)),
          y: Math.max(0, Math.min(p.y, window.innerHeight - node.offsetHeight)),
        },
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useInitialFocus(ref);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      className={`xp-window is-active xp-dialog${className ? ` ${className}` : ''}`}
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, width }}
      onKeyDown={(e) => trapKeys(e, ref.current, onCancel)}
    >
      <div
        className="xp-window__titlebar"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button') || !pos) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          if (!drag.current || drag.current.id !== e.pointerId) return;
          setPos({
            x: Math.min(Math.max(e.clientX - drag.current.dx, -200), window.innerWidth - 60),
            y: Math.min(Math.max(e.clientY - drag.current.dy, 0), window.innerHeight - 30),
          });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <h2 id={titleId} className="xp-window__title">
          {title}
        </h2>
        <div className="xp-window__caps">
          {onHelp && (
            <button type="button" className="xp-cap xp-cap--help" aria-label={`Help for ${title}`} data-tip="Help" tabIndex={-1} onClick={onHelp}>
              <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
                <path d="M7.5 7.8c0-1.9 1.4-3 3.2-3 1.9 0 3.2 1.1 3.2 2.7 0 1.3-.8 1.9-1.6 2.5-.8.6-1 .9-1 1.8v.4H9.4v-.6c0-1.3.5-2 1.4-2.6.7-.5 1-.8 1-1.4 0-.6-.5-1.1-1.2-1.1-.8 0-1.2.5-1.3 1.3z" fill="#fff" />
                <rect x="9.3" y="13.4" width="2.2" height="2.2" fill="#fff" />
              </svg>
            </button>
          )}
          <button type="button" className="xp-cap xp-cap--close" aria-label={`Close ${title}`} data-tip="Close" tabIndex={-1} onClick={onCancel}>
            <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
              <path d="M5.5 5.5l10 10M15.5 5.5l-10 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="square" />
            </svg>
          </button>
        </div>
      </div>
      <div className="xp-dialog__body">{children}</div>
    </div>
  );
}
