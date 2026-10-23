# Research register and confidence

Research checked 23 October 2026. Distinguish contemporary XP evidence from documentation covering several Windows generations. This is a curated browser recreation specification; not every behavior below has been measured in an original XP installation.

## Historical sources

**R1 — Microsoft Windows User Experience Team, July 2001: [Creating Windows XP Icons](https://learn.microsoft.com/en-us/previous-versions/ms997636(v=msdn.10)).** Primary period design guidance. Supports colorful dimensional imagery, upper-left lighting, gradients/shadows, and multiple icon sizes including 16/32/48 px. Use for visual direction and size variants, not permission to redistribute Microsoft artwork. It does not establish exact taskbar or window metrics.

**R2 — Microsoft MSDN Magazine, November 2001: [Enhance Your Programs with New Windows XP Shell Features](https://learn.microsoft.com/en-us/archive/msdn-magazine/2001/november/new-graphical-interface-enhance-your-programs-with-new-windows-xp-shell-features).** Primary period account of the Luna shell and folder customization. Supports a distinct XP shell baseline and contextual folder/property interfaces. This is developer documentation, not a comprehensive visual reference for an SP2 installation.

**R3 — Microsoft: [The Taskbar](https://learn.microsoft.com/en-us/windows/win32/shell/taskbar).** Primary, mixed-version documentation. Confirms the division into Start, Quick Launch, task buttons and notification area, window switching, XP's clock preference and auto-hide. Restrict use to explicit version distinctions; modern menu labels and Windows 7 extensions must not leak into this build. The implementation's grouping threshold and bottom-only taskbar are project choices.

**R4 — University of Dubuque, 19 August 2004: [Windows XP — What is Windows Explorer and how do I use it?](https://www.dbq.edu/media/CampusLife/OfficeOfTechnology/FAQ/WindowsXP-Explorer.pdf).** Period institutional training material documenting its own deployed XP workflow. Supports hierarchical folder navigation, tree expansion, double-click opening, views, folder creation, delete, drag/move, copy/paste and search. Its institutional drive letters are not defaults and are not copied into the simulation. Only one local C: drive is specified.

## Accessibility sources

**R5 — W3C: [Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/).** Use the standard web menu focus and arrow-key model, including submenu behavior and disabled items. This is a browser accessibility adaptation, not historical evidence about XP.

**R6 — W3C: [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).** Supports moving focus inside, containing focus while modal, making background content inert and restoring focus on dismissal. Ordinary windows must not be marked modal.

**R7 — W3C: [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/).** Supports consistent focus handling and avoiding conflicts with operating-system shortcuts. This motivates visible alternatives to intercepted desktop shortcuts.

**R8 — W3C: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).** Normative accessibility target. Check keyboard access, focus visibility, contrast, reflow, dragging alternatives and target sizes. Automated scans alone cannot establish conformance.

## Evidence-to-spec map

| Area | Evidence status | Implementation consequence |
|---|---|---|
| XP icon style and nominal icon sizes | High, R1 | Multi-size dimensional assets; provenance tracked separately |
| Luna and task-oriented shell context | High, R2 | One coherent XP visual language |
| Taskbar regions, switching and clock/auto-hide | High for cited versioned passages, R3 | Implement these; avoid modern features |
| Explorer folder navigation and operations | High for described workflows, R4 | Make folders fully interactive despite no documents |
| Exact SP2 colors, dimensions, all menu labels | Not established by these sources | Starting values in VISUAL.md need calibrated reference captures |
| Two-column Start, IE6 shell, applet layout and session screens | Period-style design baseline; not exhaustively verified here | Compare consistent XP captures during phase 0; record deviations |
| Submenu delay, grouping threshold, drag threshold, minimum sizes | Proposed choices | Tune and test; never label as official XP constants |
| Restore collisions, undo scope, protection, folder cap | Proposed policies | Follow deterministic contracts instead of inventing behavior ad hoc |
| Browser shortcuts, modal simplification, compact mode | Intentional adaptations, R5–R8 | Preserve host/browser use and accessibility |

## Research limitations and follow-up

No live original XP machine was instrumented for this pack. No original binary assets, licensed wallpaper or font files are included. Available references do not prove every SP2-specific visual detail. Before claiming exact reproduction, compare against a consistent, permission-cleared XP Professional SP2 reference set, especially Start, Explorer task pane, Control Panel, Calculator and shutdown dialogs. If unavailable, finish a coherent approximation and report the remaining fidelity gap.

Do not use current Windows support screenshots as XP references. Do not treat an article about icon design as a redistribution license. Desktop shortcut placement, protected folders and app availability vary by installation; this pack defines its own explicit configuration so the builder has a stable target.
