import { expect, test, type Page } from '@playwright/test';
import {
  activate,
  boot,
  clickMenuItem,
  desktop,
  desktopItem,
  newDesktopFolder,
  openStart,
  savedState,
  trackErrors,
  win,
  windows,
} from './helpers';

const startMenu = (page: Page) => page.getByRole('menu', { name: 'Start menu' });
const wallpaper = (page: Page) => page.locator('.desktop').evaluate((e) => getComputedStyle(e).backgroundImage);

async function openDisplay(page: Page) {
  await page.mouse.click(600, 400, { button: 'right' });
  await clickMenuItem(page, 'Properties');
  const d = win(page, 'Display Properties');
  await expect(d).toBeVisible();
  return d;
}

test.describe('QA-12 settings', () => {
  test('Apply keeps the first change, Cancel discards the second, host untouched', async ({ page }) => {
    await boot(page);
    expect(await wallpaper(page)).toContain('hillside');
    const d = await openDisplay(page);
    await d.getByRole('tab', { name: 'Desktop' }).click();
    const bg = d.getByLabel('Background:');
    await bg.selectOption({ label: 'Azure' });
    await expect(d.getByRole('button', { name: 'Apply' })).toBeEnabled();
    await d.getByRole('button', { name: 'Apply' }).click();
    expect(await wallpaper(page)).toContain('azure');
    await expect(d.getByRole('button', { name: 'Apply' })).toBeDisabled();
    await bg.selectOption({ label: 'Dusk' });
    expect(await wallpaper(page)).toContain('azure');
    await d.getByRole('button', { name: 'Cancel' }).click();
    await expect(d).toHaveCount(0);
    expect(await wallpaper(page)).toContain('azure');
    // Reopen: controls reflect the committed state.
    const d2 = await openDisplay(page);
    await d2.getByRole('tab', { name: 'Desktop' }).click();
    await expect(d2.getByLabel('Background:')).toHaveValue('azure');
    // Solid colour fallback via OK.
    await d2.getByLabel('Background:').selectOption({ label: '(None)' });
    await d2.getByRole('radio', { name: '#008080' }).check({ force: true });
    await d2.getByRole('button', { name: 'OK' }).click();
    expect(await wallpaper(page)).toBe('none');
    expect(await page.locator('.desktop').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(0, 128, 128)');
    // Settings tab is read-only viewport information.
    const d3 = await openDisplay(page);
    await d3.getByRole('tab', { name: 'Settings' }).click();
    await expect(d3).toContainText('1024 by 768 pixels');
    await expect(d3).toContainText('cannot change your screen resolution');
    await d3.getByRole('button', { name: 'OK' }).click();
  });

  test('other applets: taskbar, sounds, accessibility, date and time, folder options', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Control Panel' }).click();
    const cp = win(page, 'Control Panel');
    // Unsupported categories are visibly disabled with an explanation.
    const network = cp.getByRole('button', { name: 'Network and Internet Connections' });
    await expect(network).toHaveAttribute('aria-disabled', 'true');
    await expect(cp).toContainText('Grayed categories are not simulated');
    // Taskbar: clock off, Quick Launch on.
    await cp.getByRole('button', { name: 'Switch to Classic View' }).click();
    await cp.getByRole('button', { name: 'Taskbar and Start Menu' }).click();
    const tb = win(page, 'Taskbar and Start Menu Properties');
    await tb.getByLabel('Show the clock').uncheck();
    await tb.getByLabel('Show Quick Launch').check();
    await tb.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('.xp-tray__clock')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show Desktop' })).toBeVisible();
    // Sounds: mute reflects in the tray icon.
    await cp.getByRole('button', { name: 'Sounds and Audio Devices' }).click();
    const snd = win(page, 'Sounds and Audio Devices Properties');
    await snd.getByLabel('Mute').check();
    await snd.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('button', { name: 'Volume (muted)' })).toBeVisible();
    await snd.getByRole('button', { name: 'OK' }).click();
    // Accessibility: increased contrast + larger controls apply immediately.
    await cp.getByRole('button', { name: 'Accessibility Options' }).click();
    const acc = win(page, 'Accessibility Options');
    await acc.getByLabel('Use increased contrast').check();
    await acc.getByLabel('Use larger controls').check();
    await acc.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('html')).toHaveClass(/high-contrast/);
    await expect(page.locator('html')).toHaveClass(/larger-controls/);
    await acc.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('html')).toHaveClass(/high-contrast/);
    // Date and Time: month navigation is view-only; nothing to apply.
    await cp.getByRole('button', { name: 'Date and Time' }).click();
    const dt = win(page, 'Date and Time Properties');
    await expect(dt.getByRole('button', { name: 'Apply' })).toBeDisabled();
    const month = dt.getByLabel('Month', { exact: true });
    const before = await month.inputValue();
    await dt.getByRole('button', { name: 'Next month' }).click();
    expect(await month.inputValue()).not.toBe(before);
    await expect(dt).toContainText('cannot be changed from this simulation');
    await dt.getByRole('button', { name: 'OK' }).click();
    // Folder Options: classic folders hide the task pane in new windows.
    await cp.getByRole('button', { name: 'Folder Options' }).click();
    const fo = win(page, 'Folder Options');
    await fo.getByLabel('Use Windows classic folders').check();
    await fo.getByRole('button', { name: 'OK' }).click();
    await desktopItem(page, 'My Documents').dblclick();
    await expect(win(page, 'My Documents').getByRole('complementary', { name: 'Tasks' })).toHaveCount(0);
    // Single-instance applets: reopening focuses the existing one.
    await activate(cp);
    await cp.getByRole('button', { name: 'Display' }).click();
    await expect(win(page, 'Display Properties')).toBeVisible();
    await page.mouse.click(1000, 600, { button: 'right' });
    await clickMenuItem(page, 'Properties');
    await expect(win(page, 'Display Properties')).toHaveCount(1);
    await expect(win(page, 'Display Properties')).toHaveClass(/is-active/);
    expect(errors).toEqual([]);
  });
});

test.describe('QA-13 Calculator', () => {
  test('immediate execution, percent, divide by zero, repeated equals and memory', async ({ page }) => {
    await boot(page);
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Calculator' }).click();
    const calc = win(page, 'Calculator');
    const display = calc.getByTestId('calc-display');
    const press = async (...labels: string[]) => {
      // Keys are named "<visible label> (<description>)", e.g. "+ (add)"; digits by label alone.
      for (const l of labels) {
        const name = /^\d$/.test(l) ? new RegExp(`^${l}$`) : new RegExp(`\\(${l.toLowerCase()}\\)$`);
        await calc.getByRole('button', { name }).click();
      }
    };
    await press('2', 'Add', '3', 'Multiply', '4', 'Equals');
    await expect(display).toHaveText('20.');
    await press('Clear', '2', '0', '0', 'Add', '1', '0', 'Percent');
    await expect(display).toHaveText('20.');
    await press('Equals');
    await expect(display).toHaveText('220.');
    await press('8', 'Divide', '0', 'Equals');
    await expect(display).toHaveText('Cannot divide by zero.');
    await press('5');
    await expect(display).toHaveText('Cannot divide by zero.');
    await press('Clear');
    await expect(display).toHaveText('0.');
    await press('2', 'Add', '3', 'Equals', 'Equals');
    await expect(display).toHaveText('8.');
    // Memory
    await press('Memory store');
    await expect(calc.getByRole('img', { name: 'Memory is set' })).toHaveText('M');
    await press('Clear', '2', 'Memory add', 'Clear', 'Memory recall');
    await expect(display).toHaveText('10.');
    await press('Memory clear');
    await expect(calc.getByRole('img', { name: 'Memory is empty' })).toBeVisible();
    // Keyboard input while Calculator is active.
    await calc.locator('.calc__grid').focus();
    await page.keyboard.press('Escape');
    await page.keyboard.type('12.5*2=');
    await expect(display).toHaveText('25.');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('9@');
    await expect(display).toHaveText('3.');
    // Keys do not reach Calculator when another app is active.
    await desktopItem(page, 'My Computer').dblclick();
    await expect(win(page, 'My Computer')).toHaveClass(/is-active/);
    await page.keyboard.type('7');
    await expect(display).toHaveText('3.');
  });
});

test.describe('QA-14 session controls', () => {
  test('log off, stand by, restart and turn off keep folders and preferences', async ({ page }) => {
    await boot(page);
    await newDesktopFolder(page, 'Keep Me');
    await desktopItem(page, 'My Computer').dblclick();
    // Log off and resume.
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Log Off' }).click();
    const logoff = page.getByRole('dialog', { name: 'Log Off Windows' });
    await expect(logoff.getByRole('button', { name: 'Switch User' })).toHaveAttribute('aria-disabled', 'true');
    await logoff.getByRole('button', { name: 'Log Off' }).click();
    await expect(page.getByRole('heading', { name: 'To begin, click your user name' })).toBeVisible();
    await page.getByRole('button', { name: 'User' }).click();
    await expect(desktopItem(page, 'Keep Me')).toBeVisible();
    await expect(windows(page)).toHaveCount(0);
    // Stand by keeps windows; any key wakes.
    await desktopItem(page, 'My Computer').dblclick();
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Turn Off Computer' }).click();
    await page.getByRole('dialog', { name: 'Turn off computer' }).getByRole('button', { name: 'Stand By' }).click();
    await expect(page.getByRole('dialog', { name: 'Stand by' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog', { name: 'Stand by' })).toHaveCount(0);
    await expect(win(page, 'My Computer')).toBeVisible();
    // Restart clears windows, keeps folders.
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Turn Off Computer' }).click();
    await page.getByRole('dialog', { name: 'Turn off computer' }).getByRole('button', { name: 'Restart' }).click();
    await expect(desktopItem(page, 'Keep Me')).toBeVisible();
    await expect(windows(page)).toHaveCount(0);
    // Turn off shows an off screen with a start-again button.
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Turn Off Computer' }).click();
    await page.getByRole('dialog', { name: 'Turn off computer' }).getByRole('button', { name: 'Turn Off' }).click();
    await expect(page.getByRole('heading', { name: 'The simulation is turned off.' })).toBeVisible();
    await page.getByRole('button', { name: 'Start again' }).click();
    await expect(desktopItem(page, 'Keep Me')).toBeVisible();
    // Cancel makes no change.
    await openStart(page);
    await startMenu(page).getByRole('menuitem', { name: 'Turn Off Computer' }).click();
    const off = page.getByRole('dialog', { name: 'Turn off computer' });
    await expect(off.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(off).toHaveCount(0);
    expect(page.url()).toBe('http://localhost:4173/');
  });
});

test.describe('QA-15 persistence', () => {
  test('reload hydrates folders and preferences but not windows', async ({ page }) => {
    await boot(page);
    await newDesktopFolder(page, 'Persisted');
    const d = await openDisplay(page);
    await d.getByRole('tab', { name: 'Desktop' }).click();
    await d.getByLabel('Background:').selectOption({ label: 'Dusk' });
    await d.getByRole('button', { name: 'OK' }).click();
    await desktopItem(page, 'My Computer').dblclick();
    await expect.poll(async () => (await savedState(page))?.prefs.wallpaper).toBe('dusk');
    await page.reload();
    await expect(desktopItem(page, 'Persisted')).toBeVisible();
    expect(await wallpaper(page)).toContain('dusk');
    await expect(windows(page)).toHaveCount(0);
    // No document nodes ever reach storage.
    const saved = await savedState(page);
    for (const node of Object.values(saved.fs.nodes) as Record<string, unknown>[]) {
      expect(Object.keys(node).sort()).toEqual(['created', 'id', 'modified', 'name', 'parentId']);
    }
  });

  test('corrupt and future data fall back without overwriting; reset is explicit', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('xp-sim:v1', '{"version":1,"fs":{"nodes":{"c":{"id":"c"}}},"prefs":{}}');
        sessionStorage.setItem('seeded', '1');
      }
    });
    await boot(page);
    const notice = page.getByRole('region', { name: 'Notification' });
    await expect(notice).toContainText('could not be loaded');
    // Usable fallback session; saving is paused so the stored payload survives.
    await newDesktopFolder(page, 'Session Only');
    expect(await page.evaluate(() => localStorage.getItem('xp-sim:v1'))).toContain('"id":"c"}}}');
    // Explicit reset.
    await notice.getByRole('button', { name: 'Reset saved data…' }).click();
    const confirmReset = page.getByRole('dialog', { name: 'Reset Simulation' });
    await expect(confirmReset.getByRole('button', { name: 'No' })).toBeFocused();
    await confirmReset.getByRole('button', { name: 'Yes' }).click();
    await expect(desktopItem(page, 'Session Only')).toHaveCount(0);
    await expect.poll(async () => (await savedState(page))?.version).toBe(1);
  });

  test('data from a newer version is kept untouched', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('xp-sim:v1', JSON.stringify({ version: 99, data: 'newer' }));
        sessionStorage.setItem('seeded', '1');
      }
    });
    await boot(page);
    await expect(page.getByRole('region', { name: 'Notification' })).toContainText('newer version');
    await newDesktopFolder(page, 'Not Saved');
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('xp-sim:v1'))).toContain('"version":99');
    await expect(desktopItem(page, 'Not Saved')).toHaveCount(0);
  });

  test('blocked storage keeps a working session with a notice', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    const errors = trackErrors(page);
    await boot(page);
    await expect(page.getByRole('region', { name: 'Notification' })).toContainText('will not be kept');
    await newDesktopFolder(page, 'Works Anyway');
    await expect(desktopItem(page, 'Works Anyway')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a save from another tab is surfaced instead of silently merged', async ({ page, context }) => {
    await boot(page);
    await newDesktopFolder(page, 'Tab One');
    const other = await context.newPage();
    await boot(other);
    await expect(desktopItem(other, 'Tab One')).toBeVisible();
    await newDesktopFolder(other, 'Tab Two');
    const notice = page.getByRole('region', { name: 'Notification' });
    await expect(notice).toContainText('changed in another browser tab');
    await expect(desktopItem(page, 'Tab Two')).toHaveCount(0);
    await notice.getByRole('button', { name: 'Load saved version' }).click();
    await expect(desktopItem(page, 'Tab Two')).toBeVisible();
    await expect(desktop(page)).toBeVisible();
  });
});
