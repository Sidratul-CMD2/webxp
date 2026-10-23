import { useId, useMemo, useState, type ReactNode } from 'react';
import { ROOT_ID, SEED_IDS, isLive, isWritable } from '../../domain/fs';
import { LOC, locationContainer, locationParent, locationTitle, type ShellLocation } from '../../domain/locations';
import { useApp } from '../../state/app';
import { folderCommands, selectedItems, type Command } from '../../state/commands';
import {
  explorerSurface,
  navigate,
  scopeOptions,
  setSearchDraft,
  startSearch,
  stopSearch,
  toggleTreeNode,
  togglePane,
} from '../../state/explorerActions';
import { folderIcon, searchResultIds } from '../../state/items';
import { treeKeyFor, type TreeChild } from '../../state/tree';
import { launch } from '../../state/windowActions';
import { FolderTree } from '../../ui/FolderTree';
import { Icon, type IconName } from '../../ui/icons';
import { formatDateTime, plural } from '../../ui/format';

function TaskGroup({ title, special, children }: { title: string; special?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <section className={`task-group${special ? ' task-group--special' : ''}`}>
      <h3 className="task-group__header">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          <span>{title}</span>
          <span className={`task-group__chevron${open ? '' : ' is-collapsed'}`} aria-hidden="true" />
        </button>
      </h3>
      {open && (
        <div id={id} className="task-group__body">
          {children}
        </div>
      )}
    </section>
  );
}

function TaskLink({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button type="button" className="task-link" onClick={onClick}>
      <Icon name={icon} size={16} />
      <span>{label}</span>
    </button>
  );
}

const commandLink = (icon: IconName, label: string, command: Command) =>
  command.enabled ? <TaskLink key={label} icon={icon} label={label} onClick={command.run} /> : null;

function placeLink(windowId: string, loc: ShellLocation, label: string, icon: IconName) {
  return <TaskLink key={label} icon={icon} label={label} onClick={() => navigate(windowId, loc)} />;
}

export function TaskPane({ windowId }: { windowId: string }) {
  const state = useApp((s) => s);
  const explorer = state.explorers[windowId];
  const surface = explorerSurface(windowId);
  const fs = state.fs;
  const loc = explorer.location;
  const c = folderCommands(state, surface);
  const items = selectedItems(state, surface);
  const container = locationContainer(loc);
  const writable = !!container && isWritable(fs, container);

  const tasks: ReactNode[] = [];
  let tasksTitle = 'File and Folder Tasks';
  let special = false;
  if (loc.kind === 'recycleBin') {
    tasksTitle = 'Recycle Bin Tasks';
    special = true;
    tasks.push(commandLink('recycle-empty', 'Empty the Recycle Bin', c.emptyBin));
    if (items.length === 0) tasks.push(commandLink('restore', 'Restore all items', c.restoreAll));
    else tasks.push(commandLink('restore', items.length === 1 ? 'Restore this item' : 'Restore the selected items', c.restore));
  } else if (loc.kind === 'myComputer') {
    tasksTitle = 'System Tasks';
    special = true;
    tasks.push(<TaskLink key="settings" icon="control-panel" label="Change a setting" onClick={() => launch({ app: 'controlPanel' })} />);
  } else if (loc.kind === 'folder' || loc.kind === 'desktop') {
    const mutable = items.length > 0 && items.every((i) => i.mutable);
    if (items.length === 0 && writable) tasks.push(commandLink('new-folder', 'Make a new folder', c.newFolder));
    if (mutable && items.length === 1) {
      tasks.push(
        commandLink('rename', 'Rename this folder', c.rename),
        commandLink('move', 'Move this folder', c.moveTo),
        commandLink('copy', 'Copy this folder', c.copyTo),
        commandLink('delete', 'Delete this folder', c.delete),
      );
    } else if (mutable) {
      tasks.push(
        commandLink('move', 'Move the selected items', c.moveTo),
        commandLink('copy', 'Copy the selected items', c.copyTo),
        commandLink('delete', 'Delete the selected items', c.delete),
      );
    }
  }
  const visibleTasks = tasks.filter(Boolean);

  // Other Places: the parent first, then the standard places, never the current location twice.
  const placeList: { loc: ShellLocation; label: string; icon: IconName }[] = [];
  const parent = locationParent(loc, fs);
  const iconFor = (l: ShellLocation): IconName =>
    l.kind === 'folder' ? folderIcon(l.id) : l.kind === 'myComputer' ? 'my-computer' : l.kind === 'network' ? 'network' : 'show-desktop';
  if (parent) placeList.push({ loc: parent, label: locationTitle(fs, parent), icon: iconFor(parent) });
  placeList.push(
    { loc: LOC.desktop, label: 'Desktop', icon: 'show-desktop' },
    { loc: LOC.folder(SEED_IDS.myDocuments), label: 'My Documents', icon: 'my-documents' },
    { loc: LOC.myComputer, label: 'My Computer', icon: 'my-computer' },
    { loc: LOC.network, label: 'My Network Places', icon: 'network' },
  );
  const seen = new Set<string>([JSON.stringify(loc)]);
  const uniquePlaces: ReactNode[] = [];
  for (const p of placeList) {
    const key = JSON.stringify(p.loc);
    if (seen.has(key)) continue;
    seen.add(key);
    uniquePlaces.push(placeLink(windowId, p.loc, p.label, p.icon));
  }
  if (loc.kind === 'myComputer') uniquePlaces.push(<TaskLink key="cp" icon="control-panel" label="Control Panel" onClick={() => launch({ app: 'controlPanel' })} />);

  let details: ReactNode;
  if (items.length > 1) {
    details = <p>{plural(items.length, 'item')} selected.</p>;
  } else if (items.length === 1) {
    const it = items[0];
    details = (
      <>
        <p className="task-details__name">{it.name}</p>
        <p>{it.kind === 'bin' ? 'File Folder (deleted)' : it.type}</p>
        {it.kind === 'bin' && it.location && <p>Original location: {it.location}</p>}
        {it.modified !== null && <p>Date Modified: {formatDateTime(it.modified)}</p>}
      </>
    );
  } else {
    const isFolder = loc.kind === 'folder' && isLive(fs, loc.id);
    details = (
      <>
        <p className="task-details__name">{locationTitle(fs, loc)}</p>
        <p>{loc.kind === 'folder' ? (loc.id === ROOT_ID ? 'Local Disk' : 'File Folder') : 'System Folder'}</p>
        {isFolder && <p>Date Modified: {formatDateTime(fs.nodes[loc.id].modified)}</p>}
        {loc.kind === 'folder' && !writable && (
          <p className="task-details__note">This folder is a read-only part of the simulation. Create folders on the Desktop or in My Documents.</p>
        )}
        {loc.kind === 'network' && <p className="task-details__note">Networking is not simulated, so no network places are available.</p>}
      </>
    );
  }

  return (
    <div className="task-pane xp-scroll" role="complementary" aria-label="Tasks">
      {visibleTasks.length > 0 && (
        <TaskGroup title={tasksTitle} special={special}>
          {visibleTasks}
        </TaskGroup>
      )}
      <TaskGroup title="Other Places">{uniquePlaces}</TaskGroup>
      <TaskGroup title="Details">
        <div className="task-details">{details}</div>
      </TaskGroup>
    </div>
  );
}

export function SearchPane({ windowId }: { windowId: string }) {
  const explorer = useApp((s) => s.explorers[windowId]);
  const fs = useApp((s) => s.fs);
  const options = useApp((s) => scopeOptions(s, s.explorers[windowId]?.searchDraft.scopeId ?? ROOT_ID));
  const id = useId();
  const { searchDraft, search } = explorer;
  const running = search?.status === 'running';
  const count = search ? searchResultIds(fs, search).length : 0;
  return (
    <div className="search-pane xp-scroll" role="search" aria-label="Search Companion">
      <div className="search-pane__header">
        <span>Search Companion</span>
        <button type="button" className="pane-close" aria-label="Close Search pane" data-tip="Close" onClick={() => togglePane(windowId, 'search')}>
          ×
        </button>
      </div>
      <form
        className="search-pane__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running) startSearch(windowId);
        }}
      >
        <p className="search-pane__lead">Search by any or all of the criteria below.</p>
        <label htmlFor={`${id}-q`}>All or part of the folder name:</label>
        <input
          id={`${id}-q`}
          className="xp-input"
          value={searchDraft.query}
          maxLength={255}
          onChange={(e) => setSearchDraft(windowId, { query: e.target.value })}
        />
        <label htmlFor={`${id}-in`}>Look in:</label>
        <select id={`${id}-in`} className="xp-select" value={searchDraft.scopeId} onChange={(e) => setSearchDraft(windowId, { scopeId: e.target.value })}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {/* Separate buttons, so a late click on Stop can never restart a finished search. */}
        <div className="search-pane__buttons">
          <button type="button" className="xp-button" disabled={!running} title={running ? undefined : 'No search is running.'} onClick={() => stopSearch(windowId)}>
            Stop
          </button>
          <button type="submit" className="xp-button" disabled={running} title={running ? 'A search is already running.' : undefined}>
            Search
          </button>
        </div>
      </form>
      <div className="search-pane__status" role="status">
        {running && <p>Searching… {plural(search.found.length, 'folder')} found so far.</p>}
        {search?.status === 'done' && <p>Search is complete. {count === 0 ? 'There are no results to display.' : `There ${count === 1 ? 'is 1 result' : `are ${count} results`} to display.`}</p>}
        {search?.status === 'stopped' && <p>Search was stopped. Results may be incomplete ({plural(count, 'folder')} found).</p>}
      </div>
      <p className="search-pane__note">This simulation searches folder names only. There are no files, file contents or network locations to search.</p>
    </div>
  );
}

function folderForNode(node: TreeChild): string | null {
  if (node.location.kind === 'folder') return node.location.id;
  if (node.location.kind === 'desktop') return SEED_IDS.desktop;
  return null;
}

export function FoldersPane({ windowId }: { windowId: string }) {
  const fs = useApp((s) => s.fs);
  const expanded = useApp((s) => s.explorers[windowId].expanded);
  const location = useApp((s) => s.explorers[windowId].location);
  const selectedKey = useMemo(() => treeKeyFor(fs, location) || null, [fs, location]);
  return (
    <div className="folders-pane" role="complementary" aria-label="Folders">
      <div className="folders-pane__header">
        <span>Folders</span>
        <button type="button" className="pane-close" aria-label="Close Folders pane" data-tip="Close" onClick={() => togglePane(windowId, 'folders')}>
          ×
        </button>
      </div>
      <div className="folders-pane__tree xp-scroll">
        <FolderTree
          fs={fs}
          label="Folders"
          expanded={expanded}
          selectedKey={selectedKey}
          onToggle={(key, expand) => toggleTreeNode(windowId, key, expand)}
          onSelect={(_key, node) => navigate(windowId, node.location)}
          dropTarget={folderForNode}
          dropBin={(node) => node.id === 'recycleBin'}
        />
      </div>
    </div>
  );
}
