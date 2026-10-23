import { expect, test } from '@playwright/test';
import { boot, clickMenuItem, desktop, desktopItem, pin, rect, taskButton, trackErrors, view, win, windows } from './helpers';

test.describe('QA-01 fresh desktop', () => {
  test('seed desktop, My Computer and My Documents open as independent windows', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    const names = await desktop(page).locator('.desktop-icon__label').allTextContents();
    expect(names).toEqual(['My Documents', 'My Computer', 'My Network Places', 'Recycle Bin', 'Internet Explorer']);
    await expect(page.locator('.xp-start__text')).toHaveText('start');

    await desktopItem(page, 'My Computer').dblclick();
    await desktopItem(page, 'My Documents').dblclick();
    const mc = await pin(win(page, 'My Computer'));
    const md = win(page, 'My Documents');
    await expect(mc).toBeVisible();
    await expect(md).toBeVisible();
    await expect(view(mc).locator('.item__name')).toHaveText(["User's Documents", 'Local Disk (C:)']);
    await expect(view(md).locator('.item__name')).toHaveText(['My Music', 'My Pictures']);
    await expect(taskButton(page, 'My Computer')).toBeVisible();
    await expect(taskButton(page, 'My Documents')).toHaveAttribute('aria-pressed', 'true');

    // Seed folders only: drive and structural folders, all leaves empty.
    await taskButton(page, 'My Computer').click();
    await expect(mc).toHaveClass(/is-active/);
    await mc.locator('[role=option]', { hasText: 'Local Disk (C:)' }).dblclick();
    await expect(view(mc).locator('.item__name')).toHaveText(['Documents and Settings', 'Program Files', 'WINDOWS']);
    await view(mc).locator('[role=option]', { hasText: 'WINDOWS' }).dblclick();
    await expect(view(mc).locator('[role=option]')).toHaveCount(0);
    await expect(mc.locator('.status-bar')).toContainText('0 objects');
    expect(errors).toEqual([]);
  });
});

test.describe('QA-02 window manager', () => {
  test('z-order, drag, eight-edge resize, maximize/restore, minimize and viewport shrink', async ({ page }) => {
    await boot(page);
    await desktopItem(page, 'My Computer').dblclick();
    await desktopItem(page, 'My Documents').dblclick();
    const mc = win(page, 'My Computer');
    const md = win(page, 'My Documents');

    // Activation raises the window.
    await mc.locator('.xp-window__title').click();
    await expect(mc).toHaveClass(/is-active/);
    await expect(md).toHaveClass(/is-inactive/);
    const zMc = Number(await mc.evaluate((e) => getComputedStyle(e).zIndex));
    const zMd = Number(await md.evaluate((e) => getComputedStyle(e).zIndex));
    expect(zMc).toBeGreaterThan(zMd);

    // Drag the title bar.
    const before = await rect(mc);
    await page.mouse.move(before.x + 150, before.y + 12);
    await page.mouse.down();
    await page.mouse.move(before.x + 250, before.y + 92, { steps: 5 });
    await page.mouse.up();
    const moved = await rect(mc);
    expect(Math.round(moved.x - before.x)).toBe(100);
    expect(Math.round(moved.y - before.y)).toBe(80);

    // Resize from every edge and corner.
    for (const dir of ['e', 's', 'se', 'w', 'n', 'nw', 'ne', 'sw']) {
      const b = await rect(mc);
      const handle = mc.locator(`.xp-resize--${dir}`);
      const h = await rect(handle);
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
      await page.mouse.down();
      const dx = dir.includes('e') ? 20 : dir.includes('w') ? -20 : 0;
      const dy = dir.includes('s') ? 20 : dir.includes('n') ? -20 : 0;
      await page.mouse.move(h.x + h.width / 2 + dx, h.y + h.height / 2 + dy, { steps: 3 });
      await page.mouse.up();
      const a = await rect(mc);
      if (dx) expect(Math.round(a.width - b.width)).toBe(Math.abs(dx));
      if (dy) expect(Math.round(a.height - b.height)).toBe(Math.abs(dy));
    }

    // Minimum size is enforced.
    const se = await rect(mc.locator('.xp-resize--se'));
    await page.mouse.move(se.x + 5, se.y + 5);
    await page.mouse.down();
    await page.mouse.move(se.x - 900, se.y - 900, { steps: 3 });
    await page.mouse.up();
    const small = await rect(mc);
    expect(Math.round(small.width)).toBe(360);
    expect(Math.round(small.height)).toBe(260);

    // Maximize keeps the normal bounds and fills the work area above the taskbar.
    const normal = await rect(mc);
    await mc.getByRole('button', { name: 'Maximize My Computer' }).click();
    const max = await rect(mc);
    expect(max).toMatchObject({ x: 0, y: 0, width: 1024, height: 738 });
    // Minimize while maximized, restore from the taskbar: stays maximized.
    await mc.getByRole('button', { name: 'Minimize My Computer' }).click();
    await expect(mc).toBeHidden();
    await expect(md).toHaveClass(/is-active/);
    await taskButton(page, 'My Computer').click();
    await expect(mc).toBeVisible();
    expect(await rect(mc)).toMatchObject({ width: 1024, height: 738 });
    // Double-click title toggles back to the retained normal bounds.
    await mc.locator('.xp-window__title').dblclick();
    expect(await rect(mc)).toEqual(normal);

    // Shrinking the viewport keeps title bars and controls reachable.
    await page.setViewportSize({ width: 760, height: 560 });
    for (const w of await windows(page).all()) {
      const r = await rect(w);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(760);
      expect(r.y).toBeGreaterThanOrEqual(0);
      await expect(w.locator('.xp-cap--close')).toBeInViewport();
    }
    // No drag or capture leaks: the desktop still accepts a click.
    await page.mouse.click(700, 500);
    await expect(desktop(page)).toBeVisible();
  });
});

test.describe('QA-03 system menu and close', () => {
  test('keyboard Move rolls back on Escape, Size commits on Enter, close falls back', async ({ page }) => {
    await boot(page);
    await desktopItem(page, 'My Computer').dblclick();
    await desktopItem(page, 'My Documents').dblclick();
    const md = win(page, 'My Documents');
    const start = await rect(md);

    await md.getByRole('button', { name: 'System menu for My Documents' }).click();
    const sys = page.getByRole('menu', { name: 'System menu for My Documents' });
    await expect(sys.getByRole('menuitem', { name: 'Restore' })).toHaveAttribute('aria-disabled', 'true');
    await expect(sys.getByRole('menuitem', { name: 'Maximize' })).not.toHaveAttribute('aria-disabled', 'true');
    await clickMenuItem(page, 'Move');
    await expect(md.locator('.xp-window__movesize')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    expect(Math.round((await rect(md)).x - start.x)).toBe(20);
    await page.keyboard.press('Escape');
    expect(await rect(md)).toEqual(start);

    await md.getByRole('button', { name: 'System menu for My Documents' }).click();
    await clickMenuItem(page, 'Size');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    expect(Math.round((await rect(md)).width - start.width)).toBe(20);

    // Close the active window: focus returns to the last visible window.
    await md.getByRole('button', { name: 'Close My Documents' }).click();
    await expect(md).toHaveCount(0);
    const mc = win(page, 'My Computer');
    await expect(mc).toHaveClass(/is-active/);
    await expect.poll(() => mc.evaluate((e) => e.contains(document.activeElement))).toBe(true);

    // Close the last window: focus returns to the desktop.
    await mc.getByRole('button', { name: 'Close My Computer' }).click();
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-desktop-collection]'))).toBe(true);
  });

  test('ordinary windows do not trap focus', async ({ page }) => {
    await boot(page);
    await desktopItem(page, 'My Computer').dblclick();
    const mc = win(page, 'My Computer');
    await expect(mc).toBeVisible();
    await expect(mc).not.toHaveAttribute('aria-modal', 'true');
    let left = false;
    for (let i = 0; i < 40 && !left; i++) {
      await page.keyboard.press('Tab');
      left = await page.evaluate(() => !document.activeElement?.closest('section[data-window-id]'));
    }
    expect(left).toBe(true);
  });
});
