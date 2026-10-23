import type { ReactNode } from 'react';
import type { IconName } from '../../ui/icons';

export interface Article {
  id: string;
  title: string;
  icon: IconName;
  keywords: string;
  body: (actions: { open: (id: string) => void; reset: () => void }) => ReactNode;
}

const Kbd = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;

export const ARTICLES: Article[] = [
  {
    id: 'home',
    title: 'Welcome to Help and Support',
    icon: 'help',
    keywords: 'start overview welcome',
    body: ({ open }) => (
      <>
        <p>
          This is a browser-based recreation of a Windows XP Professional SP2-era desktop using the blue Luna style. It contains folders only: there are no
          documents, pictures, music or programs to open, and nothing here can change your real computer.
        </p>
        <h3>Pick a Help topic</h3>
        <ul className="help-topics">
          {['desktop', 'windows', 'folders', 'recycle', 'start', 'settings', 'calculator', 'browser', 'session', 'keyboard', 'accessibility', 'limitations', 'reset'].map((id) => {
            const a = ARTICLES.find((x) => x.id === id)!;
            return (
              <li key={id}>
                <button type="button" className="link-button" onClick={() => open(id)}>
                  {a.title}
                </button>
              </li>
            );
          })}
        </ul>
      </>
    ),
  },
  {
    id: 'desktop',
    title: 'Using the desktop',
    icon: 'show-desktop',
    keywords: 'icons select arrange marquee drag context menu new folder refresh',
    body: () => (
      <>
        <p>Click an icon to select it; double-click it, or select it and press Enter, to open it. Click an empty area to clear the selection.</p>
        <ul>
          <li>Hold Ctrl and click to add or remove icons from the selection; hold Shift to select a range.</li>
          <li>Drag on an empty area to draw a selection rectangle.</li>
          <li>Drag icons to move them. With Align to Grid on, they snap into place when released.</li>
          <li>Right-click the desktop for Arrange Icons By, Refresh, Paste, New Folder and Properties. Auto Arrange keeps icons in columns.</li>
          <li>Drag a folder onto another folder to move it, or onto the Recycle Bin to delete it. Hold Ctrl while dropping to copy instead.</li>
        </ul>
        <p>
          Shortcuts such as My Computer and the Recycle Bin can be moved but not copied, renamed or deleted. Folders you create on the desktop live in{' '}
          <code>C:\Documents and Settings\User\Desktop</code>.
        </p>
      </>
    ),
  },
  {
    id: 'windows',
    title: 'Working with windows',
    icon: 'task-manager',
    keywords: 'move resize maximize minimize restore close system menu task manager cascade tile show desktop',
    body: () => (
      <>
        <ul>
          <li>Drag a title bar to move a window. Drag any edge or corner of a resizable window to change its size.</li>
          <li>Double-click the title bar, or use the Maximize button, to fill the screen above the taskbar. Restore returns the previous size.</li>
          <li>Click the icon at the left of the title bar (or right-click the title bar or taskbar button) for the system menu.</li>
          <li>
            From the keyboard, choose Move or Size in the system menu, use the arrow keys (hold Ctrl for single pixels), press Enter to finish or Esc to
            cancel.
          </li>
          <li>Click a taskbar button to switch to a window; click the active window’s button to minimize it.</li>
          <li>Windows Task Manager (right-click the taskbar) lists the open windows with Switch To and End Task.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'folders',
    title: 'Working with folders',
    icon: 'folder',
    keywords: 'create rename copy cut paste move delete undo address back forward up views details sort search explorer favorites',
    body: () => (
      <>
        <p>You can create folders on the Desktop, in My Documents and in any folder inside them. Local Disk (C:), Program Files and WINDOWS are read-only.</p>
        <ul>
          <li>
            <strong>Create:</strong> click “Make a new folder” in the task pane, or File &gt; New &gt; Folder. Type a name and press Enter.
          </li>
          <li>
            <strong>Rename:</strong> select a folder and press <Kbd>F2</Kbd>, or choose Rename. Names cannot contain <code>\ / : * ? " &lt; &gt; |</code>.
          </li>
          <li>
            <strong>Move or copy:</strong> drag folders between windows, or use Cut/Copy and Paste, or Edit &gt; Move To Folder / Copy To Folder.
          </li>
          <li>
            <strong>Delete:</strong> press <Kbd>Delete</Kbd> to send folders to the Recycle Bin. <Kbd>Shift</Kbd>+<Kbd>Delete</Kbd> deletes permanently.
          </li>
          <li>
            <strong>Undo:</strong> Edit &gt; Undo reverses your last create, rename, move, copy or delete (one step, this session only).
          </li>
        </ul>
        <p>
          Type a path such as <code>C:\WINDOWS</code> or a name such as <code>My Computer</code> in the Address bar. Back, Forward and Up work per window.
          Views offers Thumbnails, Tiles, Icons, List and Details; click a Details column header to sort.
        </p>
        <p>Favorites stores bookmarks to folders. Search (on the toolbar or Start menu) finds folders by name.</p>
      </>
    ),
  },
  {
    id: 'recycle',
    title: 'The Recycle Bin',
    icon: 'recycle-full',
    keywords: 'restore empty delete permanently trash bin',
    body: () => (
      <>
        <p>Deleted folders keep their contents in the Recycle Bin. The Recycle Bin icon shows paper when it is not empty.</p>
        <ul>
          <li>Select an item and choose Restore to put it back where it was. If that place no longer exists you can restore it to My Documents.</li>
          <li>If a folder with the same name already exists, you can keep both (the restored folder gets a numbered name) or cancel.</li>
          <li>Empty Recycle Bin and Delete inside the Recycle Bin remove folders permanently after you confirm. This cannot be undone.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'start',
    title: 'The Start menu and taskbar',
    icon: 'start-logo',
    keywords: 'start menu all programs accessories taskbar grouping quick launch clock volume auto-hide show desktop run search',
    body: () => (
      <>
        <p>
          Click <strong>start</strong> (or focus it and press Enter) to open the Start menu. Use the arrow keys to move between items and columns; All
          Programs &gt; Accessories contains Calculator, Help and Support and Windows Explorer.
        </p>
        <ul>
          <li>When many windows of one program are open, the taskbar groups them into one button with a list.</li>
          <li>Show Quick Launch (taskbar Properties) adds Show Desktop and Internet Explorer buttons. Show Desktop minimizes the windows that are showing; click it again to bring the same windows back.</li>
          <li>Double-click the clock, or focus it and press Enter, for Date and Time Properties. The volume icon opens a simulated volume control.</li>
          <li>
            The taskbar always stays at the bottom of the screen in this simulation; it cannot be moved to another edge or resized. Auto-hide is available
            in taskbar Properties.
          </li>
          <li>Run accepts: explorer, calc, control, iexplore, help, or a folder path such as C:\Program Files.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'settings',
    title: 'Changing settings in Control Panel',
    icon: 'control-panel',
    keywords: 'control panel display wallpaper background taskbar sounds date time accessibility folder options apply cancel',
    body: () => (
      <>
        <p>Control Panel offers Display, Taskbar and Start Menu, Sounds and Audio Devices, Date and Time, Accessibility Options and Folder Options.</p>
        <p>
          In each settings window, <strong>OK</strong> applies your changes and closes it, <strong>Apply</strong> applies them and keeps it open, and{' '}
          <strong>Cancel</strong> discards changes since you last applied.
        </p>
        <p>Settings affect only this simulation. Screen resolution, sound volume and the clock of your real computer are never changed.</p>
      </>
    ),
  },
  {
    id: 'calculator',
    title: 'Using Calculator',
    icon: 'calculator',
    keywords: 'calculator arithmetic memory percent square root keyboard',
    body: () => (
      <>
        <p>Calculator works like a standard pocket calculator: each operation is carried out as you enter it, so 2 + 3 × 4 = gives 20.</p>
        <ul>
          <li>Press = again to repeat the last operation (2 + 3 = = gives 8).</li>
          <li>For + and −, % takes a percentage of the first number (200 + 10 % = gives 220). For × and ÷ it divides the number by 100.</li>
          <li>MS stores the display, MR recalls it, M+ adds to it and MC clears it. An M appears while memory is set.</li>
          <li>
            Keyboard: digits, <Kbd>.</Kbd> <Kbd>+</Kbd> <Kbd>-</Kbd> <Kbd>*</Kbd> <Kbd>/</Kbd> <Kbd>%</Kbd>, <Kbd>Enter</Kbd> or <Kbd>=</Kbd> for equals,{' '}
            <Kbd>Esc</Kbd> clears, <Kbd>Delete</Kbd> clears the entry, <Kbd>Backspace</Kbd>, <Kbd>@</Kbd> for square root, <Kbd>R</Kbd> for 1/x and{' '}
            <Kbd>F9</Kbd> to change sign. Keys only reach Calculator while its window is active.
          </li>
        </ul>
        <p>Results are calculated with decimal arithmetic and shown to 16 significant digits.</p>
      </>
    ),
  },
  {
    id: 'browser',
    title: 'Using the browser',
    icon: 'browser',
    keywords: 'internet explorer browser web address welcome',
    body: () => (
      <p>
        Internet Explorer here is a local shell. It shows only the pages bundled with the simulation (<code>about:welcome</code> and <code>about:help</code>)
        and never connects to the Internet. Any other address shows an explanation page.
      </p>
    ),
  },
  {
    id: 'session',
    title: 'Logging off, standing by and turning off',
    icon: 'turn-off',
    keywords: 'log off turn off restart stand by welcome session',
    body: () => (
      <ul>
        <li>Log Off closes open windows and shows the welcome screen; click User to return.</li>
        <li>Turn Off Computer offers Stand By (a dark screen; press any key to return), Turn Off (with a button to start again) and Restart.</li>
        <li>Restart and Turn Off close open windows. Your folders and settings are kept. None of these affect your real computer or browser.</li>
      </ul>
    ),
  },
  {
    id: 'keyboard',
    title: 'Keyboard shortcuts',
    icon: 'info',
    keywords: 'keyboard shortcuts keys f2 delete ctrl tab arrows shift f10',
    body: () => (
      <>
        <table className="help-table">
          <tbody>
            <tr>
              <th scope="row">Arrow keys, Home, End</th>
              <td>Move between icons; add Shift to extend the selection, Ctrl to move without selecting</td>
            </tr>
            <tr>
              <th scope="row">Space / Ctrl+Space</th>
              <td>Select / toggle the focused icon</td>
            </tr>
            <tr>
              <th scope="row">Enter</th>
              <td>Open the selected item</td>
            </tr>
            <tr>
              <th scope="row">F2</th>
              <td>Rename</td>
            </tr>
            <tr>
              <th scope="row">Delete / Shift+Delete</th>
              <td>Delete to the Recycle Bin / permanently</td>
            </tr>
            <tr>
              <th scope="row">Ctrl+A, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+Z</th>
              <td>Select all, copy, cut, paste, undo (folders, while not typing)</td>
            </tr>
            <tr>
              <th scope="row">Shift+F10 or the Menu key</th>
              <td>Context menu</td>
            </tr>
            <tr>
              <th scope="row">Backspace</th>
              <td>Up one level in Explorer</td>
            </tr>
            <tr>
              <th scope="row">Tab / Shift+Tab</th>
              <td>Move between parts of a window, between windows and to the taskbar</td>
            </tr>
          </tbody>
        </table>
        <p>
          Shortcuts reserved by your browser or operating system (such as the Windows key, Alt+Tab, Alt+F4 and Ctrl+W) are not used. Use the taskbar,
          system menu and Close buttons instead; all of them work from the keyboard.
        </p>
      </>
    ),
  },
  {
    id: 'accessibility',
    title: 'Accessibility and browser adaptations',
    icon: 'accessibility',
    keywords: 'accessibility zoom contrast larger controls reduced motion touch compact mobile screen reader',
    body: () => (
      <ul>
        <li>Browser zoom works everywhere. Below about 700 pixels of width (for example at 200% zoom or on a phone), windows fill the screen and the taskbar shows a Window List button. This compact mode is a web adaptation, not an XP feature.</li>
        <li>Accessibility Options offers increased contrast, larger controls and a motion setting that can follow your browser’s reduced-motion preference.</li>
        <li>Display Properties &gt; Appearance changes the text size.</li>
        <li>On touch screens, tap an icon to select it and tap it again to open it; press and hold for its menu. Dragging is never required: Cut and Paste move folders, and the system menu moves and sizes windows.</li>
        <li>Menus, trees, tabs and folder views follow standard web accessibility patterns so screen readers announce names, states and selection.</li>
      </ul>
    ),
  },
  {
    id: 'limitations',
    title: 'What this simulation does not do',
    icon: 'warning',
    keywords: 'limitations not simulated network internet files programs printing shutdown',
    body: () => (
      <ul>
        <li>There are no files: folders can be nested, but documents, pictures, music and programs cannot be created, uploaded or opened.</li>
        <li>No networking, Internet browsing, user accounts, printing, program installation or Windows Update.</li>
        <li>Turning off or restarting affects only this page, never your computer or browser.</li>
        <li>Open windows are not restored when the page reloads; folders and settings are.</li>
        <li>Artwork, wallpapers and icons are original substitutes drawn for this project, not Microsoft’s images. Fonts depend on what your computer has installed (Tahoma and Trebuchet MS are used when available).</li>
        <li>Only the blue Luna theme and the standard Calculator are available.</li>
      </ul>
    ),
  },
  {
    id: 'reset',
    title: 'Reset the simulation',
    icon: 'refresh',
    keywords: 'reset erase clear storage saved data start over',
    body: ({ reset }) => (
      <>
        <p>
          Folders and settings are saved in this browser’s local storage under one key for this simulation only. Resetting erases them and restores the
          original empty folders and default settings. You will be asked to confirm.
        </p>
        <button type="button" className="xp-button" onClick={reset}>
          Reset Simulation…
        </button>
      </>
    ),
  },
];

/** Plain text used for search. */
export function articleText(a: Article): string {
  return `${a.title} ${a.keywords}`;
}
