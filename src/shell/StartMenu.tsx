import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SEED_IDS } from '../domain/fs';
import { LOC } from '../domain/locations';
import type { RecentApp } from '../domain/prefs';
import { closeMenu, pushModal, taskbarHeight, useApp } from '../state/app';
import type { MenuEntry, OpenMenu } from '../state/types';
import { launch } from '../state/windowActions';
import { Icon, type IconName } from '../ui/icons';
import { MenuPopup } from '../ui/Menu';

const SUBMENU_DELAY = 250;

interface StartEntry {
  id: string;
  label: string;
  sub?: string;
  icon: IconName;
  bold?: boolean;
  run?: () => void;
  cascade?: boolean;
}

const RECENT: Record<RecentApp, { label: string; icon: IconName; run: () => void }> = {
  explorer: { label: 'Windows Explorer', icon: 'explorer', run: () => launch({ app: 'explorer', location: LOC.folder(SEED_IDS.myDocuments), pane: 'folders' }) },
  calculator: { label: 'Calculator', icon: 'calculator', run: () => launch({ app: 'calculator' }) },
  help: { label: 'Help and Support', icon: 'help', run: () => launch({ app: 'help' }) },
  controlPanel: { label: 'Control Panel', icon: 'control-panel', run: () => launch({ app: 'controlPanel' }) },
  taskManager: { label: 'Windows Task Manager', icon: 'task-manager', run: () => launch({ app: 'taskManager' }) },
};

export const ALL_PROGRAMS: MenuEntry[] = [
  {
    id: 'accessories',
    label: 'Accessories',
    icon: 'folder',
    submenu: [
      { id: 'calc', label: 'Calculator', icon: 'calculator', run: () => launch({ app: 'calculator' }) },
      { id: 'help', label: 'Help and Support', icon: 'help', run: () => launch({ app: 'help' }) },
      {
        id: 'explorer',
        label: 'Windows Explorer',
        icon: 'explorer',
        run: () => launch({ app: 'explorer', location: LOC.folder(SEED_IDS.myDocuments), pane: 'folders' }),
      },
    ],
  },
  { id: 'ie', label: 'Internet Explorer', icon: 'browser', run: () => launch({ app: 'ie' }) },
];

const openRun = () =>
  pushModal({ kind: 'run', invoker: document.querySelector<HTMLElement>('.xp-start'), ownerWindowId: null });

export function StartMenu({ menu }: { menu: OpenMenu }) {
  const recent = useApp((s) => s.prefs.recentApps);
  const barH = useApp(taskbarHeight);
  const ref = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<{ col: 0 | 1; i: number } | null>(menu.keyboard ? { col: 0, i: 0 } : null);
  const [cascade, setCascade] = useState<{ keyboard: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const left: StartEntry[] = [
    { id: 'internet', label: 'Internet', sub: 'Internet Explorer', icon: 'browser', bold: true, run: () => launch({ app: 'ie' }) },
    ...recent.map((app) => ({ id: `recent-${app}`, ...RECENT[app] })),
    { id: 'allprograms', label: 'All Programs', icon: 'start-logo', bold: true, cascade: true },
    { id: 'logoff', label: 'Log Off', icon: 'log-off', run: () => pushModal({ kind: 'logOff', invoker: document.querySelector<HTMLElement>('.xp-start'), ownerWindowId: null }) },
  ];
  const right: StartEntry[] = [
    { id: 'mydocs', label: 'My Documents', icon: 'my-documents', bold: true, run: () => launch({ app: 'explorer', location: LOC.folder(SEED_IDS.myDocuments) }) },
    { id: 'mypics', label: 'My Pictures', icon: 'my-pictures', bold: true, run: () => launch({ app: 'explorer', location: LOC.folder(SEED_IDS.myPictures) }) },
    { id: 'mymusic', label: 'My Music', icon: 'my-music', bold: true, run: () => launch({ app: 'explorer', location: LOC.folder(SEED_IDS.myMusic) }) },
    { id: 'mycomputer', label: 'My Computer', icon: 'my-computer', bold: true, run: () => launch({ app: 'explorer', location: LOC.myComputer }) },
    { id: 'network', label: 'My Network Places', icon: 'network', run: () => launch({ app: 'explorer', location: LOC.network }) },
    { id: 'control', label: 'Control Panel', icon: 'control-panel', run: () => launch({ app: 'controlPanel' }) },
    { id: 'help', label: 'Help and Support', icon: 'help', run: () => launch({ app: 'help' }) },
    { id: 'search', label: 'Search', icon: 'search', run: () => launch({ app: 'search' }) },
    { id: 'run', label: 'Run…', icon: 'run', run: openRun },
    {
      id: 'turnoff',
      label: 'Turn Off Computer',
      icon: 'turn-off',
      run: () => pushModal({ kind: 'turnOff', invoker: document.querySelector<HTMLElement>('.xp-start'), ownerWindowId: null }),
    },
  ];
  const columns = [left, right] as const;

  useEffect(() => {
    if (!focus) {
      ref.current?.focus();
      return;
    }
    const entry = columns[focus.col][focus.i];
    ref.current?.querySelector<HTMLElement>(`[data-start-id="${entry?.id}"]`)?.focus();
    // columns are rebuilt each render; focus follows the (col, i) coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const activate = (entry: StartEntry, keyboard: boolean) => {
    if (entry.cascade) {
      setCascade({ keyboard });
      return;
    }
    closeMenu(true);
    entry.run?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (cascade && e.target !== ref.current && !(e.target as HTMLElement).dataset.startId) return;
    const cur = focus ?? { col: 0 as const, i: -1 };
    const list = columns[cur.col];
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        setFocus({ col: cur.col, i: (cur.i + 1) % list.length });
        break;
      case 'ArrowUp':
        setFocus({ col: cur.col, i: (cur.i - 1 + list.length) % list.length });
        break;
      case 'Home':
        setFocus({ col: cur.col, i: 0 });
        break;
      case 'End':
        setFocus({ col: cur.col, i: list.length - 1 });
        break;
      // The footer buttons pair with each other; other rows map across without landing on the footer.
      case 'ArrowRight':
        if (cur.col === 0 && list[cur.i]?.cascade) setCascade({ keyboard: true });
        else if (cur.col === 0 && list[cur.i]?.id === 'logoff') setFocus({ col: 1, i: right.length - 1 });
        else if (cur.col === 0) setFocus({ col: 1, i: Math.min(Math.max(cur.i, 0), right.length - 2) });
        break;
      case 'ArrowLeft':
        if (cur.col === 1 && list[cur.i]?.id === 'turnoff') setFocus({ col: 0, i: left.length - 1 });
        else if (cur.col === 1) setFocus({ col: 0, i: Math.min(Math.max(cur.i, 0), left.length - 2) });
        break;
      case 'Enter':
      case ' ':
        if (list[cur.i]) activate(list[cur.i], true);
        break;
      case 'Escape':
      case 'Tab':
        closeMenu(true);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const k = e.key.toLowerCase();
          const all = [...left.map((x, i) => ({ col: 0 as const, i, x })), ...right.map((x, i) => ({ col: 1 as const, i, x }))];
          const start = all.findIndex((a) => a.col === cur.col && a.i === cur.i);
          const ordered = [...all.slice(start + 1), ...all.slice(0, start + 1)];
          const hit = ordered.find((a) => a.x.label.toLowerCase().startsWith(k));
          if (hit) setFocus({ col: hit.col, i: hit.i });
        } else handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const allProgramsEl = () => ref.current?.querySelector<HTMLElement>('[data-start-id="allprograms"]');

  const item = (entry: StartEntry, col: 0 | 1, i: number, big: boolean) => (
    <button
      key={entry.id}
      type="button"
      role="menuitem"
      tabIndex={-1}
      data-start-id={entry.id}
      aria-haspopup={entry.cascade ? 'menu' : undefined}
      aria-expanded={entry.cascade ? !!cascade : undefined}
      className={`start-item${big ? ' start-item--big' : ''}${entry.bold ? ' is-bold' : ''}${entry.cascade ? ' start-item--all' : ''}${
        entry.id === 'logoff' || entry.id === 'turnoff' ? ' start-item--footer' : ''
      }${focus?.col === col && focus.i === i ? ' is-active' : ''}${entry.cascade && cascade ? ' is-open' : ''}`}
      onPointerEnter={(e) => {
        if (e.pointerType === 'touch') return;
        setFocus({ col, i });
        if (timer.current) clearTimeout(timer.current);
        if (entry.cascade) timer.current = setTimeout(() => setCascade({ keyboard: false }), SUBMENU_DELAY);
        else if (cascade) timer.current = setTimeout(() => setCascade(null), SUBMENU_DELAY);
      }}
      onClick={(e) => activate(entry, e.detail === 0)}
    >
      {entry.cascade ? (
        <>
          <span className="start-item__text">{entry.label}</span>
          <span className="start-item__allarrow" aria-hidden="true" />
        </>
      ) : (
        <>
          <Icon name={entry.icon} size={entry.id === 'logoff' || entry.id === 'turnoff' ? 22 : big ? 32 : 24} />
          <span className="start-item__text">
            {entry.label}
            {entry.sub && <span className="start-item__sub">{entry.sub}</span>}
          </span>
        </>
      )}
    </button>
  );

  const pinnedCount = 1;
  const recentItems = left.slice(pinnedCount, left.length - 2);
  const cascadeRect = cascade ? allProgramsEl()?.getBoundingClientRect() : null;

  return (
    <>
      <div
        ref={ref}
        role="menu"
        aria-label="Start menu"
        tabIndex={-1}
        className="start-menu"
        style={{ bottom: barH }}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="start-menu__header">
          <span className="start-menu__avatar">
            <Icon name="user" size={48} />
          </span>
          <span className="start-menu__user">User</span>
        </div>
        <div className="start-menu__body">
          <div className="start-menu__left" role="group" aria-label="Programs">
            {item(left[0], 0, 0, true)}
            <div className="start-menu__sep" role="separator" />
            {recentItems.map((entry, i) => item(entry, 0, i + pinnedCount, true))}
            <div className="start-menu__spacer" />
            <div className="start-menu__sep" role="separator" />
            {item(left[left.length - 2], 0, left.length - 2, false)}
          </div>
          <div className="start-menu__right" role="group" aria-label="Places and settings">
            {item(right[0], 1, 0, false)}
            {item(right[1], 1, 1, false)}
            {item(right[2], 1, 2, false)}
            <div className="start-menu__sep start-menu__sep--right" role="separator" />
            {item(right[3], 1, 3, false)}
            {item(right[4], 1, 4, false)}
            <div className="start-menu__sep start-menu__sep--right" role="separator" />
            {item(right[5], 1, 5, false)}
            <div className="start-menu__sep start-menu__sep--right" role="separator" />
            {item(right[6], 1, 6, false)}
            {item(right[7], 1, 7, false)}
            {item(right[8], 1, 8, false)}
          </div>
        </div>
        <div className="start-menu__footer" role="group" aria-label="Session">
          {item(left[left.length - 1], 0, left.length - 1, false)}
          {item(right[right.length - 1], 1, right.length - 1, false)}
        </div>
      </div>
      {cascade && cascadeRect && (
        <MenuPopup
          items={ALL_PROGRAMS}
          anchor={{ type: 'rect', rect: cascadeRect, placement: 'right' }}
          label="All Programs"
          keyboard={cascade.keyboard}
          level={1}
          className="xp-menu--start"
          onClose={(reason) => {
            if (reason === 'activate' || reason === 'tab') closeMenu(true);
            else {
              setCascade(null);
              allProgramsEl()?.focus();
            }
          }}
        />
      )}
    </>
  );
}
