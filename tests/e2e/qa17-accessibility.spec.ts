import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot, clickMenuItem, desktopItem, item, openStart, rect, win } from './helpers';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/*
 * In XP-sized controls the Back/Forward split-arrow buttons are 13px wide. They
 * meet WCAG 2.5.8 through its "equivalent" exception: the same history lists
 * are full-size items in View > Go To. axe cannot detect equivalents, so these
 * arrows are excluded from default-size scans only; larger-controls scans
 * include them (they are 24px wide there).
 */
const SPLIT_ARROWS = '.xp-toolbtn--drop';

/** Automated scan only: it supplements, and does not replace, manual review. */
async function expectNoAxeViolations(page: Page, label: string, testInfo: TestInfo, exclude: string[] = []) {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  for (const selector of exclude) builder = builder.exclude(selector);
  const results = await builder.analyze();
  await testInfo.attach(`axe-${label}.json`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary, `axe violations in ${label}`).toEqual([]);
}

async function openAppsTour(page: Page, testInfo: TestInfo, label: string, exclude: string[] = []) {
  await expectNoAxeViolations(page, `${label}-desktop`, testInfo, exclude);
  await openStart(page);
  await page.getByRole('menuitem', { name: 'All Programs' }).hover();
  await page.getByRole('menuitem', { name: 'Accessories' }).hover();
  await expect(page.getByRole('menu', { name: 'Accessories' })).toBeVisible();
  await expectNoAxeViolations(page, `${label}-start`, testInfo, exclude);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await desktopItem(page, 'My Documents').dblclick();
  const docs = win(page, 'My Documents');
  await docs.getByRole('button', { name: 'Folders', exact: true }).click();
  await docs.getByRole('button', { name: 'Views', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Details' }).click();
  await expectNoAxeViolations(page, `${label}-explorer`, testInfo, exclude);
  await item(docs, 'My Music').click({ button: 'right' });
  await expectNoAxeViolations(page, `${label}-context-menu`, testInfo, exclude);
  await page.keyboard.press('Escape');

  await openStart(page);
  await page.getByRole('menuitem', { name: 'Run…' }).click();
  await expectNoAxeViolations(page, `${label}-run`, testInfo, exclude);
  await page.keyboard.press('Escape');

  await openStart(page);
  await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Control Panel' }).first().click();
  await win(page, 'Control Panel').getByRole('button', { name: 'Appearance and Themes' }).click();
  await win(page, 'Control Panel').getByRole('button', { name: 'Display', exact: true }).click();
  await expectNoAxeViolations(page, `${label}-control-panel-display`, testInfo, exclude);

  for (const name of ['Help and Support', 'Calculator']) {
    await openStart(page);
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name }).first().click();
  }
  await desktopItem(page, 'Internet Explorer').dblclick();
  await page.getByRole('button', { name: 'Start', exact: true }).click({ button: 'right' });
  await clickMenuItem(page, 'Task Manager');
  await expectNoAxeViolations(page, `${label}-all-apps`, testInfo, exclude);

  await desktopItem(page, 'Recycle Bin').dblclick();
  await expectNoAxeViolations(page, `${label}-recycle-bin`, testInfo, exclude);

  await openStart(page);
  await page.getByRole('menuitem', { name: 'Turn Off Computer' }).click();
  await expectNoAxeViolations(page, `${label}-turn-off`, testInfo, exclude);
  await page.keyboard.press('Escape');
}

test.describe('QA-17 automated WCAG 2.2 AA scan (axe)', () => {
  test('default theme: desktop, Start, Explorer, menus, dialogs and every app', async ({ page }, testInfo) => {
    await boot(page);
    await openAppsTour(page, testInfo, 'default', [SPLIT_ARROWS]);
  });

  test('larger controls and increased contrast modes', async ({ page }, testInfo) => {
    await boot(page);
    await openStart(page);
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Control Panel' }).first().click();
    const cp = win(page, 'Control Panel');
    await cp.getByRole('button', { name: 'Accessibility Options' }).click();
    await cp.getByRole('button', { name: 'Accessibility Options', exact: true }).last().click();
    const acc = win(page, 'Accessibility Options');
    await acc.getByLabel('Use increased contrast').check();
    await acc.getByLabel('Use larger controls').check();
    await acc.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('html')).toHaveClass(/high-contrast/);
    await expect(page.locator('html')).toHaveClass(/larger-controls/);
    await cp.getByRole('button', { name: 'Close Control Panel' }).click();
    // Focus indicators are thicker in increased-contrast mode.
    await page.getByRole('button', { name: 'Start', exact: true }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth);
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(2);
    await openAppsTour(page, testInfo, 'large-contrast');
  });
});

test.describe('QA-17 semantics for assistive technology', () => {
  test('names, roles and states are exposed', async ({ page }) => {
    await boot(page);
    // Desktop collection
    await expect(page.getByRole('listbox', { name: 'Desktop' })).toHaveAttribute('aria-multiselectable', 'true');
    await desktopItem(page, 'My Computer').click();
    await expect(desktopItem(page, 'My Computer')).toHaveAttribute('aria-selected', 'true');
    // Start button state
    const start = page.getByRole('button', { name: 'Start', exact: true });
    await expect(start).toHaveAttribute('aria-expanded', 'false');
    await start.click();
    await expect(start).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: 'All Programs' })).toHaveAttribute('aria-haspopup', 'menu');
    await page.keyboard.press('Escape');
    // Windows are named, non-modal regions with named title controls.
    await desktopItem(page, 'My Computer').dblclick();
    const mc = win(page, 'My Computer');
    await expect(mc).not.toHaveAttribute('aria-modal', 'true');
    for (const name of ['System menu for My Computer', 'Minimize My Computer', 'Maximize My Computer', 'Close My Computer']) {
      await expect(mc.getByRole('button', { name })).toBeVisible();
    }
    // Taskbar buttons report pressed state.
    await expect(page.getByRole('group', { name: 'Running windows' }).getByRole('button', { name: 'My Computer' })).toHaveAttribute('aria-pressed', 'true');
    // Tree items report expansion; menu items report disabled state with a reason.
    await mc.getByRole('button', { name: 'Folders', exact: true }).click();
    // Ancestors of the current location are expanded; the location itself is not until opened.
    await expect(mc.getByRole('treeitem', { name: 'Desktop' })).toHaveAttribute('aria-expanded', 'true');
    const mcNode = mc.getByRole('treeitem', { name: 'My Computer' });
    await expect(mcNode).toHaveAttribute('aria-expanded', 'false');
    await mcNode.focus();
    await page.keyboard.press('ArrowRight');
    await expect(mcNode).toHaveAttribute('aria-expanded', 'true');
    await mc.getByRole('menubar').getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const cut = page.getByRole('menuitem', { name: 'Cut', exact: true });
    await expect(cut).toHaveAttribute('aria-disabled', 'true');
    await expect(cut).toHaveAccessibleDescription(/Select a folder first|protected/);
    await expect(cut).toHaveAttribute('aria-keyshortcuts', 'Control+X');
    await page.keyboard.press('Escape');
    // True modals are labelled, modal, and make the shell inert.
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Run…' }).click();
    const run = page.getByRole('dialog', { name: 'Run' });
    await expect(run).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('.shell')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('.shell')).not.toHaveAttribute('inert', '');
    // Operation results are announced politely.
    const live = page.locator('[aria-live="polite"]').first();
    await mc.getByLabel('Address', { exact: true }).fill('My Documents');
    await mc.getByLabel('Address', { exact: true }).press('Enter');
    await win(page, 'My Documents').getByRole('menubar').getByRole('menuitem', { name: 'File', exact: true }).click();
    await clickMenuItem(page, 'New');
    await clickMenuItem(page, 'Folder');
    await expect(live).toContainText('New Folder created');
  });
});

test.describe('QA-17 compact touch viewport (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test.skip(({ browserName }) => browserName === 'firefox', 'Playwright cannot emulate touch input in Firefox.');

  test('windows fill the workspace; tap, tap-again and long-press replace double-click and drag', async ({ page }) => {
    await boot(page);
    // Compact taskbar and no horizontal page scroll.
    expect((await rect(page.getByRole('navigation', { name: 'Taskbar' }))).height).toBe(36);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // Tap selects; tapping the selected item opens it (no double-tap timing needed).
    const docsIcon = desktopItem(page, 'My Documents');
    await docsIcon.tap();
    await expect(docsIcon).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('section[data-window-id]')).toHaveCount(0);
    await page.waitForTimeout(400);
    await docsIcon.tap();
    const docs = win(page, 'My Documents');
    await expect(docs).toBeVisible();
    expect(await rect(docs)).toEqual({ x: 0, y: 0, width: 390, height: 808 });
    // Move and Size are replaced by filled windows, with the reason given.
    await docs.getByRole('button', { name: 'System menu for My Documents' }).tap();
    const move = page.getByRole('menuitem', { name: 'Move' });
    await expect(move).toHaveAttribute('aria-disabled', 'true');
    await expect(move).toHaveAccessibleDescription(/compact mode/);
    await page.keyboard.press('Escape');
    // Long-press opens the item menu.
    const music = item(docs, 'My Music');
    const box = await rect(music);
    await music.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0, clientX: box.x + 20, clientY: box.y + 20, bubbles: true });
    await expect(page.getByRole('menu', { name: 'Item menu' })).toBeVisible({ timeout: 2000 });
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch' })));
    await page.getByRole('menu', { name: 'Item menu' }).getByRole('menuitem', { name: 'Open' }).tap();
    await expect(win(page, 'My Music')).toBeVisible();
    // A second window, then switch with the visible Window List.
    await page.getByRole('button', { name: 'Start', exact: true }).tap();
    const startBox = await rect(page.getByRole('menu', { name: 'Start menu' }));
    expect(startBox.x + startBox.width).toBeLessThanOrEqual(390);
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'My Computer' }).tap();
    await expect(win(page, 'My Computer')).toBeVisible();
    await page.getByRole('button', { name: 'Window List' }).tap();
    await page.getByRole('menu', { name: 'Window List' }).getByRole('menuitem', { name: 'My Music' }).tap();
    await expect(win(page, 'My Music')).toHaveClass(/is-active/);
    // Menus stay inside the viewport.
    await win(page, 'My Music').getByRole('menubar').getByRole('menuitem', { name: 'Edit', exact: true }).tap();
    const menuBox = await rect(page.getByRole('menu', { name: 'Edit' }));
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

/*
 * Browser zoom cannot be driven by Playwright. Zooming to N% gives the page a
 * CSS viewport of (window size ÷ N), so 200% and 400% of a 1024×768 window are
 * tested as 512×384 and 256×192 CSS-pixel viewports. This is an equivalent
 * layout check, not a test of the browser's zoom feature itself.
 */
for (const [zoom, size] of [
  ['200%', { width: 512, height: 384 }],
  ['400%', { width: 256, height: 192 }],
] as const) {
  test.describe(`QA-17 zoom ${zoom} (as a ${size.width}×${size.height} CSS viewport)`, () => {
    test.use({ viewport: size });

    test('compact mode keeps every action reachable without page scrolling', async ({ page }) => {
      await boot(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
      // Keyboard path: Start, open My Documents.
      await page.getByRole('button', { name: 'Start', exact: true }).focus();
      await page.keyboard.press('Enter');
      const startMenu = page.getByRole('menu', { name: 'Start menu' });
      await expect(startMenu).toBeVisible();
      const sm = await rect(startMenu);
      expect(sm.x + sm.width).toBeLessThanOrEqual(size.width);
      expect(sm.y).toBeGreaterThanOrEqual(0);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      const docs = win(page, 'My Documents');
      await expect(docs).toBeVisible();
      const r = await rect(docs);
      expect(r.x).toBe(0);
      expect(r.width).toBe(size.width);
      await expect(docs.getByRole('button', { name: 'Close My Documents' })).toBeInViewport();
      // Menus and dialogs fit or scroll inside the viewport.
      await docs.getByRole('menubar').getByRole('menuitem', { name: 'File', exact: true }).click();
      const file = await rect(page.getByRole('menu', { name: 'File' }));
      expect(file.x + file.width).toBeLessThanOrEqual(size.width);
      expect(file.y + file.height).toBeLessThanOrEqual(size.height);
      await clickMenuItem(page, 'New');
      await clickMenuItem(page, 'Folder');
      await page.keyboard.press('Enter');
      await expect(item(docs, 'New Folder')).toBeVisible();
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Run…' }).click();
      const run = await rect(page.getByRole('dialog', { name: 'Run' }));
      expect(run.x).toBeGreaterThanOrEqual(0);
      expect(run.x + run.width).toBeLessThanOrEqual(size.width);
      await expect(page.getByRole('dialog', { name: 'Run' }).getByRole('button', { name: 'Cancel' })).toBeInViewport();
      await page.keyboard.press('Escape');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    });
  });
}

test.describe('QA-17 forced colors and reduced motion', () => {
  test('forced colors keeps selection, pressed state and focus visible', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'Forced-colors emulation is only available in Chromium.');
    await page.emulateMedia({ forcedColors: 'active' });
    await boot(page);
    const highlight = await page.evaluate(() => {
      // The probe opts out of forcing so it reports the system Highlight color itself.
      const probe = document.createElement('div');
      probe.style.forcedColorAdjust = 'none';
      probe.style.backgroundColor = 'Highlight';
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    });
    await desktopItem(page, 'My Computer').click();
    const label = desktopItem(page, 'My Computer').locator('.desktop-icon__label');
    expect(await label.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(highlight);
    await desktopItem(page, 'My Computer').dblclick();
    const task = page.getByRole('group', { name: 'Running windows' }).getByRole('button', { name: 'My Computer' });
    expect(await task.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid');
    // Keyboard focus (focus-visible) must show an outline in forced colors.
    await page.getByRole('button', { name: 'Start', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.matches(':focus-visible'))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none');
    await expectNoAxeViolations(page, 'forced-colors', testInfo, [SPLIT_ARROWS]);
  });

  test('reduced motion follows the system setting and the in-app override', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page);
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
    await openStart(page);
    expect(await page.locator('.start-menu').evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('html')).not.toHaveClass(/reduce-motion/);
    await openStart(page);
    expect(await page.locator('.start-menu').evaluate((e) => getComputedStyle(e).animationName)).toBe('start-in');
    await page.keyboard.press('Escape');
    // In-app override: Reduce motion wins over the system preference.
    await openStart(page);
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Control Panel' }).first().click();
    const cp = win(page, 'Control Panel');
    await cp.getByRole('button', { name: 'Switch to Classic View' }).click();
    await cp.getByRole('button', { name: 'Accessibility Options' }).click();
    const acc = win(page, 'Accessibility Options');
    await acc.getByLabel('Reduce motion').check();
    await acc.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  });
});
