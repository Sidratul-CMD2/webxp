import { useMemo, useRef, type CSSProperties } from 'react';
import { SEED_IDS } from '../domain/fs';
import type { Prefs, WallpaperId } from '../domain/prefs';
import hillside from '../assets/wallpapers/hillside.svg';
import azure from '../assets/wallpapers/azure.svg';
import dusk from '../assets/wallpapers/dusk.svg';
import { useApp, workArea } from '../state/app';
import { moveDesktopIcons } from '../state/desktopActions';
import { DESKTOP } from '../state/explorerActions';
import { desktopGrid, desktopItems, desktopLayout, type ViewItem } from '../state/items';
import { Icon } from '../ui/icons';
import { RenameBox, useCollection } from './useCollection';

export const WALLPAPER_URLS: Record<Exclude<WallpaperId, 'none'>, string> = { hillside, azure, dusk };

export const WALLPAPER_NAMES: Record<WallpaperId, string> = {
  none: '(None)',
  hillside: 'Hillside (substitute)',
  azure: 'Azure',
  dusk: 'Dusk',
};

export function wallpaperStyle(prefs: Pick<Prefs, 'wallpaper' | 'wallpaperPosition' | 'backgroundColor'>): CSSProperties {
  if (prefs.wallpaper === 'none') return { backgroundColor: prefs.backgroundColor };
  const url = `url("${WALLPAPER_URLS[prefs.wallpaper]}")`;
  switch (prefs.wallpaperPosition) {
    case 'center':
      return { backgroundColor: prefs.backgroundColor, backgroundImage: url, backgroundRepeat: 'no-repeat', backgroundPosition: 'center' };
    case 'tile':
      return { backgroundColor: prefs.backgroundColor, backgroundImage: url, backgroundRepeat: 'repeat', backgroundSize: '400px 250px' };
    default:
      return { backgroundColor: prefs.backgroundColor, backgroundImage: url, backgroundSize: '100% 100%' };
  }
}

function dropAttrs(item: ViewItem) {
  if (item.kind === 'folder') return { 'data-drop-folder': item.id };
  if (item.kind === 'shell' && item.id === 'myDocuments') return { 'data-drop-folder': SEED_IDS.myDocuments };
  if (item.kind === 'shell' && item.id === 'recycleBin') return { 'data-drop-bin': '' };
  return {};
}

export function Desktop() {
  const fs = useApp((s) => s.fs);
  const wallpaper = useApp((s) => ({ wallpaper: s.prefs.wallpaper, wallpaperPosition: s.prefs.wallpaperPosition, backgroundColor: s.prefs.backgroundColor }));
  const positions = useApp((s) => s.prefs.desktop.positions);
  const autoArrange = useApp((s) => s.prefs.desktop.autoArrange);
  const work = useApp(workArea);
  const clipboard = useApp((s) => s.clipboard);
  const renaming = useApp((s) => s.desktop.renaming);
  useApp((s) => s.refreshTick);
  const ref = useRef<HTMLDivElement>(null);

  const items = useMemo(() => desktopItems(fs), [fs]);
  const textScale = useApp((s) => s.prefs.textScale);
  const grid = useMemo(() => desktopGrid(textScale), [textScale]);
  const layout = useMemo(() => desktopLayout(items, positions, autoArrange, work, grid), [items, positions, autoArrange, work, grid]);
  // Visual order for ranges and Home/End: down each column, then across.
  const ordered = useMemo(
    () => [...items].sort((a, b) => layout[a.key].x - layout[b.key].x || layout[a.key].y - layout[b.key].y),
    [items, layout],
  );
  const cut = useMemo(() => new Set(clipboard?.mode === 'cut' ? clipboard.ids : []), [clipboard]);

  const c = useCollection({ surface: DESKTOP, items: ordered, containerRef: ref, label: 'Desktop', onReposition: moveDesktopIcons });

  return (
    <div className="desktop" style={wallpaperStyle(wallpaper)}>
      <div
        ref={ref}
        className="desktop__icons"
        data-desktop-collection
        data-drop-desktop
        style={{ width: work.w, height: work.h }}
        {...c.containerProps}
      >
        {ordered.map((item) => {
          const selected = c.selected.has(item.key);
          const pos = layout[item.key];
          return (
            <div
              key={item.key}
              className={`desktop-icon${selected ? ' is-selected' : ''}${cut.has(item.id) ? ' is-cut' : ''}`}
              style={{ left: pos.x, top: pos.y, width: grid.w }}
              {...dropAttrs(item)}
              {...c.itemProps(item)}
            >
              <span className="desktop-icon__img" data-hit>
                <Icon name={item.icon} size={32} tinted={selected} ghosted={cut.has(item.id)} />
              </span>
              {renaming === item.key ? (
                <RenameBox surface={DESKTOP} item={item} className="rename--desktop" />
              ) : (
                <span className="desktop-icon__label" data-hit>
                  {item.name}
                </span>
              )}
            </div>
          );
        })}
        {c.marqueeStyle && <div className="marquee" style={c.marqueeStyle} />}
      </div>
    </div>
  );
}
