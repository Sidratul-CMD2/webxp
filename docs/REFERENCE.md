# Reference board and fidelity record (QA-18)

## Reference configuration

English Windows XP Professional SP2, blue Luna theme ("Windows XP style", "Default (blue)"), 1024×768 at 96 DPI and 100% zoom. Explorer uses default folder options (common tasks shown, folders open in the same window). The desktop is the configured one in PRODUCT.md, not a factory default.

## What the comparison was based on

| Source | What it supports | Used for |
|---|---|---|
| R1 (Microsoft, 2001: *Creating Windows XP Icons*) | Colourful dimensional icons, upper-left light source, 16/32/48 px sizes | Icon style and sizes in `scripts/generate-assets.mjs` |
| R2 (MSDN Magazine, 2001: XP shell features) | Task-oriented Explorer and Luna shell baseline | Task pane, Explorer chrome, folder views |
| R3 (Microsoft: *The Taskbar*) | Start, Quick Launch, task buttons, notification area, grouping, auto-hide | Taskbar structure and behaviour |
| R4 (Univ. of Dubuque, 2004: XP Explorer training) | Tree navigation, views, folder operations, search | Explorer workflows |

**Gap, stated plainly:** no permission-cleared XP Professional SP2 screen captures and no live XP machine were available. Visual comparison was against those textual sources and designer knowledge of the Luna design. There was no side-by-side image comparison, no overlay or diff, and no measured metrics, so this project **does not claim pixel-accurate fidelity**. The VISUAL.md starting targets were implemented as written and then adjusted where accessibility required it (below).

## Element-by-element status

| Element | VISUAL.md target | Implemented | Evidence status | Screenshot |
|---|---|---|---|---|
| UI font | Tahoma ~11 px | Tahoma 11 px (local), Arial fallback | Matches target; host-rendered | all |
| Window title | Bold ~13 px, white active text | Trebuchet MS bold 13 px; white active text; inactive text dark navy (see deviations) | Approximation | `1024x768/03-explorers-active-inactive.png` |
| Title bar height | ~30 px incl. top frame | 26 px bar + frame (≈29 px) | Approximation | 03 |
| Taskbar | ~30 px, green Start, blue bar, lighter tray | 30 px (36 px in compact or larger-controls mode) | Approximation; colours darkened for contrast | 01, 19 |
| Desktop icon | 32 px art, compact label below | 32 px art, 76×74 px grid (scales with text size), white label with drop shadow and halo | Approximation | 01 |
| Toolbar/menu icons | 16 or 24 px | 24 px toolbar, 16 px menus/tree/task pane | Matches target | 03, 04 |
| Window body | ~#ece9d8, white content | #ece9d8 face, white content | Matches target | 03 |
| Selection | ~#316ac5, white label | #316ac5; gray (#c9c6bc) when the list is not focused | Matches target | 05, 10 |
| Frame | Saturated blue bevel; softer inactive | Gradient title bars, blue frames; inactive light blue | Approximation | 03 |
| Task pane | Blue-tinted, ~180 px | 196 px, blue gradient, collapsible groups | Approximation | 03, 06 |
| Start menu | Two columns, profile header, footer | As specified; All Programs cascade | Period-style baseline (RESEARCH.md: not exhaustively verified) | 02 |
| Session dialogs, welcome screen | Period style | Turn Off with grayscale backdrop; welcome screen | Period-style baseline | 12, 18 |

## Deliberate deviations from XP's appearance (accessibility)

ACCESSIBILITY.md requires the *default* theme to meet WCAG 2.2 AA text contrast and target size. Where XP's original colours or metrics fall short, the default was changed. Ratios are computed in `tests/unit/contrast.test.ts`; target sizes are checked by axe in `tests/e2e/qa17-accessibility.spec.ts`.

| Element | XP original (approx.) | Here | Reason |
|---|---|---|---|
| Inactive title text | Light blue-white on light blue (~1.7:1) | Dark navy `#10307e` (≥4.9:1) | 1.4.3 contrast |
| Taskbar button face | `#3c81f3` (white text ~3.7:1) | `#2b67dc` main band (5.1:1) | 1.4.3 |
| Notification area | `#0f90e8` (clock ~3.4:1) | `#0b72c8` main band (4.9:1) | 1.4.3 |
| "start" label | 18 px italic bold | 19 px (counts as large text, ≥3:1) on a slightly darker green | 1.4.3 |
| Link hover in task pane | Lighter blue `#428eff` (~2.4:1) | Darker `#0b3a9c` with underline | 1.4.3 |
| Turn Off dialog body | Mid blue (labels ~3.2:1) | Darker blue (5.3:1) | 1.4.3 |
| Welcome-screen text | 18–20 px | 24 px (large text) | 1.4.3 |
| Desktop labels | Hard drop shadow | Drop shadow plus dark halo | Legibility over light wallpaper areas |
| Menu bar | ~20 px band | 24 px band and items | 2.5.8 target size |
| Address bar | ~22 px combo, ~17 px drop arrow | 24 px combo, 24 px drop button, 24 px Go | 2.5.8 |
| Details column headers | ~18 px | 24 px, sticky inside the scroller | 2.5.8; headers now scroll with their columns |
| Task-pane links | ~16 px rows with gaps | 24 px rows | 2.5.8 |
| Views toolbar button | Button plus separate arrow | One button with its arrow inside | 2.5.8 (removes an undersized target) |
| Back/Forward history arrows | 13 px split arrows | Kept at 13 px; the same lists are full-size items in View › Go To (WCAG 2.5.8 "equivalent" exception); 24 px with Larger controls | 2.5.8 |
| System-menu icon | 16–18 px hit area | 24 px hit area, same 16 px icon | 2.5.8 |
| Calculator key names | (n/a) | Accessible names start with the visible label, e.g. "CE (clear entry)" | 2.5.3 label in name |

## Web adaptations that are not XP features

Compact mode below 700 CSS px (windows fill the workspace; Window List button; stacked Start columns); Larger controls; Increased contrast; Windows forced-colors mapping; reduced motion (system or in-app); desktop grid scaling with text size; browser zoom. See ACCESSIBILITY.md and Help › "Accessibility and browser adaptations".

## Screenshot index

Captured by `npm run screenshots` (`tests/e2e/screenshots.spec.ts`): Chromium, DPR 1, reduced motion, fresh seed, fixed clock 23 Oct 2026 09:41 (America/New_York). Fonts are the build machine's (macOS 27.2: Tahoma, Trebuchet MS, Verdana). These images are review evidence, not pixel baselines.

| Folder | Files |
|---|---|
| `docs/screenshots/1024x768/` | 01 desktop · 02 Start + Accessories · 03 active/inactive Explorers · 04 tree + task pane · 05 selected folders · 06 item context menu · 07 desktop menu + Arrange · 08 Run error · 09 Display · 10 Recycle Bin · 11 Calculator · 12 Turn Off · 13 Control Panel · 14 Help · 15 browser error page · 16 Task Manager · 17 Search · 18 welcome screen · 19 grouped taskbar |
| `docs/screenshots/1280x1024/`, `docs/screenshots/1440x900/` | 01–04 (larger displays show more workspace with unchanged chrome) |
| `docs/screenshots/390x844/` | Compact desktop, Start, Explorer, Window List |
| `docs/screenshots/adaptations/` | Increased contrast + larger controls, Extra Large Fonts, forced colors |

### Review notes (2026-10-23)

- Geometry, icon silhouettes and states were inspected per image: active vs inactive frames, pressed task button, gray inactive-list selection, disabled items, tree plus/minus boxes, Start cascade, grouped taskbar list and compact layouts.
- Problems found during review and fixed before these captures:
  - The forced-colors active title was invisible (white on the forced white backplate).
  - Desktop labels overlapped under Extra Large Fonts.
  - Details headers did not scroll with their columns.
  - The Search date column was truncated.
  - The increased-contrast inactive title had a smeared shadow.
  - Fixed-clock timezone errors appeared in screenshots only.
- Remaining visible differences from XP are the substitutions and deviations listed above.
