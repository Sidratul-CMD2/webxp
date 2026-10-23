import { useState, type KeyboardEvent } from 'react';
import { useApp } from '../state/app';
import { openAbout, openRunDialog } from '../state/dialogs';
import {
  activateWindow,
  cascadeWindows,
  closeWindow,
  launch,
  maximizeWindow,
  minimizeWindow,
  tileWindows,
  windowIcon,
  windowTitle,
} from '../state/windowActions';
import { Icon } from '../ui/icons';
import { MenuBar, type MenuBarMenu } from '../ui/MenuBar';
import { Tabs } from '../ui/PropertySheet';

/** Lists simulated top-level windows only; shows no invented CPU, process or device data. */
export function TaskManagerApp({ windowId }: { windowId: string }) {
  const rows = useApp((s) =>
    Object.keys(s.wm.windows)
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      .map((id) => ({ id, title: windowTitle(s, id), icon: windowIcon(s, id), minimized: s.wm.windows[id].minimized })),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const current = rows.find((r) => r.id === selected) ?? null;

  const menus: MenuBarMenu[] = [
    {
      label: '&File',
      items: () => [
        { id: 'new', label: '&New Task (Run…)', run: openRunDialog },
        { kind: 'separator', id: 's' },
        { id: 'exit', label: 'E&xit Task Manager', run: () => closeWindow(windowId) },
      ],
    },
    {
      label: '&Windows',
      items: () => [
        { id: 'tileh', label: 'Tile &Horizontally', run: () => tileWindows('horizontal') },
        { id: 'tilev', label: 'Tile &Vertically', run: () => tileWindows('vertical') },
        { id: 'min', label: '&Minimize', disabled: current ? false : 'Select a task first.', run: () => current && minimizeWindow(current.id) },
        { id: 'max', label: 'Ma&ximize', disabled: current ? false : 'Select a task first.', run: () => current && maximizeWindow(current.id) },
        { id: 'cascade', label: '&Cascade', run: cascadeWindows },
        { id: 'front', label: '&Bring To Front', disabled: current ? false : 'Select a task first.', run: () => current && activateWindow(current.id) },
      ],
    },
    {
      label: '&Help',
      items: () => [
        { id: 'topics', label: 'Task Manager &Help Topics', run: () => launch({ app: 'help', topic: 'windows' }) },
        { kind: 'separator', id: 's' },
        { id: 'about', label: '&About Task Manager', run: () => openAbout('Task Manager') },
      ],
    },
  ];

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!rows.length) return;
    const i = rows.findIndex((r) => r.id === selected);
    let next = -1;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else if (e.key === 'Enter' && current) {
      e.preventDefault();
      activateWindow(current.id);
      return;
    } else if (e.key === 'Delete' && current) {
      e.preventDefault();
      closeWindow(current.id);
      return;
    }
    if (next < 0) return;
    e.preventDefault();
    setSelected(rows[next].id);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  const tabIndexRow = current?.id ?? rows[0]?.id;

  return (
    <div className="taskmgr">
      <MenuBar menus={menus} ownerWindowId={windowId} />
      <div className="taskmgr__body">
        <Tabs tabs={[{ id: 'apps', label: 'Applications' }]} selected="apps" onSelect={() => undefined} label="Task Manager pages">
          <div className="taskmgr__table">
            <div className="taskmgr__head" aria-hidden="true">
              <span>Task</span>
              <span>Status</span>
            </div>
            <ul className="taskmgr__list xp-scroll" role="listbox" aria-label="Tasks" tabIndex={rows.length ? -1 : 0} onKeyDown={onListKey} data-autofocus>
              {rows.map((r) => (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={r.id === selected}
                  tabIndex={r.id === tabIndexRow ? 0 : -1}
                  className={r.id === selected ? 'is-selected' : ''}
                  onClick={() => setSelected(r.id)}
                  onDoubleClick={() => activateWindow(r.id)}
                  onFocus={() => setSelected(r.id)}
                >
                  <span className="taskmgr__task">
                    <Icon name={r.icon} size={16} />
                    {r.title}
                  </span>
                  <span>{r.minimized ? 'Running (minimized)' : 'Running'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="dialog-buttons">
            <button type="button" className="xp-button" disabled={!current} title={current ? undefined : 'Select a task first.'} onClick={() => current && closeWindow(current.id)}>
              <span className="mnemonic is-shown">E</span>nd Task
            </button>
            <button type="button" className="xp-button" disabled={!current} title={current ? undefined : 'Select a task first.'} onClick={() => current && activateWindow(current.id)}>
              <span className="mnemonic is-shown">S</span>witch To
            </button>
            <button type="button" className="xp-button" onClick={openRunDialog}>
              <span className="mnemonic is-shown">N</span>ew Task…
            </button>
          </div>
        </Tabs>
      </div>
      <div className="status-bar" role="status">
        <span className="status-bar__panel status-bar__panel--main">Applications: {rows.length}</span>
        <span className="status-bar__panel">Simulated windows only</span>
      </div>
    </div>
  );
}
