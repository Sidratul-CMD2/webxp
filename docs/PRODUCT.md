# Product and scope

## Target experience

A browser desktop that feels like using a configured Windows XP Professional SP2-era PC. English labels, blue Luna, mouse and keyboard first. Desktop reference size: 1024 × 768 CSS pixels at 100% zoom. Also support 1280 × 1024 and 1440 × 900. This is a recreation of the shell experience, not an emulator, compatibility layer or full replica of every XP component.

Use one local display name, `User`; no sign-in credentials. Initial desktop shortcuts: My Documents, My Computer, My Network Places, Recycle Bin and Internet Explorer. These are shell entries, not .lnk nodes. Internet Explorer opens only a bundled local welcome/help page in an IE6-style shell. No network browsing. This placement is a deliberate configuration, not a pristine-install claim.

## Folder-only world

One simulated drive, Local Disk (C:). Its initial hierarchy:

- `C:\Documents and Settings\User\Desktop`
- `C:\Documents and Settings\User\My Documents\My Pictures`
- `C:\Documents and Settings\User\My Documents\My Music`
- `C:\Program Files`
- `C:\WINDOWS`

All leaf folders start empty. Parent folders contain only the listed subfolders. My Documents is a shell alias for its real folder ID, not a second copy. Desktop shows that folder's children plus the shell shortcuts. My Network Places is an empty shell view. My Computer lists the simulated drive and appropriate shell links. Recycle Bin starts empty.

The drive, listed structural folders and shell aliases are protected from rename, move and deletion. Users can create child folders in Desktop and My Documents descendants; WINDOWS and Program Files are read-only representations. This restricted model is a project adaptation. Show clear explanatory errors, never pretend to modify the real computer.

User folders may contain subfolders. There are no file nodes, file imports, text documents, downloadable exports, media libraries or working file editors. Deleting a folder moves its whole subtree into the simulated bin. Persist folder metadata and preferences locally, with a reset control; do not persist sensitive user content.

## Required release inventory

| Surface | Required result |
|---|---|
| Desktop | Select, multi-select, marquee, arrange, drag position, context menu, keyboard open |
| Start | Profile header, two columns, All Programs cascade, shell links, Search, Run, Help, Log Off, Turn Off |
| Window manager | Focus, stacking, move, eight resize handles, minimize, maximize, restore, close, system menu |
| Taskbar | Start, optional Quick Launch, window buttons, grouping, clock, volume, context menu, Show Desktop |
| Explorer | Menus, toolbar, editable address, task pane/folder tree, history, view/sort modes, status, folder operations |
| Recycle Bin | Contents, restore, permanent delete, empty, icon state |
| Search | Folder-name search with location filter, cancel and empty results |
| Run | Small command allowlist; predictable error for everything else |
| Control Panel | Category/classic views; Display, Taskbar and Start Menu, Sounds, Date and Time, Accessibility |
| Calculator | Standard arithmetic, clear, backspace, sign, decimal, memory, keyboard input |
| Internet Explorer shell | Back/Forward/Home for bundled pages; address accepts local route allowlist only |
| Help and Support | Searchable bundled usage help and honest simulation limitations |
| Task Manager | Application list, Switch To and End Task for simulated windows only |
| Session controls | Local welcome, log off, restart, stand-by overlay, turn-off screen and restart button |

A visible app launcher must launch its listed app; do not add extra app names as inert nostalgia props. Omit unsupported Control Panel categories/applets, or visibly disable them with a shared “Not simulated” explanation. System settings affect only this simulation.

## Deliberately outside the release

Real networking, accounts, activation, device management, installers, command execution, hardware stats, Windows Update, arbitrary website embedding, full registry/filesystem emulation, printing and real shutdown. Games, animated search assistant, boot animation, alternative Luna colors, Classic theme, screensaver and sound effects are optional only after release acceptance. No Notepad/Paint is needed under the no-documents rule.

## Definitions of success

The central demonstration is: open Start; launch two Explorer windows; move and resize them; create and rename a folder; nest and copy it; delete and restore it; switch through the taskbar; change wallpaper; use Calculator; restart the simulation and recover saved folders/preferences. It must work with both pointer and keyboard, with no dead enabled controls and no modern visual elements accidentally mixed in.
