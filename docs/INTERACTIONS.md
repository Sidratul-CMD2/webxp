# Interaction contracts

Normative project behavior follows. Historical anchors are listed in RESEARCH.md; unverified timings and edge policies below are explicit implementation choices, not claims of exact XP internals.

## Shared command and menu rules — INT-01

- Commands expose label, enabled state, checked/radio state, shortcut text and action. Context controls reflect the current target and selection at invocation time.
- One open menu chain at a time. Outside pointer-down dismisses it without activating an obscured item. Escape closes the deepest submenu, then its parent, then returns focus to the invoker.
- Menu click/Enter activates once. Up/Down navigate; Right enters a submenu; Left returns; Home/End jump; letter keys find labels. Disabled items are announced but never executed.
- Submenus open on hover after a proposed 250 ms delay or immediately by click/keyboard. Preserve a short pointer travel grace region. Flip at viewport edges and scroll tall menus.
- A modal dismisses open menus. A menu opened in one window must not remain on top after another window is activated. Separators cannot receive activation.
- Show hover, pressed, selected, disabled, checked and focused states. Use ellipses for commands requiring further input. Tooltips appear on focus as well as hover, dismiss on Escape, and never contain the only accessible name.

## Desktop — INT-02

Single click selects; double click or Enter opens. Blank click clears selection. Ctrl-click toggles a selection; Shift extends a visual-order range. Arrow keys move the focused icon; Ctrl+arrow moves focus without clearing selection; Space toggles under Ctrl, otherwise selects. Ctrl+A selects eligible desktop items. Focus and selection are distinct.

Blank-area drag creates a selection marquee; only icon bounds intersecting it are selected. Use a 4 CSS px movement threshold before dragging, a project tuning value. Dragging icons moves the selected group, clamps to the desktop work area and snaps on release when Align to Grid is enabled. Auto Arrange lays out top-to-bottom then left-to-right and disables free positioning. Shell shortcuts may be repositioned but cannot be copied or deleted.

Background menu: Arrange Icons By > Name/Type, Auto Arrange, Align to Grid; Refresh; Paste; New > Folder; Properties. Refresh re-renders current state without reload or data loss. Properties opens Display. Folder icon menu: Open, Explore (new Explorer window), Cut, Copy, Delete, Rename, Properties. Protected items expose only valid commands. Right-click an unselected item selects it; right-click a selected item preserves the group.

Dragging a user folder onto another user folder moves it; Ctrl-drag copies. Reject self/descendant drops. Dragging to Recycle Bin invokes delete confirmation. External OS drops do not upload files or navigate the page.

## Window manager — INT-03

Window identity is independent of app identity. Explorer supports multiple windows. Calculator, settings applets, Help, Task Manager and Run focus/restore their existing instance when reopened. Local IE supports one instance. A normal window receives activation on pointer-down, raises above other ordinary windows and restores its last focused control.

Drag only the title area, excluding controls. Resize only resizable windows, with eight edge/corner handles. Use pointer capture; cancel cleanly on pointer cancel, Escape or loss of capture. Clamp sizes to each app's minimum and retain an accessible title/control strip after viewport changes. Default Explorer minimum is a project-chosen 360 × 260 CSS px; compact mode may override it.

Maximize occupies the work area above the taskbar; save normal bounds once. Restore returns to those bounds, clamped to current work area. Double-click title toggles maximize/restore only on resizable windows. Minimize removes content from layout, hit testing and keyboard navigation while retaining state/taskbar entry. Restoring a minimized maximized window stays maximized. Close destroys that instance and chooses the next most recently active visible window, else desktop.

System menu: Restore, Move, Size, Minimize, Maximize, Close. Enable according to state. Keyboard Move/Size uses arrows, Enter to commit and Escape to roll back. All title controls have explicit accessible names. Ordinary windows do not trap focus.

Dialogs: project-wide modal blocking is used for confirmations, Run and session choices for predictable web accessibility. This simplifies XP owner-modal behavior. Store an owner ID and invoker; no separate taskbar button. Escape/Cancel makes no changes; restore focus on exit. Never let a hidden owner strand a dialog.

## Taskbar and Start — INT-04

The taskbar stays at the bottom for this release; edge docking and thickness changes are excluded. Start toggles its menu. Its left column has pinned Internet and a compact recently launched list drawn only from implemented apps; All Programs > Accessories contains Calculator, Windows Explorer and local Help. Right column: My Documents, My Pictures, My Music, My Computer, My Network Places, Control Panel, Help and Support, Search and Run. Footer: Log Off and Turn Off Computer.

Click a nonactive taskbar button to activate/restore. Click the active visible window button to minimize. Right-click opens that window's system menu. Group same-app windows when grouping is enabled and buttons would shrink below 110 CSS px (chosen threshold). A grouped button opens a labeled list, never thumbnail previews. Preserve access to every window if many groups overflow by allowing taskbar scrolling.

Quick Launch is initially hidden and can be enabled in Taskbar Properties; contains Show Desktop and local IE. Show Desktop snapshots currently visible windows and minimizes them; invoking again restores only that snapshot. Closing a window removes it from the snapshot; newly opened windows are not added retroactively.

Taskbar menu: Toolbars > Quick Launch, Cascade Windows, Tile Windows Horizontally, Tile Windows Vertically, Show Desktop, Task Manager, Properties. Arrangement affects visible normal/resizable windows, preserves minimum sizes, and falls back to cascade if tiling cannot fit. Property controls: grouping, Quick Launch, show clock and auto-hide. Taskbar fixed-edge policy is described in Help. Auto-hide reveals on bottom-edge hover or taskbar keyboard focus; menus/dialogs using it keep it exposed.

Clock uses the browser's locale/timezone, updates by minute and shows date tooltip. Double-click opens Date and Time. Volume click opens a simulation-only slider/mute; outside click dismisses. No control changes host audio or system time.

## Explorer and folder operations — INT-05

Chrome: File/Edit/View/Favorites/Tools/Help menu bar, Back/Forward/Up, Search, Folders, Views, address dropdown/entry and status bar. Favorites stores folder bookmarks in preferences, not .url files. Tools > Folder Options includes only implemented view/open behavior options. Help opens the relevant local topic.

Back/Forward store per-window folder ID history; navigating after Back discards the forward branch. Up follows the current parent. Opening a child normally navigates the current window; Explore opens a new window. Address Enter resolves a case-insensitive virtual path or shell alias, never the network. Invalid paths produce a dismissible error without changing location. Folders toggles a tree in place of the task pane; tree expansion is independent of current location.

Task pane groups: File and Folder Tasks, Other Places, Details. Actions change with selection; never offer document tasks. Tree controls expand/collapse with plus/minus styling. Views: Thumbnails (folder representations only), Tiles, Icons, List, Details. Details columns: Name, Type, Date Modified; no fabricated file size. Sort by name/type/date, toggle direction; stable ID tie-break. Status reports item/selection counts. Empty views remain mostly blank with `0 objects` status; no modern illustration or giant empty-state card.

Selection follows INT-02, using layout-aware arrows and range order; multi-selection operations are atomic. Enter opens a single folder; multiple selected folders open separate windows only through an explicit Open command. Inline rename selects the current name, commits on Enter or valid blur, cancels on Escape. Proposed validation: trimmed nonempty names, max 255 code units, no `\ / : * ? " < > |`, trailing dot/space, `.`/`..`, or reserved device names; case-insensitive uniqueness per parent. Treat these as this app's validation policy, not full NTFS emulation. Invalid names retain editing and show an associated error.

New Folder creates a uniquely numbered default (`New Folder`, `New Folder (2)`) then enters rename. Escape preserves that newly created folder with its default name. Cut dims the folder and stores IDs until successful paste; Copy snapshots the selected folder subtrees in memory. Paste uses one atomic transaction and fresh IDs for copies. Same-parent cut is a no-op. Repeated copy-paste generates unique `Copy of …` names. Cross-parent name conflicts offer Keep Both or Cancel; no destructive replacement. Reject moving into self/descendants, protected locations, or missing destinations with no partial change.

Clipboard is simulation-only; never read host clipboard for folder commands. Delete confirms and moves selected top-level subtrees to the bin; remove redundant selected descendants. Shift+Delete confirms permanent removal. Track one level of Undo for the latest successful create/rename/move/copy/soft-delete transaction in the current session; a later permanent-delete/empty-bin clears Undo. Undo is disabled after reload. If an undo target is invalid, explain and leave current state unchanged.

All open views update immediately after mutations. If a viewed folder is deleted, navigate to the closest surviving ancestor and announce it. History skips unavailable entries. Rename/move updates displayed paths through stable IDs. Folder Properties shows name, path, type and descendant folder count; apply/cancel follows transactional settings rules.

## Recycle Bin and Search — INT-06

Bin lists deleted root folders with Original Location and Date Deleted; their descendants remain attached, not separate list items. Restore returns the subtree to its recorded parent. If missing, offer My Documents as an explicit fallback; on name conflict offer Keep Both or Cancel. Empty Bin and permanent delete require confirmation and cannot be undone. Bin icon reflects whether anything is present. Disable Empty Bin when empty.

Search opens an Explorer-style Search task pane: name contains, Look in (virtual folders), Search, Stop. Search user-visible nontrashed folders recursively and case-insensitively; an empty query lists all matching descendants. Results show names and locations, open the result or its containing folder, and update after mutations. Stop cancels pending work and marks results incomplete. No results uses compact text. Do not fabricate file content search or network results.

## Utilities and settings — INT-07

Run accepts trimmed, case-insensitive `explorer`, `calc`, `control`, `iexplore`, `help`, or a valid virtual folder path. Enter/OK launches and closes; unknown input shows an XP-style error and retains input; Cancel closes. Browse opens a folder chooser. Never pass input to eval, shell, navigation or a network request.

Control Panel category/classic views link to the same implemented applets. Display offers Themes (blue Luna only, other themes omitted), Desktop (bundled permitted wallpaper or solid color), Appearance (text scale/contrast adaptation), Settings (read-only viewport information). No fake resolution change. Taskbar settings follow INT-04. Sounds controls mute/volume for optional app sounds only. Date and Time shows calendar month navigation and read-only current local time; cannot set host clock. Accessibility exposes increased contrast, larger controls and reduced motion. OK applies and closes, Apply commits and stays open, Cancel discards only changes since last Apply. All open windows respond immediately to committed changes.

Calculator supports digits, decimal, +, −, ×, ÷, equals, %, square root, reciprocal, sign, backspace, CE, C and memory MC/MR/MS/M+. Define standard immediate-execution arithmetic rather than algebraic precedence; repeated equals repeats the last operation. Percent for addition/subtraction is a percentage of the left operand; for multiply/divide convert the right operand to a fraction. Divide by zero/negative square root show an error cleared by C; use explicit decimal handling and bounded display rounding. Test examples in QA. Do not capture numeric keys when another app is active.

IE-style shell uses static bundled Welcome and Help routes with title, menus, toolbar and status. Back/Forward/Home work within those routes. Unrecognized addresses display an explanatory local error; no live browsing or iframe. Unsupported internet features are disabled. Task Manager lists current simulated top-level windows; Switch To activates one; End Task closes it through the shared command. Do not show invented CPU/process/device telemetry.

## Session and persistence — INT-08

Initial load enters the desktop immediately; optional welcome flow must be skippable. Log Off closes session windows and returns to a local User welcome screen; clicking User resumes. Turn Off dialog offers Stand By, Turn Off, Restart and Cancel. Stand By presents a reversible overlay; Turn Off presents an off screen with a visible start-again button; Restart clears transient state and reinitializes the shell. None closes the browser or affects the device. Preserve folders/preferences across all three and reload; do not restore windows on reload for this release.

Reset Simulation lives in local Help/Settings, explicitly confirms loss of local folders/preferences, clears only this app's storage namespace and restores the seed. Corrupt or unavailable storage falls back to a working session with a nonmodal explanation; do not silently destroy a recoverable saved state. See architecture for validation.
