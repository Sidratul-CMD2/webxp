import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { AppId } from '../domain/windows';
import { APP_SPECS } from '../state/appSpecs';
import { closeMenu, get, isCompact, openMenu, useApp } from '../state/app';
import { updatePrefs } from '../state/sessionActions';
import type { MenuEntry } from '../state/types';
import {
  activateWindow,
  cascadeWindows,
  closeWindow,
  launch,
  minimizeWindow,
  tileWindows,
  toggleShowDesktop,
  windowIcon,
  windowTitle,
} from '../state/windowActions';
import { Icon } from '../ui/icons';
import { escapeMnemonic } from '../ui/Menu';
import { systemMenuItems } from './systemMenu';

const GROUP_THRESHOLD = 110;
const MAX_BUTTON = 160;
const MIN_BUTTON = 44;

export function taskbarMenuItems(): MenuEntry[] {
  const s = get();
  const hasWindows = s.wm.order.some((id) => !s.wm.windows[id].minimized);
  return [
    {
      id: 'toolbars',
      label: '&Toolbars',
      submenu: [
        {
          id: 'ql',
          label: '&Quick Launch',
          checked: s.prefs.taskbar.quickLaunch,
          run: () => updatePrefs((p) => ({ ...p, taskbar: { ...p.taskbar, quickLaunch: !p.taskbar.quickLaunch } })),
        },
      ],
    },
    { kind: 'separator', id: 's1' },
    { id: 'cascade', label: '&Cascade Windows', disabled: hasWindows ? false : 'There are no open windows to arrange.', run: cascadeWindows },
    { id: 'tileh', label: 'Tile Windows &Horizontally', disabled: hasWindows ? false : 'There are no open windows to arrange.', run: () => tileWindows('horizontal') },
    { id: 'tilev', label: 'Tile Windows V&ertically', disabled: hasWindows ? false : 'There are no open windows to arrange.', run: () => tileWindows('vertical') },
    { id: 'showdesk', label: s.wm.showDesktopSnapshot ? '&Show Open Windows' : '&Show the Desktop', run: toggleShowDesktop },
    { kind: 'separator', id: 's2' },
    { id: 'taskmgr', label: 'Tas&k Manager', run: () => launch({ app: 'taskManager' }) },
    { kind: 'separator', id: 's3' },
    { id: 'props', label: 'P&roperties', run: () => launch({ app: 'taskbarProps' }) },
  ];
}

function openTaskbarMenu(e: { clientX: number; clientY: number } | null, invoker: HTMLElement | null) {
  const rect = invoker?.getBoundingClientRect();
  openMenu({
    kind: 'menu',
    items: taskbarMenuItems(),
    anchor: e ? { type: 'point', x: e.clientX, y: e.clientY } : { type: 'rect', rect: rect!, placement: 'above' },
    ownerWindowId: null,
    invoker,
    keyboard: !e,
    label: 'Taskbar',
  });
}

/** Shift+F10 / Menu key opens a context menu on taskbar controls without their own. */
function taskbarMenuKey(e: KeyboardEvent<HTMLElement>) {
  if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
    e.preventDefault();
    openTaskbarMenu(null, e.currentTarget);
  }
}

function useMinuteClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = new Date();
      setTime(now);
      timer = setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
    };
    timer = setTimeout(tick, 60_000 - (new Date().getSeconds() * 1000 + new Date().getMilliseconds()) + 20);
    return () => clearTimeout(timer);
  }, []);
  return time;
}

function Clock() {
  const time = useMinuteClock();
  const label = time.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const date = time.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <button
      type="button"
      className="xp-tray__clock"
      data-tip={date}
      aria-label={`${label}, ${date}. Press Enter or double-click for Date and Time Properties.`}
      onClick={(e) => {
        if (e.detail === 0 || e.detail === 2) launch({ app: 'dateTime' });
      }}
      onKeyDown={taskbarMenuKey}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openTaskbarMenu(e, e.currentTarget);
      }}
    >
      {label}
    </button>
  );
}

interface TaskEntry {
  kind: 'window' | 'group';
  key: string;
  appId: AppId;
  ids: string[];
}

function windowSeq(id: string) {
  return Number(id.slice(1));
}

export function Taskbar() {
  const windows = useApp((s) => s.wm.windows);
  const activeId = useApp((s) => s.wm.activeId);
  const titles = useApp((s) => Object.keys(s.wm.windows).map((id) => windowTitle(s, id)));
  const icons = useApp((s) => Object.keys(s.wm.windows).map((id) => windowIcon(s, id)));
  const prefsTaskbar = useApp((s) => s.prefs.taskbar);
  const showVolume = useApp((s) => s.prefs.sound.showTrayIcon);
  const muted = useApp((s) => s.prefs.sound.muted);
  const startOpen = useApp((s) => s.menu?.kind === 'start');
  const menuOpen = useApp((s) => !!s.menu || s.modals.length > 0);
  const compact = useApp(isCompact);
  const [hover, setHover] = useState(false);
  const [areaWidth, setAreaWidth] = useState(600);
  const [page, setPage] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaWidth(el.clientWidth));
    ro.observe(el);
    setAreaWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const ids = useMemo(() => Object.keys(windows).sort((a, b) => windowSeq(a) - windowSeq(b)), [windows]);
  const titleOf = useMemo(() => Object.fromEntries(Object.keys(windows).map((id, i) => [id, titles[i]])), [windows, titles]);
  const iconOf = useMemo(() => Object.fromEntries(Object.keys(windows).map((id, i) => [id, icons[i]])), [windows, icons]);

  const entries: TaskEntry[] = useMemo(() => {
    const single = ids.map((id) => ({ kind: 'window' as const, key: id, appId: windows[id].appId, ids: [id] }));
    if (!prefsTaskbar.grouping || ids.length === 0 || areaWidth / ids.length >= GROUP_THRESHOLD) return single;
    const byApp = new Map<AppId, string[]>();
    for (const id of ids) byApp.set(windows[id].appId, [...(byApp.get(windows[id].appId) ?? []), id]);
    const result: TaskEntry[] = [];
    const seen = new Set<AppId>();
    for (const id of ids) {
      const app = windows[id].appId;
      const members = byApp.get(app)!;
      if (members.length < 2) result.push({ kind: 'window', key: id, appId: app, ids: [id] });
      else if (!seen.has(app)) {
        seen.add(app);
        result.push({ kind: 'group', key: `group:${app}`, appId: app, ids: members });
      }
    }
    return result;
  }, [ids, windows, prefsTaskbar.grouping, areaWidth]);

  const perButton = entries.length ? Math.min(MAX_BUTTON, Math.floor(areaWidth / entries.length) - 2) : MAX_BUTTON;
  const paged = perButton < MIN_BUTTON;
  const perPage = Math.max(1, Math.floor(areaWidth / (MIN_BUTTON + 2)) - 1);
  const pages = paged ? Math.ceil(entries.length / perPage) : 1;
  const currentPage = Math.min(page, pages - 1);
  const visibleEntries = paged ? entries.slice(currentPage * perPage, currentPage * perPage + perPage) : entries;
  const buttonWidth = paged ? Math.floor(areaWidth / (perPage + 1)) - 2 : perButton;

  const exposed = !prefsTaskbar.autoHide || hover || startOpen || menuOpen;

  const toggleStart = (keyboard: boolean) => {
    if (get().menu?.kind === 'start') {
      closeMenu(true);
      return;
    }
    openMenu({
      kind: 'start',
      items: [],
      anchor: { type: 'point', x: 0, y: 0 },
      ownerWindowId: null,
      invoker: startRef.current,
      keyboard,
      label: 'Start menu',
    });
  };

  const onTaskClick = (entry: TaskEntry, el: HTMLElement, keyboard: boolean) => {
    if (entry.kind === 'group') {
      const rect = el.getBoundingClientRect();
      openMenu({
        kind: 'menu',
        items: entry.ids.map((id) => ({
          id,
          label: escapeMnemonic(titleOf[id]),
          icon: iconOf[id],
          bold: id === activeId,
          run: () => activateWindow(id),
        })),
        anchor: { type: 'rect', rect, placement: 'above' },
        ownerWindowId: null,
        invoker: el,
        keyboard,
        label: `${APP_SPECS[entry.appId].groupLabel} windows`,
      });
      return;
    }
    const id = entry.ids[0];
    const win = get().wm.windows[id];
    if (!win) return;
    if (get().wm.activeId === id && !win.minimized) minimizeWindow(id);
    else activateWindow(id);
  };

  const onTaskContext = (entry: TaskEntry, el: HTMLElement, e: MouseEvent | null) => {
    const anchor = e ? { type: 'point' as const, x: e.clientX, y: e.clientY } : { type: 'rect' as const, rect: el.getBoundingClientRect(), placement: 'above' as const };
    if (entry.kind === 'group') {
      openMenu({
        kind: 'menu',
        items: [
          { id: 'mingroup', label: 'Mi&nimize Group', run: () => entry.ids.forEach((id) => minimizeWindow(id)) },
          { kind: 'separator', id: 's' },
          { id: 'closegroup', label: '&Close Group', run: () => entry.ids.forEach((id) => closeWindow(id)) },
        ],
        anchor,
        ownerWindowId: null,
        invoker: el,
        keyboard: !e,
        label: `${APP_SPECS[entry.appId].groupLabel} group`,
      });
      return;
    }
    const id = entry.ids[0];
    openMenu({ kind: 'menu', items: systemMenuItems(id), anchor, ownerWindowId: null, invoker: el, keyboard: !e, label: `System menu for ${titleOf[id]}` });
  };

  return (
    <nav
      className={`xp-taskbar${exposed ? '' : ' is-hidden'}${compact ? ' is-compact' : ''}`}
      aria-label="Taskbar"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(false);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if ((e.target as HTMLElement).closest('button')) return;
        openTaskbarMenu(e, null);
      }}
    >
      <button
        ref={startRef}
        type="button"
        className={`xp-start${startOpen ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={startOpen}
        aria-label="Start"
        data-tip="Click here to begin"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          toggleStart(false);
        }}
        onClick={(e) => {
          if (e.detail === 0) toggleStart(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') {
            e.preventDefault();
            toggleStart(true);
          } else taskbarMenuKey(e);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openTaskbarMenu(e, e.currentTarget);
        }}
      >
        <Icon name="start-logo" size={22} />
        <span className="xp-start__text">start</span>
      </button>

      {prefsTaskbar.quickLaunch && (
        <div className="xp-quicklaunch" role="group" aria-label="Quick Launch">
          <button type="button" className="xp-quicklaunch__btn" aria-label="Show Desktop" data-tip="Show Desktop" onClick={toggleShowDesktop} onKeyDown={taskbarMenuKey}>
            <Icon name="show-desktop" size={16} />
          </button>
          <button type="button" className="xp-quicklaunch__btn" aria-label="Launch Internet Explorer" data-tip="Launch Internet Explorer Browser" onClick={() => launch({ app: 'ie' })} onKeyDown={taskbarMenuKey}>
            <Icon name="browser" size={16} />
          </button>
        </div>
      )}

      <div className="xp-tasks" ref={areaRef} role="group" aria-label="Running windows">
        {visibleEntries.map((entry) => {
          const isGroup = entry.kind === 'group';
          const pressed = !isGroup && entry.ids[0] === activeId && !windows[entry.ids[0]]?.minimized;
          const groupActive = isGroup && entry.ids.includes(activeId ?? '');
          const label = isGroup ? `${APP_SPECS[entry.appId].groupLabel}` : titleOf[entry.ids[0]];
          return (
            <button
              key={entry.key}
              type="button"
              className={`xp-task${pressed || groupActive ? ' is-active' : ''}${isGroup ? ' is-group' : ''}`}
              style={{ width: buttonWidth }}
              aria-pressed={isGroup ? undefined : pressed}
              aria-haspopup={isGroup ? 'menu' : undefined}
              aria-label={isGroup ? `${entry.ids.length} ${label} windows` : label}
              data-tip={isGroup ? `${entry.ids.length} ${label} windows` : label}
              data-window-button={isGroup ? undefined : entry.ids[0]}
              onClick={(e) => onTaskClick(entry, e.currentTarget, e.detail === 0)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTaskContext(entry, e.currentTarget, e);
              }}
              onKeyDown={(e) => {
                if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
                  e.preventDefault();
                  onTaskContext(entry, e.currentTarget, null);
                }
              }}
            >
              {isGroup && <span className="xp-task__count">{entry.ids.length}</span>}
              {/* Space keeps the visible text "N Label" for label-in-name; ignored by flex layout. */}
              {isGroup && ' '}
              <Icon name={isGroup ? APP_SPECS[entry.appId].icon : iconOf[entry.ids[0]]} size={16} />
              <span className="xp-task__label">{label}</span>
              {isGroup && <span className="xp-task__drop" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {paged && (
        <div className="xp-task-pager" role="group" aria-label="Taskbar pages">
          <button type="button" aria-label="Previous taskbar page" disabled={currentPage === 0} title={currentPage === 0 ? 'This is the first page of taskbar buttons.' : undefined} onClick={() => setPage(currentPage - 1)}>
            ▲
          </button>
          <button type="button" aria-label="Next taskbar page" disabled={currentPage >= pages - 1} title={currentPage >= pages - 1 ? 'This is the last page of taskbar buttons.' : undefined} onClick={() => setPage(currentPage + 1)}>
            ▼
          </button>
        </div>
      )}

      <div className="xp-tray" role="group" aria-label="Notification area">
        {compact && (
          <button
            type="button"
            className="xp-tray__btn xp-tray__windows"
            aria-label="Window List"
            data-tip="Window List"
            disabled={ids.length === 0}
            title={ids.length === 0 ? 'No windows are open.' : undefined}
            onClick={(e) => {
              openMenu({
                kind: 'menu',
                items: ids.map((id) => ({ id, label: escapeMnemonic(titleOf[id]), icon: iconOf[id], bold: id === activeId, run: () => activateWindow(id) })),
                anchor: { type: 'rect', rect: e.currentTarget.getBoundingClientRect(), placement: 'above' },
                ownerWindowId: null,
                invoker: e.currentTarget,
                keyboard: e.detail === 0,
                label: 'Window List',
              });
            }}
          >
            <Icon name="task-manager" size={16} />
          </button>
        )}
        {showVolume && (
          <button
            type="button"
            className="xp-tray__btn"
            aria-label={muted ? 'Volume (muted)' : 'Volume'}
            aria-haspopup="dialog"
            data-tip={muted ? 'Volume (muted)' : 'Volume'}
            onKeyDown={taskbarMenuKey}
            onClick={(e) =>
              openMenu({
                kind: 'volume',
                items: [],
                anchor: { type: 'rect', rect: e.currentTarget.getBoundingClientRect(), placement: 'above' },
                ownerWindowId: null,
                invoker: e.currentTarget,
                keyboard: e.detail === 0,
                label: 'Volume',
              })
            }
          >
            <Icon name={muted ? 'volume-muted' : 'volume'} size={16} />
          </button>
        )}
        {prefsTaskbar.showClock && <Clock />}
      </div>
    </nav>
  );
}
