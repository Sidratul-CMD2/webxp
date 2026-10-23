import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { closeWindow } from '../state/windowActions';

export interface SheetTab<T> {
  id: string;
  label: string;
  render: (draft: T, update: (patch: Partial<T>) => void) => ReactNode;
}

interface PropertySheetProps<T> {
  windowId: string;
  tabs: SheetTab<T>[];
  committed: T;
  apply: (draft: T) => void | boolean;
  initialTab?: string;
  equals?: (a: T, b: T) => boolean;
  /** Read-only sheets show only OK. */
  readOnly?: boolean;
}

export function Tabs({
  tabs,
  selected,
  onSelect,
  label,
  children,
}: {
  tabs: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  label: string;
  children: ReactNode;
}) {
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === selected);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onSelect(tabs[next].id);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${base}-tab-${tabs[next].id}`)}`)?.focus());
  };
  return (
    <div className="xp-tabs">
      <div ref={listRef} role="tablist" aria-label={label} className="xp-tablist" onKeyDown={onKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === selected}
            aria-controls={`${base}-panel`}
            tabIndex={t.id === selected ? 0 : -1}
            className="xp-tab"
            onClick={() => onSelect(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${selected}`} className="xp-tabpanel" tabIndex={0}>
        {children}
      </div>
    </div>
  );
}

const shallow = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

/** OK applies and closes; Apply commits and stays open; Cancel discards changes since the last Apply. */
export function PropertySheet<T>({ windowId, tabs, committed, apply, initialTab, equals = shallow, readOnly }: PropertySheetProps<T>) {
  const [tab, setTab] = useState(initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id);
  const [draft, setDraft] = useState<T>(committed);
  const [base, setBase] = useState<T>(committed);
  const dirty = !equals(draft, base);
  const update = (patch: Partial<T>) => setDraft((d) => ({ ...d, ...patch }));
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  const doApply = () => {
    if (apply(draft) === false) return false;
    setBase(draft);
    return true;
  };

  return (
    <div className="sheet">
      <Tabs tabs={tabs} selected={current.id} onSelect={setTab} label="Settings pages">
        {current.render(draft, update)}
      </Tabs>
      <div className="dialog-buttons sheet__buttons">
        <button
          type="button"
          className="xp-button is-default"
          data-autofocus
          onClick={() => {
            if (!dirty || doApply()) closeWindow(windowId);
          }}
        >
          OK
        </button>
        {!readOnly && (
          <>
            <button type="button" className="xp-button" onClick={() => closeWindow(windowId)}>
              Cancel
            </button>
            <button type="button" className="xp-button" disabled={!dirty} title={dirty ? undefined : 'There are no changes to apply.'} onClick={doApply}>
              <span className="mnemonic is-shown">A</span>pply
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Keyboard Escape closes applet windows like Cancel. */
export function sheetKeyDown(windowId: string) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, select, [role="menu"]')) {
      e.preventDefault();
      closeWindow(windowId);
    }
  };
}
