import { useId } from 'react';
import { ROOT_ID, binEntry, descendantCount, isLive, isUserFolder, pathOf, type FolderId } from '../domain/fs';
import { showError, useApp } from '../state/app';
import { commitRename } from '../state/folderActions';
import { folderIcon } from '../state/items';
import { Icon } from '../ui/icons';
import { formatLongDate, plural } from '../ui/format';
import { PropertySheet, sheetKeyDown } from '../ui/PropertySheet';

export function FolderPropertiesApp({ windowId }: { windowId: string }) {
  const fs = useApp((s) => s.fs);
  const folderId = useApp((s) => s.params[windowId]?.folderId as FolderId | null);
  const binId = useApp((s) => s.params[windowId]?.binId as FolderId | null);
  const id = useId();

  if (binId) {
    const entry = binEntry(fs, binId);
    if (!entry) return null;
    const node = entry.nodes[binId];
    const count = Object.keys(entry.nodes).length - 1;
    return (
      <div className="applet" onKeyDown={sheetKeyDown(windowId)}>
        <PropertySheet
          windowId={windowId}
          readOnly
          committed={{}}
          apply={() => true}
          tabs={[
            {
              id: 'general',
              label: 'General',
              render: () => (
                <div className="props">
                  <div className="props__head">
                    <Icon name="folder" size={32} />
                    <span className="props__name">{node.name}</span>
                  </div>
                  <hr className="xp-hr" />
                  <dl className="readout">
                    <dt>Type:</dt>
                    <dd>File Folder (in the Recycle Bin)</dd>
                    <dt>Original location:</dt>
                    <dd>{entry.originalPath}</dd>
                    <dt>Contains:</dt>
                    <dd>{plural(count, 'folder')}</dd>
                  </dl>
                  <hr className="xp-hr" />
                  <dl className="readout">
                    <dt>Created:</dt>
                    <dd>{formatLongDate(node.created)}</dd>
                    <dt>Deleted:</dt>
                    <dd>{formatLongDate(entry.deletedAt)}</dd>
                  </dl>
                </div>
              ),
            },
          ]}
        />
      </div>
    );
  }

  if (!folderId || !isLive(fs, folderId)) return null;
  const node = fs.nodes[folderId];
  const renamable = isUserFolder(fs, folderId);
  const displayName = folderId === ROOT_ID ? 'Local Disk (C:)' : node.name;
  return (
    <div className="applet" onKeyDown={sheetKeyDown(windowId)}>
      <PropertySheet<{ name: string }>
        windowId={windowId}
        committed={{ name: displayName }}
        apply={(d) => {
          if (!renamable || d.name === node.name) return true;
          const error = commitRename(null, folderId, d.name);
          if (error) {
            void showError('Rename', error);
            return false;
          }
          return true;
        }}
        tabs={[
          {
            id: 'general',
            label: 'General',
            render: (d, update) => (
              <div className="props">
                <div className="props__head">
                  <Icon name={folderIcon(folderId)} size={32} />
                  <label htmlFor={`${id}-name`} className="sr-only">
                    Folder name
                  </label>
                  <input
                    id={`${id}-name`}
                    className="xp-input props__input"
                    value={d.name}
                    maxLength={255}
                    readOnly={!renamable}
                    aria-describedby={renamable ? undefined : `${id}-prot`}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </div>
                {!renamable && (
                  <p id={`${id}-prot`} className="field__note">
                    This is a protected system folder and cannot be renamed in this simulation.
                  </p>
                )}
                <hr className="xp-hr" />
                <dl className="readout">
                  <dt>Type:</dt>
                  <dd>{folderId === ROOT_ID ? 'Local Disk' : 'File Folder'}</dd>
                  <dt>Location:</dt>
                  <dd>{node.parentId ? pathOf(fs, node.parentId) : 'My Computer'}</dd>
                  <dt>Path:</dt>
                  <dd>{pathOf(fs, folderId)}</dd>
                  <dt>Contains:</dt>
                  <dd>{plural(descendantCount(fs, folderId), 'folder')}, 0 files</dd>
                </dl>
                <hr className="xp-hr" />
                <dl className="readout">
                  <dt>Created:</dt>
                  <dd>{formatLongDate(node.created)}</dd>
                  <dt>Modified:</dt>
                  <dd>{formatLongDate(node.modified)}</dd>
                </dl>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
