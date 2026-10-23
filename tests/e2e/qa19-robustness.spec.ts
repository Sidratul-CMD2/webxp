import { expect, test, type Page } from '@playwright/test';
import { boot, desktopItem, item, openMyDocuments, pin, rect, trackErrors, win, windows } from './helpers';

/** A valid saved envelope with `count` user folders in My Documents (loaded through normal hydration). */
function envelopeWithFolders(count: number): string {
  const t = Date.parse('2026-10-23T09:00:00-04:00');
  const seed: [string, string | null, string][] = [
    ['c', null, 'C:'],
    ['das', 'c', 'Documents and Settings'],
    ['user', 'das', 'User'],
    ['desktop', 'user', 'Desktop'],
    ['mydocs', 'user', 'My Documents'],
    ['mypics', 'mydocs', 'My Pictures'],
    ['mymusic', 'mydocs', 'My Music'],
    ['progfiles', 'c', 'Program Files'],
    ['windows', 'c', 'WINDOWS'],
  ];
  const nodes: Record<string, unknown> = {};
  for (const [id, parentId, name] of seed) nodes[id] = { id, parentId, name, created: t, modified: t };
  for (let i = 1; i <= count; i++) {
    nodes[`f${i}`] = { id: `f${i}`, parentId: 'mydocs', name: `Folder ${String(i).padStart(3, '0')}`, created: t, modified: t };
  }
  const prefs = {
    wallpaper: 'hillside',
    wallpaperPosition: 'stretch',
    backgroundColor: '#3a6ea5',
    textScale: 'normal',
    highContrast: false,
    largerControls: false,
    motion: 'system',
    taskbar: { grouping: true, quickLaunch: false, showClock: true, autoHide: false },
    sound: { volume: 70, muted: false, showTrayIcon: true },
    desktop: { autoArrange: false, alignToGrid: true, positions: {} },
    explorer: { showTasks: true, newWindowPerFolder: false, fullPathInTitle: false, fullPathInAddress: false, showStatusBar: true, showAddressBar: true, showToolbar: true },
    favorites: [],
    recentApps: ['explorer', 'calculator'],
  };
  return JSON.stringify({ version: 1, savedAt: t, fs: { nodes, bin: [], nextId: count + 1 }, prefs });
}

async function seed(page: Page, count: number) {
  const text = envelopeWithFolders(count);
  await page.addInitScript((payload) => {
    if (!sessionStorage.getItem('qa19-seeded')) {
      localStorage.setItem('xp-sim:v1', payload);
      sessionStorage.setItem('qa19-seeded', '1');
    }
  }, text);
}

async function dragBy(page: Page, x: number, y: number, dx: number, dy: number, steps: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
}

test.describe('QA-19 scale and performance', () => {
  test('10 windows and 100 folders: drags stay smooth, z-order stays bounded', async ({ page, browserName }, testInfo) => {
    const errors = trackErrors(page);
    await seed(page, 100);
    await boot(page);
    // Ten Explorer windows, half of them showing the 100-folder My Documents.
    for (let i = 0; i < 10; i++) {
      await desktopItem(page, i % 2 ? 'My Computer' : 'My Documents').dblclick();
    }
    await expect(windows(page)).toHaveCount(10);
    const top = page.locator('section[data-window-id="w10"]');
    await expect(top).toHaveClass(/is-active/);
    const docs = page.locator('section[data-window-id="w9"]');
    // 100 seeded folders plus My Music and My Pictures.
    await expect(docs.locator('[role=option]')).toHaveCount(102);

    if (browserName === 'chromium') {
      await page.evaluate(() => {
        (window as unknown as { __long: number[] }).__long = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) (window as unknown as { __long: number[] }).__long.push(e.duration);
        }).observe({ type: 'longtask', buffered: false });
      });
    }
    // Drag the active window across the screen in 60 pointer moves.
    const r = await rect(top);
    const t0 = Date.now();
    await dragBy(page, r.x + 200, r.y + 12, -150, 120, 60);
    const dragMs = Date.now() - t0;
    const moved = await rect(top);
    expect(Math.round(moved.x - r.x)).toBe(-150);
    // Marquee over the 100-item view.
    await page.locator('section[data-window-id="w9"]').evaluate((e) => e.scrollIntoView());
    if (browserName === 'chromium') {
      const longTasks = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
      const max = longTasks.length ? Math.max(...longTasks) : 0;
      testInfo.annotations.push({ type: 'measure', description: `drag 60 moves: ${dragMs} ms total; long tasks ${longTasks.length}, max ${Math.round(max)} ms` });
      // No sustained main-thread blocking during the drag (a long task is ≥50 ms).
      expect(longTasks.filter((d) => d > 100)).toEqual([]);
    } else {
      testInfo.annotations.push({ type: 'measure', description: `drag 60 moves: ${dragMs} ms total (long-task API unavailable)` });
    }
    // Activate windows repeatedly through the taskbar: z-indices are rebased, not unbounded.
    for (let round = 0; round < 3; round++) {
      for (const id of ['w1', 'w4', 'w7', 'w2']) {
        await page.getByRole('group', { name: 'Running windows' }).getByRole('button', { name: /Windows Explorer windows/ }).click();
        await page.getByRole('menu', { name: 'Windows Explorer windows' }).getByRole('menuitem').nth(Number(id.slice(1)) - 1).click();
      }
    }
    const z = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('section[data-window-id]')].map((s) => Number(s.style.zIndex)));
    expect(Math.max(...z)).toBeLessThanOrEqual(10 + 10);
    expect(new Set(z).size).toBe(10);
    expect(errors).toEqual([]);
  });

  test('100 open/close cycles leave no windows, nodes or listeners behind', async ({ page, browserName }, testInfo) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await boot(page);
    const domCount = () => page.evaluate(() => document.getElementsByTagName('*').length);
    const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
    const listenerCount = async () => {
      if (!cdp) return -1;
      const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
      const doc = await cdp.send('Runtime.evaluate', { expression: 'document' });
      const docListeners = await cdp.send('DOMDebugger.getEventListeners', { objectId: doc.result.objectId! });
      return listeners.length + docListeners.listeners.length;
    };
    // Warm up once so lazily created nodes (tooltip, live region text) exist in both measurements.
    await desktopItem(page, 'My Computer').dblclick();
    await win(page, 'My Computer').getByRole('button', { name: 'Close My Computer' }).click();
    const nodesBefore = await domCount();
    const listenersBefore = await listenerCount();
    for (let i = 0; i < 100; i++) {
      const target = i % 3 === 0 ? 'My Documents' : i % 3 === 1 ? 'My Computer' : 'Recycle Bin';
      await desktopItem(page, target).dblclick();
      const w = win(page, target);
      await w.getByRole('button', { name: `Close ${target}` }).click();
      await expect(w).toHaveCount(0);
    }
    await expect(windows(page)).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Running windows' }).getByRole('button')).toHaveCount(0);
    const nodesAfter = await domCount();
    const listenersAfter = await listenerCount();
    testInfo.annotations.push({ type: 'measure', description: `DOM elements ${nodesBefore} → ${nodesAfter}; window+document listeners ${listenersBefore} → ${listenersAfter}` });
    expect(Math.abs(nodesAfter - nodesBefore)).toBeLessThanOrEqual(5);
    if (cdp) expect(listenersAfter).toBeLessThanOrEqual(listenersBefore);
    expect(errors).toEqual([]);
  });
});

test.describe('QA-19 interrupted pointer input', () => {
  test('pointer cancel and window blur roll back a window drag and leave nothing stuck', async ({ page }) => {
    await boot(page);
    await desktopItem(page, 'My Computer').dblclick();
    const mc = await pin(win(page, 'My Computer'));
    const before = await rect(mc);
    const title = mc.locator('.xp-window__titlebar');
    // pointercancel mid-drag
    await page.mouse.move(before.x + 200, before.y + 12);
    await page.mouse.down();
    await page.mouse.move(before.x + 300, before.y + 80, { steps: 5 });
    await title.dispatchEvent('pointercancel', { pointerId: 1 });
    await page.mouse.up();
    expect(await rect(mc)).toEqual(before);
    await expect(page.locator('html')).not.toHaveClass(/is-dragging-window/);
    // window blur mid-drag
    await page.mouse.move(before.x + 200, before.y + 12);
    await page.mouse.down();
    await page.mouse.move(before.x + 260, before.y + 60, { steps: 5 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.mouse.up();
    expect(await rect(mc)).toEqual(before);
    // Escape mid-resize
    const se = await rect(mc.locator('.xp-resize--se'));
    await page.mouse.move(se.x + 5, se.y + 5);
    await page.mouse.down();
    await page.mouse.move(se.x + 80, se.y + 60, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await rect(mc)).toEqual(before);
    // The window still drags normally afterwards.
    await dragBy(page, before.x + 200, before.y + 12, 40, 30, 4);
    expect(Math.round((await rect(mc)).x - before.x)).toBe(40);
  });

  test('cancelled folder drags move nothing and leave no ghost', async ({ page }) => {
    await boot(page);
    const docs = await pin(await openMyDocuments(page));
    const music = item(docs, 'My Music');
    const pics = item(docs, 'My Pictures');
    const a = await rect(pics);
    const b = await rect(desktopItem(page, 'Recycle Bin'));
    // Escape mid-drag
    await page.mouse.move(a.x + 20, a.y + 20);
    await page.mouse.down();
    await page.mouse.move(b.x + 20, b.y + 20, { steps: 8 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // pointercancel mid-drag (My Pictures is protected, so use the drag preview only)
    const m = await rect(music);
    await page.mouse.move(m.x + 20, m.y + 20);
    await page.mouse.down();
    await page.mouse.move(m.x + 120, m.y + 120, { steps: 6 });
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
    await page.mouse.up();
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/is-dragging-items/);
    await expect(item(docs, 'My Music')).toBeVisible();
    await expect(item(docs, 'My Pictures')).toBeVisible();
  });
});

test.describe('QA-19 viewport changes mid-interaction', () => {
  test('resizing during a menu, a dialog and a drag leaves every control reachable', async ({ page }) => {
    await boot(page);
    await desktopItem(page, 'My Computer').dblclick();
    const mc = await pin(win(page, 'My Computer'));
    // Menu open while the viewport shrinks: it closes instead of staying stranded.
    await page.mouse.click(980, 600, { button: 'right' });
    await expect(page.getByRole('menu', { name: 'Desktop menu' })).toBeVisible();
    await page.setViewportSize({ width: 800, height: 600 });
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByTestId('menu-catcher')).toHaveCount(0);
    // Dialog open while the viewport shrinks: it stays inside.
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Run…' }).click();
    const run = page.getByRole('dialog', { name: 'Run' });
    await expect(run).toBeVisible();
    await page.setViewportSize({ width: 720, height: 420 });
    await expect.poll(async () => { const d = await rect(run); return d.x + d.width <= 720 && d.y + d.height <= 420; }).toBe(true);
    await expect(run.getByRole('button', { name: 'Cancel' })).toBeInViewport();
    await page.keyboard.press('Escape');
    // Drag in progress while the viewport shrinks: the committed window is clamped.
    await page.setViewportSize({ width: 1024, height: 768 });
    const r = await rect(mc);
    await page.mouse.move(r.x + 200, r.y + 12);
    await page.mouse.down();
    await page.mouse.move(r.x + 500, r.y + 300, { steps: 6 });
    await page.setViewportSize({ width: 760, height: 560 });
    await page.mouse.move(r.x + 520, r.y + 310, { steps: 2 });
    await page.mouse.up();
    await expect(page.locator('html')).not.toHaveClass(/is-dragging-window/);
    const after = await rect(mc);
    expect(after.y + 30).toBeLessThanOrEqual(560);
    await expect(mc.getByRole('button', { name: 'System menu for My Computer' })).toBeInViewport();
    // Dragging far off-screen still leaves the title strip reachable.
    await dragBy(page, after.x + 100, after.y + 12, -900, 0, 6);
    const off = await rect(mc);
    expect(off.x + off.width).toBeGreaterThanOrEqual(60);
    // Growing the viewport re-clamps the window fully on-screen (applied on the next render).
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect.poll(async () => (await rect(mc)).x).toBeGreaterThanOrEqual(0);
    await expect(mc.getByRole('button', { name: 'Close My Computer' })).toBeInViewport();
  });
});
