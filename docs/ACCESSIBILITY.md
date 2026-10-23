# Accessibility and browser adaptations

Target WCAG 2.2 AA and test applicable criteria; do not claim conformance from an automated scan. Retro styling is never a reason to remove keyboard access or readable focus. W3C references are in RESEARCH.md. The following also contains explicit project design decisions.

## Semantics and focus

Use real buttons, inputs and labels. Give title-bar icons names such as “Minimize My Documents.” Ordinary app windows are named non-modal regions; keep them reachable through a visible Window List accessible from the taskbar. Do not apply `aria-modal` to ordinary Explorer windows or `role=application` to the whole desktop.

True modals use labeled dialog semantics, move focus inside, keep Tab within, block underlying interaction and restore focus to the opener or a sensible surviving control. Destructive confirmations initially focus Cancel. An ordinary window can be left through Tab/Shift+Tab or the Window List; users must be able to reach browser chrome.

Menus follow the APG menu/menubar model. Tree, tabs and selectable folder collections need their corresponding implemented keyboard semantics; do not apply a role without its interaction. Announce selection counts, operation results and errors politely. Avoid clock announcements every minute. Errors include text and the related input association; color alone is insufficient.

## Keyboard contract

| Context | Required keys / alternative |
|---|---|
| Desktop/folder collection | Arrows, Home/End, Ctrl+A, Enter, Space, Shift range, Ctrl toggle |
| Folder operations | F2 rename, Delete, Shift+Delete, Ctrl+C/X/V/Z when not editing text |
| Context menu | Shift+F10 or dedicated visible menu button |
| Menus | Arrows, Home/End, letters, Enter/Space, Escape |
| Address/input | Native text navigation/editing, Enter submit, Escape cancel where specified |
| Dialog | Tab/Shift+Tab, Enter appropriate default, Escape cancel |
| Window operations | Visible system-menu Move/Size with arrows/Enter/Escape |
| Window switching | Visible Window List and taskbar buttons reachable by keyboard |
| Start | Focusable Start button with Enter/Space |

Handle the above only inside relevant focused widgets and only when a command is valid. F2 and Shift+F10 are best-effort browser integrations; visible controls remain mandatory. Do not depend on Win, Alt+Tab, Alt+F4, Ctrl+Esc, Alt+Space, Ctrl+W or Ctrl+L interception. These can be reserved by the OS/browser. Do not intercept browser reload, zoom, find or assistive technology shortcuts. F6 may be browser-owned: use normal Tab navigation as the reliable path. Display only shortcuts that actually work on the tested platform.

## Reading, motion and touch

Text zoom to 200% must not hide essential actions. Support 400% zoom through compact/reflow mode with scrollable app content, reachable menus and controls; do not scale the entire canvas down to microscopic text. Below roughly 700 CSS px viewport width, open one active window filling the available workspace, retain taskbar/Window List, and replace free window manipulation with visible system-menu actions. This is a documented web adaptation, not an XP mobile design.

Meet text contrast and non-text control/focus contrast requirements in the default theme; offer an increased-contrast palette as an enhancement, not the only readable mode. Verify small retro controls against WCAG target-size requirements and spacing exceptions; enlarge hit regions without overlap or use larger-control mode when needed. Touch users receive single-tap select plus explicit Open/context actions, avoiding double-tap timing as the only route. Never require dragging: Cut/Paste moves folders and system-menu Move/Size manages windows.

Honor prefers-reduced-motion from first load; reduced mode removes boot, minimize and submenu animation. Sounds are optional, user-enabled after a gesture, with mute and equivalent visual feedback. Native forced colors must retain control outlines and focus. Do not disable browser zoom or text selection globally. Restrict selection suppression to drag handles and icon interaction surfaces.

## Manual verification

Complete QA's keyboard-only demonstration; test VoiceOver with Safari and NVDA with Chrome or Firefox when those environments are available. Record unavailable coverage rather than invent it. Confirm names/roles, modal announcements, focus return, active-window changes, selection and error feedback. Automated axe results supplement this manual check.

### VoiceOver pass (macOS Safari): checklist

Status: **not yet performed**. Record the date, macOS and Safari versions, and any failures in `docs/PROGRESS.md`.

1. **Setup.**
   - Run `npm run build && npm run preview` and open http://localhost:4173 in Safari.
   - Turn on Safari › Settings › Advanced › "Press Tab to highlight each item" (or use Option+Tab instead of Tab).
   - Start VoiceOver with Cmd+F5.
2. **Desktop.** Tab to the desktop icons and move between them with the arrow keys.
   - Each icon is read by its name ("My Documents", "Recycle Bin"…) as an option in the "Desktop" list box, with its selected state.
   - Enter opens the focused icon.
3. **Start menu.** Tab to Start and press Enter.
   - "Start menu" is announced, and the arrow keys read each item.
   - Escape closes it, and focus is announced back on the Start button.
4. **Explorer items.** Open My Documents.
   - Each folder is read by its name only ("My Music"), with "File Folder" as its description.
   - After View › Details, the description also includes the date.
   - Ctrl+A announces the selection, and the status bar reads "2 objects selected".
5. **Menus and disabled reasons.** Tab to the menu bar, then open Edit with Enter.
   - Undo is read as dimmed or unavailable, together with its reason: "There is nothing to undo."
   - Escape returns focus to "Edit".
6. **Rename errors.** Create a folder (File › New › Folder) and press Enter. Then press F2, type `a:b` and press Enter.
   - The error alert is read aloud, and the edit box stays focused and marked invalid.
   - Escape cancels the rename and returns focus to the folder.
7. **Modal dialog.** Select the folder and press Delete.
   - "Confirm Folder Delete" and its question are announced, with focus on **No**.
   - The VoiceOver cursor cannot reach the desktop or the windows behind the dialog.
   - Escape closes it, and focus returns to the folder.
8. **Windows.** Open My Computer as well and switch between the two windows with their taskbar buttons.
   - The activated window's title is announced.
   - Closing a window moves focus to the remaining window rather than leaving it nowhere.

### NVDA

**Not tested.** NVDA is Windows-only, and no Windows machine was available. This coverage is unavailable, not passed.
