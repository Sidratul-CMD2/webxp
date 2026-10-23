import type { Point } from '../domain/prefs';
import { get } from '../state/app';
import { folderCommands, refreshViews, selectedItems, type Command } from '../state/commands';
import { setSort, setView, type Surface } from '../state/explorerActions';
import { updatePrefs } from '../state/sessionActions';
import { arrangeDesktop } from '../state/desktopActions';
import type { MenuEntry, SortKey, ViewMode } from '../state/types';

export function toEntry(id: string, command: Command, label?: string, extra: Partial<Extract<MenuEntry, { label: string }>> = {}): MenuEntry {
  return {
    id,
    label: label ?? command.label,
    shortcut: command.shortcut,
    disabled: command.enabled ? false : (command.reason ?? 'Not available.'),
    run: command.run,
    ...extra,
  };
}

const sep = (id: string): MenuEntry => ({ kind: 'separator', id });

/** Removes separators at the ends and doubled separators. */
export function tidy(entries: MenuEntry[]): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const e of entries) {
    if (e.kind === 'separator' && (out.length === 0 || out[out.length - 1].kind === 'separator')) continue;
    out.push(e);
  }
  while (out.length && out[out.length - 1].kind === 'separator') out.pop();
  return out;
}

export function itemContextMenu(surface: Surface): MenuEntry[] {
  const s = get();
  const items = selectedItems(s, surface);
  const c = folderCommands(s, surface);
  if (items.length === 0) return [];
  const inSearch = surface.kind === 'explorer' && s.explorers[surface.windowId]?.location.kind === 'search';
  if (items.every((i) => i.kind === 'bin')) {
    return tidy([
      toEntry('restore', c.restore, 'R&estore', { bold: true }),
      sep('s1'),
      toEntry('delete', c.delete, '&Delete'),
      ...(c.properties.enabled ? [sep('s2'), toEntry('props', c.properties, 'P&roperties')] : []),
    ]);
  }
  const single = items.length === 1 ? items[0] : null;
  const allMutable = items.every((i) => i.mutable);
  const entries: MenuEntry[] = [toEntry('open', c.open, '&Open', { bold: true })];
  if (c.explore.enabled) entries.push(toEntry('explore', c.explore, 'E&xplore'));
  if (inSearch && single) entries.push(toEntry('containing', c.openContaining, 'Open Containing &Folder'));
  if (single?.kind === 'shell' && single.id === 'recycleBin') {
    entries.push(sep('sbin'), toEntry('empty', c.emptyBin, 'Empty Recycle &Bin'));
  }
  if (allMutable) {
    entries.push(sep('s1'), toEntry('cut', c.cut, 'Cu&t'), toEntry('copy', c.copy, '&Copy'));
    entries.push(sep('s2'), toEntry('delete', c.delete, '&Delete'));
    if (single) entries.push(toEntry('rename', c.rename, 'Rena&me'));
  }
  if (c.properties.enabled) entries.push(sep('s3'), toEntry('props', c.properties, 'P&roperties'));
  return tidy(entries);
}

const VIEWS: [ViewMode, string][] = [
  ['thumbnails', 'T&humbnails'],
  ['tiles', 'Tile&s'],
  ['icons', 'Ico&ns'],
  ['list', '&List'],
  ['details', '&Details'],
];

export function viewSubmenu(windowId: string): MenuEntry[] {
  const view = get().explorers[windowId]?.view;
  return VIEWS.map(([mode, label]) => ({ id: mode, label, radio: true, checked: view === mode, run: () => setView(windowId, mode) }));
}

export function arrangeSubmenu(windowId: string): MenuEntry[] {
  const e = get().explorers[windowId];
  if (!e) return [];
  const keys: [SortKey, string][] =
    e.location.kind === 'recycleBin'
      ? [
          ['name', '&Name'],
          ['location', 'Original &Location'],
          ['deleted', 'Date &Deleted'],
        ]
      : e.location.kind === 'search'
        ? [
            ['name', '&Name'],
            ['location', '&In Folder'],
            ['modified', '&Modified'],
          ]
        : [
            ['name', '&Name'],
            ['type', '&Type'],
            ['modified', '&Modified'],
          ];
  return keys.map(([key, label]) => ({ id: key, label, radio: true, checked: e.sort.key === key, run: () => setSort(windowId, key, 1) }));
}

export function backgroundContextMenu(surface: Surface, at?: Point): MenuEntry[] {
  const s = get();
  const c = folderCommands(s, surface, at);
  if (surface.kind === 'desktop') {
    const d = s.prefs.desktop;
    return [
      {
        id: 'arrange',
        label: 'Arr&ange Icons By',
        submenu: [
          { id: 'name', label: '&Name', run: () => arrangeDesktop('name') },
          { id: 'type', label: '&Type', run: () => arrangeDesktop('type') },
          sep('as'),
          {
            id: 'auto',
            label: '&Auto Arrange',
            checked: d.autoArrange,
            run: () => updatePrefs((p) => ({ ...p, desktop: { ...p.desktop, autoArrange: !p.desktop.autoArrange } })),
          },
          {
            id: 'grid',
            label: 'Align to &Grid',
            checked: d.alignToGrid,
            run: () => updatePrefs((p) => ({ ...p, desktop: { ...p.desktop, alignToGrid: !p.desktop.alignToGrid } })),
          },
        ],
      },
      { id: 'refresh', label: 'R&efresh', run: refreshViews },
      sep('s1'),
      toEntry('paste', c.paste, '&Paste'),
      toEntry('undo', c.undo, c.undo.enabled ? c.undo.label.replace(/^Undo/, '&Undo') : '&Undo'),
      sep('s2'),
      { id: 'new', label: 'Ne&w', submenu: [toEntry('folder', c.newFolder, '&Folder', { icon: 'folder' })] },
      sep('s3'),
      toEntry('props', c.properties, 'P&roperties'),
    ];
  }
  const e = s.explorers[surface.windowId];
  const loc = e?.location.kind;
  const entries: MenuEntry[] = [
    { id: 'view', label: '&View', submenu: viewSubmenu(surface.windowId) },
    { id: 'arrange', label: 'Arr&ange Icons By', submenu: arrangeSubmenu(surface.windowId) },
    { id: 'refresh', label: 'R&efresh', run: refreshViews },
  ];
  if (loc === 'recycleBin') {
    entries.push(sep('s1'), toEntry('empty', c.emptyBin, 'Empty Recycle &Bin'), toEntry('restoreAll', c.restoreAll, 'Restore &All Items'));
  } else if (loc === 'folder' || loc === 'desktop') {
    entries.push(
      sep('s1'),
      toEntry('paste', c.paste, '&Paste'),
      toEntry('undo', c.undo, c.undo.enabled ? c.undo.label.replace(/^Undo/, '&Undo') : '&Undo'),
      sep('s2'),
      { id: 'new', label: 'Ne&w', submenu: [toEntry('folder', c.newFolder, '&Folder', { icon: 'folder' })] },
    );
    if (c.properties.enabled) entries.push(sep('s3'), toEntry('props', c.properties, 'P&roperties'));
  }
  return entries;
}
