import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ROOT_ID, SEED_IDS, isLive } from '../../domain/fs';
import {
  LOC,
  locationAddress,
  locationExists,
  locationTitle,
  sameLocation,
  type ShellLocation,
} from '../../domain/locations';
import { get, isCompact, openMenu, useApp } from '../../state/app';
import { folderCommands, refreshViews, type Command } from '../../state/commands';
import { addFavorite, openAbout, openOrganizeFavorites } from '../../state/dialogs';
import {
  canGoBack,
  canGoForward,
  canGoUp,
  explorerSurface,
  goHistory,
  goToHistoryIndex,
  goUp,
  navigate,
  submitAddress,
  togglePane,
} from '../../state/explorerActions';
import { locationIcon as locationIconFor, locationItems } from '../../state/items';
import { updatePrefs } from '../../state/sessionActions';
import type { MenuEntry } from '../../state/types';
import { closeWindow, launch } from '../../state/windowActions';
import { arrangeSubmenu, tidy, toEntry, viewSubmenu } from '../../shell/contextMenus';
import { Icon, type IconName } from '../../ui/icons';
import { escapeMnemonic } from '../../ui/Menu';
import { MenuBar, type MenuBarMenu } from '../../ui/MenuBar';
import { ToolButton, Toolbar } from '../../ui/Toolbar';
import { plural } from '../../ui/format';
import { ContentView } from './ContentView';
import { FoldersPane, SearchPane, TaskPane } from './Panes';

const sep = (id: string): MenuEntry => ({ kind: 'separator', id });

const locationIcon = (loc: ShellLocation): IconName => locationIconFor(get().fs, loc);

function explorerMenus(windowId: string): MenuBarMenu[] {
  const surface = explorerSurface(windowId);
  const c = () => folderCommands(get(), surface);
  return [
    {
      label: '&File',
      items: () => {
        const cmd = c();
        const s = get();
        const e = s.explorers[windowId];
        const hasSelection = (e?.selected.length ?? 0) > 0;
        return tidy([
          ...(hasSelection
            ? [toEntry('open', cmd.open, '&Open', { bold: true }), toEntry('explore', cmd.explore, 'E&xplore')]
            : []),
          ...(e?.location.kind === 'search' && hasSelection ? [toEntry('containing', cmd.openContaining, 'Open Containing &Folder')] : []),
          { id: 'search', label: 'Searc&h…', run: () => togglePane(windowId, 'search') },
          sep('s1'),
          ...(e?.location.kind === 'recycleBin'
            ? [toEntry('restore', cmd.restore, 'R&estore'), toEntry('empty', cmd.emptyBin, 'Empty Recycle &Bin')]
            : [{ id: 'new', label: 'Ne&w', submenu: [toEntry('folder', cmd.newFolder, '&Folder', { icon: 'folder' })] } as MenuEntry]),
          sep('s2'),
          toEntry('delete', cmd.delete, '&Delete'),
          toEntry('rename', cmd.rename, 'Rena&me'),
          toEntry('props', cmd.properties, 'P&roperties'),
          sep('s3'),
          { id: 'close', label: '&Close', run: () => closeWindow(windowId) },
        ]);
      },
    },
    {
      label: '&Edit',
      items: () => {
        const cmd = c();
        return [
          toEntry('undo', cmd.undo, cmd.undo.enabled ? cmd.undo.label.replace(/^Undo/, '&Undo') : '&Undo'),
          sep('s1'),
          toEntry('cut', cmd.cut, 'Cu&t'),
          toEntry('copy', cmd.copy, '&Copy'),
          toEntry('paste', cmd.paste, '&Paste'),
          sep('s2'),
          toEntry('copyto', cmd.copyTo, 'Cop&y To Folder…'),
          toEntry('moveto', cmd.moveTo, 'Mo&ve To Folder…'),
          sep('s3'),
          toEntry('all', cmd.selectAll, 'Select &All'),
          toEntry('invert', cmd.invertSelection, '&Invert Selection'),
        ];
      },
    },
    {
      label: '&View',
      items: () => {
        const s = get();
        const p = s.prefs.explorer;
        const e = s.explorers[windowId];
        return [
          {
            id: 'toolbars',
            label: '&Toolbars',
            submenu: [
              {
                id: 'std',
                label: '&Standard Buttons',
                checked: p.showToolbar,
                run: () => updatePrefs((x) => ({ ...x, explorer: { ...x.explorer, showToolbar: !x.explorer.showToolbar } })),
              },
              {
                id: 'addr',
                label: '&Address Bar',
                checked: p.showAddressBar,
                run: () => updatePrefs((x) => ({ ...x, explorer: { ...x.explorer, showAddressBar: !x.explorer.showAddressBar } })),
              },
            ],
          },
          {
            id: 'status',
            label: 'Status &Bar',
            checked: p.showStatusBar,
            run: () => updatePrefs((x) => ({ ...x, explorer: { ...x.explorer, showStatusBar: !x.explorer.showStatusBar } })),
          },
          {
            id: 'bar',
            label: '&Explorer Bar',
            submenu: [
              { id: 'search', label: '&Search', checked: e?.pane === 'search' || e?.location.kind === 'search', run: () => togglePane(windowId, 'search') },
              { id: 'folders', label: '&Folders', checked: e?.pane === 'folders', run: () => togglePane(windowId, 'folders') },
            ],
          },
          sep('s1'),
          ...viewSubmenu(windowId),
          sep('s2'),
          { id: 'arrange', label: 'Arrange Icons b&y', submenu: arrangeSubmenu(windowId) },
          sep('s3'),
          {
            id: 'goto',
            label: '&Go To',
            submenu: [
              { id: 'back', label: '&Back', disabled: canGoBack(s, windowId) ? false : 'There is no previous location.', run: () => goHistory(windowId, -1) },
              { id: 'fwd', label: '&Forward', disabled: canGoForward(s, windowId) ? false : 'There is no next location.', run: () => goHistory(windowId, 1) },
              { id: 'up', label: '&Up One Level', disabled: canGoUp(s, windowId) ? false : 'This is the top level.', run: () => goUp(windowId) },
              sep('g1'),
              ...(
                [
                  ['mycomp', 'My &Computer', LOC.myComputer],
                  ['mydocs', 'My &Documents', LOC.folder(SEED_IDS.myDocuments)],
                  ['desk', '&Desktop', LOC.desktop],
                ] as const
              ).map(
                ([id, label, loc]): MenuEntry => ({
                  id,
                  label,
                  disabled: e && sameLocation(e.location, loc) ? `This window already shows ${label.replace('&', '')}.` : false,
                  run: () => navigate(windowId, loc),
                }),
              ),
              // The Back/Forward split-arrow lists, also reachable here as full-size menu items.
              sep('g2'),
              ...historyMenu(windowId, 1).reverse(),
              ...historyMenu(windowId, -1),
            ],
          },
          { id: 'refresh', label: '&Refresh', run: refreshViews },
        ];
      },
    },
    {
      label: 'F&avorites',
      items: () => {
        const s = get();
        const e = s.explorers[windowId];
        const canAdd = e?.location.kind === 'folder' && isLive(s.fs, e.location.id);
        return tidy([
          {
            id: 'add',
            label: '&Add to Favorites…',
            disabled: canAdd ? false : 'Only folders can be added to Favorites.',
            run: () => e?.location.kind === 'folder' && void addFavorite(e.location.id),
          },
          { id: 'organize', label: '&Organize Favorites…', run: openOrganizeFavorites },
          sep('s1'),
          ...s.prefs.favorites.map(
            (f): MenuEntry => ({
              id: f.id,
              label: escapeMnemonic(f.name),
              icon: 'folder',
              disabled: isLive(s.fs, f.folderId) ? false : 'This folder no longer exists.',
              run: () => navigate(windowId, LOC.folder(f.folderId)),
            }),
          ),
        ]);
      },
    },
    {
      label: '&Tools',
      items: () => [{ id: 'options', label: 'Folder &Options…', run: () => launch({ app: 'folderOptions' }) }],
    },
    {
      label: '&Help',
      items: () => [
        { id: 'help', label: 'Help and Support &Center', run: () => launch({ app: 'help', topic: 'folders' }) },
        sep('s1'),
        { id: 'about', label: '&About Windows Explorer', run: () => openAbout('Windows Explorer') },
      ],
    },
  ];
}

function historyMenu(windowId: string, dir: -1 | 1): MenuEntry[] {
  const s = get();
  const e = s.explorers[windowId];
  if (!e) return [];
  const entries: MenuEntry[] = [];
  for (let i = e.index + dir, n = 0; i >= 0 && i < e.history.length && n < 9; i += dir) {
    const loc = e.history[i];
    if (!locationExists(s.fs, loc) || entries.some((x) => x.kind !== 'separator' && x.label === escapeMnemonic(locationTitle(s.fs, loc)))) continue;
    const target = i;
    entries.push({
      id: `h${i}`,
      label: escapeMnemonic(locationTitle(s.fs, loc)),
      icon: locationIcon(loc),
      run: () => goToHistoryIndex(windowId, target),
    });
    n++;
  }
  return entries;
}

function addressMenu(windowId: string): MenuEntry[] {
  const s = get();
  const e = s.explorers[windowId];
  const places: { loc: ShellLocation; label: string; depth: number }[] = [
    { loc: LOC.desktop, label: 'Desktop', depth: 0 },
    { loc: LOC.folder(SEED_IDS.myDocuments), label: 'My Documents', depth: 1 },
    { loc: LOC.myComputer, label: 'My Computer', depth: 1 },
    { loc: LOC.folder(ROOT_ID), label: 'Local Disk (C:)', depth: 2 },
    { loc: LOC.network, label: 'My Network Places', depth: 1 },
    { loc: LOC.recycleBin, label: 'Recycle Bin', depth: 1 },
  ];
  if (e && e.location.kind === 'folder' && !places.some((p) => sameLocation(p.loc, e.location))) {
    places.splice(4, 0, { loc: e.location, label: locationTitle(s.fs, e.location), depth: 3 });
  }
  return places.map((p, i) => ({
    id: `a${i}`,
    label: `${' '.repeat(p.depth)}${escapeMnemonic(p.label)}`,
    icon: locationIcon(p.loc),
    bold: e ? sameLocation(e.location, p.loc) : false,
    run: () => navigate(windowId, p.loc),
  }));
}

function AddressBar({ windowId }: { windowId: string }) {
  const location = useApp((s) => s.explorers[windowId].location);
  const fullPath = useApp((s) => s.prefs.explorer.fullPathInAddress);
  const address = useApp((s) => locationAddress(s.fs, location, fullPath));
  const [draft, setDraft] = useState(address);
  const id = useId();
  useEffect(() => setDraft(address), [address]);
  const go = () => {
    if (!submitAddress(windowId, draft)) setDraft(draft);
  };
  return (
    <div className="address-bar">
      <label htmlFor={id} className="address-bar__label">
        A<span className="mnemonic">d</span>dress
      </label>
      <div className="address-bar__combo">
        <Icon name={locationIcon(location)} size={16} />
        <input
          id={id}
          className="address-bar__input"
          value={draft}
          spellCheck={false}
          autoComplete="off"
          maxLength={1024}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              go();
            } else if (e.key === 'Escape') {
              setDraft(address);
            }
          }}
        />
        <button
          type="button"
          className="address-bar__drop"
          aria-label="Show address list"
          aria-haspopup="menu"
          onClick={(e) => {
            const rect = e.currentTarget.parentElement!.getBoundingClientRect();
            openMenu({
              kind: 'menu',
              items: addressMenu(windowId),
              anchor: { type: 'rect', rect, placement: 'below' },
              ownerWindowId: windowId,
              invoker: e.currentTarget,
              keyboard: e.detail === 0,
              label: 'Address list',
            });
          }}
        />
      </div>
      <button type="button" className="address-bar__go" onClick={go} aria-label="Go to the typed address" data-tip={`Go to "${draft}"`}>
        <Icon name="go" size={16} />
        <span>Go</span>
      </button>
    </div>
  );
}

function StatusBar({ windowId }: { windowId: string }) {
  const fs = useApp((s) => s.fs);
  const e = useApp((s) => s.explorers[windowId]);
  const total = useMemo(() => locationItems(fs, e.location, e.search).length, [fs, e.location, e.search]);
  let text: string;
  if (e.location.kind === 'search' && e.search?.status === 'running') text = 'Searching…';
  else if (e.selected.length) text = `${plural(e.selected.length, 'object')} selected`;
  else text = plural(total, 'object');
  if (e.location.kind === 'search' && e.search?.status === 'stopped') text += ' (search stopped; results may be incomplete)';
  const zone = e.location.kind === 'folder' || e.location.kind === 'desktop' || e.location.kind === 'myComputer';
  return (
    <div className="status-bar" role="status" aria-live="off">
      <span className="status-bar__panel status-bar__panel--main">{text}</span>
      <span className="status-bar__panel status-bar__panel--zone">
        {zone && (
          <>
            <Icon name="my-computer" size={16} />
            <span>My Computer</span>
          </>
        )}
      </span>
    </div>
  );
}

export function ExplorerApp({ windowId }: { windowId: string }) {
  const explorer = useApp((s) => s.explorers[windowId]);
  const prefs = useApp((s) => s.prefs.explorer);
  const compact = useApp(isCompact);
  const back = useApp((s) => canGoBack(s, windowId));
  const forward = useApp((s) => canGoForward(s, windowId));
  const up = useApp((s) => canGoUp(s, windowId));
  const menus = useMemo(() => explorerMenus(windowId), [windowId]);
  if (!explorer) return null;
  const pane = explorer.location.kind === 'search' && explorer.pane !== 'folders' ? 'search' : explorer.pane;
  const searching = pane === 'search';

  const dropdown = (items: MenuEntry[], label: string) => (el: HTMLElement, keyboard: boolean) =>
    openMenu({
      kind: 'menu',
      items,
      anchor: { type: 'rect', rect: el.getBoundingClientRect(), placement: 'below' },
      ownerWindowId: windowId,
      invoker: el,
      keyboard,
      label,
    });

  // Window-wide accelerators (as in XP) outside text fields; the item view handles its own keys.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [role="menu"], [role="listbox"]')) return;
    const c = folderCommands(get(), explorerSurface(windowId));
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    let command: Command | null = null;
    if (mod && !e.shiftKey) command = ({ z: c.undo, x: c.cut, c: c.copy, v: c.paste, a: c.selectAll } as Record<string, Command>)[key] ?? null;
    else if (!mod && key === 'Delete') command = e.shiftKey ? c.deletePermanently : c.delete;
    else if (!mod && key === 'F2') command = c.rename;
    else if (!mod && key === 'Backspace') {
      e.preventDefault();
      goUp(windowId);
      return;
    }
    if (!command) return;
    e.preventDefault();
    command.run();
  };

  return (
    <div className={`explorer${compact ? ' is-compact' : ''}`} onKeyDown={onKeyDown}>
      <div className="explorer__bars">
        <MenuBar menus={menus} ownerWindowId={windowId} />
        {prefs.showToolbar && (
          <Toolbar label="Standard Buttons" className="explorer__toolbar">
            <ToolButton
              icon="back"
              label="Back"
              showLabel
              disabled={!back}
              disabledReason="there is no previous location in this window"
              onClick={() => goHistory(windowId, -1)}
              dropdown={(el, kb) => dropdown(historyMenu(windowId, -1), 'Back history')(el, kb)}
            />
            <ToolButton icon="forward" label="Forward" disabled={!forward} disabledReason="there is no next location in this window" onClick={() => goHistory(windowId, 1)} dropdown={(el, kb) => dropdown(historyMenu(windowId, 1), 'Forward history')(el, kb)} />
            <ToolButton icon="up" label="Up" disabled={!up} disabledReason="this is the top level" onClick={() => goUp(windowId)} />
            <span className="xp-toolbar__sep" aria-hidden="true" />
            <ToolButton icon="search" label="Search" showLabel pressed={searching} onClick={() => togglePane(windowId, 'search')} />
            <ToolButton icon="folders" label="Folders" showLabel pressed={pane === 'folders'} onClick={() => togglePane(windowId, 'folders')} />
            <span className="xp-toolbar__sep" aria-hidden="true" />
            <ToolButton icon="views" label="Views" hasMenu onClick={(el, kb) => dropdown(viewSubmenu(windowId), 'Views')(el, kb)} />
          </Toolbar>
        )}
        {prefs.showAddressBar && <AddressBar windowId={windowId} />}
      </div>
      <div className="explorer__body">
        {pane !== 'none' && !(compact && pane === 'tasks') && (
          <div className={`explorer__pane explorer__pane--${pane}`}>
            {pane === 'tasks' && <TaskPane windowId={windowId} />}
            {pane === 'folders' && <FoldersPane windowId={windowId} />}
            {pane === 'search' && <SearchPane windowId={windowId} />}
          </div>
        )}
        <ContentView windowId={windowId} />
      </div>
      {prefs.showStatusBar && <StatusBar windowId={windowId} />}
    </div>
  );
}
