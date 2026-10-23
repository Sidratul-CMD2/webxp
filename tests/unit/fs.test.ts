import { describe, expect, it } from 'vitest';
import {
  MAX_DEPTH,
  MAX_FOLDERS,
  SEED_IDS,
  childIds,
  copyFolders,
  createFolder,
  deletePermanently,
  deleteToBin,
  emptyBin,
  moveFolders,
  normalizeSelection,
  pathOf,
  purgeBinEntries,
  renameFolder,
  restoreFromBin,
  searchFolders,
  seedFs,
  snapshotFolders,
  validateFs,
  validateName,
  type FsState,
} from '../../src/domain/fs';

const T = 1_000;
const { desktop, myDocuments, myPictures, windows, programFiles, drive } = SEED_IDS;

function make(fs: FsState, parent: string, name?: string): [FsState, string] {
  const r = createFolder(fs, parent, T, name);
  if (!r.ok) throw new Error(r.error.message);
  return [r.fs, r.value];
}

function names(fs: FsState, parent: string) {
  return childIds(fs, parent).map((id) => fs.nodes[id].name).sort();
}

describe('seed', () => {
  it('contains only the specified folder hierarchy and no files', () => {
    const fs = seedFs(T);
    expect(Object.keys(fs.nodes)).toHaveLength(9);
    expect(pathOf(fs, myPictures)).toBe('C:\\Documents and Settings\\User\\My Documents\\My Pictures');
    expect(pathOf(fs, drive)).toBe('C:\\');
    expect(fs.bin).toEqual([]);
    for (const node of Object.values(fs.nodes)) {
      expect(Object.keys(node).sort()).toEqual(['created', 'id', 'modified', 'name', 'parentId']);
    }
    expect(childIds(fs, SEED_IDS.myMusic)).toEqual([]);
    expect(childIds(fs, desktop)).toEqual([]);
  });
});

describe('names', () => {
  it.each([
    ['', false],
    ['   ', false],
    ['a/b', false],
    ['what?', false],
    ['trailing.', false],
    ['.', false],
    ['..', false],
    ['CON', false],
    ['lpt1.txt', false],
    ['x'.repeat(256), false],
    ['tab\there', false],
    ['  Projects  ', true],
    ['Résumé 2006', true],
    ['<script>', false],
  ])('validateName(%j) ok=%s', (input, ok) => {
    expect(validateName(input).ok).toBe(ok);
  });

  it('creates unique numbered defaults', () => {
    let fs = seedFs(T);
    let a: string, b: string, c: string;
    [fs, a] = make(fs, desktop);
    [fs, b] = make(fs, desktop);
    [fs, c] = make(fs, desktop);
    expect([fs.nodes[a].name, fs.nodes[b].name, fs.nodes[c].name]).toEqual(['New Folder', 'New Folder (2)', 'New Folder (3)']);
  });

  it('rejects case-insensitive duplicates on rename but allows case-only change', () => {
    let fs = seedFs(T);
    let a: string;
    [fs] = make(fs, desktop, 'Alpha');
    [fs, a] = make(fs, desktop, 'Beta');
    const dup = renameFolder(fs, a, 'ALPHA', T);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('duplicate-name');
    const caseOnly = renameFolder(fs, a, 'BETA', T);
    expect(caseOnly.ok && caseOnly.fs.nodes[a].name).toBe('BETA');
  });

  it('keeps malicious-looking names as inert text when valid', () => {
    let fs = seedFs(T);
    let a: string;
    [fs, a] = make(fs, desktop, "Robert'); DROP TABLE folders;--");
    expect(fs.nodes[a].name).toBe("Robert'); DROP TABLE folders;--");
  });
});

describe('protection', () => {
  it('protects structural folders from rename, move and delete', () => {
    const fs = seedFs(T);
    for (const id of Object.values(SEED_IDS)) {
      expect(renameFolder(fs, id, 'X', T).ok).toBe(false);
      expect(deleteToBin(fs, [id], T).ok).toBe(false);
      expect(moveFolders(fs, [id], desktop, T).ok).toBe(false);
    }
  });

  it('allows creation only below Desktop and My Documents', () => {
    const fs = seedFs(T);
    expect(createFolder(fs, desktop, T).ok).toBe(true);
    expect(createFolder(fs, myPictures, T).ok).toBe(true);
    for (const id of [windows, programFiles, drive, SEED_IDS.user, SEED_IDS.docsAndSettings]) {
      const r = createFolder(fs, id, T);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('read-only');
    }
  });
});

describe('move', () => {
  it('rejects self and descendant destinations without changes', () => {
    let fs = seedFs(T);
    let a: string, b: string;
    [fs, a] = make(fs, desktop, 'A');
    [fs, b] = make(fs, a, 'B');
    const self = moveFolders(fs, [a], a, T);
    const desc = moveFolders(fs, [a], b, T);
    expect(self.ok || desc.ok).toBe(false);
    if (!desc.ok) expect(desc.error.code).toBe('cycle');
  });

  it('is a no-op within the same parent', () => {
    let fs = seedFs(T);
    let a: string;
    [fs, a] = make(fs, desktop, 'A');
    const r = moveFolders(fs, [a], desktop, T);
    expect(r.ok && r.fs).toBe(fs);
  });

  it('is atomic: one invalid item aborts the whole batch', () => {
    let fs = seedFs(T);
    let a: string;
    [fs, a] = make(fs, desktop, 'A');
    const r = moveFolders(fs, [a, myPictures], SEED_IDS.myMusic, T);
    expect(r.ok).toBe(false);
    expect(fs.nodes[a].parentId).toBe(desktop);
  });

  it('reports conflicts and resolves them only with keep both', () => {
    let fs = seedFs(T);
    let a: string;
    [fs, a] = make(fs, desktop, 'Same');
    [fs] = make(fs, myDocuments, 'same');
    const r = moveFolders(fs, [a], myDocuments, T);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.conflicts).toEqual(['Same']);
    const kept = moveFolders(fs, [a], myDocuments, T, { keepBoth: true });
    expect(kept.ok).toBe(true);
    if (kept.ok) expect(names(kept.fs, myDocuments)).toEqual(['My Music', 'My Pictures', 'Same (2)', 'same']);
  });

  it('normalizes selections that contain a folder and its descendant', () => {
    let fs = seedFs(T);
    let a: string, b: string;
    [fs, a] = make(fs, desktop, 'A');
    [fs, b] = make(fs, a, 'B');
    expect(normalizeSelection(fs, [b, a, a, 'missing'])).toEqual([a]);
    const r = moveFolders(fs, [a, b], myDocuments, T);
    expect(r.ok && r.fs.nodes[b].parentId).toBe(a);
  });
});

describe('copy', () => {
  it('uses fresh unique IDs and Copy of names in the same parent', () => {
    let fs = seedFs(T);
    let a: string;
    [fs, a] = make(fs, desktop, 'Trip');
    [fs] = make(fs, a, 'Day 1');
    const snap = snapshotFolders(fs, [a]);
    const first = copyFolders(fs, snap, desktop, T);
    if (!first.ok) throw new Error();
    const second = copyFolders(first.fs, snap, desktop, T);
    if (!second.ok) throw new Error();
    fs = second.fs;
    expect(names(fs, desktop)).toEqual(['Copy (2) of Trip', 'Copy of Trip', 'Trip']);
    const allIds = Object.keys(fs.nodes);
    expect(new Set(allIds).size).toBe(allIds.length);
    const copy = first.value[0];
    expect(copy).not.toBe(a);
    expect(names(fs, copy)).toEqual(['Day 1']);
  });

  it('copies a snapshot even after the original changes', () => {
    let fs = seedFs(T);
    let a: string;
    [fs, a] = make(fs, desktop, 'Orig');
    const snap = snapshotFolders(fs, [a]);
    const renamed = renameFolder(fs, a, 'Renamed', T);
    if (!renamed.ok) throw new Error();
    const r = copyFolders(renamed.fs, snap, myDocuments, T);
    expect(r.ok && names(r.fs, myDocuments)).toEqual(['My Music', 'My Pictures', 'Orig']);
  });

  it('refuses to copy a folder into its own subtree', () => {
    let fs = seedFs(T);
    let a: string, b: string;
    [fs, a] = make(fs, desktop, 'A');
    [fs, b] = make(fs, a, 'B');
    const r = copyFolders(fs, snapshotFolders(fs, [a]), b, T);
    expect(r.ok).toBe(false);
  });

  it('never snapshots protected folders', () => {
    const fs = seedFs(T);
    expect(snapshotFolders(fs, [myPictures, windows]).roots).toEqual([]);
  });
});

describe('recycle bin', () => {
  it('keeps the subtree attached and restores it intact', () => {
    let fs = seedFs(T);
    let a: string, b: string;
    [fs, a] = make(fs, myPictures, 'Album');
    [fs, b] = make(fs, a, 'Inner');
    const del = deleteToBin(fs, [a, b], 2_000);
    if (!del.ok) throw new Error();
    expect(del.fs.bin).toHaveLength(1);
    expect(Object.keys(del.fs.bin[0].nodes).sort()).toEqual([a, b].sort());
    expect(del.fs.bin[0].originalPath).toBe(pathOf(fs, myPictures));
    expect(del.fs.nodes[a]).toBeUndefined();
    const res = restoreFromBin(del.fs, [a], 3_000);
    if (!res.ok) throw new Error();
    expect(res.fs.nodes[b].parentId).toBe(a);
    expect(res.fs.nodes[a].parentId).toBe(myPictures);
    expect(res.fs.bin).toEqual([]);
  });

  it('requires an explicit fallback when the original parent is gone', () => {
    let fs = seedFs(T);
    let a: string, b: string;
    [fs, a] = make(fs, desktop, 'Parent');
    [fs, b] = make(fs, a, 'Child');
    let r = deleteToBin(fs, [b], T);
    if (!r.ok) throw new Error();
    r = deleteToBin(r.fs, [a], T);
    if (!r.ok) throw new Error();
    const attempt = restoreFromBin(r.fs, [b], T);
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.error.code).toBe('missing-parent');
    const fallback = restoreFromBin(r.fs, [b], T, { fallbackToMyDocuments: true });
    expect(fallback.ok && fallback.fs.nodes[b].parentId).toBe(myDocuments);
  });

  it('asks before restoring over a name conflict', () => {
    let fs = seedFs(T);
    let a: string;
    [fs, a] = make(fs, desktop, 'Dup');
    const del = deleteToBin(fs, [a], T);
    if (!del.ok) throw new Error();
    const [withNew] = make(del.fs, desktop, 'Dup');
    const r = restoreFromBin(withNew, [a], T);
    expect(r.ok).toBe(false);
    const kept = restoreFromBin(withNew, [a], T, { keepBoth: true });
    expect(kept.ok && names(kept.fs, desktop)).toEqual(['Dup', 'Dup (2)']);
  });

  it('purges and empties', () => {
    let fs = seedFs(T);
    let a: string, b: string;
    [fs, a] = make(fs, desktop, 'A');
    [fs, b] = make(fs, desktop, 'B');
    const del = deleteToBin(fs, [a, b], T);
    if (!del.ok) throw new Error();
    const purged = purgeBinEntries(del.fs, [a]);
    expect(purged.ok && purged.fs.bin.map((e) => e.rootId)).toEqual([b]);
    const emptied = emptyBin(del.fs);
    expect(emptied.ok && emptied.fs.bin).toEqual([]);
    const perm = deletePermanently(fs, [a], T);
    expect(perm.ok && perm.fs.nodes[a]).toBeUndefined();
    expect(perm.ok && perm.fs.bin).toEqual([]);
  });
});

describe('limits', () => {
  it('bounds nesting depth', () => {
    let fs = seedFs(T);
    let parent: string = desktop;
    let depth = 3;
    while (depth < MAX_DEPTH) {
      [fs, parent] = make(fs, parent, `d${depth}`);
      depth++;
    }
    const r = createFolder(fs, parent, T);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('limit-depth');
  });

  it('bounds folder count', () => {
    let fs = seedFs(T);
    for (let i = fs ? 9 : 0; i < MAX_FOLDERS; i++) [fs] = make(fs, desktop);
    const r = createFolder(fs, desktop, T);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('limit-count');
  });
});

describe('search', () => {
  it('finds descendants case-insensitively within scope only', () => {
    let fs = seedFs(T);
    let a: string;
    [fs, a] = make(fs, desktop, 'Holiday Plans');
    [fs] = make(fs, myDocuments, 'holiday');
    expect(searchFolders(fs, desktop, 'HOLI')).toEqual([a]);
    expect(searchFolders(fs, drive, 'holi')).toHaveLength(2);
    expect(searchFolders(fs, myPictures, '')).toEqual([]);
  });
});

describe('validateFs', () => {
  it('accepts a round-tripped state', () => {
    let fs = seedFs(T);
    let a: string;
    [fs, a] = make(fs, desktop, 'A');
    const del = deleteToBin(fs, [a], T);
    if (!del.ok) throw new Error();
    const r = validateFs(JSON.parse(JSON.stringify(del.fs)));
    expect(r.ok).toBe(true);
  });

  it.each([
    ['cycle', (fs: FsState) => ({ ...fs, nodes: { ...fs.nodes, f1: { ...fs.nodes.f1, parentId: 'f2' }, f2: { ...fs.nodes.f2, parentId: 'f1' } } })],
    ['orphan', (fs: FsState) => ({ ...fs, nodes: { ...fs.nodes, f1: { ...fs.nodes.f1, parentId: 'nope' } } })],
    ['duplicate', (fs: FsState) => ({ ...fs, nodes: { ...fs.nodes, f2: { ...fs.nodes.f2, name: 'A' } } })],
    ['bad name', (fs: FsState) => ({ ...fs, nodes: { ...fs.nodes, f1: { ...fs.nodes.f1, name: '<img src=x onerror=alert(1)>' } } })],
    ['file kind', (fs: FsState) => ({ ...fs, nodes: { ...fs.nodes, f1: { ...fs.nodes.f1, kind: 'file' } } })],
    ['protected altered', (fs: FsState) => ({ ...fs, nodes: { ...fs.nodes, [windows]: { ...fs.nodes[windows], name: 'Win' } } })],
    ['missing seed', (fs: FsState) => {
      const nodes = { ...fs.nodes };
      delete nodes[SEED_IDS.myMusic];
      return { ...fs, nodes };
    }],
  ])('rejects %s', (_label, mutate) => {
    let fs = seedFs(T);
    [fs] = make(fs, desktop, 'A');
    [fs] = make(fs, desktop, 'B');
    const raw = mutate(JSON.parse(JSON.stringify(fs)));
    const r = validateFs(raw);
    if (_label === 'file kind') {
      // Unknown fields are dropped rather than trusted: a file kind can never be hydrated.
      expect(r.ok && Object.keys(r.fs.nodes.f1)).not.toContain('kind');
    } else {
      expect(r.ok).toBe(false);
    }
  });
});
