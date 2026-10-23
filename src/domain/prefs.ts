/** Durable preferences. Every field is validated before hydration. */

export const WALLPAPERS = ['hillside', 'azure', 'dusk', 'none'] as const;
export type WallpaperId = (typeof WALLPAPERS)[number];
export const WALLPAPER_POSITIONS = ['stretch', 'center', 'tile'] as const;
export type WallpaperPosition = (typeof WALLPAPER_POSITIONS)[number];
export const TEXT_SCALES = ['normal', 'large', 'extraLarge'] as const;
export type TextScale = (typeof TEXT_SCALES)[number];
export const MOTION_MODES = ['system', 'reduce', 'allow'] as const;
export type MotionMode = (typeof MOTION_MODES)[number];
export const RECENT_APPS = ['explorer', 'calculator', 'help', 'controlPanel', 'taskManager'] as const;
export type RecentApp = (typeof RECENT_APPS)[number];

export interface Point {
  x: number;
  y: number;
}

export interface Favorite {
  id: string;
  name: string;
  folderId: string;
}

export interface Prefs {
  wallpaper: WallpaperId;
  wallpaperPosition: WallpaperPosition;
  backgroundColor: string;
  textScale: TextScale;
  highContrast: boolean;
  largerControls: boolean;
  motion: MotionMode;
  taskbar: { grouping: boolean; quickLaunch: boolean; showClock: boolean; autoHide: boolean };
  sound: { volume: number; muted: boolean; showTrayIcon: boolean };
  desktop: { autoArrange: boolean; alignToGrid: boolean; positions: Record<string, Point> };
  explorer: {
    showTasks: boolean;
    newWindowPerFolder: boolean;
    fullPathInTitle: boolean;
    fullPathInAddress: boolean;
    showStatusBar: boolean;
    showAddressBar: boolean;
    showToolbar: boolean;
  };
  favorites: Favorite[];
  recentApps: RecentApp[];
}

export const defaultPrefs: Prefs = {
  wallpaper: 'hillside',
  wallpaperPosition: 'stretch',
  backgroundColor: '#3a6ea5',
  textScale: 'normal',
  highContrast: false,
  largerControls: false,
  motion: 'system',
  taskbar: { grouping: true, quickLaunch: false, showClock: true, autoHide: false },
  sound: { volume: 70, muted: false, showTrayIcon: true },
  desktop: { autoArrange: false, alignToGrid: true, positions: {} },
  explorer: {
    showTasks: true,
    newWindowPerFolder: false,
    fullPathInTitle: false,
    fullPathInAddress: false,
    showStatusBar: true,
    showAddressBar: true,
    showToolbar: true,
  },
  favorites: [],
  recentApps: ['explorer', 'calculator'],
};

export const MAX_FAVORITES = 50;
export const MAX_RECENT = 6;
const POSITION_KEY = /^(shell:[a-zA-Z]+|f\d+)$/;

type V = Record<string, unknown>;
const isObj = (v: unknown): v is V => typeof v === 'object' && v !== null && !Array.isArray(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const isCoord = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 100_000;

export type PrefsValidation = { ok: true; prefs: Prefs } | { ok: false; reason: string };

export function validatePrefs(raw: unknown): PrefsValidation {
  const bad = (reason: string): PrefsValidation => ({ ok: false, reason: `preferences: ${reason}` });
  if (!isObj(raw)) return bad('not an object');
  const { taskbar, sound, desktop, explorer } = raw;
  if (!oneOf(WALLPAPERS, raw.wallpaper)) return bad('wallpaper');
  if (!oneOf(WALLPAPER_POSITIONS, raw.wallpaperPosition)) return bad('wallpaper position');
  if (typeof raw.backgroundColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.backgroundColor)) return bad('background color');
  if (!oneOf(TEXT_SCALES, raw.textScale)) return bad('text scale');
  if (!isBool(raw.highContrast) || !isBool(raw.largerControls)) return bad('appearance flags');
  if (!oneOf(MOTION_MODES, raw.motion)) return bad('motion');
  if (!isObj(taskbar) || ![taskbar.grouping, taskbar.quickLaunch, taskbar.showClock, taskbar.autoHide].every(isBool)) return bad('taskbar');
  if (!isObj(sound) || typeof sound.volume !== 'number' || !Number.isInteger(sound.volume) || sound.volume < 0 || sound.volume > 100) {
    return bad('sound');
  }
  if (!isBool(sound.muted) || !isBool(sound.showTrayIcon)) return bad('sound');
  if (!isObj(desktop) || !isBool(desktop.autoArrange) || !isBool(desktop.alignToGrid) || !isObj(desktop.positions)) return bad('desktop');
  const positions: Record<string, Point> = {};
  const entries = Object.entries(desktop.positions);
  if (entries.length > 1100) return bad('too many desktop positions');
  for (const [key, value] of entries) {
    if (!POSITION_KEY.test(key) || !isObj(value) || !isCoord(value.x) || !isCoord(value.y)) return bad('desktop position');
    positions[key] = { x: value.x, y: value.y };
  }
  const explorerKeys = ['showTasks', 'newWindowPerFolder', 'fullPathInTitle', 'fullPathInAddress', 'showStatusBar', 'showAddressBar', 'showToolbar'] as const;
  if (!isObj(explorer) || !explorerKeys.every((k) => isBool(explorer[k]))) return bad('explorer options');
  if (!Array.isArray(raw.favorites) || raw.favorites.length > MAX_FAVORITES) return bad('favorites');
  const favorites: Favorite[] = [];
  for (const fav of raw.favorites) {
    if (!isObj(fav) || typeof fav.id !== 'string' || typeof fav.name !== 'string' || typeof fav.folderId !== 'string') return bad('favorite');
    if (fav.name.length === 0 || fav.name.length > 255 || fav.id.length > 64 || fav.folderId.length > 64) return bad('favorite');
    favorites.push({ id: fav.id, name: fav.name, folderId: fav.folderId });
  }
  if (!Array.isArray(raw.recentApps) || raw.recentApps.length > MAX_RECENT || !raw.recentApps.every((a) => oneOf(RECENT_APPS, a))) {
    return bad('recent programs');
  }
  return {
    ok: true,
    prefs: {
      wallpaper: raw.wallpaper,
      wallpaperPosition: raw.wallpaperPosition,
      backgroundColor: raw.backgroundColor.toLowerCase(),
      textScale: raw.textScale,
      highContrast: raw.highContrast,
      largerControls: raw.largerControls,
      motion: raw.motion,
      taskbar: {
        grouping: taskbar.grouping as boolean,
        quickLaunch: taskbar.quickLaunch as boolean,
        showClock: taskbar.showClock as boolean,
        autoHide: taskbar.autoHide as boolean,
      },
      sound: { volume: sound.volume, muted: sound.muted, showTrayIcon: sound.showTrayIcon },
      desktop: { autoArrange: desktop.autoArrange, alignToGrid: desktop.alignToGrid, positions },
      explorer: Object.fromEntries(explorerKeys.map((k) => [k, explorer[k] as boolean])) as Prefs['explorer'],
      favorites,
      recentApps: [...new Set(raw.recentApps as RecentApp[])],
    },
  };
}
