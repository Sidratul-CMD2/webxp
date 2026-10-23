import { validateFs, type FsState } from './fs';
import { validatePrefs, type Prefs } from './prefs';

/**
 * One versioned localStorage envelope. Only folder metadata and preferences
 * are stored; windows, clipboard, undo, menus and drafts are transient.
 */
export const STORAGE_KEY = 'xp-sim:v1';
export const SCHEMA_VERSION = 1;
export const MAX_PAYLOAD_CHARS = 2_000_000;

export interface Envelope {
  version: number;
  savedAt: number;
  fs: FsState;
  prefs: Prefs;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; fs: FsState; prefs: Prefs; savedAt: number }
  | { status: 'unavailable'; message: string }
  | { status: 'invalid'; reason: string }
  | { status: 'future'; version: number };

/** Accessing localStorage can itself throw (blocked site data, sandboxed frames). */
export function getStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = '__xp-sim-probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function parseEnvelope(text: string): LoadResult {
  if (text.length > MAX_PAYLOAD_CHARS) return { status: 'invalid', reason: 'saved data is too large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { status: 'invalid', reason: 'saved data is not valid JSON' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { status: 'invalid', reason: 'saved data is not an object' };
  const data = raw as Record<string, unknown>;
  if (typeof data.version !== 'number' || !Number.isInteger(data.version)) return { status: 'invalid', reason: 'missing schema version' };
  if (data.version > SCHEMA_VERSION) return { status: 'future', version: data.version };
  if (data.version !== SCHEMA_VERSION) return { status: 'invalid', reason: `unsupported schema version ${data.version}` };
  const fs = validateFs(data.fs);
  if (!fs.ok) return { status: 'invalid', reason: fs.reason };
  const prefs = validatePrefs(data.prefs);
  if (!prefs.ok) return { status: 'invalid', reason: prefs.reason };
  const savedAt = typeof data.savedAt === 'number' && Number.isFinite(data.savedAt) ? data.savedAt : 0;
  return { status: 'loaded', fs: fs.fs, prefs: prefs.prefs, savedAt };
}

export function loadSaved(storage: Storage | null): LoadResult {
  if (!storage) return { status: 'unavailable', message: 'Browser storage is unavailable.' };
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable', message: 'Browser storage could not be read.' };
  }
  if (text === null) return { status: 'empty' };
  return parseEnvelope(text);
}

export function serialize(fs: FsState, prefs: Prefs, now: number): string {
  const envelope: Envelope = { version: SCHEMA_VERSION, savedAt: now, fs, prefs };
  return JSON.stringify(envelope);
}

export type SaveResult = { ok: true; text: string } | { ok: false; message: string };

export function save(storage: Storage | null, fs: FsState, prefs: Prefs, now: number): SaveResult {
  if (!storage) return { ok: false, message: 'Browser storage is unavailable.' };
  const text = serialize(fs, prefs, now);
  try {
    storage.setItem(STORAGE_KEY, text);
    return { ok: true, text };
  } catch (error) {
    const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22);
    return { ok: false, message: quota ? 'Browser storage is full.' : 'Browser storage refused the save.' };
  }
}

export function clearSaved(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
