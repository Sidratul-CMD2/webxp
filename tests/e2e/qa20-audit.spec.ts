import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { activate, boot, clickMenuItem, desktopItem, item, newFolder, openMyDocuments, openStart, pin, trackErrors, win } from './helpers';

/*
 * QA-20 command audit. Every menu (including submenus) on every surface is
 * walked. Disabled items must explain why (accessible description). Enabled
 * leaf items are activated from a fresh state and must cause an observable
 * effect outside the menu itself, with no console errors. Documented no-op
 * exceptions: "Refresh" (re-renders identical state; data safety is covered by
 * QA-15), radio items that are already the checked choice, and the bold
 * current-location entry of the address list (selecting it closes the list).
 * Check and radio items whose change is not visible in the current state are
 * verified by reopening the menu; a successful host clipboard write (Calculator
 * Copy, silent as in XP) counts as its effect. Each step runs in a fresh browser context,
 * because the app persists its state on pagehide.
 */

interface Entry {
  label: string;
  role: string;
  checked: boolean;
  bold: boolean;
  disabled: boolean;
  submenu: boolean;
  checkedRadio: boolean;
  description: string;
}

interface Surface {
  name: string;
  /** Fresh state for this surface (page already booted). */
  setup: (page: Page) => Promise<void>;
  /** Opens the root menu. */
  open: (page: Page) => Promise<void>;
  /** The bold entry marks the current location (address list), not the default command. */
  boldIsCurrent?: boolean;
}

const lastMenu = (page: Page) => page.locator('.xp-menu').last();

async function readEntries(page: Page): Promise<Entry[]> {
  return lastMenu(page)
    .locator('[role^=menuitem]')
    .evaluateAll((els) =>
      els.map((el) => {
        const describedBy = el.getAttribute('aria-describedby');
        return {
          label: el.querySelector('.xp-menu__label')?.textContent?.trim() ?? '',
          role: el.getAttribute('role') ?? '',
          checked: el.getAttribute('aria-checked') === 'true',
          bold: el.classList.contains('is-bold'),
          disabled: el.getAttribute('aria-disabled') === 'true',
          submenu: el.getAttribute('aria-haspopup') === 'menu',
          checkedRadio: el.getAttribute('role') === 'menuitemradio' && el.getAttribute('aria-checked') === 'true',
          description: describedBy ? (document.getElementById(describedBy)?.textContent ?? '') : '',
        };
      }),
    );
}

const entryLocator = (page: Page, label: string) =>
  lastMenu(page)
    .locator('[role^=menuitem]')
    .filter({ has: page.locator('.xp-menu__label', { hasText: new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }) })
    .first();

async function openPath(page: Page, surface: Surface, path: string[]) {
  await surface.open(page);
  for (const label of path) {
    await entryLocator(page, label).click();
    await expect(page.locator('.xp-menu').last().locator('[role^=menuitem]').first()).toBeVisible();
  }
}

/** Counts DOM changes outside the menu layer and tooltips. */
async function watchEffects(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __effects: number; __obs?: MutationObserver };
    w.__effects = 0;
    w.__obs?.disconnect();
    const ignored = (n: Node) => n instanceof Element && !!n.closest('.menu-layer, .xp-tooltip');
    w.__obs = new MutationObserver((list) => {
      for (const m of list) {
        if (ignored(m.target)) continue;
        if (m.type === 'childList') {
          const nodes = [...m.addedNodes, ...m.removedNodes];
          if (nodes.length && nodes.every((n) => n instanceof Element && n.matches('.menu-layer, .xp-tooltip'))) continue;
        }
        if (m.type === 'attributes' && ['aria-expanded', 'tabindex'].includes(m.attributeName ?? '')) continue;
        if (m.type === 'attributes' && m.attributeName === 'class' && m.target instanceof Element && m.target.matches('.xp-menubar__item, .xp-start')) continue;
        w.__effects++;
      }
    });
    w.__obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}

const effects = (page: Page) => page.evaluate(() => (window as unknown as { __effects: number }).__effects);

const BASE = { baseURL: 'http://localhost:4173', viewport: { width: 1024, height: 768 } };

async function audit(browser: Browser, surface: Surface) {
  const errors: string[] = [];
  const failures: string[] = [];
  const checked: string[] = [];
  let context: BrowserContext | undefined;
  const fresh = async (path: string[]) => {
    await context?.close();
    context = await browser.newContext(BASE);
    // Count host clipboard writes (Calculator Copy), which succeed with no DOM change.
    await context.addInitScript(() => {
      const clip = navigator.clipboard;
      if (!clip?.writeText) return;
      const write = clip.writeText.bind(clip);
      clip.writeText = (text: string) => {
        const w = window as unknown as { __clipboardWrites?: number };
        w.__clipboardWrites = (w.__clipboardWrites ?? 0) + 1;
        return write(text);
      };
    });
    const page = await context.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    await surface.setup(page);
    await openPath(page, surface, path);
    return page;
  };
  const walk = async (path: string[]) => {
    const entries = await readEntries(await fresh(path));
    for (const entry of entries) {
      const where = [...path, entry.label].join(' › ');
      if (entry.disabled) {
        if (!entry.description.trim()) failures.push(`${where}: disabled without an explanation`);
        checked.push(`${where} (disabled: ${entry.description})`);
        continue;
      }
      if (entry.submenu) {
        await walk([...path, entry.label]);
        continue;
      }
      if (entry.label === 'Refresh' || (entry.role === 'menuitemradio' && entry.checked) || (surface.boldIsCurrent && entry.bold)) {
        checked.push(`${where} (documented no-op)`);
        continue;
      }
      const page = await fresh(path);
      await watchEffects(page);
      await entryLocator(page, entry.label).click();
      await page.waitForTimeout(350);
      let n = await effects(page);
      if (n === 0 && (await page.evaluate(() => (window as unknown as { __clipboardWrites?: number }).__clipboardWrites ?? 0)) > 0) n = -2;
      if (n === 0 && entry.role !== 'menuitem') {
        // A state toggle with no visible change here: confirm the state itself changed.
        await openPath(page, surface, path);
        if ((await entryLocator(page, entry.label).getAttribute('aria-checked')) !== String(entry.checked)) n = -1;
        await page.keyboard.press('Escape');
      }
      if (n === 0) failures.push(`${where}: enabled but had no observable effect`);
      checked.push(`${where} (${n === -1 ? 'state toggled' : n === -2 ? 'copied to the host clipboard' : `${n} changes`})`);
    }
  };
  await walk([]);
  await context?.close();
  test.info().annotations.push({ type: 'audit', description: `${surface.name}: ${checked.length} items — ${checked.join('; ')}` });
  expect(failures, surface.name).toEqual([]);
  expect(errors, `${surface.name} console errors`).toEqual([]);
}

const menubar = (windowName: string | RegExp, menu: string) => async (page: Page) => {
  await win(page, windowName).first().getByRole('menubar').getByRole('menuitem', { name: menu, exact: true }).click();
};

async function docsWithFolder(page: Page) {
  const docs = await openMyDocuments(page);
  await newFolder(docs, 'Alpha');
  await item(docs, 'Alpha').click();
  await page.keyboard.press('ControlOrMeta+c');
}

async function binWithItem(page: Page) {
  const docs = await pin(await openMyDocuments(page));
  await newFolder(docs, 'Alpha');
  await item(docs, 'Alpha').click();
  await page.keyboard.press('Delete');
  await page.getByRole('dialog').getByRole('button', { name: 'Yes' }).click();
  await docs.getByRole('button', { name: 'Close My Documents' }).click();
  await desktopItem(page, 'Recycle Bin').dblclick();
  await item(win(page, 'Recycle Bin'), 'Alpha').click();
}

async function startApp(page: Page, name: string) {
  await openStart(page);
  await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name }).first().click();
}

const SURFACES: Surface[] = [
  ...['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help'].map((menu) => ({
    name: `Explorer ${menu}`,
    setup: docsWithFolder,
    open: menubar('My Documents', menu),
  })),
  { name: 'Explorer item menu', setup: docsWithFolder, open: async (page) => item(win(page, 'My Documents'), 'Alpha').click({ button: 'right' }) },
  {
    name: 'Explorer background menu',
    setup: docsWithFolder,
    open: async (page) => win(page, 'My Documents').getByRole('listbox', { name: 'Items' }).click({ button: 'right', position: { x: 300, y: 250 } }),
  },
  { name: 'Explorer Views button', setup: docsWithFolder, open: async (page) => win(page, 'My Documents').getByRole('button', { name: 'Views', exact: true }).click() },
  {
    name: 'Explorer address list',
    setup: docsWithFolder,
    open: async (page) => win(page, 'My Documents').getByRole('button', { name: 'Show address list' }).click(),
    boldIsCurrent: true,
  },
  // Empty states: nothing selected, nothing on the clipboard, an empty Recycle Bin.
  ...['File', 'Edit', 'View'].map((menu) => ({
    name: `Explorer ${menu} (nothing selected)`,
    setup: async (page: Page) => void (await openMyDocuments(page)),
    open: menubar('My Documents', menu),
  })),
  {
    name: 'Recycle Bin File (empty)',
    setup: async (page: Page) => desktopItem(page, 'Recycle Bin').dblclick(),
    open: menubar('Recycle Bin', 'File'),
  },
  {
    name: 'Recycle Bin background (empty)',
    setup: async (page: Page) => desktopItem(page, 'Recycle Bin').dblclick(),
    open: async (page) => win(page, 'Recycle Bin').getByRole('listbox', { name: 'Items' }).click({ button: 'right', position: { x: 300, y: 250 } }),
  },
  {
    name: 'My Computer File (read-only drive selected)',
    setup: async (page: Page) => {
      await desktopItem(page, 'My Computer').dblclick();
      await item(win(page, 'My Computer'), 'Local Disk (C:)').click();
    },
    open: menubar('My Computer', 'File'),
  },
  { name: 'Recycle Bin File', setup: binWithItem, open: menubar('Recycle Bin', 'File') },
  { name: 'Recycle Bin item menu', setup: binWithItem, open: async (page) => item(win(page, 'Recycle Bin'), 'Alpha').click({ button: 'right' }) },
  {
    name: 'Desktop menu',
    // Move one icon out of order so the arrange commands have something to do.
    setup: async (page) => {
      const box = (await desktopItem(page, 'My Computer').boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(520, 380, { steps: 5 });
      await page.mouse.up();
    },
    open: async (page) => page.mouse.click(600, 420, { button: 'right' }) },
  { name: 'Desktop shortcut menu', setup: async () => undefined, open: async (page) => desktopItem(page, 'My Computer').click({ button: 'right' }) },
  {
    name: 'Recycle Bin shortcut menu',
    setup: async (page) => {
      await binWithItem(page);
      await win(page, 'Recycle Bin').getByRole('button', { name: 'Close Recycle Bin' }).click();
    },
    open: async (page) => desktopItem(page, 'Recycle Bin').click({ button: 'right' }),
  },
  {
    name: 'Taskbar menu',
    setup: async (page) => {
      await desktopItem(page, 'My Computer').dblclick();
    },
    open: async (page) => page.getByRole('button', { name: 'Start', exact: true }).click({ button: 'right' }),
  },
  {
    name: 'System menu',
    setup: async (page) => {
      await desktopItem(page, 'My Computer').dblclick();
    },
    open: async (page) => win(page, 'My Computer').getByRole('button', { name: 'System menu for My Computer' }).click(),
  },
  {
    name: 'All Programs',
    setup: async () => undefined,
    open: async (page) => {
      await openStart(page);
      await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'All Programs' }).click();
    },
  },
  ...['Edit', 'View', 'Help'].map((menu) => ({ name: `Calculator ${menu}`, setup: (page: Page) => startApp(page, 'Calculator'), open: menubar('Calculator', menu) })),
  ...['File', 'View', 'Help'].map((menu) => ({ name: `Control Panel ${menu}`, setup: (page: Page) => startApp(page, 'Control Panel'), open: menubar('Control Panel', menu) })),
  ...['File', 'View', 'Favorites', 'Tools', 'Help'].map((menu) => ({
    name: `Internet Explorer ${menu}`,
    setup: async (page: Page) => desktopItem(page, 'Internet Explorer').dblclick(),
    open: menubar(/Internet Explorer$/, menu),
  })),
  ...['File', 'Help'].map((menu) => ({ name: `Help ${menu}`, setup: (page: Page) => startApp(page, 'Help and Support'), open: menubar('Help and Support Center', menu) })),
  ...['File', 'Windows', 'Help'].map((menu) => ({
    name: `Task Manager ${menu}`,
    setup: async (page: Page) => {
      await desktopItem(page, 'My Computer').dblclick();
      await page.getByRole('button', { name: 'Start', exact: true }).click({ button: 'right' });
      await clickMenuItem(page, 'Task Manager');
      await win(page, 'Windows Task Manager').getByRole('option').first().click();
    },
    open: menubar('Windows Task Manager', menu),
  })),
];

test.describe('QA-20 every menu command acts or explains why it cannot', () => {
  test.describe.configure({ mode: 'parallel' });
  for (const surface of SURFACES) {
    test(surface.name, async ({ browser }) => {
      test.setTimeout(240_000);
      await audit(browser, surface);
    });
  }
});

/** Every visible disabled control must say why it is unavailable. */
async function disabledWithoutReason(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const els = document.querySelectorAll<HTMLElement>('button, input, select, [role=tab], [role=button], [role^=menuitem]');
    for (const el of els) {
      const disabled = (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true';
      if (!disabled || !el.getClientRects().length || el.closest('[hidden], [aria-hidden="true"]')) continue;
      const describedBy = el.getAttribute('aria-describedby');
      const label = el.closest('label');
      const reason =
        el.getAttribute('title') ||
        (describedBy && document.getElementById(describedBy)?.textContent) ||
        el.dataset.tip ||
        label?.dataset.tip ||
        (label?.parentElement?.querySelector('[id]') as HTMLElement | null)?.textContent;
      if (!reason?.trim()) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}"`);
    }
    return out;
  });
}

test('QA-20 disabled controls in every app and tab explain why', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  const failures: string[] = [];
  const check = async (where: string) => {
    for (const f of await disabledWithoutReason(page)) failures.push(`${where}: ${f}`);
  };
  await desktopItem(page, 'My Documents').dblclick();
  await check('Explorer at My Documents');
  await win(page, 'My Documents').getByRole('button', { name: 'Search', exact: true }).click();
  await check('Explorer search pane');
  await startApp(page, 'Control Panel');
  await check('Control Panel');
  await desktopItem(page, 'Internet Explorer').dblclick();
  await startApp(page, 'Help and Support');
  await check('browser and help');
  await page.getByRole('button', { name: 'Start', exact: true }).click({ button: 'right' });
  await clickMenuItem(page, 'Task Manager');
  await check('Task Manager without selection');
  await win(page, 'Windows Task Manager').getByRole('button', { name: 'Close Windows Task Manager' }).click();
  const cp = await pin(win(page, 'Control Panel'));
  await activate(cp);
  await cp.getByRole('button', { name: 'Switch to Classic View' }).click();
  for (const applet of ['Display', 'Taskbar and Start Menu', 'Sounds and Audio Devices', 'Date and Time', 'Accessibility Options', 'Folder Options']) {
    await cp.getByRole('button', { name: applet, exact: true }).click();
    const w = page.locator('section[data-window-id].is-active');
    const tabs = await w.getByRole('tab').allTextContents();
    for (const tab of tabs) {
      await w.getByRole('tab', { name: tab, exact: true }).click();
      await check(`${applet} › ${tab}`);
    }
    if (applet === 'Display') {
      await w.getByRole('tab', { name: 'Desktop' }).click();
      await w.getByLabel('Background:').selectOption({ label: '(None)' });
      await check('Display › Desktop with no picture');
    }
    if (applet === 'Sounds and Audio Devices') {
      await w.getByLabel('Mute').check();
      await check('Sounds muted');
    }
    await w.getByRole('button', { name: 'Cancel' }).or(w.getByRole('button', { name: 'OK' })).first().click();
  }
  await openStart(page);
  await page.getByRole('menuitem', { name: 'Run…' }).click();
  await check('Run dialog (empty)');
  await page.getByRole('dialog', { name: 'Run' }).getByRole('button', { name: 'Browse…' }).click();
  await page.getByRole('dialog', { name: 'Browse For Folder' }).getByRole('treeitem', { name: 'My Computer', exact: true }).click();
  await check('Browse For Folder on My Computer');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await openStart(page);
  await page.getByRole('menuitem', { name: 'Log Off' }).click();
  await check('Log Off dialog');
  await page.keyboard.press('Escape');
  expect(failures).toEqual([]);
});

test('QA-20 launchers, task links and tray controls all act', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await boot(page);
  const failures: string[] = [];
  const expectEffect = async (where: string, act: () => Promise<void>) => {
    await watchEffects(page);
    await act();
    await page.waitForTimeout(300);
    if ((await effects(page)) === 0) failures.push(where);
  };
  const closeActive = () => page.locator('section[data-window-id].is-active').getByRole('button', { name: /^Close / }).first().click();
  // Control Panel categories, tasks and applet icons.
  await startApp(page, 'Control Panel');
  const cp = await pin(win(page, 'Control Panel'));
  for (const category of ['Appearance and Themes', 'Sounds, Speech, and Audio Devices', 'Date, Time, Language, and Regional Options', 'Accessibility Options']) {
    await activate(cp);
    await expectEffect(`category ${category}`, () => cp.getByRole('button', { name: category, exact: true }).click());
    for (const task of await cp.locator('.cp-task').allTextContents()) {
      await activate(cp);
      await expectEffect(`task ${task}`, () => cp.locator('.cp-task', { hasText: task }).click());
      await closeActive();
    }
    const icons = await cp.locator('.cp-icons .cp-applet > span:last-child').allTextContents();
    for (const applet of icons) {
      await activate(cp);
      await expectEffect(`category icon ${applet}`, () => cp.locator('.cp-icons').getByRole('button', { name: applet, exact: true }).click());
      await closeActive();
    }
    await activate(cp);
    await expectEffect(`Up from ${category}`, () => cp.getByRole('button', { name: 'Up', exact: true }).click());
  }
  await expectEffect('Switch to Classic View', () => cp.getByRole('button', { name: 'Switch to Classic View' }).click());
  const applets = await cp.locator('.cp-classic .cp-applet > span:last-child').allTextContents();
  expect(applets.length).toBe(6);
  for (const applet of applets) {
    await activate(cp);
    await expectEffect(`applet ${applet}`, () => cp.locator('.cp-classic').getByRole('button', { name: applet, exact: true }).click());
    await closeActive();
  }
  await activate(cp);
  await expectEffect('Switch to Category View', () => cp.getByRole('button', { name: 'Switch to Category View' }).click());
  await expectEffect('Control Panel See Also › Help', () => cp.getByRole('button', { name: 'Help and Support' }).click());
  await closeActive();
  await closeActive();
  // Explorer task-pane links in several locations.
  const docs = await pin(await openMyDocuments(page));
  const address = docs.getByLabel('Address', { exact: true });
  const goTo = async (where: string) => {
    await address.fill(where);
    await address.press('Enter');
    await expect(docs.getByRole('heading', { level: 2 })).toHaveText(where);
  };
  for (const link of ['Desktop', 'My Computer', 'My Network Places']) {
    await goTo('My Documents');
    await expectEffect(`Other Places › ${link}`, () => docs.locator('.task-link', { hasText: new RegExp(`^${link}$`) }).click());
  }
  await goTo('My Documents');
  await expectEffect('File and Folder Tasks › Make a new folder', () => docs.getByRole('button', { name: 'Make a new folder' }).click());
  await page.keyboard.press('Enter');
  await expectEffect('File and Folder Tasks › Rename this folder', () => docs.getByRole('button', { name: 'Rename this folder' }).click());
  await page.keyboard.press('Escape');
  await goTo('My Computer');
  await expectEffect('System Tasks › Change a setting', () => docs.getByRole('button', { name: 'Change a setting' }).click());
  await closeActive();
  await activate(docs);
  await expectEffect('Other Places › Control Panel', () => docs.locator('.task-link', { hasText: /^Control Panel$/ }).click());
  await closeActive();
  // Help topics.
  await startApp(page, 'Help and Support');
  const help = win(page, 'Help and Support Center');
  for (const topic of await help.locator('.help__toc .help__topic:not(.is-current) > span:last-child').allTextContents()) {
    await expectEffect(`Help topic ${topic}`, () => help.locator('.help__toc').getByRole('button', { name: topic, exact: true }).click());
  }
  // Tray clock and volume; Quick Launch.
  await expectEffect('clock (keyboard)', async () => {
    await page.locator('.xp-tray__clock').focus();
    await page.keyboard.press('Enter');
  });
  // The volume popup lives in the menu layer, which the effect observer ignores.
  await page.getByRole('button', { name: /^Volume/ }).click();
  await expect(page.getByRole('dialog', { name: 'Volume' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Volume' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start', exact: true }).click({ button: 'right' });
  await clickMenuItem(page, 'Toolbars');
  await clickMenuItem(page, 'Quick Launch');
  await expectEffect('Quick Launch › Show Desktop', () => page.getByRole('button', { name: 'Show Desktop' }).click());
  await expectEffect('Quick Launch › Internet Explorer', () => page.getByRole('button', { name: 'Launch Internet Explorer' }).click());
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});
