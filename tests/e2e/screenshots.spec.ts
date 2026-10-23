import { expect, test, type Page } from '@playwright/test';
import { boot, clickMenuItem, desktopItem, item, newFolder, openStart, win } from './helpers';

/*
 * QA-18 reference screenshots (VISUAL.md procedure): DPR 1, reduced motion,
 * a fresh seed per scene and a fixed clock. Run with `npm run screenshots`.
 * Fonts come from the host (Tahoma/Trebuchet MS on this machine), so images
 * are evidence for review, not pixel baselines.
 */
const OUT = 'docs/screenshots';
// Explicit offset: the browser runs in America/New_York (EDT, UTC-4) per playwright.config.ts.
const FIXED_TIME = new Date('2026-10-23T09:41:00-04:00');

test.skip(({ browserName }) => browserName !== 'chromium', 'Reference screenshots are captured in Chromium only.');

async function start(page: Page) {
  await page.clock.setFixedTime(FIXED_TIME);
  await boot(page);
}

async function shot(page: Page, size: string, name: string) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${size}/${name}.png` });
}

async function twoExplorers(page: Page) {
  await desktopItem(page, 'My Computer').dblclick();
  await desktopItem(page, 'My Documents').dblclick();
  await expect(win(page, 'My Documents')).toHaveClass(/is-active/);
}

const SCENES: Record<string, (page: Page) => Promise<void>> = {
  '01-desktop': async () => undefined,
  '02-start-accessories': async (page) => {
    await openStart(page);
    await page.getByRole('menuitem', { name: 'All Programs' }).hover();
    await page.getByRole('menuitem', { name: 'Accessories' }).hover();
    await expect(page.getByRole('menu', { name: 'Accessories' })).toBeVisible();
    await page.getByRole('menu', { name: 'Accessories' }).getByRole('menuitem', { name: 'Calculator' }).hover();
  },
  '03-explorers-active-inactive': twoExplorers,
  '04-explorer-tree-task-pane': async (page) => {
    await desktopItem(page, 'My Documents').dblclick();
    const docs = win(page, 'My Documents');
    await newFolder(docs, 'Projects');
    await newFolder(docs, 'Travel');
    await docs.getByRole('button', { name: 'Folders', exact: true }).click();
    await docs.getByRole('treeitem', { name: 'My Documents', exact: true }).locator('.xp-tree__toggle').click().catch(() => undefined);
  },
  '05-selected-folders': async (page) => {
    await desktopItem(page, 'My Documents').dblclick();
    const docs = win(page, 'My Documents');
    await newFolder(docs, 'Projects');
    await newFolder(docs, 'Travel');
    await item(docs, 'Projects').click();
    await item(docs, 'Travel').click({ modifiers: ['ControlOrMeta'] });
  },
  '06-context-menu': async (page) => {
    await desktopItem(page, 'My Documents').dblclick();
    const docs = win(page, 'My Documents');
    await newFolder(docs, 'Projects');
    await item(docs, 'Projects').click({ button: 'right' });
  },
  '07-desktop-context-menu': async (page) => {
    await page.mouse.click(560, 320, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Arrange Icons By' }).hover();
    await expect(page.getByRole('menu', { name: 'Arrange Icons By' })).toBeVisible();
  },
  '08-run-error': async (page) => {
    await openStart(page);
    await page.getByRole('menuitem', { name: 'Run…' }).click();
    await page.getByLabel('Open:').fill('notepad');
    await page.getByLabel('Open:').press('Enter');
    await expect(page.getByRole('dialog').last()).toContainText("Windows cannot find 'notepad'");
  },
  '09-display-properties': async (page) => {
    await page.mouse.click(700, 400, { button: 'right' });
    await clickMenuItem(page, 'Properties');
    await expect(win(page, 'Display Properties')).toBeVisible();
  },
  '10-recycle-bin': async (page) => {
    await desktopItem(page, 'My Documents').dblclick();
    const docs = win(page, 'My Documents');
    await newFolder(docs, 'Old Drafts');
    await item(docs, 'Old Drafts').click();
    await page.keyboard.press('Delete');
    await page.getByRole('dialog').getByRole('button', { name: 'Yes' }).click();
    await docs.getByRole('button', { name: 'Close My Documents' }).click();
    await desktopItem(page, 'Recycle Bin').dblclick();
    await item(win(page, 'Recycle Bin'), 'Old Drafts').click();
  },
  '11-calculator': async (page) => {
    await openStart(page);
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Calculator' }).click();
    const calc = win(page, 'Calculator');
    await expect(calc).toBeVisible();
    await expect.poll(() => calc.evaluate((e) => e.contains(document.activeElement))).toBe(true);
    await page.keyboard.type('1234.5*2=');
    await page.getByRole('button', { name: /memory store/ }).click();
  },
  '12-turn-off': async (page) => {
    await openStart(page);
    await page.getByRole('menuitem', { name: 'Turn Off Computer' }).click();
    await expect(page.getByRole('dialog', { name: 'Turn off computer' })).toBeVisible();
  },
  '13-control-panel': async (page) => {
    await openStart(page);
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Control Panel' }).click();
    await expect(win(page, 'Control Panel')).toBeVisible();
  },
  '14-help': async (page) => {
    await openStart(page);
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Help and Support' }).click();
    await expect(win(page, 'Help and Support Center')).toBeVisible();
  },
  '15-internet-explorer-error': async (page) => {
    await desktopItem(page, 'Internet Explorer').dblclick();
    const ie = win(page, /Internet Explorer$/);
    await ie.getByLabel('Address', { exact: true }).fill('www.example.com');
    await ie.getByLabel('Address', { exact: true }).press('Enter');
    await expect(ie.getByRole('heading', { name: 'The page cannot be displayed' })).toBeVisible();
  },
  '16-task-manager': async (page) => {
    await twoExplorers(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click({ button: 'right' });
    await clickMenuItem(page, 'Task Manager');
    await expect(win(page, 'Windows Task Manager')).toBeVisible();
  },
  '17-search': async (page) => {
    await openStart(page);
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Search' }).click();
    const s = win(page, 'Search Results');
    await s.getByLabel('All or part of the folder name:').fill('my');
    await s.getByRole('search').getByRole('button', { name: 'Search', exact: true }).click();
    await expect(s.getByText('Search is complete', { exact: false })).toBeVisible();
  },
  '18-welcome-screen': async (page) => {
    await openStart(page);
    await page.getByRole('menuitem', { name: 'Log Off' }).click();
    await page.getByRole('dialog', { name: 'Log Off Windows' }).getByRole('button', { name: 'Log Off' }).click();
    await expect(page.getByRole('heading', { name: 'To begin, click your user name' })).toBeVisible();
  },
  '19-taskbar-grouped': async (page) => {
    for (let i = 0; i < 8; i++) {
      await openStart(page);
      await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'My Computer' }).click();
    }
    await page.getByRole('group', { name: 'Running windows' }).getByRole('button', { name: /Windows Explorer windows/ }).click();
  },
};

test.describe('QA-18 screenshots at 1024×768', () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    test(name, async ({ page }) => {
      await start(page);
      await scene(page);
      await shot(page, '1024x768', name);
    });
  }
});

for (const size of [
  { width: 1280, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test.describe(`QA-18 screenshots at ${size.width}×${size.height}`, () => {
    test.use({ viewport: size });
    for (const name of ['01-desktop', '02-start-accessories', '03-explorers-active-inactive', '04-explorer-tree-task-pane']) {
      test(name, async ({ page }) => {
        await start(page);
        await SCENES[name](page);
        await shot(page, `${size.width}x${size.height}`, name);
      });
    }
  });
}

test.describe('QA-18 screenshots: compact 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('01-desktop', async ({ page }) => {
    await start(page);
    await shot(page, '390x844', '01-desktop');
  });
  test('02-start', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Start', exact: true }).tap();
    await shot(page, '390x844', '02-start');
  });
  test('03-explorer', async ({ page }) => {
    await start(page);
    await desktopItem(page, 'My Documents').dblclick();
    await shot(page, '390x844', '03-explorer');
  });
  test('04-window-list', async ({ page }) => {
    await start(page);
    await desktopItem(page, 'My Documents').dblclick();
    await page.getByRole('button', { name: 'Start', exact: true }).tap();
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Control Panel' }).tap();
    await page.getByRole('button', { name: 'Window List' }).tap();
    await shot(page, '390x844', '04-window-list');
  });
});

test.describe('QA-18 screenshots: adaptations', () => {
  // Adaptations are switched on through the real settings UI, as a user would.
  test('increased contrast and larger controls', async ({ page }) => {
    await start(page);
    await openStart(page);
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'Control Panel' }).click();
    const cp = win(page, 'Control Panel');
    await cp.getByRole('button', { name: 'Switch to Classic View' }).click();
    await cp.getByRole('button', { name: 'Accessibility Options' }).click();
    const acc = win(page, 'Accessibility Options');
    await acc.getByLabel('Use increased contrast').check();
    await acc.getByLabel('Use larger controls').check();
    await acc.getByRole('button', { name: 'OK' }).click();
    await cp.getByRole('button', { name: 'Close Control Panel' }).click();
    await twoExplorers(page);
    await shot(page, 'adaptations', 'high-contrast-larger-controls');
  });
  test('extra large fonts', async ({ page }) => {
    await start(page);
    await page.mouse.click(700, 400, { button: 'right' });
    await clickMenuItem(page, 'Properties');
    const display = win(page, 'Display Properties');
    await display.getByRole('tab', { name: 'Appearance' }).click();
    await display.getByLabel('Font size:').selectOption({ label: 'Extra Large Fonts' });
    await display.getByRole('button', { name: 'OK' }).click();
    await twoExplorers(page);
    await shot(page, 'adaptations', 'extra-large-fonts');
  });
  test('forced colors', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await start(page);
    await twoExplorers(page);
    await item(win(page, 'My Documents'), 'My Music').click();
    await shot(page, 'adaptations', 'forced-colors');
  });
});
