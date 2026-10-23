# Visual system and reference protocol

## Baseline

Use the blue Luna configuration in PRODUCT.md. Research establishes XP's colorful dimensional icons and period shell controls; measurements below are initial design targets, not authenticated Microsoft metrics. Calibrate them against one consistent reference configuration before calling the result faithful.

| Element | Starting target at 100% zoom |
|---|---|
| UI font | Tahoma if locally installed; Arial/sans-serif fallback, roughly 11 px |
| Title | Bold approximately 13 px, white active text |
| Taskbar | Approximately 30 px high; green Start, blue bar, lighter tray |
| Window title | Approximately 30 px including top frame, compact caption controls |
| Desktop icon | 32 px artwork; compact label below, white with restrained shadow |
| Toolbar/menu icon | 16 or 24 px where appropriate |
| Window body | Warm gray around `#ece9d8`; white content region |
| Selection | Blue around `#316ac5`, white selected label |
| Frame | Layered saturated blue bevel/gradient; softer inactive blue |
| Task pane | Narrow blue-tinted grouping, roughly 180 px wide |

Use CSS tokens for colors, spacing, borders, title heights and metrics. Active/inactive frames must differ clearly. Match control spacing, bevel direction, status bar dividers, inset inputs, menu separators, hover fills and pressed offsets. No large modern radii, oversized whitespace, emoji, generic thin-line icons or frosted glass. Preserve title truncation and measured menu padding. Avoid replacing interactive DOM with a screenshot.

Wallpaper dominates first impression. Use a permission-cleared original reference image if supplied; otherwise create/use an original green-hill/blue-sky scene with documented provenance. Call it a substitute, not Bliss. Offer a solid-color fallback. Do not hotlink artwork. Tahoma must use local availability unless redistribution permission is established; record platform-dependent font differences.

## Asset register

The builder creates an asset manifest with each asset's local path, purpose, creator/source URL, license or permission, modifications and fallback. Include icons, wallpaper, sounds and fonts. Source documentation explains style, not redistribution rights. No Microsoft binary extraction or copied third-party emulator asset bundle without permission. Asset sourcing must not delay functional phases: use consistent original approximations, then record fidelity gaps.

## Reference and screenshot procedure

RESEARCH.md identifies available historical material. Build a reference board of source URLs and the exact configuration being compared; obtain additional permission-cleared captures if necessary. Never assert pixel-perfect accuracy from mixed-era screenshots. Document which elements are supported by references and which remain approximations.

Capture at 1024 × 768, DPR 1, 100% browser zoom, deterministic seed, fixed clock and animations off: desktop; Start plus Accessories submenu; active/inactive overlapping Explorer windows; Explorer tree and task pane; selected folders; context menu; Run/error; Display; Recycle Bin; Calculator; Turn Off dialog. Compare reference and implementation side by side, prioritizing geometry, typography, icon silhouettes and state changes. Use overlays/diffs only where comparable reference imagery exists. No arbitrary global similarity percentage can substitute for inspection.

Larger displays expose more workspace, not proportionally larger retro chrome. At small widths use the accessible compact adaptation from ACCESSIBILITY.md. Native browser rendering and licensed substitute assets may prevent exact identity; list those limitations in the release notes.
