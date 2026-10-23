/**
 * Folder-only virtual filesystem.
 *
 * Invariants enforced here (the domain boundary every UI entry point goes through):
 * - Nodes are folders only; there is no file kind or content field.
 * - Live nodes form a tree rooted at the drive; no cycles, no orphans.
 * - Sibling names are unique case-insensitively.
 * - Seed structure is protected from rename/move/delete.
 * - Multi-item operations validate everything first and then apply atomically.
 */

export type FolderId = string;

export interface FolderNode {
  id: FolderId;
  parentId: FolderId | null;
  name: string;
  created: number;
  modified: number;
}

export interface BinEntry {
  rootId: FolderId;
  originalParentId: FolderId;
  originalPath: string;
  deletedAt: number;
  /** The deleted root and its complete subtree. The root keeps its original parentId. */
  nodes: Record<FolderId, FolderNode>;
}

export interface FsState {
  nodes: Record<FolderId, FolderNode>;
  bin: BinEntry[];
  nextId: number;
}

export const SEED_IDS = {
  drive: 'c',
  docsAndSettings: 'das',
  user: 'user',
  desktop: 'desktop',
  myDocuments: 'mydocs',
  myPictures: 'mypics',
  myMusic: 'mymusic',
  programFiles: 'progfiles',
  windows: 'windows',
} as const;

export const ROOT_ID: FolderId = SEED_IDS.drive;
export const MAX_FOLDERS = 1000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 255;

const SEED: ReadonlyArray<readonly [FolderId, FolderId | null, string]> = [
  [SEED_IDS.drive, null, 'C:'],
  [SEED_IDS.docsAndSettings, SEED_IDS.drive, 'Documents and Settings'],
  [SEED_IDS.user, SEED_IDS.docsAndSettings, 'User'],
  [SEED_IDS.desktop, SEED_IDS.user, 'Desktop'],
  [SEED_IDS.myDocuments, SEED_IDS.user, 'My Documents'],
  [SEED_IDS.myPictures, SEED_IDS.myDocuments, 'My Pictures'],
  [SEED_IDS.myMusic, SEED_IDS.myDocuments, 'My Music'],
  [SEED_IDS.programFiles, SEED_IDS.drive, 'Program Files'],
  [SEED_IDS.windows, SEED_IDS.drive, 'WINDOWS'],
];

const PROTECTED: ReadonlySet<FolderId> = new Set(SEED.map(([id]) => id));
const WRITABLE_ROOTS: ReadonlySet<FolderId> = new Set([SEED_IDS.desktop, SEED_IDS.myDocuments]);

export function seedFs(now: number): FsState {
  const nodes: Record<FolderId, FolderNode> = {};
  for (const [id, parentId, name] of SEED) {
    nodes[id] = { id, parentId, name, created: now, modified: now };
  }
  return { nodes, bin: [], nextId: 1 };
}

export function seedEntries(): ReadonlyArray<readonly [FolderId, FolderId | null, string]> {
  return SEED;
}

// ---------------------------------------------------------------------------
// Errors

export type FsErrorCode =
  | 'invalid-name'
  | 'duplicate-name'
  | 'protected'
  | 'read-only'
  | 'missing'
  | 'missing-parent'
  | 'cycle'
  | 'limit-count'
  | 'limit-depth'
  | 'conflict';

export interface FsError {
  code: FsErrorCode;
  message: string;
  /** For 'conflict': names that already exist at the destination. */
  conflicts?: string[];
  /** For 'missing-parent': bin roots whose original location is gone. */
  missing?: FolderId[];
}

export type FsResult<T> = { ok: true; fs: FsState; value: T } | { ok: false; error: FsError };

const fail = <T>(code: FsErrorCode, message: string, extra?: Partial<FsError>): FsResult<T> => ({
  ok: false,
  error: { code, message, ...extra },
});

// ---------------------------------------------------------------------------
// Names

const INVALID_CHARS = /[\\/:*?"<>|]/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export const INVALID_CHARS_MESSAGE = 'A folder name cannot contain any of the following characters: \\ / : * ? " < > |';

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

/** Project validation policy (not full NTFS emulation). */
export function validateName(raw: string): NameCheck {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, message: 'You must type a folder name.' };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, message: `The folder name is too long. Use ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  if (INVALID_CHARS.test(name)) return { ok: false, message: INVALID_CHARS_MESSAGE };
  if (CONTROL_CHARS.test(name)) return { ok: false, message: 'A folder name cannot contain control characters.' };
  if (name.endsWith('.')) return { ok: false, message: 'A folder name cannot end with a period.' };
  if (RESERVED.test(name)) {
    return { ok: false, message: `“${name}” is a reserved device name. Choose a different folder name.` };
  }
  return { ok: true, name };
}

const fold = (name: string) => name.toLowerCase();

export function findChildByName(fs: FsState, parentId: FolderId, name: string, exceptId?: FolderId): FolderNode | undefined {
  const key = fold(name);
  for (const id of childIds(fs, parentId)) {
    if (id !== exceptId && fold(fs.nodes[id].name) === key) return fs.nodes[id];
  }
  return undefined;
}

function nameSetOf(fs: FsState, parentId: FolderId): Set<string> {
  return new Set(childIds(fs, parentId).map((id) => fold(fs.nodes[id].name)));
}

function clampBase(base: string, suffixLength: number): string {
  return base.length + suffixLength > MAX_NAME_LENGTH ? base.slice(0, MAX_NAME_LENGTH - suffixLength).trimEnd() : base;
}

/** `New Folder`, `New Folder (2)`, `New Folder (3)` ... */
export function numberedName(taken: Set<string>, base: string): string {
  if (!taken.has(fold(base))) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = clampBase(base, suffix.length) + suffix;
    if (!taken.has(fold(candidate))) return candidate;
  }
}

/** `Copy of X`, `Copy (2) of X` ... */
export function copyName(taken: Set<string>, base: string): string {
  for (let n = 1; ; n++) {
    const prefix = n === 1 ? 'Copy of ' : `Copy (${n}) of `;
    const candidate = prefix + clampBase(base, prefix.length);
    if (!taken.has(fold(candidate))) return candidate;
  }
}

export function uniqueChildName(fs: FsState, parentId: FolderId, base: string): string {
  return numberedName(nameSetOf(fs, parentId), base);
}

// ---------------------------------------------------------------------------
// Tree queries (children index memoized per nodes object)

const childIndexCache = new WeakMap<Record<FolderId, FolderNode>, Map<FolderId, FolderId[]>>();

function childIndex(nodes: Record<FolderId, FolderNode>): Map<FolderId, FolderId[]> {
  let index = childIndexCache.get(nodes);
  if (!index) {
    index = new Map();
    for (const node of Object.values(nodes)) {
      if (node.parentId === null) continue;
      const list = index.get(node.parentId);
      if (list) list.push(node.id);
      else index.set(node.parentId, [node.id]);
    }
    childIndexCache.set(nodes, index);
  }
  return index;
}

export function childIds(fs: FsState, parentId: FolderId): FolderId[] {
  return childIndex(fs.nodes).get(parentId) ?? [];
}

export function children(fs: FsState, parentId: FolderId): FolderNode[] {
  return childIds(fs, parentId).map((id) => fs.nodes[id]);
}

export function isLive(fs: FsState, id: FolderId | null | undefined): id is FolderId {
  return !!id && Object.prototype.hasOwnProperty.call(fs.nodes, id);
}

/** Ancestor IDs from the parent up to the drive. */
export function ancestorsOf(fs: FsState, id: FolderId): FolderId[] {
  const result: FolderId[] = [];
  let current = fs.nodes[id]?.parentId ?? null;
  let guard = 0;
  while (current !== null && guard++ <= MAX_DEPTH + 2) {
    result.push(current);
    current = fs.nodes[current]?.parentId ?? null;
  }
  return result;
}

export function isSelfOrDescendant(fs: FsState, id: FolderId, ancestorId: FolderId): boolean {
  return id === ancestorId || ancestorsOf(fs, id).includes(ancestorId);
}

export function depthOf(fs: FsState, id: FolderId): number {
  return ancestorsOf(fs, id).length;
}

/** The subtree rooted at id, including id, in breadth-first order. */
export function subtreeIds(fs: FsState, id: FolderId): FolderId[] {
  return subtreeOf(fs.nodes, id);
}

function subtreeOf(nodes: Record<FolderId, FolderNode>, rootId: FolderId): FolderId[] {
  if (!nodes[rootId]) return [];
  const index = childIndex(nodes);
  const result = [rootId];
  for (let i = 0; i < result.length; i++) {
    for (const child of index.get(result[i]) ?? []) result.push(child);
  }
  return result;
}

/** Height of a subtree: 1 for a leaf. */
function heightOf(nodes: Record<FolderId, FolderNode>, rootId: FolderId): number {
  const index = childIndex(nodes);
  const walk = (id: FolderId): number => 1 + Math.max(0, ...(index.get(id) ?? []).map(walk));
  return walk(rootId);
}

export function descendantCount(fs: FsState, id: FolderId): number {
  return subtreeIds(fs, id).length - 1;
}

export function totalFolderCount(fs: FsState): number {
  let count = Object.keys(fs.nodes).length;
  for (const entry of fs.bin) count += Object.keys(entry.nodes).length;
  return count;
}

export function pathOf(fs: FsState, id: FolderId): string {
  const chain = [id, ...ancestorsOf(fs, id)].reverse();
  const names = chain.map((cid) => fs.nodes[cid]?.name ?? '?');
  return names.length === 1 ? `${names[0]}\\` : names.join('\\');
}

// ---------------------------------------------------------------------------
// Protection

export const isProtected = (id: FolderId): boolean => PROTECTED.has(id);

/** May the user create, paste or restore folders inside this folder? */
export function isWritable(fs: FsState, id: FolderId): boolean {
  if (!isLive(fs, id)) return false;
  if (WRITABLE_ROOTS.has(id)) return true;
  return ancestorsOf(fs, id).some((a) => WRITABLE_ROOTS.has(a));
}

/** May the user rename, move, copy or delete this folder? */
export function isUserFolder(fs: FsState, id: FolderId): boolean {
  return isLive(fs, id) && !isProtected(id);
}

export function displayName(fs: FsState, id: FolderId): string {
  if (id === ROOT_ID) return 'Local Disk (C:)';
  return fs.nodes[id]?.name ?? '';
}

function protectedMessage(fs: FsState, id: FolderId, verb: string): string {
  return `“${displayName(fs, id)}” is a protected system folder in this simulation and cannot be ${verb}.`;
}

function readOnlyMessage(fs: FsState, id: FolderId): string {
  return `“${displayName(fs, id)}” is a read-only part of this simulation. You can create folders on the Desktop and in My Documents.`;
}

/** Removes duplicates, missing IDs and items already covered by a selected ancestor. */
export function normalizeSelection(fs: FsState, ids: readonly FolderId[]): FolderId[] {
  const live = [...new Set(ids)].filter((id) => isLive(fs, id));
  const set = new Set(live);
  return live.filter((id) => !ancestorsOf(fs, id).some((a) => set.has(a)));
}

function idFactory(fs: FsState) {
  let next = fs.nextId;
  return {
    make: () => `f${next++}`,
    get next() {
      return next;
    },
  };
}

function capacityError<T>(): FsResult<T> {
  return fail(
    'limit-count',
    `This simulation can hold up to ${MAX_FOLDERS.toLocaleString('en-US')} folders, including the Recycle Bin. Delete or empty some folders and try again.`,
  );
}

function depthError<T>(): FsResult<T> {
  return fail('limit-depth', `Folders can be nested at most ${MAX_DEPTH} levels deep in this simulation.`);
}

// ---------------------------------------------------------------------------
// Mutations

export function createFolder(fs: FsState, parentId: FolderId, now: number, requestedName?: string): FsResult<FolderId> {
  if (!isLive(fs, parentId)) return fail('missing', 'The destination folder no longer exists.');
  if (!isWritable(fs, parentId)) return fail('read-only', readOnlyMessage(fs, parentId));
  if (totalFolderCount(fs) + 1 > MAX_FOLDERS) return capacityError();
  if (depthOf(fs, parentId) + 1 > MAX_DEPTH) return depthError();
  let name: string;
  if (requestedName === undefined) {
    name = uniqueChildName(fs, parentId, 'New Folder');
  } else {
    const check = validateName(requestedName);
    if (!check.ok) return fail('invalid-name', check.message);
    if (findChildByName(fs, parentId, check.name)) return fail('duplicate-name', duplicateMessage(check.name));
    name = check.name;
  }
  const ids = idFactory(fs);
  const id = ids.make();
  const nodes = {
    ...fs.nodes,
    [id]: { id, parentId, name, created: now, modified: now },
    [parentId]: { ...fs.nodes[parentId], modified: now },
  };
  return { ok: true, fs: { ...fs, nodes, nextId: ids.next }, value: id };
}

function duplicateMessage(name: string): string {
  return `Cannot rename to “${name}”: A folder with the name you specified already exists. Specify a different folder name.`;
}

export function renameFolder(fs: FsState, id: FolderId, raw: string, now: number): FsResult<string> {
  if (!isLive(fs, id)) return fail('missing', 'The folder no longer exists.');
  if (isProtected(id)) return fail('protected', protectedMessage(fs, id, 'renamed'));
  const check = validateName(raw);
  if (!check.ok) return fail('invalid-name', check.message);
  const node = fs.nodes[id];
  if (node.name === check.name) return { ok: true, fs, value: node.name };
  const parentId = node.parentId as FolderId;
  if (findChildByName(fs, parentId, check.name, id)) return fail('duplicate-name', duplicateMessage(check.name));
  const nodes = {
    ...fs.nodes,
    [id]: { ...node, name: check.name, modified: now },
    [parentId]: { ...fs.nodes[parentId], modified: now },
  };
  return { ok: true, fs: { ...fs, nodes }, value: check.name };
}

export interface TransferOptions {
  /** Resolve name conflicts at a different parent by numbering the incoming folder. */
  keepBoth?: boolean;
}

export function moveFolders(
  fs: FsState,
  ids: readonly FolderId[],
  destId: FolderId,
  now: number,
  options: TransferOptions = {},
): FsResult<FolderId[]> {
  const roots = normalizeSelection(fs, ids);
  if (roots.length === 0) return fail('missing', 'The folders to move no longer exist.');
  if (!isLive(fs, destId)) return fail('missing', 'The destination folder no longer exists.');
  for (const id of roots) {
    if (isProtected(id)) return fail('protected', protectedMessage(fs, id, 'moved'));
  }
  if (!isWritable(fs, destId)) return fail('read-only', readOnlyMessage(fs, destId));
  for (const id of roots) {
    if (isSelfOrDescendant(fs, destId, id)) {
      return fail('cycle', `Cannot move “${fs.nodes[id].name}”: The destination folder is a subfolder of the source folder.`);
    }
  }
  const moving = roots.filter((id) => fs.nodes[id].parentId !== destId);
  if (moving.length === 0) return { ok: true, fs, value: [] };
  const destDepth = depthOf(fs, destId);
  for (const id of moving) {
    if (destDepth + heightOf(fs.nodes, id) > MAX_DEPTH) return depthError();
  }
  const movingSet = new Set(moving);
  const taken = new Set(childIds(fs, destId).filter((c) => !movingSet.has(c)).map((c) => fold(fs.nodes[c].name)));
  const conflicts: string[] = [];
  const finalNames = new Map<FolderId, string>();
  for (const id of moving) {
    const name = fs.nodes[id].name;
    if (taken.has(fold(name))) {
      conflicts.push(name);
      finalNames.set(id, numberedName(taken, name));
    } else {
      finalNames.set(id, name);
    }
    taken.add(fold(finalNames.get(id)!));
  }
  if (conflicts.length && !options.keepBoth) return conflictError(conflicts);
  const nodes = { ...fs.nodes };
  for (const id of moving) {
    const oldParent = nodes[id].parentId as FolderId;
    nodes[oldParent] = { ...nodes[oldParent], modified: now };
    nodes[id] = { ...nodes[id], parentId: destId, name: finalNames.get(id)! };
  }
  nodes[destId] = { ...nodes[destId], modified: now };
  return { ok: true, fs: { ...fs, nodes }, value: moving };
}

function conflictError<T>(conflicts: string[]): FsResult<T> {
  const list = conflicts.map((n) => `“${n}”`).join(', ');
  return fail(
    'conflict',
    conflicts.length === 1
      ? `This folder already contains a folder named ${list}.`
      : `This folder already contains folders named ${list}.`,
    { conflicts },
  );
}

/** A detached snapshot of folder subtrees, e.g. taken by Copy. */
export interface FolderSnapshot {
  roots: FolderId[];
  nodes: Record<FolderId, FolderNode>;
}

export function snapshotFolders(fs: FsState, ids: readonly FolderId[]): FolderSnapshot {
  const roots = normalizeSelection(fs, ids).filter((id) => !isProtected(id));
  const nodes: Record<FolderId, FolderNode> = {};
  for (const root of roots) {
    for (const id of subtreeIds(fs, root)) nodes[id] = fs.nodes[id];
  }
  return { roots, nodes };
}

export function copyFolders(
  fs: FsState,
  source: FolderSnapshot,
  destId: FolderId,
  now: number,
  options: TransferOptions = {},
): FsResult<FolderId[]> {
  if (source.roots.length === 0) return fail('missing', 'There is nothing to paste.');
  if (!isLive(fs, destId)) return fail('missing', 'The destination folder no longer exists.');
  if (!isWritable(fs, destId)) return fail('read-only', readOnlyMessage(fs, destId));
  for (const root of source.roots) {
    if (isLive(fs, root) && isSelfOrDescendant(fs, destId, root)) {
      return fail('cycle', `Cannot copy “${source.nodes[root].name}”: The destination folder is a subfolder of the source folder.`);
    }
  }
  if (totalFolderCount(fs) + Object.keys(source.nodes).length > MAX_FOLDERS) return capacityError();
  const destDepth = depthOf(fs, destId);
  for (const root of source.roots) {
    if (destDepth + heightOf(source.nodes, root) > MAX_DEPTH) return depthError();
  }
  const taken = nameSetOf(fs, destId);
  const conflicts: string[] = [];
  const finalNames = new Map<FolderId, string>();
  for (const root of source.roots) {
    const name = source.nodes[root].name;
    let finalName = name;
    if (taken.has(fold(name))) {
      if (source.nodes[root].parentId === destId) {
        finalName = copyName(taken, name);
      } else {
        conflicts.push(name);
        finalName = numberedName(taken, name);
      }
    }
    finalNames.set(root, finalName);
    taken.add(fold(finalName));
  }
  if (conflicts.length && !options.keepBoth) return conflictError(conflicts);
  const ids = idFactory(fs);
  const nodes = { ...fs.nodes };
  const created: FolderId[] = [];
  for (const root of source.roots) {
    const mapping = new Map<FolderId, FolderId>();
    for (const oldId of subtreeOf(source.nodes, root)) {
      const newId = ids.make();
      mapping.set(oldId, newId);
      const old = source.nodes[oldId];
      const isRoot = oldId === root;
      nodes[newId] = {
        id: newId,
        parentId: isRoot ? destId : (mapping.get(old.parentId as FolderId) as FolderId),
        name: isRoot ? finalNames.get(root)! : old.name,
        created: now,
        modified: now,
      };
    }
    created.push(mapping.get(root)!);
  }
  nodes[destId] = { ...nodes[destId], modified: now };
  return { ok: true, fs: { ...fs, nodes, nextId: ids.next }, value: created };
}

export function deleteToBin(fs: FsState, ids: readonly FolderId[], now: number): FsResult<FolderId[]> {
  const roots = normalizeSelection(fs, ids);
  if (roots.length === 0) return fail('missing', 'The folders to delete no longer exist.');
  for (const id of roots) {
    if (isProtected(id)) return fail('protected', protectedMessage(fs, id, 'deleted'));
  }
  const nodes = { ...fs.nodes };
  const entries: BinEntry[] = [];
  for (const root of roots) {
    const parentId = fs.nodes[root].parentId as FolderId;
    const subtree: Record<FolderId, FolderNode> = {};
    for (const id of subtreeIds(fs, root)) {
      subtree[id] = fs.nodes[id];
      delete nodes[id];
    }
    entries.push({ rootId: root, originalParentId: parentId, originalPath: pathOf(fs, parentId), deletedAt: now, nodes: subtree });
    if (nodes[parentId]) nodes[parentId] = { ...nodes[parentId], modified: now };
  }
  return { ok: true, fs: { ...fs, nodes, bin: [...fs.bin, ...entries] }, value: roots };
}

export function deletePermanently(fs: FsState, ids: readonly FolderId[], now: number): FsResult<FolderId[]> {
  const roots = normalizeSelection(fs, ids);
  if (roots.length === 0) return fail('missing', 'The folders to delete no longer exist.');
  for (const id of roots) {
    if (isProtected(id)) return fail('protected', protectedMessage(fs, id, 'deleted'));
  }
  const nodes = { ...fs.nodes };
  for (const root of roots) {
    const parentId = fs.nodes[root].parentId as FolderId;
    for (const id of subtreeIds(fs, root)) delete nodes[id];
    if (nodes[parentId]) nodes[parentId] = { ...nodes[parentId], modified: now };
  }
  return { ok: true, fs: { ...fs, nodes }, value: roots };
}

export function binEntry(fs: FsState, rootId: FolderId): BinEntry | undefined {
  return fs.bin.find((e) => e.rootId === rootId);
}

export function purgeBinEntries(fs: FsState, rootIds: readonly FolderId[]): FsResult<FolderId[]> {
  const set = new Set(rootIds);
  const removed = fs.bin.filter((e) => set.has(e.rootId)).map((e) => e.rootId);
  if (removed.length === 0) return fail('missing', 'Those items are no longer in the Recycle Bin.');
  return { ok: true, fs: { ...fs, bin: fs.bin.filter((e) => !set.has(e.rootId)) }, value: removed };
}

export function emptyBin(fs: FsState): FsResult<FolderId[]> {
  return { ok: true, fs: { ...fs, bin: [] }, value: fs.bin.map((e) => e.rootId) };
}

export interface RestoreOptions extends TransferOptions {
  /** Restore entries whose original parent is gone into My Documents. */
  fallbackToMyDocuments?: boolean;
}

export function restoreFromBin(
  fs: FsState,
  rootIds: readonly FolderId[],
  now: number,
  options: RestoreOptions = {},
): FsResult<FolderId[]> {
  const entries = rootIds.map((id) => binEntry(fs, id)).filter((e): e is BinEntry => !!e);
  if (entries.length === 0) return fail('missing', 'Those items are no longer in the Recycle Bin.');
  const targets = new Map<FolderId, FolderId>();
  const missing: FolderId[] = [];
  for (const entry of entries) {
    if (isLive(fs, entry.originalParentId) && isWritable(fs, entry.originalParentId)) {
      targets.set(entry.rootId, entry.originalParentId);
    } else if (options.fallbackToMyDocuments) {
      targets.set(entry.rootId, SEED_IDS.myDocuments);
    } else {
      missing.push(entry.rootId);
    }
  }
  if (missing.length) {
    const names = missing.map((id) => `“${binEntry(fs, id)!.nodes[id].name}”`).join(', ');
    return fail('missing-parent', `The original location of ${names} no longer exists.`, { missing });
  }
  for (const entry of entries) {
    if (depthOf(fs, targets.get(entry.rootId)!) + heightOf(entry.nodes, entry.rootId) > MAX_DEPTH) return depthError();
  }
  const takenByParent = new Map<FolderId, Set<string>>();
  const conflicts: string[] = [];
  const finalNames = new Map<FolderId, string>();
  for (const entry of entries) {
    const target = targets.get(entry.rootId)!;
    if (!takenByParent.has(target)) takenByParent.set(target, nameSetOf(fs, target));
    const taken = takenByParent.get(target)!;
    const name = entry.nodes[entry.rootId].name;
    let finalName = name;
    if (taken.has(fold(name))) {
      conflicts.push(name);
      finalName = numberedName(taken, name);
    }
    finalNames.set(entry.rootId, finalName);
    taken.add(fold(finalName));
  }
  if (conflicts.length && !options.keepBoth) return conflictError(conflicts);
  const nodes = { ...fs.nodes };
  for (const entry of entries) {
    const target = targets.get(entry.rootId)!;
    Object.assign(nodes, entry.nodes);
    nodes[entry.rootId] = { ...entry.nodes[entry.rootId], parentId: target, name: finalNames.get(entry.rootId)! };
    nodes[target] = { ...nodes[target], modified: now };
  }
  const restored = new Set(entries.map((e) => e.rootId));
  return {
    ok: true,
    fs: { ...fs, nodes, bin: fs.bin.filter((e) => !restored.has(e.rootId)) },
    value: entries.map((e) => e.rootId),
  };
}

// ---------------------------------------------------------------------------
// Search

/** Descendants of scope (excluding scope) in breadth-first order. */
export function* walkDescendants(fs: FsState, scopeId: FolderId): Generator<FolderId> {
  const queue = [...childIds(fs, scopeId)];
  for (let i = 0; i < queue.length; i++) {
    yield queue[i];
    queue.push(...childIds(fs, queue[i]));
  }
}

export function nameMatches(name: string, query: string): boolean {
  return fold(name).includes(fold(query.trim()));
}

export function searchFolders(fs: FsState, scopeId: FolderId, query: string): FolderId[] {
  if (!isLive(fs, scopeId)) return [];
  const result: FolderId[] = [];
  for (const id of walkDescendants(fs, scopeId)) {
    if (nameMatches(fs.nodes[id].name, query)) result.push(id);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Persistence validation

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function readNode(raw: unknown, key: string): FolderNode | string {
  if (!isRecord(raw)) return `node ${key} is not an object`;
  const { id, parentId, name, created, modified } = raw;
  if (typeof id !== 'string' || id !== key || id.length === 0 || id.length > 64) return `node ${key} has an invalid id`;
  if (parentId !== null && typeof parentId !== 'string') return `node ${key} has an invalid parent`;
  if (typeof name !== 'string') return `node ${key} has an invalid name`;
  if (!isTime(created) || !isTime(modified)) return `node ${key} has invalid timestamps`;
  return { id, parentId, name, created, modified };
}

function checkTree(nodes: Record<FolderId, FolderNode>, root: FolderId, rootParent: FolderId | null): string | null {
  const index = childIndex(nodes);
  for (const node of Object.values(nodes)) {
    if (node.id === root) {
      if (node.parentId !== rootParent) return `root ${root} has an unexpected parent`;
      continue;
    }
    if (node.parentId === null || !nodes[node.parentId]) return `folder ${node.id} is orphaned`;
  }
  // Reachability from root proves the structure is a tree (no cycles, no orphans).
  const seen = new Set<FolderId>([root]);
  const depth = new Map<FolderId, number>([[root, 0]]);
  const queue = [root];
  for (let i = 0; i < queue.length; i++) {
    const names = new Set<string>();
    for (const child of index.get(queue[i]) ?? []) {
      if (seen.has(child)) return 'the folder tree contains a cycle';
      const check = validateName(nodes[child].name);
      if (!check.ok || check.name !== nodes[child].name) return `folder ${child} has an invalid name`;
      const key = fold(nodes[child].name);
      if (names.has(key)) return `duplicate folder names under ${queue[i]}`;
      names.add(key);
      seen.add(child);
      depth.set(child, depth.get(queue[i])! + 1);
      if (depth.get(child)! > MAX_DEPTH) return 'folders are nested too deeply';
      queue.push(child);
    }
  }
  if (seen.size !== Object.keys(nodes).length) return 'the folder tree contains unreachable folders';
  return null;
}

export type FsValidation = { ok: true; fs: FsState } | { ok: false; reason: string };

/** Validates untrusted persisted data before it is allowed into the store. */
export function validateFs(raw: unknown): FsValidation {
  const bad = (reason: string): FsValidation => ({ ok: false, reason });
  if (!isRecord(raw)) return bad('folder data is not an object');
  if (!isRecord(raw.nodes) || !Array.isArray(raw.bin)) return bad('folder data is incomplete');
  if (typeof raw.nextId !== 'number' || !Number.isInteger(raw.nextId) || raw.nextId < 1) return bad('invalid id counter');
  const allIds = new Set<string>();
  const nodes: Record<FolderId, FolderNode> = {};
  for (const [key, value] of Object.entries(raw.nodes)) {
    const node = readNode(value, key);
    if (typeof node === 'string') return bad(node);
    nodes[key] = node;
    allIds.add(key);
  }
  for (const [id, parentId, name] of SEED) {
    const node = nodes[id];
    if (!node || node.parentId !== parentId || node.name !== name) return bad(`protected folder ${name} is missing or altered`);
  }
  // The drive's name is not a valid folder name, so validate the tree below it.
  const treeError = checkTree(nodes, ROOT_ID, null);
  if (treeError) return bad(treeError);
  const bin: BinEntry[] = [];
  for (const rawEntry of raw.bin) {
    if (!isRecord(rawEntry) || !isRecord(rawEntry.nodes)) return bad('invalid Recycle Bin entry');
    const { rootId, originalParentId, originalPath, deletedAt } = rawEntry;
    if (typeof rootId !== 'string' || typeof originalParentId !== 'string' || typeof originalPath !== 'string' || !isTime(deletedAt)) {
      return bad('invalid Recycle Bin entry');
    }
    if (originalPath.length > 4096) return bad('invalid Recycle Bin path');
    const entryNodes: Record<FolderId, FolderNode> = {};
    for (const [key, value] of Object.entries(rawEntry.nodes)) {
      const node = readNode(value, key);
      if (typeof node === 'string') return bad(node);
      if (allIds.has(key) || PROTECTED.has(key)) return bad('duplicate folder id in Recycle Bin');
      allIds.add(key);
      entryNodes[key] = node;
    }
    if (!entryNodes[rootId]) return bad('Recycle Bin entry is missing its folder');
    const rootCheck = validateName(entryNodes[rootId].name);
    if (!rootCheck.ok || rootCheck.name !== entryNodes[rootId].name) return bad('Recycle Bin entry has an invalid name');
    const entryError = checkTree(entryNodes, rootId, originalParentId);
    if (entryError) return bad(`Recycle Bin: ${entryError}`);
    bin.push({ rootId, originalParentId, originalPath, deletedAt, nodes: entryNodes });
  }
  if (allIds.size > MAX_FOLDERS) return bad('too many folders');
  let maxId = 0;
  for (const id of allIds) {
    const match = /^f(\d+)$/.exec(id);
    if (match) maxId = Math.max(maxId, Number(match[1]));
    else if (!PROTECTED.has(id)) return bad(`unexpected folder id ${id}`);
  }
  const nextId = Math.max(raw.nextId, maxId + 1);
  return { ok: true, fs: { nodes, bin, nextId } };
}
