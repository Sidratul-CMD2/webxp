import type { FolderId, FolderSnapshot, FsState } from '../domain/fs';
import type { ShellLocation } from '../domain/locations';
import type { Prefs } from '../domain/prefs';
import type { Rect, WmState } from '../domain/windows';
import type { IconName } from '../ui/icons';

export type ViewMode = 'thumbnails' | 'tiles' | 'icons' | 'list' | 'details';
export type SortKey = 'name' | 'type' | 'modified' | 'location' | 'deleted';

export interface Selection {
  selected: string[];
  focused: string | null;
  anchor: string | null;
}

export interface SearchState {
  query: string;
  scopeId: FolderId;
  status: 'running' | 'done' | 'stopped';
  /** Matches found so far; for completed searches results are re-derived live. */
  found: FolderId[];
  runId: number;
}

export type ExplorerPane = 'tasks' | 'folders' | 'search' | 'none';

export interface ExplorerState extends Selection {
  location: ShellLocation;
  history: ShellLocation[];
  index: number;
  renaming: FolderId | null;
  view: ViewMode;
  sort: { key: SortKey; dir: 1 | -1 };
  pane: ExplorerPane;
  expanded: string[];
  search: SearchState | null;
  /** Most recent search form values, kept when navigating away. */
  searchDraft: { query: string; scopeId: FolderId };
}

export interface DesktopState extends Selection {
  renaming: FolderId | null;
}

export type Clipboard = { mode: 'cut'; ids: FolderId[] } | { mode: 'copy'; snapshot: FolderSnapshot };

export interface UndoEntry {
  label: string;
  before: FsState;
  after: FsState;
}

export type Session = 'running' | 'loggedOff' | 'standby' | 'off' | 'restarting';

export type StorageMode = 'ok' | 'unavailable' | 'invalid' | 'future' | 'failed' | 'conflict';

export interface StorageStatus {
  mode: StorageMode;
  detail: string;
  /** Saving is paused while recoverable data or a cross-tab conflict awaits a decision. */
  canSave: boolean;
}

export interface ModalButton {
  label: string;
  value: string;
}

interface ModalBase {
  id: string;
  invoker: HTMLElement | null;
  ownerWindowId: string | null;
}

export type Modal =
  | (ModalBase & {
      kind: 'message';
      title: string;
      icon: 'info' | 'warning' | 'error' | 'question' | null;
      text: string;
      detail?: string;
      buttons: ModalButton[];
      /** Index focused first; destructive confirmations focus the cancel button. */
      focusIndex: number;
      cancelValue: string;
      resolve: (value: string) => void;
    })
  | (ModalBase & { kind: 'run' })
  | (ModalBase & { kind: 'turnOff' })
  | (ModalBase & { kind: 'logOff' })
  | (ModalBase & {
      kind: 'browseFolder';
      title: string;
      prompt: string;
      okLabel: string;
      initial: FolderId | null;
      /** Returns an error message when the folder is not an acceptable choice. */
      validate: (id: FolderId) => string | null;
      resolve: (id: FolderId | null) => void;
    })
  | (ModalBase & {
      kind: 'prompt';
      title: string;
      label: string;
      value: string;
      validate: (text: string) => string | null;
      resolve: (text: string | null) => void;
    })
  | (ModalBase & { kind: 'organizeFavorites' })
  | (ModalBase & { kind: 'about'; product: string });

export type MenuEntry =
  | {
      kind?: 'item';
      id: string;
      /** `&` marks the access key, e.g. `E&xplore`. */
      label: string;
      icon?: IconName;
      shortcut?: string;
      /** A string explains why the command is unavailable. */
      disabled?: string | false;
      checked?: boolean;
      radio?: boolean;
      bold?: boolean;
      submenu?: MenuEntry[];
      run?: () => void;
    }
  | { kind: 'separator'; id: string };

export type MenuAnchor =
  | { type: 'point'; x: number; y: number }
  | { type: 'rect'; rect: { left: number; top: number; right: number; bottom: number }; placement: 'below' | 'above' | 'right' };

export interface OpenMenu {
  id: string;
  kind: 'menu' | 'start' | 'volume';
  items: MenuEntry[];
  anchor: MenuAnchor;
  ownerWindowId: string | null;
  invoker: HTMLElement | null;
  /** Opened with the keyboard: focus the first item and show access keys. */
  keyboard: boolean;
  /** Menubar menus can be switched by hovering sibling titles. */
  menubar?: { id: string; index: number; count: number; open: (index: number, keyboard: boolean) => void };
  label: string;
}

export interface Balloon {
  id: string;
  title: string;
  text: string;
  actions: { label: string; run: () => void }[];
  tone: 'info' | 'warning' | 'error';
}

export interface MoveSizeState {
  windowId: string;
  mode: 'move' | 'size';
  original: Rect;
  current: Rect;
  edges: { h: 'left' | 'right' | null; v: 'top' | 'bottom' | null };
}

export interface AppState {
  fs: FsState;
  prefs: Prefs;
  wm: WmState;
  explorers: Record<string, ExplorerState>;
  /** Per-window parameters for other apps (target folder, help topic...). */
  params: Record<string, Record<string, unknown>>;
  desktop: DesktopState;
  clipboard: Clipboard | null;
  undo: UndoEntry | null;
  modals: Modal[];
  menu: OpenMenu | null;
  session: Session;
  storage: StorageStatus;
  viewport: { w: number; h: number };
  balloon: Balloon | null;
  announcement: { text: string; n: number };
  moveSize: MoveSizeState | null;
  /** Bumped by Refresh so views re-render from current state. */
  refreshTick: number;
}
