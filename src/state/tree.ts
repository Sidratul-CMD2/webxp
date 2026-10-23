import { ROOT_ID, SEED_IDS, ancestorsOf, children, isLive, type FolderId, type FsState } from '../domain/fs';
import { LOC, type ShellLocation } from '../domain/locations';
import type { IconName } from '../ui/icons';
import { binIcon, folderIcon, sortItems, folderItem } from './items';

/**
 * The Folders tree follows XP's namespace: Desktop at the root, with My
 * Documents, My Computer (and the drive below it), My Network Places, the
 * Recycle Bin and the Desktop folder's own subfolders.
 * Node keys are slash-joined paths of node IDs from the root.
 */
export interface TreeChild {
  id: string;
  label: string;
  icon: IconName;
  location: ShellLocation;
  hasChildren: boolean;
}

export function treePathFor(fs: FsState, loc: ShellLocation): string[] {
  switch (loc.kind) {
    case 'desktop':
      return ['desktop'];
    case 'myComputer':
      return ['desktop', 'myComputer'];
    case 'network':
      return ['desktop', 'network'];
    case 'recycleBin':
      return ['desktop', 'recycleBin'];
    case 'search':
      return [];
    case 'folder': {
      if (!isLive(fs, loc.id)) return [];
      const chain = [loc.id, ...ancestorsOf(fs, loc.id)].reverse();
      const docs = chain.indexOf(SEED_IDS.myDocuments);
      if (docs >= 0) return ['desktop', ...chain.slice(docs)];
      const desk = chain.indexOf(SEED_IDS.desktop);
      if (desk >= 0 && loc.id !== SEED_IDS.desktop) return ['desktop', ...chain.slice(desk + 1)];
      return ['desktop', 'myComputer', ...chain];
    }
  }
}

export function treeKeyFor(fs: FsState, loc: ShellLocation): string {
  return treePathFor(fs, loc).join('/');
}

function sortedFolders(fs: FsState, parent: FolderId): TreeChild[] {
  const items = sortItems(
    children(fs, parent).map((n) => folderItem(fs, n.id)),
    { key: 'name', dir: 1 },
  );
  return items.map((item) => ({
    id: item.id,
    label: item.name,
    icon: folderIcon(item.id),
    location: LOC.folder(item.id),
    hasChildren: children(fs, item.id).length > 0,
  }));
}

export function treeRoot(): TreeChild {
  return { id: 'desktop', label: 'Desktop', icon: 'show-desktop', location: LOC.desktop, hasChildren: true };
}

export function treeChildren(fs: FsState, nodeId: string): TreeChild[] {
  switch (nodeId) {
    case 'desktop':
      return [
        {
          id: SEED_IDS.myDocuments,
          label: 'My Documents',
          icon: 'my-documents',
          location: LOC.folder(SEED_IDS.myDocuments),
          hasChildren: children(fs, SEED_IDS.myDocuments).length > 0,
        },
        { id: 'myComputer', label: 'My Computer', icon: 'my-computer', location: LOC.myComputer, hasChildren: true },
        { id: 'network', label: 'My Network Places', icon: 'network', location: LOC.network, hasChildren: false },
        { id: 'recycleBin', label: 'Recycle Bin', icon: binIcon(fs), location: LOC.recycleBin, hasChildren: false },
        ...sortedFolders(fs, SEED_IDS.desktop),
      ];
    case 'myComputer':
      return [{ id: ROOT_ID, label: 'Local Disk (C:)', icon: 'drive', location: LOC.folder(ROOT_ID), hasChildren: true }];
    case 'network':
    case 'recycleBin':
      return [];
    default:
      return isLive(fs, nodeId) ? sortedFolders(fs, nodeId) : [];
  }
}
