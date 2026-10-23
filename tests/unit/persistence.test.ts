import { describe, expect, it } from 'vitest';
import { createFolder, seedFs, SEED_IDS } from '../../src/domain/fs';
import { defaultPrefs } from '../../src/domain/prefs';
import { STORAGE_KEY, clearSaved, loadSaved, parseEnvelope, save, serialize } from '../../src/domain/persistence';
import { resolveRun } from '../../src/domain/run';
import { resolveAddress } from '../../src/domain/locations';
import { resolveBrowserAddress } from '../../src/domain/browserRoutes';

function memoryStorage(overrides: Partial<Storage> = {}): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
    ...overrides,
  };
}

describe('persistence (QA-15)', () => {
  it('round-trips folders and preferences', () => {
    const storage = memoryStorage();
    const created = createFolder(seedFs(1), SEED_IDS.desktop, 1, 'Saved');
    if (!created.ok) throw new Error();
    const prefs = { ...defaultPrefs, wallpaper: 'azure' as const };
    expect(save(storage, created.fs, prefs, 5).ok).toBe(true);
    const loaded = loadSaved(storage);
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.fs.nodes[created.value].name).toBe('Saved');
      expect(loaded.prefs.wallpaper).toBe('azure');
    }
  });

  it('reports empty, corrupt and future data without throwing', () => {
    expect(loadSaved(memoryStorage()).status).toBe('empty');
    expect(parseEnvelope('{not json').status).toBe('invalid');
    expect(parseEnvelope(JSON.stringify({ version: 1, fs: {}, prefs: {} })).status).toBe('invalid');
    const future = parseEnvelope(JSON.stringify({ version: 7 }));
    expect(future).toEqual({ status: 'future', version: 7 });
    expect(loadSaved(null).status).toBe('unavailable');
  });

  it('rejects invalid preferences', () => {
    const text = serialize(seedFs(1), { ...defaultPrefs, wallpaper: 'https://evil.example/x.png' as never }, 1);
    expect(parseEnvelope(text).status).toBe('invalid');
  });

  it('surfaces quota failure without losing state', () => {
    const storage = memoryStorage({
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });
    const r = save(storage, seedFs(1), defaultPrefs, 1);
    expect(r).toEqual({ ok: false, message: 'Browser storage is full.' });
  });

  it('clears only its own key', () => {
    const storage = memoryStorage();
    storage.setItem('other-app', 'keep');
    save(storage, seedFs(1), defaultPrefs, 1);
    clearSaved(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem('other-app')).toBe('keep');
  });
});

describe('Run allowlist and address resolution (QA-11)', () => {
  const fs = seedFs(1);

  it.each([
    ['calc', 'calculator'],
    ['  EXPLORER ', 'explorer'],
    ['control', 'controlPanel'],
    ['iexplore', 'ie'],
    ['Help', 'help'],
  ])('%j launches %s', (input, app) => {
    expect(resolveRun(fs, input)).toEqual({ kind: 'app', app });
  });

  it.each(['cmd', 'calc.exe', 'javascript:alert(1)', 'https://example.com', 'alert(1)', 'D:\\', '../../etc', 'notepad'])(
    'rejects %j',
    (input) => {
      expect(resolveRun(fs, input)).toBeNull();
    },
  );

  it('resolves virtual folder paths case-insensitively', () => {
    expect(resolveRun(fs, 'c:\\windows')).toEqual({ kind: 'location', location: { kind: 'folder', id: SEED_IDS.windows } });
    expect(resolveAddress(fs, 'C:/Documents and Settings/user/MY DOCUMENTS/')).toEqual({ kind: 'folder', id: SEED_IDS.myDocuments });
    expect(resolveAddress(fs, 'my computer')).toEqual({ kind: 'myComputer' });
    expect(resolveAddress(fs, 'C:\\Nope')).toBeNull();
  });

  it('keeps browser addresses local', () => {
    expect(resolveBrowserAddress('about:welcome')).toEqual({ route: 'welcome' });
    expect(resolveBrowserAddress('http://example.com')).toEqual({ route: 'error', address: 'http://example.com' });
  });
});
