import { expect, test, type Page } from '@playwright/test';
import { boot, desktopItem, item, rect, savedState, trackErrors, win } from './helpers';

/**
 * macOS WebKit (Safari) skips buttons on Tab unless "Press Tab to highlight each
 * item" is on; Option+Tab reaches every control, so use it there.
 */
const tabKey = () => (test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab');

/** Presses Tab (or Shift+Tab) until the focused element matches the selector. */
async function tabTo(page: Page, selector: string, back = false, max = 120) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => !!document.activeElement?.matches(s), selector)) return;
    await page.keyboard.press(back ? `Shift+${tabKey()}` : tabKey());
  }
  throw new Error(`Could not reach ${selector} with ${back ? 'Shift+Tab' : 'Tab'}`);
}

const focusedName = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText?.trim() ?? '');

test('QA-16 the PRODUCT.md demonstration with the keyboard only', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await boot(page);
  const keys = async (...k: string[]) => {
    for (const key of k) await page.keyboard.press(key);
  };

  // Open Start and launch My Documents (right column).
  await tabTo(page, '.xp-start');
  await keys('Enter', 'ArrowRight');
  expect(await focusedName(page)).toBe('My Documents');
  await keys('Enter');
  const docs = page.locator('section[data-window-id="w1"]');
  await expect(docs).toHaveClass(/is-active/);
  await expect.poll(() => docs.evaluate((e) => e.contains(document.activeElement))).toBe(true);

  // Launch My Computer as the second window.
  await tabTo(page, '.xp-start');
  await keys('Enter', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown');
  expect(await focusedName(page)).toBe('My Computer');
  await keys('Enter');
  const mc = page.locator('section[data-window-id="w2"]');
  await expect(mc).toHaveClass(/is-active/);

  // Move the window with the system menu.
  const before = await rect(mc);
  await tabTo(page, 'section[data-window-id="w2"] .xp-window__sysicon', true);
  await keys('Enter');
  await expect(page.getByRole('menu', { name: /System menu/ })).toBeVisible();
  await keys('m');
  await keys('ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'Enter');
  const moved = await rect(mc);
  expect(Math.round(moved.x - before.x)).toBe(30);
  expect(Math.round(moved.y - before.y)).toBe(20);
  // Resize it. (Tabbing through other windows activates them, so target this window's button.)
  await tabTo(page, 'section[data-window-id="w2"] .xp-window__sysicon', true);
  await keys('Enter', 's', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'Enter');
  const sized = await rect(mc);
  expect(Math.round(sized.width - moved.width)).toBe(20);
  expect(Math.round(sized.height - moved.height)).toBe(10);

  // Switch to My Documents through the taskbar.
  await tabTo(page, '[data-window-button="w1"]');
  await keys('Enter');
  await expect(docs).toHaveClass(/is-active/);
  // Activation restores the window's last focused control; Tab on to its item view.
  await expect.poll(() => docs.evaluate((e) => e.contains(document.activeElement))).toBe(true);
  await tabTo(page, 'section[data-window-id="w1"] [role=listbox] [tabindex="0"]');

  // Create and rename a folder with the context menu (Shift+F10 > New > Folder).
  await keys('Shift+F10');
  await expect(page.getByRole('menu', { name: 'Folder background menu' })).toBeVisible();
  await keys('w', 'f');
  await expect(docs.locator('.rename__input')).toBeFocused();
  await page.keyboard.type('Plans');
  await keys('Enter');
  await expect(item(docs, 'Plans')).toBeFocused();

  // Nest: open it and create a child.
  await keys('Enter');
  await expect(docs.locator('.xp-window__title')).toHaveText('Plans');
  await expect.poll(() => docs.evaluate((e) => e.contains(document.activeElement))).toBe(true);
  await keys('Shift+F10', 'w', 'f');
  await page.keyboard.type('Draft');
  await keys('Enter', 'Backspace');
  await expect(docs.locator('.xp-window__title')).toHaveText('My Documents');

  // Copy Plans into My Pictures.
  await expect.poll(() => focusedName(page)).toContain('');
  await keys('Home');
  while (!(await focusedName(page)).startsWith('Plans')) await keys('ArrowDown');
  await keys('Space', 'Control+c');
  await keys('Home');
  while (!(await focusedName(page)).startsWith('My Pictures')) await keys('ArrowDown');
  await keys('Enter');
  await expect(docs.locator('.xp-window__title')).toHaveText('My Pictures');
  await keys('Control+v');
  await expect(item(docs, 'Plans')).toBeVisible();
  await keys('Backspace');

  // Move Plans into My Music with Cut and Paste.
  await keys('Home');
  while (!(await focusedName(page)).startsWith('Plans')) await keys('ArrowDown');
  await keys('Space', 'Control+x');
  await keys('Home');
  while (!(await focusedName(page)).startsWith('My Music')) await keys('ArrowDown');
  await keys('Enter');
  await keys('Control+v');
  await expect(item(docs, 'Plans')).toBeVisible();

  // Delete it (confirmation starts on No) and restore it from the Recycle Bin.
  await keys('Home', 'Space', 'Delete');
  const confirm = page.getByRole('dialog', { name: 'Confirm Folder Delete' });
  await expect(confirm.getByRole('button', { name: 'No' })).toBeFocused();
  await keys(`Shift+${tabKey()}`, 'Enter');
  await expect(confirm).toHaveCount(0);
  await expect(item(docs, 'Plans')).toHaveCount(0);
  await tabTo(page, 'section[data-window-id="w1"] .address-bar__input');
  await page.keyboard.type('Recycle Bin');
  await keys('Enter');
  await expect(docs.locator('.xp-window__title')).toHaveText('Recycle Bin');
  await tabTo(page, 'section[data-window-id="w1"] [role=option]');
  await keys('Space', 'Shift+F10', 'e');
  await expect(docs.locator('[role=option]')).toHaveCount(0);
  await tabTo(page, 'section[data-window-id="w1"] .address-bar__input', true);
  await page.keyboard.type('My Music');
  await keys('Enter');
  await expect(item(docs, 'Plans')).toBeVisible();

  // Change the wallpaper from the desktop's Properties.
  await tabTo(page, '[data-desktop-collection] [tabindex="0"]');
  await keys('Shift+F10');
  await expect(page.getByRole('menu', { name: 'Desktop menu' })).toBeVisible();
  await keys('r');
  const display = win(page, 'Display Properties');
  await expect(display).toBeVisible();
  await tabTo(page, 'section.is-active select.bg-list');
  await keys('Home', 'ArrowDown');
  await tabTo(page, 'section.is-active .sheet__buttons .is-default');
  await keys('Enter');
  await expect(display).toHaveCount(0);
  await expect.poll(() => page.locator('.desktop').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('azure');

  // Use Calculator.
  await tabTo(page, '.xp-start');
  await keys('Enter', 'ArrowDown', 'ArrowDown');
  await keys('Enter');
  const calc = win(page, 'Calculator');
  await expect(calc).toBeVisible();
  await expect.poll(() => calc.evaluate((e) => e.contains(document.activeElement))).toBe(true);
  await page.keyboard.type('6*7=');
  await expect(calc.getByTestId('calc-display')).toHaveText('42.');

  // Restart and recover saved folders and preferences.
  await tabTo(page, '.xp-start');
  await keys('Enter', 'End');
  await keys('ArrowRight');
  expect(await focusedName(page)).toBe('Turn Off Computer');
  await keys('Enter');
  const off = page.getByRole('dialog', { name: 'Turn off computer' });
  await expect(off.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await keys(`Shift+${tabKey()}`, 'Enter');
  await expect(desktopItem(page, 'My Documents')).toBeVisible();
  const saved = await savedState(page);
  expect(saved.prefs.wallpaper).toBe('azure');
  expect(Object.values(saved.fs.nodes as Record<string, { name: string }>).map((n) => n.name)).toEqual(expect.arrayContaining(['Plans', 'Draft']));
  expect(errors).toEqual([]);
});
