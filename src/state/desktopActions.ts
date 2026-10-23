import type { Point } from '../domain/prefs';
import { get, workArea } from './app';
import { setDesktopPositions } from './folderActions';
import { clampToDesktop, desktopGrid, desktopItems, desktopLayout, sequentialLayout, snapToGrid, sortItems } from './items';

/** Arrange Icons By: shell icons first, then folders by the chosen key, top-to-bottom then left-to-right. */
export function arrangeDesktop(by: 'name' | 'type'): void {
  const s = get();
  const items = desktopItems(s.fs);
  const shell = items.filter((i) => i.kind === 'shell');
  const folders = sortItems(
    items.filter((i) => i.kind !== 'shell'),
    { key: by, dir: 1 },
  );
  const layout = sequentialLayout([...shell, ...folders].map((i) => i.key), workArea(s), desktopGrid(s.prefs.textScale));
  setDesktopPositions(layout);
}

/** Moves the given icons by a drag delta, snapping when Align to Grid is on. */
export function moveDesktopIcons(keys: string[], dx: number, dy: number): void {
  const s = get();
  if (s.prefs.desktop.autoArrange) return;
  const work = workArea(s);
  const items = desktopItems(s.fs);
  const grid = desktopGrid(s.prefs.textScale);
  const layout = desktopLayout(items, s.prefs.desktop.positions, false, work, grid);
  const moving = new Set(keys);
  const patch: Record<string, Point> = {};
  const taken = new Set(
    items
      .filter((i) => !moving.has(i.key))
      .map((i) => layout[i.key])
      .filter(Boolean)
      .map((p) => `${p.x}:${p.y}`),
  );
  for (const key of keys) {
    const from = layout[key];
    if (!from) continue;
    let p = clampToDesktop({ x: from.x + dx, y: from.y + dy }, work, grid);
    if (s.prefs.desktop.alignToGrid) {
      p = snapToGrid(p, work, grid);
      // Avoid stacking icons in one cell: walk down to the next free cell.
      let guard = 0;
      while (taken.has(`${p.x}:${p.y}`) && guard++ < 200) {
        const next = snapToGrid({ x: p.x, y: p.y + grid.h }, work, grid);
        p = next.y === p.y ? snapToGrid({ x: p.x + grid.w, y: grid.oy }, work, grid) : next;
      }
    }
    taken.add(`${p.x}:${p.y}`);
    patch[key] = p;
  }
  setDesktopPositions(patch);
}
