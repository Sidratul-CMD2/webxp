import { useId, useMemo, useRef, type ReactNode } from 'react';
import { SEED_IDS } from '../../domain/fs';
import { locationContainer } from '../../domain/locations';
import { useApp } from '../../state/app';
import { explorerSurface, goUp, setSort } from '../../state/explorerActions';
import { locationItems, sortItems, type ViewItem } from '../../state/items';
import type { SortKey } from '../../state/types';
import { RenameBox, useCollection } from '../../shell/useCollection';
import { Icon } from '../../ui/icons';
import { formatDateTime } from '../../ui/format';

interface Column {
  key: SortKey;
  label: string;
  width: number;
  value: (item: ViewItem) => string;
}

const NAME: Column = { key: 'name', label: 'Name', width: 200, value: (i) => i.name };
const TYPE: Column = { key: 'type', label: 'Type', width: 110, value: (i) => i.type };
const MODIFIED: Column = { key: 'modified', label: 'Date Modified', width: 140, value: (i) => (i.modified ? formatDateTime(i.modified) : '') };
const IN_FOLDER: Column = { key: 'location', label: 'In Folder', width: 220, value: (i) => i.location ?? '' };
const ORIGINAL: Column = { key: 'location', label: 'Original Location', width: 220, value: (i) => i.location ?? '' };
const DELETED: Column = { key: 'deleted', label: 'Date Deleted', width: 140, value: (i) => (i.deleted ? formatDateTime(i.deleted) : '') };

function dropAttrs(item: ViewItem) {
  if (item.kind === 'folder') return { 'data-drop-folder': item.id };
  if (item.kind === 'shell' && item.id === 'myDocuments') return { 'data-drop-folder': SEED_IDS.myDocuments };
  if (item.kind === 'shell' && item.id === 'recycleBin') return { 'data-drop-bin': '' };
  return {};
}

export function ContentView({ windowId }: { windowId: string }) {
  const fs = useApp((s) => s.fs);
  const explorer = useApp((s) => s.explorers[windowId]);
  const clipboard = useApp((s) => s.clipboard);
  useApp((s) => s.refreshTick);
  const ref = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const surface = useMemo(() => explorerSurface(windowId), [windowId]);
  const { location, sort, view, search, renaming } = explorer;

  const items = useMemo(() => sortItems(locationItems(fs, location, search), sort), [fs, location, sort, search]);
  const cut = useMemo(() => new Set(clipboard?.mode === 'cut' ? clipboard.ids : []), [clipboard]);
  const container = locationContainer(location);
  const grouped = location.kind === 'myComputer' && view !== 'details' && view !== 'list';

  const c = useCollection({
    surface,
    items,
    containerRef: ref,
    label: 'Items',
    onBackspace: () => goUp(windowId),
  });

  // Widths fit a default-size window; wider content scrolls with its header.
  // The Recycle Bin omits Type: every entry is a File Folder.
  const columns: Column[] =
    location.kind === 'recycleBin'
      ? [{ ...NAME, width: 150 }, { ...ORIGINAL, width: 150 }, { ...DELETED, width: 130 }]
      : location.kind === 'search'
        ? [{ ...NAME, width: 150 }, { ...IN_FOLDER, width: 130 }, { ...MODIFIED, width: 130 }]
        : [{ ...NAME, width: 180 }, { ...TYPE, width: 100 }, { ...MODIFIED, width: 130 }];

  const renderItem = (item: ViewItem): ReactNode => {
    const selected = c.selected.has(item.key);
    const isCut = cut.has(item.id);
    // The option is named by the folder name alone: type/date text is hidden from the
    // name computation and exposed as the description instead (described-by still
    // reads hidden nodes). An aria-label would break label-in-name (WCAG 2.5.3).
    const metaId = (n: number) => `${baseId}-${item.key}-${n}`;
    const props = { ...dropAttrs(item), ...c.itemProps(item) };
    const name =
      renaming === item.key ? (
        <RenameBox surface={surface} item={item} />
      ) : (
        <span className="item__name" data-hit>
          {item.name}
        </span>
      );
    const cls = `item item--${view}${selected ? ' is-selected' : ''}${isCut ? ' is-cut' : ''}`;
    switch (view) {
      case 'details':
        return (
          <div
            key={item.key}
            className={cls}
            {...props}
            aria-describedby={columns.slice(1).flatMap((col, n) => (col.value(item) ? [metaId(n)] : [])).join(' ') || undefined}
          >
            <span className="item__cell" style={{ width: columns[0].width }}>
              <Icon name={item.icon} size={16} tinted={selected} ghosted={isCut} />
              {name}
            </span>
            {columns.slice(1).map((col, n) => (
              <span key={col.label} id={metaId(n)} className="item__cell item__cell--meta" style={{ width: col.width }} aria-hidden="true">
                {col.value(item)}
              </span>
            ))}
          </div>
        );
      case 'list':
        return (
          <div key={item.key} className={cls} {...props}>
            <Icon name={item.icon} size={16} tinted={selected} ghosted={isCut} />
            {name}
          </div>
        );
      case 'tiles':
        return (
          <div key={item.key} className={cls} {...props} aria-describedby={metaId(0)}>
            <span data-hit className="item__img">
              <Icon name={item.icon} size={48} tinted={selected} ghosted={isCut} />
            </span>
            <span className="item__text">
              {name}
              <span id={metaId(0)} className="item__meta" aria-hidden="true">{item.kind === 'bin' ? item.location : item.type}</span>
            </span>
          </div>
        );
      case 'thumbnails':
        return (
          <div key={item.key} className={cls} {...props}>
            <span data-hit className="item__thumb">
              <Icon name={item.icon} size={64} ghosted={isCut} />
            </span>
            {name}
          </div>
        );
      default:
        return (
          <div key={item.key} className={cls} {...props}>
            <span data-hit className="item__img">
              <Icon name={item.icon} size={32} tinted={selected} ghosted={isCut} />
            </span>
            {name}
          </div>
        );
    }
  };

  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<string, ViewItem[]>();
    for (const item of items) map.set(item.group ?? '', [...(map.get(item.group ?? '') ?? []), item]);
    return [...map.entries()];
  }, [grouped, items]);

  const emptyText =
    location.kind === 'search'
      ? search?.status === 'running'
        ? null
        : search
          ? 'There are no results to display.'
          : 'Enter a folder name in the Search pane, then click Search.'
      : null;

  const header = view === 'details' && (
        <div className="details-header" role="group" aria-label="Sort by column">
          {columns.map((col) => {
            const active = sort.key === col.key;
            return (
              <button
                key={col.label}
                type="button"
                className={`details-header__cell${active ? ' is-sorted' : ''}`}
                style={{ width: col.width }}
                aria-label={`${col.label}${active ? `, sorted ${sort.dir === 1 ? 'ascending' : 'descending'}` : ''}`}
                onClick={() => setSort(windowId, col.key)}
              >
                {col.label}
                {active && <span className={`sort-arrow${sort.dir === -1 ? ' is-desc' : ''}`} aria-hidden="true" />}
              </button>
            );
          })}
          <span className="details-header__fill" />
        </div>
  );

  const list = (
      <div
        ref={ref}
        className={`content__items xp-scroll view-${view}`}
        data-drop-folder={container ?? undefined}
        data-autofocus
        {...c.containerProps}
      >
        {groups
          ? groups.map(([group, list]) => (
              <div key={group} role="group" aria-label={group} className="item-group">
                <div className="item-group__header" aria-hidden="true">
                  {group}
                </div>
                <div className="item-group__items">{list.map(renderItem)}</div>
              </div>
            ))
          : items.map(renderItem)}
        {items.length === 0 && emptyText && <p className="content__empty">{emptyText}</p>}
        {c.marqueeStyle && <div className="marquee" style={c.marqueeStyle} />}
      </div>
  );

  // In Details view the header sits inside the scroller (sticky), so it scrolls
  // horizontally with its columns and every header stays reachable.
  return (
    <div className={`content content--${view}`}>
      {view === 'details' ? (
        <div className="content__scroll xp-scroll">
          {header}
          {list}
        </div>
      ) : (
        list
      )}
    </div>
  );
}
