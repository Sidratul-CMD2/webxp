import { useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { calcReduce, displayText, hasMemory, initialCalc, type CalcAction } from '../domain/calculator';
import { showError } from '../state/app';
import { openAbout } from '../state/dialogs';
import { launch } from '../state/windowActions';
import { MenuBar, type MenuBarMenu } from '../ui/MenuBar';

interface Key {
  id: string;
  label: string;
  name: string;
  action: CalcAction;
  tone: 'digit' | 'op' | 'mem' | 'clear';
  wide?: boolean;
}

const k = (id: string, label: string, name: string, action: CalcAction, tone: Key['tone'], wide = false): Key => ({ id, label, name, action, tone, wide });

const TOP: Key[] = [
  k('back', 'Backspace', 'Backspace', { type: 'backspace' }, 'clear', true),
  k('ce', 'CE', 'Clear entry', { type: 'clearEntry' }, 'clear', true),
  k('c', 'C', 'Clear', { type: 'clear' }, 'clear', true),
];

const GRID: Key[][] = [
  [
    k('mc', 'MC', 'Memory clear', { type: 'memoryClear' }, 'mem'),
    k('7', '7', '7', { type: 'digit', digit: '7' }, 'digit'),
    k('8', '8', '8', { type: 'digit', digit: '8' }, 'digit'),
    k('9', '9', '9', { type: 'digit', digit: '9' }, 'digit'),
    k('div', '/', 'Divide', { type: 'operator', op: '/' }, 'op'),
    k('sqrt', 'sqrt', 'Square root', { type: 'sqrt' }, 'op'),
  ],
  [
    k('mr', 'MR', 'Memory recall', { type: 'memoryRecall' }, 'mem'),
    k('4', '4', '4', { type: 'digit', digit: '4' }, 'digit'),
    k('5', '5', '5', { type: 'digit', digit: '5' }, 'digit'),
    k('6', '6', '6', { type: 'digit', digit: '6' }, 'digit'),
    k('mul', '*', 'Multiply', { type: 'operator', op: '*' }, 'op'),
    k('pct', '%', 'Percent', { type: 'percent' }, 'op'),
  ],
  [
    k('ms', 'MS', 'Memory store', { type: 'memoryStore' }, 'mem'),
    k('1', '1', '1', { type: 'digit', digit: '1' }, 'digit'),
    k('2', '2', '2', { type: 'digit', digit: '2' }, 'digit'),
    k('3', '3', '3', { type: 'digit', digit: '3' }, 'digit'),
    k('sub', '-', 'Subtract', { type: 'operator', op: '-' }, 'op'),
    k('inv', '1/x', 'Reciprocal', { type: 'reciprocal' }, 'op'),
  ],
  [
    k('mplus', 'M+', 'Memory add', { type: 'memoryAdd' }, 'mem'),
    k('0', '0', '0', { type: 'digit', digit: '0' }, 'digit'),
    k('sign', '+/-', 'Change sign', { type: 'sign' }, 'digit'),
    k('dot', '.', 'Decimal point', { type: 'decimal' }, 'digit'),
    k('add', '+', 'Add', { type: 'operator', op: '+' }, 'op'),
    k('eq', '=', 'Equals', { type: 'equals' }, 'op'),
  ],
];

const KEYMAP: Record<string, string> = {
  '+': 'add',
  '-': 'sub',
  '*': 'mul',
  '/': 'div',
  '%': 'pct',
  '@': 'sqrt',
  r: 'inv',
  R: 'inv',
  '.': 'dot',
  ',': 'dot',
  '=': 'eq',
  Enter: 'eq',
  Escape: 'c',
  Delete: 'ce',
  Backspace: 'back',
  F9: 'sign',
};

const ALL_KEYS = [...TOP, ...GRID.flat()];

/** WCAG 2.5.3: the accessible name starts with the visible label, e.g. "CE (clear entry)". */
function accessibleName(key: Key): string {
  return key.label === key.name ? key.label : `${key.label} (${key.name.toLowerCase()})`;
}

export function CalculatorApp({ windowId }: { windowId: string }) {
  const [state, dispatch] = useReducer(calcReduce, initialCalc);
  const [grouping, setGrouping] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const text = displayText(state, grouping);

  const press = (key: Key) => {
    dispatch(key.action);
    setFlash(key.id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 110);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.replace(/,/g, '').replace(/\.$/, ''));
    } catch {
      void showError('Calculator', 'The browser did not allow copying to the clipboard.');
    }
  };

  const menus: MenuBarMenu[] = useMemo(
    () => [
      {
        label: '&Edit',
        items: () => [
          { id: 'copy', label: '&Copy', shortcut: 'Ctrl+C', run: () => void copy() },
          { id: 'paste', label: '&Paste', disabled: 'Not simulated: the calculator does not read your clipboard.' },
        ],
      },
      {
        label: '&View',
        items: () => [
          { id: 'std', label: 'S&tandard', radio: true, checked: true, run: () => undefined },
          { id: 'sci', label: '&Scientific', radio: true, checked: false, disabled: 'Not simulated: only the standard calculator is available.' },
          { kind: 'separator', id: 's' },
          { id: 'group', label: '&Digit grouping', checked: grouping, run: () => setGrouping((g) => !g) },
        ],
      },
      {
        label: '&Help',
        items: () => [
          { id: 'topics', label: '&Help Topics', run: () => launch({ app: 'help', topic: 'calculator' }) },
          { kind: 'separator', id: 's' },
          { id: 'about', label: '&About Calculator', run: () => openAbout('Calculator') },
        ],
      },
    ],
    // copy reads the latest text through closure on each open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grouping, text],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[role="menubar"], [role="menu"]')) return;
    if (e.altKey || e.metaKey) return;
    if (e.ctrlKey) {
      if (e.key === 'c' || e.key === 'C') {
        if (!window.getSelection()?.toString()) {
          e.preventDefault();
          void copy();
        }
      }
      return;
    }
    const id = /^[0-9]$/.test(e.key) ? e.key : KEYMAP[e.key];
    if (!id) return;
    const key = ALL_KEYS.find((x) => x.id === id);
    if (!key) return;
    e.preventDefault();
    e.stopPropagation();
    press(key);
  };

  const button = (key: Key) => (
    <button
      key={key.id}
      type="button"
      className={`calc__key calc__key--${key.tone}${key.wide ? ' calc__key--wide' : ''}${flash === key.id ? ' is-pressed' : ''}`}
      aria-label={accessibleName(key)}
      onClick={() => press(key)}
    >
      {key.label}
    </button>
  );

  return (
    <div className="calc" onKeyDown={onKeyDown}>
      <MenuBar menus={menus} ownerWindowId={windowId} label="Calculator menu" />
      <div className="calc__body">
        <output className="calc__display" aria-live="polite" aria-label={`Display: ${text}`} data-testid="calc-display">
          {text}
        </output>
        <div className="calc__top">
          <span className="calc__memory" aria-label={hasMemory(state) ? 'Memory is set' : 'Memory is empty'} role="img">
            {hasMemory(state) ? 'M' : ''}
          </span>
          {TOP.map(button)}
        </div>
        <div className="calc__grid" data-autofocus tabIndex={-1}>
          {GRID.map((row, i) => (
            <div key={i} className="calc__row">
              {row.map(button)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
