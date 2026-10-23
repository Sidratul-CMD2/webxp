# Phased implementation

All phases 0–6 are required; phases are review gates, not permission checkpoints. Preserve working behavior as each phase adds depth. Use QA IDs to record evidence. Optional features are not required for release.

| Phase | Build | Exit gate |
|---|---|---|
| 0 — Baseline | Inspect repository; establish compatible dependencies/scripts; reference board; asset register; seed model and tokens | Actual commands documented; build runs; scope and historical compromises recorded |
| 1 — Shell skeleton | Desktop, shared controls, window reducer, focus/stacking, drag/resize, system menus, taskbar | QA-01–03 pass with two independent dummy/test windows; no focus trap |
| 2 — Folder desktop | Explorer, aliases/tree/history, folder-only mutations, clipboard, bin and undo | QA-04–08 pass in multiple Explorer windows; no file node possible |
| 3 — Complete navigation | Start cascades, grouping, Quick Launch, Search, Run, local IE/help | QA-09–11 pass; every enabled navigation/launch item resolves |
| 4 — Utilities/settings | Control Panel, Calculator, Task Manager, tray, session controls, persistence/reset | QA-12–15 pass; saved state survives restart/reload |
| 5 — Fidelity/accessibility | Calibrate all states, responsive adaptation, semantics, focus, zoom, reduced motion and assets | QA-16–18 pass; reference screenshots reviewed; provenance complete |
| 6 — Release | Cross-browser flows, failure recovery, performance pass, final command/control audit | QA-19–20 and release gate pass; final evidence and limitations recorded |

Start keyboard semantics in phase 1 and test each new interaction as it appears; phase 5 is an audit, not delayed accessibility implementation. Add persistence after the folder reducer is stable. Do not add games/boot animation before the core workflows pass.

At a gate update PROGRESS.md with: implemented scope, exact check commands and results, screenshot paths, deviations, next action. Keep a failing gate open until fixed. An asset/reference gap can be documented as a fidelity limitation; a broken mandatory interaction cannot be called complete.

## Gate status (final, 2026-10-23)

| Phase | Status |
|---|---|
| 0 | **Done.** Stack, lockfile, commands, generated assets and the provenance manifest (`docs/ASSETS.md`). |
| 1–4 | **Done.** QA-01 to QA-15 pass in Chromium and Playwright WebKit. |
| 5 | **Done.** QA-16 to QA-18 pass:<br>• QA-16 in Chromium and WebKit;<br>• QA-17's automated checks (axe, contrast, touch, zoom simulation, reduced motion);<br>• QA-18 with 34 screenshots in `docs/screenshots/`.<br>Forced colors and screenshots are Chromium-only. |
| 6 | **Done; the release gate passed.**<br>• QA-19 and QA-20 pass;<br>• `npm run check` exits 0 (119/119 unit and component tests);<br>• Chromium 118/118;<br>• WebKit 83 passed, 35 skipped (Chromium-only), 0 failed. |

**Not covered (disclosed, not passed):**
- **Firefox:** Playwright's Firefox build won't launch on macOS 27.2.
- **VoiceOver:** not performed; a checklist is in ACCESSIBILITY.md.
- **NVDA:** Windows-only, not tested.
- **Zoom:** true browser zoom was not tested; 200% and 400% were simulated as viewports.
- **Visual references:** no permission-cleared XP captures were available.

The full list of limitations is in the README ("Current status and limitations"). The detailed session evidence log is kept locally and not published.
