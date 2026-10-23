import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { SEED_IDS, createFolder } from '../../src/domain/fs';
import { LOC } from '../../src/domain/locations';
import { get, set } from '../../src/state/app';
import { openRunDialog } from '../../src/state/dialogs';
import { bootstrap } from '../../src/state/sessionActions';
import { launch } from '../../src/state/windowActions';

/*
 * Component tests render the whole shell, so they exercise the real command
 * layer, focus policy and modal stack. jsdom has no layout engine and lacks a
 * few browser APIs; the shims below report a box for every rendered element
 * (so "is this control visible?" checks pass) and stub the missing APIs. Layout
 * dependent behavior (arrow-key geometry, menu placement) is covered by the
 * Playwright suites instead.
 */
const original = { getClientRects: Element.prototype.getClientRects };
beforeAll(() => {
  Element.prototype.getClientRects = function (this: Element) {
    const box = { x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10 };
    return (this.isConnected && !this.closest('[hidden]') ? [box] : []) as unknown as DOMRectList;
  };
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  if (!globalThis.CSS?.escape) Object.assign(globalThis, { CSS: { ...globalThis.CSS, escape: (s: string) => s.replace(/[^\w-]/g, '\\$&') } });
  window.matchMedia ??= (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
});
afterAll(() => {
  Element.prototype.getClientRects = original.getClientRects;
});

beforeEach(() => {
  bootstrap({ w: 1024, h: 768 });
});

/** Adds user folders to My Documents before the shell renders. */
function seedDocs(...names: string[]) {
  let fs = get().fs;
  for (const name of names) {
    const r = createFolder(fs, SEED_IDS.myDocuments, Date.now(), name);
    if (!r.ok) throw new Error(r.error.message);
    fs = r.fs;
  }
  set((s) => ({ ...s, fs }));
}

function openDocs() {
  act(() => void launch({ app: 'explorer', location: LOC.folder(SEED_IDS.myDocuments) }));
  return screen.getByRole('region', { name: 'My Documents' });
}

const option = (w: HTMLElement, name: string) => within(within(w).getByRole('listbox', { name: 'Items' })).getByRole('option', { name });
const selectedNames = (w: HTMLElement) =>
  within(within(w).getByRole('listbox', { name: 'Items' }))
    .getAllByRole('option')
    .filter((o) => o.getAttribute('aria-selected') === 'true')
    .map((o) => o.querySelector('.item__name')?.textContent);

describe('menu keyboard model', () => {
  it('moves along the menu bar, opens menus and submenus, and returns focus on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    const w = openDocs();
    const bar = within(w).getByRole('menubar');
    const file = within(bar).getByRole('menuitem', { name: 'File' });
    const edit = within(bar).getByRole('menuitem', { name: 'Edit' });
    const view = within(bar).getByRole('menuitem', { name: 'View' });

    act(() => file.focus());
    await user.keyboard('{ArrowRight}');
    expect(edit).toHaveFocus();

    // Enter opens the menu with its first item active, disabled items included and explained.
    await user.keyboard('{Enter}');
    const editMenu = screen.getByRole('menu', { name: 'Edit' });
    expect(edit).toHaveAttribute('aria-expanded', 'true');
    const undo = within(editMenu).getAllByRole('menuitem')[0];
    expect(undo).toHaveFocus();
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    expect(undo).toHaveAccessibleDescription('There is nothing to undo.');
    // Activating a disabled item does nothing and keeps the menu open.
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu', { name: 'Edit' })).toBeInTheDocument();

    // ArrowDown skips separators; ArrowRight on a plain item steps to the next menu.
    await user.keyboard('{ArrowDown}');
    expect(within(editMenu).getByRole('menuitem', { name: /^Cut/ })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.queryByRole('menu', { name: 'Edit' })).not.toBeInTheDocument();
    const viewMenu = screen.getByRole('menu', { name: 'View' });
    expect(view).toHaveAttribute('aria-expanded', 'true');

    // The access key opens a submenu; ArrowLeft closes only the submenu.
    await user.keyboard('y');
    expect(screen.getAllByRole('menu')).toHaveLength(2);
    expect(within(screen.getAllByRole('menu')[1]).getAllByRole('menuitemradio')[0]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(within(viewMenu).getByRole('menuitem', { name: /^Arrange Icons by/ })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(view).toHaveFocus();
    expect(view).toHaveAttribute('aria-expanded', 'false');
  });

  it('runs a command from its access key and closes the menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    const w = openDocs();
    const edit = within(within(w).getByRole('menubar')).getByRole('menuitem', { name: 'Edit' });
    act(() => edit.focus());
    await user.keyboard('{Enter}a');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(selectedNames(w)).toEqual(['My Music', 'My Pictures']);
    expect(within(w).getByText('2 objects selected')).toBeInTheDocument();
  });

  it('closes on Tab without running anything', async () => {
    const user = userEvent.setup();
    render(<App />);
    const w = openDocs();
    const file = within(within(w).getByRole('menubar')).getByRole('menuitem', { name: 'File' });
    act(() => file.focus());
    await user.keyboard('{Enter}{Tab}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'My Documents' })).toBeInTheDocument();
  });
});

describe('modal focus return', () => {
  it('returns focus to the invoker inside a stacked dialog before the next key arrives', async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => openRunDialog());
    const run = screen.getByRole('dialog', { name: 'Run' });
    expect(within(run).getByRole('textbox', { name: 'Open:' })).toHaveFocus();
    const browse = within(run).getByRole('button', { name: 'Browse…' });
    await user.click(browse);
    expect(screen.getByRole('dialog', { name: 'Browse For Folder' })).toBeInTheDocument();
    // The dialog beneath is inert while another is stacked on it.
    expect(run.closest('[inert]')).not.toBeNull();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Browse For Folder' })).not.toBeInTheDocument();
    expect(run.closest('[inert]')).toBeNull();
    expect(browse).toHaveFocus();

    // The very next Escape reaches Run rather than falling on <body>. Run was
    // opened with nothing focused, so focus falls back to the desktop, not <body>.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Run' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Desktop' }).contains(document.activeElement)).toBe(true));
  });

  it('returns focus to the folder after a cancelled delete confirmation', async () => {
    seedDocs('Alpha');
    const user = userEvent.setup();
    render(<App />);
    const w = openDocs();
    await user.click(option(w, 'Alpha'));
    await user.keyboard('{Delete}');
    const confirm = screen.getByRole('dialog', { name: 'Confirm Folder Delete' });
    // Destructive confirmations start on the safe choice (ACCESSIBILITY.md).
    expect(within(confirm).getByRole('button', { name: 'No' })).toHaveFocus();
    // The desktop and windows behind a true modal are inert.
    expect(w.closest('[inert]')).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(option(w, 'Alpha')).toHaveFocus();
    expect(selectedNames(w)).toEqual(['Alpha']);
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => openRunDialog());
    const run = screen.getByRole('dialog', { name: 'Run' });
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(run.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(run.contains(document.activeElement)).toBe(true);
  });
});

describe('inline rename', () => {
  it('reports invalid names, keeps editing, and commits a valid one', async () => {
    seedDocs('Alpha', 'Beta');
    const user = userEvent.setup();
    render(<App />);
    const w = openDocs();
    await user.click(option(w, 'Beta'));
    await user.keyboard('{F2}');
    const box = within(w).getByRole('textbox', { name: 'Rename Beta' });
    expect(box).toHaveFocus();
    expect(box).toHaveValue('Beta');

    const attempt = async (text: string, message: string | RegExp) => {
      await user.clear(box);
      if (text) await user.type(box, text);
      await user.keyboard('{Enter}');
      expect(within(w).getByRole('alert')).toHaveTextContent(message);
      expect(box).toHaveAttribute('aria-invalid', 'true');
      expect(box).toHaveAccessibleDescription(typeof message === 'string' ? expect.stringContaining(message) : message);
      expect(box).toHaveFocus();
    };
    await attempt('ALPHA', 'A folder with the name you specified already exists');
    await attempt('a:b', 'A folder name cannot contain any of the following characters');
    await attempt('', 'You must type a folder name.');
    await attempt('Gamma.', 'A folder name cannot end with a period.');
    await attempt('con', 'is a reserved device name');

    // Editing clears the error; Escape cancels and keeps the old name.
    await user.type(box, 'x');
    expect(within(w).queryByRole('alert')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(within(w).queryByRole('textbox', { name: /^Rename/ })).not.toBeInTheDocument();
    expect(option(w, 'Beta')).toHaveFocus();

    await user.keyboard('{F2}');
    await user.clear(within(w).getByRole('textbox', { name: 'Rename Beta' }));
    await user.keyboard('Gamma{Enter}');
    expect(option(w, 'Gamma')).toHaveFocus();
    expect(within(w).queryByRole('option', { name: 'Beta' })).not.toBeInTheDocument();
    expect(get().undo?.label).toBe('Rename');
  });

  it('treats markup in a name as plain text', async () => {
    seedDocs('Alpha');
    const user = userEvent.setup();
    render(<App />);
    const w = openDocs();
    await user.click(option(w, 'Alpha'));
    await user.keyboard('{F2}');
    const box = within(w).getByRole('textbox', { name: 'Rename Alpha' });
    await user.clear(box);
    await user.type(box, '<img src=x onerror=alert(1)>');
    await user.keyboard('{Enter}');
    // "<", ">" are invalid characters, so the name is rejected as text.
    expect(within(w).getByRole('alert')).toHaveTextContent('cannot contain');
    expect(w.querySelector('img[src="x"]')).toBeNull();
    await user.clear(box);
    await user.type(box, '&amp; "quoted"');
    await user.keyboard('{Escape}');
    await user.keyboard('{F2}');
    await user.clear(within(w).getByRole('textbox', { name: 'Rename Alpha' }));
    await user.keyboard('&amp; it');
    await user.keyboard('{Enter}');
    expect(option(w, '&amp; it')).toBeInTheDocument();
  });
});

describe('selection', () => {
  it('supports click, Ctrl+click, Shift+click, Ctrl+A, Home/Shift+End and Ctrl+Space', async () => {
    seedDocs('Alpha', 'Beta', 'Delta', 'Gamma');
    const user = userEvent.setup();
    render(<App />);
    const w = openDocs();
    const names = within(within(w).getByRole('listbox', { name: 'Items' }))
      .getAllByRole('option')
      .map((o) => o.querySelector('.item__name')?.textContent ?? '');
    expect(names).toHaveLength(6);
    const [a, b, c, d] = names;
    // Each option is named by its folder name; the visible type line is the description.
    expect(option(w, 'Alpha')).toHaveAccessibleName('Alpha');
    expect(option(w, 'Alpha')).toHaveAccessibleDescription('File Folder');

    await user.click(option(w, a));
    expect(selectedNames(w)).toEqual([a]);
    await user.keyboard('{Control>}');
    await user.click(option(w, c));
    await user.keyboard('{/Control}');
    expect(selectedNames(w)).toEqual([a, c]);
    // Ctrl+click toggles an item off again.
    await user.keyboard('{Control>}');
    await user.click(option(w, a));
    await user.keyboard('{/Control}');
    expect(selectedNames(w)).toEqual([c]);
    // Shift+click selects from the anchor (the last Ctrl+clicked item) to the target.
    await user.click(option(w, c));
    await user.keyboard('{Shift>}');
    await user.click(option(w, b));
    await user.keyboard('{/Shift}');
    expect(selectedNames(w)).toEqual([b, c]);
    await user.keyboard('{Shift>}');
    await user.click(option(w, d));
    await user.keyboard('{/Shift}');
    expect(selectedNames(w)).toEqual([c, d]);

    await user.keyboard('{Control>}a{/Control}');
    expect(selectedNames(w)).toEqual(names);
    expect(within(w).getByText('6 objects selected')).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(selectedNames(w)).toEqual([a]);
    expect(option(w, a)).toHaveFocus();
    await user.keyboard('{Shift>}{End}{/Shift}');
    expect(selectedNames(w)).toEqual(names);
    expect(option(w, names[5])).toHaveFocus();
    await user.keyboard('{Control>} {/Control}');
    expect(selectedNames(w)).toEqual(names.slice(0, 5));

    // Type-ahead moves to the next name starting with the letter.
    await user.keyboard('g');
    expect(selectedNames(w)).toEqual(['Gamma']);
    expect(option(w, 'Gamma')).toHaveFocus();
  });

  it('clears the selection when the empty background is clicked', async () => {
    seedDocs('Alpha');
    const user = userEvent.setup();
    render(<App />);
    const w = openDocs();
    await user.click(option(w, 'Alpha'));
    expect(selectedNames(w)).toEqual(['Alpha']);
    await user.click(within(w).getByRole('listbox', { name: 'Items' }));
    expect(selectedNames(w)).toEqual([]);
  });
});
