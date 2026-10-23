import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  activate,
  boot,
  clearSelection,
  clickMenuItem,
  confirm,
  desktopItem,
  item,
  menuPath,
  newFolder,
  openMyDocuments,
  pin,
  rect,
  savedState,
  trackErrors,
  view,
  win,
} from './helpers';

async function address(w: Locator, text: string) {
  const input = w.getByLabel('Address', { exact: true });
  await input.fill(text);
  await input.press('Enter');
}

async function names(w: Locator) {
  return view(w).locator('.item__name').allTextContents();
}

async function dragTo(page: Page, from: Locator, to: Locator, modifiers: ('Control' | 'Meta')[] = []) {
  const a = await rect(from);
  const b = await rect(to);
  await page.mouse.move(a.x + a.width / 2, a.y + Math.min(20, a.height / 2));
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + 10, { steps: 3 });
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(20, b.height / 2), { steps: 8 });
  await page.mouse.up();
  for (const m of modifiers) await page.keyboard.up(m);
}

test.describe('QA-04 navigation and history', () => {
  test('independent histories, forward branch discarded, bad address keeps location', async ({ page }) => {
    await boot(page);
    const a = await pin(await openMyDocuments(page));
    await newFolder(a, 'Alpha');
    await item(a, 'Alpha').dblclick();
    await newFolder(a, 'Beta');
    await item(a, 'Beta').dblclick();
    await expect(a.getByLabel('Address', { exact: true })).toHaveValue('C:\\Documents and Settings\\User\\My Documents\\Alpha\\Beta');

    // A second window has its own history.
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('menu', { name: 'Start menu' }).getByRole('menuitem', { name: 'My Computer', exact: true }).click();
    const b = await pin(win(page, 'My Computer'));
    await expect(b.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();

    await activate(a);
    await a.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(a.locator('.xp-window__title')).toHaveText('Alpha');
    await a.getByRole('button', { name: 'Forward', exact: true }).click();
    await expect(a.locator('.xp-window__title')).toHaveText('Beta');
    await a.getByRole('button', { name: 'Up', exact: true }).click();
    await a.getByRole('button', { name: 'Up', exact: true }).click();
    await expect(a.locator('.xp-window__title')).toHaveText('My Documents');
    // Navigate somewhere new after Back: the forward branch is discarded.
    await a.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(a.locator('.xp-window__title')).toHaveText('Alpha');
    await item(a, 'Beta').click();
    await address(a, 'C:\\WINDOWS');
    await expect(a.locator('.xp-window__title')).toHaveText('WINDOWS');
    await expect(a.getByRole('button', { name: 'Forward', exact: true })).toBeDisabled();

    // Case-insensitive paths and shell names resolve; bad input is an error and keeps the location.
    await address(a, 'c:/documents and settings/user/my documents/ALPHA');
    await expect(a.locator('.xp-window__title')).toHaveText('Alpha');
    await address(a, 'C:\\No Such Folder');
    const err = page.getByRole('dialog');
    await expect(err).toContainText("Windows cannot find 'C:\\No Such Folder'");
    await err.getByRole('button', { name: 'OK' }).click();
    await expect(a.locator('.xp-window__title')).toHaveText('Alpha');
    await address(a, 'https://example.com');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(a.locator('.xp-window__title')).toHaveText('Alpha');
  });
});

test.describe('QA-05 create and rename', () => {
  test('unique defaults, invalid and duplicate names keep editing, Escape keeps the new folder', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    const w = await pin(await openMyDocuments(page));
    await w.getByRole('button', { name: 'Make a new folder' }).click();
    const input = w.locator('.rename__input');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('New Folder');
    // Escape on the initial rename keeps the created folder with its default name.
    await input.press('Escape');
    await expect(item(w, 'New Folder')).toBeVisible();
    // With the new folder selected the task pane offers folder tasks; clear the selection first.
    await expect(w.getByRole('button', { name: 'Rename this folder' })).toBeVisible();
    await clearSelection(w);
    await w.getByRole('button', { name: 'Make a new folder' }).click();
    await expect(w.locator('.rename__input')).toHaveValue('New Folder (2)');
    await w.locator('.rename__input').press('Escape');

    // Rename to an invalid name: the editor stays open with an associated error.
    await item(w, 'New Folder').click();
    await page.keyboard.press('F2');
    await expect(w.locator('.rename__input')).toBeFocused();
    await w.locator('.rename__input').fill('bad:name');
    await w.locator('.rename__input').press('Enter');
    await expect(w.getByRole('alert')).toContainText('cannot contain');
    await expect(w.locator('.rename__input')).toHaveAttribute('aria-invalid', 'true');
    // Duplicate (case-insensitive) is rejected too.
    await w.locator('.rename__input').fill('new folder (2)');
    await w.locator('.rename__input').press('Enter');
    await expect(w.getByRole('alert')).toContainText('already exists');
    // A valid name commits.
    await w.locator('.rename__input').fill('Reports');
    await w.locator('.rename__input').press('Enter');
    await expect(item(w, 'Reports')).toBeVisible();
    expect(await names(w)).toEqual(['My Music', 'My Pictures', 'New Folder (2)', 'Reports']);

    // Protected folders cannot be renamed and expose no Rename command.
    await item(w, 'My Music').click({ button: 'right' });
    await expect(page.getByRole('menu').getByRole('menuitem', { name: 'Rename' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Read-only locations refuse new folders with an explanation.
    await w.getByLabel('Address', { exact: true }).fill('C:\\Program Files');
    await w.getByLabel('Address', { exact: true }).press('Enter');
    await expect(w.getByRole('button', { name: 'Make a new folder' })).toHaveCount(0);
    await menuPath(w, 'File', 'New');
    await expect(page.getByRole('menuitem', { name: 'Folder', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
});

test.describe('QA-06 clipboard and moves between windows', () => {
  test('multi-select cut/paste, repeated copy names, invalid drops change nothing', async ({ page }) => {
    await boot(page);
    const docs = await pin(await openMyDocuments(page));
    await newFolder(docs, 'One');
    await newFolder(docs, 'Two');
    await newFolder(docs, 'Three');
    // Second window on My Pictures.
    await item(docs, 'My Pictures').click({ button: 'right' });
    await clickMenuItem(page, 'Explore');
    const pics = await pin(win(page, 'My Pictures'));

    // Multi-select with Ctrl, cut, paste in the other window.
    await activate(docs);
    await item(docs, 'One').click();
    await item(docs, 'Three').click({ modifiers: ['ControlOrMeta'] });
    await expect(docs.locator('.status-bar')).toContainText('2 objects selected');
    await page.keyboard.press('ControlOrMeta+x');
    await expect(item(docs, 'One')).toHaveClass(/is-cut/);
    await activate(pics);
    await view(pics).click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('ControlOrMeta+v');
    await expect(item(pics, 'One')).toBeVisible();
    await expect(item(pics, 'Three')).toBeVisible();
    expect(await names(docs)).toEqual(['My Music', 'My Pictures', 'Two']);

    // Copy twice into the same parent: unique "Copy of" names.
    await item(pics, 'One').click();
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    await page.keyboard.press('ControlOrMeta+v');
    await expect(item(pics, 'Copy (2) of One')).toBeVisible();
    expect(await names(pics)).toEqual(['Copy (2) of One', 'Copy of One', 'One', 'Three']);
    const saved = await savedState(page);
    const ids = [...Object.keys(saved.fs.nodes)];
    expect(new Set(ids).size).toBe(ids.length);

    // Dragging a folder onto its own subfolder (in the Folders tree) is rejected with no change.
    await item(pics, 'One').dblclick();
    await newFolder(pics, 'Inner');
    await pics.getByRole('button', { name: 'Up', exact: true }).click();
    // Tree expansion is independent of location: expand One with its plus box.
    await pics.getByRole('treeitem', { name: 'One', exact: true }).locator('.xp-tree__toggle').click();
    const innerNode = pics.getByRole('treeitem', { name: 'Inner', exact: true });
    await expect(innerNode).toBeVisible();
    const before = JSON.stringify((await savedState(page)).fs);
    await dragTo(page, item(pics, 'One'), innerNode);
    const err = page.getByRole('dialog', { name: 'Error Moving Folder' });
    await expect(err).toContainText('subfolder of the source folder');
    await err.getByRole('button', { name: 'OK' }).click();
    expect(JSON.stringify((await savedState(page)).fs)).toBe(before);
    await item(pics, 'One').click({ button: 'right' });
    await clickMenuItem(page, 'Explore');
    const one = await pin(win(page, 'One'));
    await activate(pics);

    // Move into a protected/read-only location fails with an explanation.
    await item(pics, 'Three').click();
    await page.keyboard.press('ControlOrMeta+x');
    await activate(one);
    await one.getByLabel('Address', { exact: true }).fill('C:\\WINDOWS');
    await one.getByLabel('Address', { exact: true }).press('Enter');
    await expect(one.getByRole('button', { name: 'Make a new folder' })).toHaveCount(0);
    await view(one).click({ button: 'right', position: { x: 200, y: 150 } });
    await expect(page.getByRole('menuitem', { name: 'Paste' })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    expect(JSON.stringify((await savedState(page)).fs)).toBe(before);
  });

  test('drag to move, Ctrl-drag to copy, drop on the Recycle Bin asks first', async ({ page }) => {
    await boot(page);
    const docs = await pin(await openMyDocuments(page));
    await newFolder(docs, 'Mover');
    await newFolder(docs, 'Copier');
    await dragTo(page, item(docs, 'Mover'), item(docs, 'My Music'));
    await expect(item(docs, 'Mover')).toHaveCount(0);
    await dragTo(page, item(docs, 'Copier'), item(docs, 'My Music'), ['Control']);
    await expect(item(docs, 'Copier')).toBeVisible();
    await item(docs, 'My Music').dblclick();
    expect(await names(docs)).toEqual(['Copier', 'Mover']);
    await dragTo(page, item(docs, 'Mover'), desktopItem(page, 'Recycle Bin'));
    await expect(page.getByRole('dialog', { name: 'Confirm Folder Delete' })).toBeVisible();
    await confirm(page, 'Yes');
    expect(await names(docs)).toEqual(['Copier']);
  });
});

test.describe('QA-07 Recycle Bin', () => {
  test('delete nested, viewing window recovers, restore, conflict choice, empty bin', async ({ page }) => {
    await boot(page);
    const docs = await pin(await openMyDocuments(page));
    await newFolder(docs, 'Parent');
    await item(docs, 'Parent').dblclick();
    await newFolder(docs, 'Child');
    await item(docs, 'Child').dblclick();
    await newFolder(docs, 'Grandchild');
    // A second window shows Parent\Child.
    await docs.getByRole('button', { name: 'Up', exact: true }).click();
    await item(docs, 'Child').click({ button: 'right' });
    await clickMenuItem(page, 'Explore');
    const child = await pin(win(page, 'Child'));
    await expect(item(child, 'Grandchild')).toBeVisible();

    // Delete Parent from the first window.
    await activate(docs);
    await docs.getByRole('button', { name: 'Up', exact: true }).click();
    await item(docs, 'Parent').click();
    await page.keyboard.press('Delete');
    const dlg = page.getByRole('dialog', { name: 'Confirm Folder Delete' });
    await expect(dlg).toContainText("send ‘Parent’ and all its contents to the Recycle Bin");
    // Destructive confirmation starts on No.
    await expect(dlg.getByRole('button', { name: 'No' })).toBeFocused();
    await confirm(page, 'Yes');
    // The window showing a deleted folder recovers to the closest surviving ancestor.
    await expect(child.locator('.xp-window__title')).toHaveText('My Documents');
    await expect(desktopItem(page, 'Recycle Bin').locator('img')).toHaveAttribute('src', /recycle-full/);

    // The bin lists the deleted root only, with its original location.
    await desktopItem(page, 'Recycle Bin').dblclick();
    const bin = await pin(win(page, 'Recycle Bin'));
    expect(await names(bin)).toEqual(['Parent']);
    await expect(item(bin, 'Parent')).toContainText('C:\\Documents and Settings\\User\\My Documents');

    // Create a conflicting folder, then restore: Keep Both is explicit.
    await activate(docs);
    await newFolder(docs, 'Parent');
    await activate(bin);
    await item(bin, 'Parent').click();
    await bin.getByRole('button', { name: 'Restore this item' }).click();
    const conflict = page.getByRole('dialog', { name: 'Confirm Folder Name Conflict' });
    await expect(conflict).toBeVisible();
    await conflict.getByRole('button', { name: 'Keep Both' }).click();
    await expect(item(docs, 'Parent (2)')).toBeVisible();
    // Subtree intact after restore.
    await activate(docs);
    await item(docs, 'Parent (2)').dblclick();
    await item(docs, 'Child').dblclick();
    await expect(item(docs, 'Grandchild')).toBeVisible();

    // Restore when the original parent is gone offers My Documents explicitly.
    await item(docs, 'Grandchild').click();
    await page.keyboard.press('Delete');
    await confirm(page, 'Yes');
    await docs.getByRole('button', { name: 'Up', exact: true }).click();
    await item(docs, 'Child').click();
    await page.keyboard.press('Delete');
    await confirm(page, 'Yes');
    await activate(bin);
    await item(bin, 'Grandchild').click();
    await bin.getByRole('button', { name: 'Restore this item' }).click();
    const missing = page.getByRole('dialog', { name: 'Restore' });
    await expect(missing).toContainText('no longer exists');
    await missing.getByRole('button', { name: 'Restore to My Documents' }).click();
    await activate(docs);
    await docs.getByLabel('Address', { exact: true }).fill('My Documents');
    await docs.getByLabel('Address', { exact: true }).press('Enter');
    await expect(item(docs, 'Grandchild')).toBeVisible();

    // Empty requires confirmation and updates the icon.
    await activate(bin);
    await bin.getByRole('button', { name: 'Empty the Recycle Bin' }).click();
    const emptyDlg = page.getByRole('dialog', { name: /Confirm/ });
    await expect(emptyDlg).toContainText('cannot be undone');
    await confirm(page, 'Yes');
    await expect(view(bin).locator('[role=option]')).toHaveCount(0);
    await expect(bin.getByRole('button', { name: 'Empty the Recycle Bin' })).toHaveCount(0);
    await expect(desktopItem(page, 'Recycle Bin').locator('img')).toHaveAttribute('src', /recycle-empty/);
  });
});

test.describe('QA-08 undo', () => {
  test('undo create, rename, move, copy and delete; permanent delete clears undo', async ({ page }) => {
    await boot(page);
    const w = await pin(await openMyDocuments(page));
    const undo = async () => {
      await menuPath(w, 'Edit');
      await page.getByRole('menu').getByRole('menuitem', { name: /^Undo/ }).click();
    };
    // Create (Escape keeps the default name, so the last transaction is the creation itself).
    await w.getByRole('button', { name: 'Make a new folder' }).click();
    await w.locator('.rename__input').press('Escape');
    await expect(item(w, 'New Folder')).toBeVisible();
    await menuPath(w, 'Edit');
    await expect(page.getByRole('menuitem', { name: 'Undo New Folder' })).toBeVisible();
    await page.keyboard.press('Escape');
    await undo();
    await expect(item(w, 'New Folder')).toHaveCount(0);
    // Naming a new folder is two transactions; one-level Undo reverts only the rename.
    await newFolder(w, 'Temp');
    await undo();
    await expect(item(w, 'New Folder')).toBeVisible();
    await menuPath(w, 'Edit');
    await expect(page.getByRole('menuitem', { name: 'Undo', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await item(w, 'New Folder').click();
    await page.keyboard.press('Shift+Delete');
    await confirm(page, 'Yes');
    // Rename
    await newFolder(w, 'Before');
    await item(w, 'Before').click();
    await page.keyboard.press('F2');
    await w.locator('.rename__input').fill('After');
    await w.locator('.rename__input').press('Enter');
    await expect(item(w, 'After')).toBeVisible();
    await menuPath(w, 'Edit');
    await expect(page.getByRole('menuitem', { name: 'Undo Rename' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(item(w, 'Before')).toBeVisible();
    // Move
    await item(w, 'Before').click();
    await page.keyboard.press('ControlOrMeta+x');
    await item(w, 'My Music').dblclick();
    await view(w).click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('ControlOrMeta+v');
    await expect(item(w, 'Before')).toBeVisible();
    await undo();
    await expect(item(w, 'Before')).toHaveCount(0);
    await w.getByRole('button', { name: 'Up', exact: true }).click();
    await expect(item(w, 'Before')).toBeVisible();
    // Copy
    await item(w, 'Before').click();
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    await expect(item(w, 'Copy of Before')).toBeVisible();
    await undo();
    await expect(item(w, 'Copy of Before')).toHaveCount(0);
    // Soft delete
    await item(w, 'Before').click();
    await page.keyboard.press('Delete');
    await confirm(page, 'Yes');
    await expect(item(w, 'Before')).toHaveCount(0);
    await undo();
    await expect(item(w, 'Before')).toBeVisible();
    // Permanent delete clears Undo, protected structure survives.
    await item(w, 'Before').click();
    await page.keyboard.press('Shift+Delete');
    await expect(page.getByRole('dialog')).toContainText('permanently delete');
    await confirm(page, 'Yes');
    await menuPath(w, 'Edit');
    await expect(page.getByRole('menuitem', { name: 'Undo' })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    expect(await names(w)).toEqual(['My Music', 'My Pictures']);
  });
});
