import { useEffect, useRef, useState } from 'react';

interface Tip {
  text: string;
  x: number;
  y: number;
}

const HOVER_DELAY = 600;

/**
 * Shows `data-tip` text on hover (after a delay) and on keyboard focus, and
 * dismisses on Escape, pointer-out, blur or scroll. Tooltips are supplemental:
 * every control keeps its own accessible name.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const owner = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const hide = () => {
      clear();
      owner.current = null;
      setTip(null);
    };
    const show = (el: HTMLElement) => {
      const text = el.dataset.tip;
      if (!text || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      owner.current = el;
      setTip({ text, x: Math.min(r.left, window.innerWidth - 220), y: r.bottom + 4 > window.innerHeight - 24 ? r.top - 22 : r.bottom + 4 });
    };
    const tipTarget = (node: EventTarget | null) => (node instanceof Element ? (node.closest('[data-tip]') as HTMLElement | null) : null);

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = tipTarget(e.target);
      if (el === owner.current) return;
      hide();
      if (el) {
        owner.current = el;
        timer.current = setTimeout(() => show(el), HOVER_DELAY);
      }
    };
    const onFocus = (e: FocusEvent) => {
      const el = tipTarget(e.target);
      hide();
      if (el && el === e.target && el.matches(':focus-visible')) show(el);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && owner.current) hide();
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      clear();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!tip) return null;
  return (
    <div role="tooltip" className="xp-tooltip" style={{ left: Math.max(2, tip.x), top: Math.max(2, tip.y) }}>
      {tip.text}
    </div>
  );
}
