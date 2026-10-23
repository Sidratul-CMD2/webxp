# Technical architecture

This started as a proposal and now describes the implemented application. The proposal's design rules below still apply.

**Stack:**
- React 19.3.1, TypeScript 6.0.3 and Vite 8.3.5;
- plain CSS with tokens;
- Vitest 5 with jsdom and Testing Library for domain and component tests;
- Playwright 1.64.1 for browser flows and screenshots, with @axe-core/playwright for automated accessibility checks.

Versions are exact in `package.json`, with `package-lock.json`. There is no backend, authentication, analytics, external API, emulator or desktop wrapper.

## Boundaries (actual paths)

- `src/domain/`: pure, unit-tested logic.
  - `fs.ts`: folder tree, validation, mutations, bin, limits.
  - `locations.ts`: shell locations and addresses.
  - `decimal.ts` and `calculator.ts`.
  - `windows.ts`: window-manager transitions.
  - `prefs.ts` and `persistence.ts`: the `xp-sim:v1` envelope and its validation.
  - `run.ts`: the Run allowlist.
  - `browserRoutes.ts`: bundled browser pages.
- `src/state/`: the store and every action.
  - `store.ts`: an external store read through `useSyncExternalStore` with a cached selector.
  - `app.ts`: the singleton state, focus policy, modal stack, menus, balloons and announcements.
  - `commands.ts`: the single command layer used by menus, toolbar, keyboard, task pane and pointer.
  - Action modules: `windowActions.ts`, `explorerActions.ts`, `folderActions.ts` (`commitFs`/`reconcile`, clipboard, undo), `desktopActions.ts`, `dialogs.ts` and `sessionActions.ts` (persistence wiring, cross-tab conflicts, reset, resize).
  - Derived views: `items.ts` (sorting, desktop grid) and `tree.ts`.
- `src/shell/`:
  - `Desktop.tsx` and `WindowFrame.tsx` (drag and resize with pointer capture, keyboard Move/Size).
  - `Taskbar.tsx`, `StartMenu.tsx`, `ModalLayer.tsx` and `SessionScreens.tsx`.
  - `useCollection.tsx`: selection, keyboard, marquee, drag, touch and inline rename.
  - `dnd.ts`, `contextMenus.ts` and `systemMenu.ts`.
- `src/ui/`:
  - `Menu.tsx` and `MenuBar.tsx` (APG menus, with disabled reasons in `aria-describedby`).
  - `Toolbar.tsx`, `FolderTree.tsx`, `ModalDialog.tsx` (focus trap), `PropertySheet.tsx`, `TooltipLayer.tsx`, `icons.tsx` and `format.ts`.
- `src/apps/`:
  - `explorer/`: ExplorerApp, ContentView (5 views) and Panes.
  - `Calculator.tsx`, `ControlPanel.tsx`, `Applets.tsx`, `FolderProperties.tsx`, `TaskManager.tsx`, `Browser.tsx`, `help/` and `registry.tsx`.
- `src/styles/`: tokens, base, shell, window, menu, explorer, apps, dialogs, compact (under 700 px or coarse pointer) and forced (forced colors, loaded last).
- `tests/unit/`: domain tests, a contrast check and whole-shell component tests (jsdom shims are documented in `components.test.tsx`).
- `tests/e2e/`: Playwright flows named by QA ID, axe scans, the QA-20 command audit and screenshots.
- `scripts/generate-assets.mjs`: generates every icon and wallpaper.

A central external store owns the durable simulation state. It is not a reducer: actions are plain functions that compute the next state from pure domain transitions and set it. Components read through selectors. Transient input drafts and pointer previews stay component-local. Virtual nodes are never duplicated per Explorer instance, and selection lives in the store, so menus, toolbar and keyboard share it.

The stacking bands are tokens in `tokens.css`:

| Band | z-index |
|---|---|
| desktop | 0 |
| windows | from 10, rebased |
| taskbar | 5000 |
| menus | 6000 |
| modals | 7000 |
| balloons | 7500 |
| session screens | 9000 |
| tooltips | 9500 |

## State and invariants

| Entity | Minimum data/invariant |
|---|---|
| Window | ID, app ID, title, bounds, saved normal bounds, normal/maximized mode, minimized flag, last focus key; dimensions valid |
| Window manager | Ordered IDs, active ID or null; minimized/closed windows cannot be active |
| Folder | Stable ID, parent ID, name, created/modified timestamp, protection flags; no file-content field or file kind |
| Bin entry | Root ID, original parent/path, deleted timestamp, complete attached subtree |
| Explorer instance | Current folder/shell location, history/index, selection IDs, focused ID, view/sort, pane mode |
| Preferences | Wallpaper ID, layout, applet settings, bookmarks, accessibility flags; versioned |
| Clipboard/undo | In-memory typed transaction data, never system clipboard content |
| Overlay | Menu chain or modal descriptor with owner/invoker; single authoritative manager |

Use explicit shell-location types for My Computer, Network Places, Search and Recycle Bin; never encode them as fake user files. Derive paths from stable parent links. Enforce no cycles, no orphan live nodes, unique case-insensitive sibling names and protection at the domain boundary. Apply multi-item commands atomically with a single undo payload. Normalize selected subtrees before mutation. All command entry points call the same validator and action.

## Rendering and interaction

Use normal DOM for text, controls and folders. Use layered positioned elements for windows. Establish stack bands: wallpaper/desktop, ordinary windows, taskbar, menus, modal backdrop/dialog, tooltips restricted to their owner. A modal wins over all interactive surfaces. Rebase ordered indices rather than incrementing z-index without bound.

Pointer capture handles dragging/resizing; update preview through requestAnimationFrame and commit final state once. Reuse work-area calculation for maximize, drag constraints, menus and viewport changes. Use a ResizeObserver where needed, clean up all listeners/timers, and handle pointercancel/window blur. Keep transforms out of text rendering at rest if they blur retro typography.

Keyboard dispatch order: active dialog → active menu → editing control → active app → shell. Never let a global handler steal normal input editing, composition, text selection, or browser shortcuts. Menus capture a target ID at opening and revalidate it at activation to avoid stale-target bugs.

## Persistence and resilience

Use one versioned localStorage envelope, e.g. `xp-sim:v1`, for folder tree, bin, preferences and desktop positions. Transient windows, clipboard, undo, open menus and input drafts are not persisted. Debounce saves; flush a committed mutation promptly without relying solely on unload. Catch quota/security failures; keep the current session functional and disclose that saving failed.

Validate structure, types, IDs, bounds, unique names, references, protection and cycle/depth limits before hydration. Use a proposed cap of 1,000 folders and depth 32 to bound recursive work; display a clear limit message. Treat persisted strings as data, render text safely, and avoid HTML injection. Unknown future versions must not be silently overwritten; provide reset and retain the saved payload until the user explicitly resets. For cross-tab writes, detect storage changes and ask to reload saved state or keep this session; do not silently merge trees.

Bundle all core resources locally. “No external dependency at runtime” means no third-party requests after the app loads; it does not promise offline reload unless a service worker is separately implemented. Startup must work when storage is unavailable. A top-level error boundary offers restart/recovery without erasing saved data.

## Performance and verification

Target visibly smooth drag with 10 open windows and 100 folders, no persistent long tasks during pointer moves, and no unbounded DOM/state growth after repeated open/close. Record browser, machine and observed measurements instead of inventing performance results. Lazy-load optional apps; do not add virtualized lists before evidence warrants the accessibility complexity.

During setup establish actual scripts for development, production build/preview, lint, typecheck, unit/component tests and browser tests. Write their exact invocation and versions in PROGRESS.md. Tests must exercise state invariants and user flows rather than mirror component implementation.
