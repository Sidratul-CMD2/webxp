import { describe, expect, it } from 'vitest';
import {
  activate,
  clampAll,
  closeWindow,
  emptyWm,
  maximize,
  minimize,
  openWindow,
  restore,
  setBounds,
  tile,
  toggleMaximize,
  toggleShowDesktop,
  type WmState,
} from '../../src/domain/windows';

const work = { x: 0, y: 0, w: 1024, h: 738 };

function open(wm: WmState, title = 'Win'): [WmState, string] {
  const r = openWindow(wm, { appId: 'explorer', title, size: { w: 500, h: 400 } }, work);
  return [r.wm, r.id];
}

function check(wm: WmState) {
  const ids = Object.keys(wm.windows).sort();
  expect([...wm.order].sort()).toEqual(ids);
  expect([...wm.mru].sort()).toEqual(ids);
  if (wm.activeId) expect(wm.windows[wm.activeId].minimized).toBe(false);
}

describe('window manager', () => {
  it('activates, raises and falls back on close to the most recent visible window', () => {
    let wm = emptyWm;
    let a: string, b: string, c: string;
    [wm, a] = open(wm, 'A');
    [wm, b] = open(wm, 'B');
    [wm, c] = open(wm, 'C');
    wm = activate(wm, a);
    expect(wm.order.at(-1)).toBe(a);
    wm = minimize(wm, c);
    wm = closeWindow(wm, a);
    expect(wm.activeId).toBe(b);
    check(wm);
    wm = closeWindow(wm, b);
    expect(wm.activeId).toBeNull();
    check(wm);
  });

  it('retains normal bounds through maximize and minimize', () => {
    let wm = emptyWm;
    let a: string;
    [wm, a] = open(wm);
    wm = setBounds(wm, a, { x: 100, y: 80, w: 600, h: 420 }, work);
    const normal = wm.windows[a].bounds;
    wm = maximize(wm, a);
    wm = minimize(wm, a);
    expect(wm.activeId).toBeNull();
    wm = restore(wm, a, work);
    expect(wm.windows[a].maximized).toBe(true);
    wm = toggleMaximize(wm, a, work);
    expect(wm.windows[a].maximized).toBe(false);
    expect(wm.windows[a].bounds).toEqual(normal);
    check(wm);
  });

  it('clamps to minimum size and keeps windows reachable after viewport shrink', () => {
    let wm = emptyWm;
    let a: string;
    [wm, a] = open(wm);
    wm = setBounds(wm, a, { x: 900, y: 600, w: 100, h: 50 }, work);
    expect(wm.windows[a].bounds.w).toBe(360);
    expect(wm.windows[a].bounds.h).toBe(260);
    const small = { x: 0, y: 0, w: 700, h: 500 };
    wm = clampAll(wm, small);
    const b = wm.windows[a].bounds;
    expect(b.x + b.w).toBeLessThanOrEqual(700);
    expect(b.y + b.h).toBeLessThanOrEqual(500);
  });

  it('Show Desktop restores only its snapshot and drops closed windows', () => {
    let wm = emptyWm;
    let a: string, b: string, c: string, d: string;
    [wm, a] = open(wm, 'A');
    [wm, b] = open(wm, 'B');
    [wm, c] = open(wm, 'C');
    wm = minimize(wm, c);
    wm = toggleShowDesktop(wm);
    expect(wm.showDesktopSnapshot).toEqual([a, b]);
    wm = closeWindow(wm, a);
    [wm, d] = open(wm, 'D');
    wm = toggleShowDesktop(wm);
    expect(wm.windows[b].minimized).toBe(false);
    expect(wm.windows[c].minimized).toBe(true);
    expect(wm.windows[d].minimized).toBe(false);
    expect(wm.showDesktopSnapshot).toBeNull();
    check(wm);
  });

  it('tiles when windows fit and cascades when they do not', () => {
    let wm = emptyWm;
    for (let i = 0; i < 2; i++) [wm] = open(wm);
    const tiled = tile(wm, work, 'vertical');
    expect(Object.values(tiled.windows).map((w) => w.bounds.w)).toEqual([512, 512]);
    for (let i = 0; i < 4; i++) [wm] = open(wm);
    const fallback = tile(wm, work, 'vertical');
    const xs = Object.values(fallback.windows).map((w) => w.bounds.x);
    expect(new Set(xs).size).toBe(6);
    expect(Math.max(...Object.values(fallback.windows).map((w) => w.bounds.w))).toBeGreaterThanOrEqual(360);
  });
});
