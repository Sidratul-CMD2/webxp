# QA and acceptance criteria

All tests below are pending until the application exists. Use deterministic seed/clock for screenshot tests; production clock remains live. Each ID needs pass/fail, browser and evidence. “Looks good” is not a result.

## Functional acceptance matrix

| ID | Reproducible check | Expected result |
|---|---|---|
| QA-01 | Fresh seed load; open My Computer and My Documents | Correct Luna desktop, seed folders only, independent windows and taskbar buttons |
| QA-02 | Activate alternating windows; drag, resize all edges, maximize, minimize, restore; shrink viewport | Correct z-order, retained normal bounds, maximized restoration, reachable controls, no pointer capture leak |
| QA-03 | Open system menu; Move/Size with arrows; Escape; close active window | Escape rolls back bounds; focus returns to last visible window or desktop |
| QA-04 | Navigate nested folders; Back, Forward, Up; navigate after Back; enter bad address | Independent histories; forward branch discarded; error preserves location |
| QA-05 | Create folder, rename, attempt duplicate/invalid name; Escape initial rename | Valid commit; invalid edit remains; unique defaults; Escape leaves created default folder |
| QA-06 | Multi-select, cut/paste between windows, copy twice, attempt self/descendant/protected drop | Shared state updates; unique copy IDs/names; invalid transaction changes nothing |
| QA-07 | Delete nested folder; view it from another window; restore; conflict; empty bin | Subtree intact; open view recovers; conflict choice explicit; empty requires confirmation; icon updates |
| QA-08 | Undo create/rename/move/copy/delete individually; then permanent delete | One-level rollback correct; permanent removal clears Undo; protected structure survives |
| QA-09 | Open Start by click/keyboard; navigate submenu; move near viewport edge; Escape/outside click | No accidental launch; menu fits/flips; focus returns; all launchers work |
| QA-10 | Open enough Explorer windows to group; activate/minimize; Show Desktop twice; close one while hidden | Group lists all windows; restoration respects snapshot and excludes closed windows |
| QA-11 | Search new folder in/out of scope; cancel; Run calc/explorer/path/unknown; IE local and arbitrary address | Accurate results/stop state; allowlist only; errors safe; no outbound navigation |
| QA-12 | Change wallpaper; Apply; change again; Cancel; test other applets | First applied state retained; no host settings touched; controls reflect real state |
| QA-13 | Calculator: 2+3×4=; 200+10%=; 8÷0; C; repeated equals; memory | Immediate arithmetic gives 20; percent gives 220; error recovers; 2+3== gives 8; MS/MC/MR work |
| QA-14 | Log off/resume; stand by/wake; restart; turn off/start again | Only simulation affected; transient windows cleared as specified; folders/preferences retained |
| QA-15 | Reload after mutations; block storage; corrupt schema; reset; trigger another-tab save | Valid hydration; usable fallback; no silent overwrite; reset explicit; conflict surfaced |
| QA-16 | Entire demonstration using only keyboard, including folder move and window resize | No unreachable actions, no trapped ordinary window, correct focus/menu/modal behavior |
| QA-17 | Screen-reader check; contrast/forced colors; 200%/400% zoom; 390 × 844 touch viewport | Meaningful names/state; readable controls, reachable actions, documented compact mode |
| QA-18 | Review all VISUAL.md screenshots and asset register | Consistent XP-era geometry/states; no mixed modern UI; provenance and deviations recorded |
| QA-19 | 10 windows/100 folders; 100 open/close cycles; pointer cancel/blur; resize during menu/drag | Usable drag, bounded state/listeners, no stuck drag/overlay or inaccessible offscreen control |
| QA-20 | Traverse every menu, toolbar, tab, checkbox, context item and launcher | Each enabled command has defined tested effect; disabled actions explain why |

## Domain/component tests

Test cycle prevention, subtree selection normalization, case-insensitive name collisions, copy ID uniqueness, protected aliases, atomic batch rollback, bin restoration/missing parent, undo invalidation and schema validation. Test calculator decimal rounding and percent/error transitions. Test window normal/maximized/minimized combinations, work-area clamping and focus fallback. Components need keyboard menu, modal focus return, rename error and selection tests.

Include malicious persisted names and Run input; verify text remains text and no execution/network request occurs. Verify simulated shortcuts cannot become virtual files. Test storage quota failure without losing current session state. Use existing libraries for decimal arithmetic only when justified and record chosen precision policy.

## Browser and visual coverage

Run main flows in Chromium, Firefox and WebKit. Name actual versions and OS; Playwright WebKit is not proof of testing shipping Safari. Manually check Safari on macOS if available, plus Windows keyboard/screen-reader coverage when available. Mark unavailable platforms clearly.

Capture at 1024 × 768, 1280 × 1024 and 1440 × 900, plus compact mobile viewport. Test zoom through the browser, not only a CSS transform. Freeze time, font availability and asset loading for image comparisons; inspect active/inactive/focused/pressed/disabled states separately. Do not accept a screenshot baseline generated from a known-broken interface.

## Release gate

- Production build, lint, typecheck, domain/component and browser tests succeed with recorded commands.
- All QA IDs pass for required available environments; unavailable coverage and asset fidelity limits are explicitly disclosed.
- No uncaught console error, broken local asset, unexpected third-party request, inaccessible modal or dead enabled control.
- No user-document nodes in seed, after interactions or in persisted storage.
- Demonstration in PRODUCT.md completes with mouse and keyboard.
- README includes real install/run/build/preview commands and storage/reset explanation.
- Evidence includes screenshots, test output summary, manual checks, provenance and remaining limitations. Never call documented failures passes.
