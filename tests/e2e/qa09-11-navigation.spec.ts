import { expect, test } from '@playwright/test';
import {
  activate,
  boot,
  clickMenuItem,
  desktopItem,
  item,
  newFolder,
  openMyDocuments,
  openStart,
  pin,
  rect,
  startItem,
  taskButton,
  trackErrors,
  trackExternalRequests,
  view,
  win,
  windows,
} from './helpers';

const startMenu = (page: import('@playwright/test').Page) => page.getByRole('menu', { name: 'Start menu' });

test.describe('QA-09 Start menu', () => {
  test('mouse: cascades, outside click dismisses without launching', async ({ page }) => {
    await boot(page);
    await openStart(page);
    await expect(startMenu(page).getByText('User', { exact: true })).toBeVisible();
    await startMenu(page).getByRole('menuitem', { name: 'All Programs' }).hover();
    const programs = page.getByRole('menu', { name: 'All Programs' });
    await expect(programs).toBeVisible();
    await programs.getByRole('menuitem', { name: 'Accessories' }).hover();
    const accessories = page.getByRole('menu', { name: 'Accessories' });
    await expect(accessories.getByRole('menuitem')).toHaveText(['Calculator', 'Help and Support', 'Windows Explorer']);
    // Cascades stay inside the viewport.
    for (const m of [programs, accessories]) {
      const r = await rect(m);
      expect(r.x + r.width).toBeLessThanOrEqual(1024);
      expect(r.y + r.height).toBeLessThanOrEqual(768);
    }
    // Outside click closes the menu and does not activate what is underneath.
    await page.mouse.click(42, 250);
    await expect(startMenu(page)).toBeHidden();
    await expect(windows(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveAttribute('aria-expanded', 'false');
  });

  test('keyboard: open, navigate columns and submenus, Escape returns focus', async ({ page }) => {
    await boot(page);
    await page.getByRole('button', { name: 'Start', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(startMenu(page)).toBeVisible();
    await expect(startMenu(page).getByRole('menuitem', { name: /Internet/ })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(startMenu(page).getByRole('menuitem', { name: 'My Documents' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    // Go to All Programs and open it with the keyboard.
    for (let i = 0; i < 10; i++) {
      if (await startMenu(page).getByRole('menuitem', { name: 'All Programs' }).evaluate((e) => e === document.activeElement)) break;
      await page.keyboard.press('ArrowDown');
    }
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menu', { name: 'All Programs' }).getByRole('menuitem', { name: 'Accessories' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menu', { name: 'Accessories' }).getByRole('menuitem', { name: 'Calculator' })).toBeFocused();
    // Escape closes the deepest submenu first.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'Accessories' })).toBeHidden();
    await expect(page.getByRole('menu', { name: 'All Programs' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(startMenu(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeFocused();
    // Launch Calculator from the keyboard.
    // Internet, Windows Explorer, Calculator: two steps down.
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(startMenu(page).getByRole('menuitem', { name: 'Calculator' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(win(page, 'Calculator')).toBeVisible();
  });

  test('every Start launcher opens its app', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    const cases: [string, string | RegExp][] = [
      ['Internet', /Internet Explorer$/],
      ['My Documents', 'My Documents'],
      ['My Pictures', 'My Pictures'],
      ['My Music', 'My Music'],
      ['My Computer', 'My Computer'],
      ['My Network Places', 'My Network Places'],
      ['Control Panel', 'Control Panel'],
      ['Help and Support', 'Help and Support Center'],
      ['Search', 'Search Results'],
      ['Windows Explorer', 'My Documents'],
      ['Calculator', 'Calculator'],
    ];
    for (const [label, title] of cases) {
      await openStart(page);
      await startMenu(page).getByRole('menuitem', { name: new RegExp(`^${label}`) }).first().click();
      await expect(win(page, title).first()).toBeVisible();
      await win(page, title).first().locator('.xp-cap--close').click();
    }
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Run…' }).click();
    await expect(page.getByRole('dialog', { name: 'Run' })).toBeVisible();
    await page.keyboard.press('Escape');
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Log Off' }).click();
    await expect(page.getByRole('dialog', { name: 'Log Off Windows' })).toBeVisible();
    await page.keyboard.press('Escape');
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Turn Off Computer' }).click();
    await expect(page.getByRole('dialog', { name: 'Turn off computer' })).toBeVisible();
    await page.keyboard.press('Escape');
    // All Programs entries.
    for (const [path, title] of [
      [['Accessories', 'Calculator'], 'Calculator'],
      [['Accessories', 'Help and Support'], 'Help and Support Center'],
      [['Accessories', 'Windows Explorer'], 'My Documents'],
      [['Internet Explorer'], /Internet Explorer$/],
    ] as [string[], string | RegExp][]) {
      await openStart(page);
      await startMenu(page).getByRole('menuitem', { name: 'All Programs' }).click();
      for (const p of path) await clickMenuItem(page, p);
      await expect(win(page, title).first()).toBeVisible();
      await win(page, title).first().locator('.xp-cap--close').click();
    }
    expect(errors).toEqual([]);
  });

  test('context menu near the viewport edge flips to stay visible', async ({ page }) => {
    await boot(page);
    await page.mouse.click(1015, 700, { button: 'right' });
    const menu = page.getByRole('menu', { name: 'Desktop menu' });
    const r = await rect(menu);
    expect(r.x + r.width).toBeLessThanOrEqual(1024);
    expect(r.y + r.height).toBeLessThanOrEqual(768);
    await menu.getByRole('menuitem', { name: 'New' }).click();
    const sub = page.getByRole('menu', { name: 'New' });
    const s = await rect(sub);
    expect(s.x).toBeLessThan(r.x);
    expect(s.x + s.width).toBeLessThanOrEqual(1024);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });
});

test.describe('QA-10 taskbar grouping and Show Desktop', () => {
  test('grouped Explorer windows are all reachable; Show Desktop restores only its snapshot', async ({ page }) => {
    await boot(page);
    for (let i = 0; i < 8; i++) await startItem(page, 'My Computer');
    await expect(windows(page)).toHaveCount(8);
    const group = page.getByRole('group', { name: 'Running windows' }).getByRole('button', { name: /8 Windows Explorer windows/ });
    await expect(group).toBeVisible();
    await group.click();
    const list = page.getByRole('menu', { name: 'Windows Explorer windows' });
    await expect(list.getByRole('menuitem')).toHaveCount(8);
    await list.getByRole('menuitem').first().click();
    const first = page.locator('section[data-window-id="w1"]');
    await expect(first).toHaveClass(/is-active/);

    // Show Desktop via Quick Launch.
    await page.getByRole('button', { name: 'Start', exact: true }).click({ button: 'right' });
    await clickMenuItem(page, 'Toolbars');
    await clickMenuItem(page, 'Quick Launch');
    const show = page.getByRole('button', { name: 'Show Desktop' });
    await expect(show).toBeVisible();
    // Minimize one window first: it must stay minimized after the round trip.
    await page.locator('section[data-window-id="w1"]').getByRole('button', { name: 'Minimize My Computer' }).click();
    await expect(page.locator('section[data-window-id="w1"]')).toBeHidden();
    await show.click();
    await expect(windows(page)).toHaveCount(0);
    // Close one hidden window through Task Manager-free path: the group menu's right-click.
    await page.getByRole('group', { name: 'Running windows' }).getByRole('button', { name: /Windows Explorer/ }).click({ button: 'right' });
    await expect(page.getByRole('menu', { name: 'Windows Explorer group' })).toBeVisible();
    await page.keyboard.press('Escape');
    // A newly opened window is not part of the snapshot.
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Control Panel' }).click();
    await expect(win(page, 'Control Panel')).toBeVisible();
    await show.click();
    // Seven snapshot windows return, the minimized one stays minimized, Control Panel stays open.
    await expect(windows(page)).toHaveCount(8);
    await expect(page.locator('section[data-window-id="w1"]')).toBeHidden();
    await expect(win(page, 'Control Panel')).toBeVisible();
  });

  test('closing a hidden window removes it from the Show Desktop snapshot', async ({ page }) => {
    await boot(page);
    await desktopItem(page, 'My Computer').dblclick();
    await desktopItem(page, 'My Documents').dblclick();
    await page.getByRole('button', { name: 'Start', exact: true }).click({ button: 'right' });
    await clickMenuItem(page, 'Show the Desktop');
    await expect(windows(page)).toHaveCount(0);
    // Close My Computer from its taskbar system menu while hidden.
    await taskButton(page, 'My Computer').click({ button: 'right' });
    await clickMenuItem(page, 'Close');
    await expect(taskButton(page, 'My Computer')).toHaveCount(0);
    await page.getByRole('button', { name: 'Start', exact: true }).click({ button: 'right' });
    await clickMenuItem(page, 'Show Open Windows');
    await expect(windows(page)).toHaveCount(1);
    await expect(win(page, 'My Documents')).toBeVisible();
  });
});

test.describe('QA-11 Search, Run and the local browser', () => {
  test('search finds folders in scope, updates after mutations, stop marks results incomplete', async ({ page }) => {
    await boot(page);
    const docs = await pin(await openMyDocuments(page));
    await newFolder(docs, 'Budget 2006');
    await item(docs, 'My Pictures').dblclick();
    await newFolder(docs, 'budget photos');
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Search' }).click();
    const s = await pin(win(page, 'Search Results'));
    const searchButton = s.getByRole('search').getByRole('button', { name: 'Search', exact: true });
    await s.getByLabel('All or part of the folder name:').fill('BUDGET');
    await s.getByLabel('Look in:').selectOption({ label: 'My Pictures' });
    await searchButton.click();
    await expect(s.getByRole('status').filter({ hasText: 'Search is complete' })).toBeVisible();
    await expect(view(s).locator('.item__name')).toHaveText(['budget photos']);
    await s.getByLabel('Look in:').selectOption({ label: 'Local Disk (C:)' });
    await searchButton.click();
    await expect(view(s).locator('.item__name')).toHaveText(['budget photos', 'Budget 2006'].sort((a, b) => a.localeCompare(b)));
    // Results update after a rename elsewhere.
    await activate(docs);
    await item(docs, 'budget photos').click();
    await page.keyboard.press('F2');
    await docs.locator('.rename__input').fill('Holiday');
    await docs.locator('.rename__input').press('Enter');
    await expect(view(s).locator('.item__name')).toHaveText(['Budget 2006']);
    // Open the containing folder from a result.
    await activate(s);
    await item(s, 'Budget 2006').click({ button: 'right' });
    await clickMenuItem(page, 'Open Containing Folder');
    await expect(win(page, 'My Documents')).toBeVisible();
    await expect(item(win(page, 'My Documents'), 'Budget 2006')).toBeVisible();
    // Empty query lists every folder below the scope; Stop marks results incomplete.
    await activate(s);
    await s.getByLabel('All or part of the folder name:').fill('');
    await searchButton.click();
    await s.getByRole('button', { name: 'Stop' }).click();
    await expect(s.getByRole('status').filter({ hasText: 'Search was stopped' })).toBeVisible();
    await expect(s.locator('.status-bar')).toContainText('results may be incomplete');
    // No results text stays compact.
    await s.getByLabel('All or part of the folder name:').fill('zzz-nothing');
    await searchButton.click();
    await expect(s.getByText('There are no results to display.').first()).toBeVisible();
  });

  test('Run accepts only the allowlist and folder paths; unknown input errors and is retained', async ({ page }) => {
    const external = trackExternalRequests(page);
    await boot(page);
    const run = async (text: string) => {
      await openStart(page);
      await startMenu(page).getByRole('menuitem', { name: 'Run…' }).click();
      const d = page.getByRole('dialog', { name: 'Run' });
      await d.getByLabel('Open:').fill(text);
      await d.getByLabel('Open:').press('Enter');
      return d;
    };
    await run('  CALC ');
    await expect(win(page, 'Calculator')).toBeVisible();
    await run('explorer');
    await expect(win(page, 'My Documents')).toBeVisible();
    await run('c:\\program files');
    await expect(win(page, 'Program Files')).toBeVisible();
    for (const bad of ['notepad', 'javascript:alert(1)', 'https://example.com', 'cmd /c del *']) {
      const d = await run(bad);
      const err = page.getByRole('dialog').last();
      await expect(err).toContainText(`Windows cannot find '${bad}'`);
      await err.getByRole('button', { name: 'OK' }).click();
      await expect(d.getByLabel('Open:')).toHaveValue(bad);
      await expect(d.getByLabel('Open:')).toBeFocused();
      await d.getByRole('button', { name: 'Cancel' }).click();
    }
    // Browse fills the box with a folder path.
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Run…' }).click();
    const d = page.getByRole('dialog', { name: 'Run' });
    await d.getByRole('button', { name: 'Browse…' }).click();
    const browse = page.getByRole('dialog', { name: 'Browse For Folder' });
    await browse.getByRole('treeitem', { name: 'My Documents', exact: true }).click();
    await browse.getByRole('button', { name: 'OK' }).click();
    await expect(d.getByLabel('Open:')).toHaveValue('C:\\Documents and Settings\\User\\My Documents');
    await d.getByRole('button', { name: 'Cancel' }).click();
    expect(external).toEqual([]);
  });

  test('Internet Explorer shows only bundled pages and never navigates out', async ({ page }) => {
    const external = trackExternalRequests(page);
    await boot(page);
    await desktopItem(page, 'Internet Explorer').dblclick();
    const ie = await pin(win(page, 'Welcome - Internet Explorer'));
    await expect(ie.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
    const address = ie.getByLabel('Address', { exact: true });
    await address.fill('about:help');
    await address.press('Enter');
    await expect(ie.locator('.xp-window__title')).toHaveText('Using This Browser - Internet Explorer');
    await address.fill('http://www.example.com/');
    await address.press('Enter');
    await expect(ie.getByRole('heading', { name: 'The page cannot be displayed' })).toBeVisible();
    await expect(ie).toContainText('http://www.example.com/');
    await ie.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(ie.locator('.xp-window__title')).toHaveText('Using This Browser - Internet Explorer');
    await ie.getByRole('button', { name: 'Forward', exact: true }).click();
    await expect(ie.getByRole('heading', { name: 'The page cannot be displayed' })).toBeVisible();
    await ie.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(ie.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
    await ie.getByRole('menubar').getByRole('menuitem', { name: 'Tools', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Internet Options…' })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    expect(page.url()).toBe('http://localhost:4173/');
    expect(external).toEqual([]);
    // Single instance: launching again focuses the same window.
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: /^Internet/ }).click();
    await expect(win(page, /Internet Explorer$/)).toHaveCount(1);
  });
});
