import { expect, type Locator, type Page } from '@playwright/test';

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const exact = (s: string) => new RegExp(`^${escapeRe(s)}$`);

export async function boot(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
}

/** Collects console errors and page errors; assert empty at the end of a test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Fails if the page makes any request outside its own origin. */
export function trackExternalRequests(page: Page, origin = 'http://localhost:4173'): string[] {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url);
  });
  return external;
}

export const win = (page: Page, name: string | RegExp) => page.getByRole('region', { name: typeof name === 'string' ? exact(name) : name });
/** Pins a window by its stable ID, since titles follow navigation. */
export async function pin(w: Locator): Promise<Locator> {
  const id = await w.getAttribute('data-window-id');
  return w.page().locator(`section[data-window-id="${id}"]`);
}
export const windows = (page: Page) => page.locator('section[data-window-id]:not([hidden])');
export const desktop = (page: Page) => page.getByRole('listbox', { name: 'Desktop' });
export const desktopItem = (page: Page, name: string) => desktop(page).locator('[role=option]').filter({ has: page.locator('.desktop-icon__label', { hasText: exact(name) }) });
export const view = (w: Locator) => w.getByRole('listbox', { name: 'Items' });
export const item = (w: Locator, name: string) => view(w).locator('[role=option]').filter({ has: w.page().locator('.item__name', { hasText: exact(name) }) });
export const taskButton = (page: Page, name: string) => page.getByRole('group', { name: 'Running windows' }).getByRole('button', { name: exact(name) });
export const dialog = (page: Page, name?: string | RegExp) => (name ? page.getByRole('dialog', { name }) : page.getByRole('dialog'));

export async function clickMenuItem(page: Page, name: string) {
  await page.locator('[role=menu] [role^=menuitem]').filter({ hasText: exact(name) }).last().click();
}

/** Opens a window menu (File, Edit, …) and clicks a path of items. */
export async function menuPath(w: Locator, ...path: string[]) {
  const page = w.page();
  await w.getByRole('menubar').getByRole('menuitem', { name: path[0], exact: true }).click();
  for (const name of path.slice(1)) await clickMenuItem(page, name);
}

export async function openStart(page: Page) {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('menu', { name: 'Start menu' })).toBeVisible();
}

export async function startItem(page: Page, name: string) {
  await openStart(page);
  await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: exact(name) }).first().click();
}

export async function openMyDocuments(page: Page): Promise<Locator> {
  await desktopItem(page, 'My Documents').dblclick();
  const w = win(page, 'My Documents');
  await expect(w).toBeVisible();
  return w;
}

/** Activates a window through its taskbar button (title bars may be covered). */
export async function activate(w: Locator) {
  const page = w.page();
  if (await w.evaluate((e) => e.classList.contains('is-active'))) return;
  const id = await w.getAttribute('data-window-id');
  await page.locator(`[data-window-button="${id}"]`).click();
  await expect(w).toHaveClass(/is-active/);
}

/** Clicks blank space in a folder view to clear its selection. */
export async function clearSelection(w: Locator) {
  const box = await rect(view(w));
  await view(w).click({ position: { x: box.width - 12, y: box.height - 12 } });
}

/** Creates a folder in an Explorer window via the task pane and names it. */
export async function newFolder(w: Locator, name: string) {
  const page = w.page();
  await activate(w);
  await clearSelection(w);
  const task = w.getByRole('button', { name: 'Make a new folder' });
  // Windows showing the Folders pane have no task pane: use File > New > Folder.
  if (await task.isVisible()) await task.click();
  else await menuPath(w, 'File', 'New', 'Folder');
  const input = w.locator('.rename__input');
  await expect(input).toBeFocused();
  await input.fill(name);
  await input.press('Enter');
  await expect(item(w, name)).toBeVisible();
  void page;
}

export async function newDesktopFolder(page: Page, name: string, at = { x: 520, y: 300 }) {
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await clickMenuItem(page, 'New');
  await clickMenuItem(page, 'Folder');
  const input = desktop(page).locator('.rename__input');
  await expect(input).toBeFocused();
  await input.fill(name);
  await input.press('Enter');
  await expect(desktopItem(page, name)).toBeVisible();
}

export async function confirm(page: Page, button = 'Yes') {
  const d = page.getByRole('dialog').last();
  await d.getByRole('button', { name: button, exact: true }).click();
  await expect(d).toBeHidden();
}

export async function rect(l: Locator) {
  const box = await l.boundingBox();
  if (!box) throw new Error('no bounding box');
  return box;
}

export async function savedState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('xp-sim:v1') ?? 'null'));
}
