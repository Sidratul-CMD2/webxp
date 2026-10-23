import { useId, useMemo, useRef, useState } from 'react';
import { SEED_IDS, createFolder, isLive, isWritable, pathOf, type FolderId } from '../domain/fs';
import { LOC } from '../domain/locations';
import { resolveRun, runErrorMessage } from '../domain/run';
import { ask, closeModal, get, now, useApp } from '../state/app';
import { promptText } from '../state/dialogs';
import { browseForFolder, commitFs } from '../state/folderActions';
import { logOff, restart, standBy, turnOff, updatePrefs } from '../state/sessionActions';
import { treeKeyFor, type TreeChild } from '../state/tree';
import type { Modal } from '../state/types';
import { launch } from '../state/windowActions';
import { FolderTree } from '../ui/FolderTree';
import { Icon } from '../ui/icons';
import { ModalDialog, trapKeys, useInitialFocus } from '../ui/ModalDialog';

type Of<K extends Modal['kind']> = Extract<Modal, { kind: K }>;

function MessageBox({ modal }: { modal: Of<'message'> }) {
  const textId = useId();
  const done = (value: string) => {
    closeModal(modal.id);
    modal.resolve(value);
  };
  return (
    <ModalDialog title={modal.title} onCancel={() => done(modal.cancelValue)} describedBy={textId} className="msgbox">
      <div className="msgbox__content">
        {modal.icon && <Icon name={modal.icon} size={32} />}
        <div id={textId} className="msgbox__text">
          <p>{modal.text}</p>
          {modal.detail && <p className="msgbox__detail">{modal.detail}</p>}
        </div>
      </div>
      <div className="dialog-buttons dialog-buttons--center">
        {modal.buttons.map((b, i) => (
          <button key={b.value} type="button" className="xp-button" data-initial-focus={i === modal.focusIndex || undefined} onClick={() => done(b.value)}>
            {b.label}
          </button>
        ))}
      </div>
    </ModalDialog>
  );
}

function RunDialog({ modal }: { modal: Of<'run'> }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const descId = useId();
  const close = () => closeModal(modal.id);
  const submit = () => {
    const text = value.trim();
    if (!text) return;
    const target = resolveRun(get().fs, text);
    if (!target) {
      void ask({ title: text.slice(0, 60), text: runErrorMessage(text), icon: 'error' });
      return;
    }
    close();
    if (target.kind === 'location') {
      launch({ app: 'explorer', location: target.location });
      return;
    }
    switch (target.app) {
      case 'explorer':
        launch({ app: 'explorer', location: LOC.folder(SEED_IDS.myDocuments), pane: 'folders' });
        break;
      case 'calculator':
        launch({ app: 'calculator' });
        break;
      case 'controlPanel':
        launch({ app: 'controlPanel' });
        break;
      case 'ie':
        launch({ app: 'ie' });
        break;
      case 'help':
        launch({ app: 'help' });
        break;
    }
  };
  return (
    <ModalDialog title="Run" onCancel={close} describedBy={descId} className="run-dialog" width={347}>
      <div className="run-dialog__intro">
        <Icon name="run" size={32} />
        <p id={descId}>Type the name of a program or folder, and Windows will open it for you.</p>
      </div>
      <form
        className="run-dialog__row"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={`${descId}-open`}>
          <span className="mnemonic is-shown">O</span>pen:
        </label>
        <input
          id={`${descId}-open`}
          ref={inputRef}
          className="xp-input"
          value={value}
          autoComplete="off"
          spellCheck={false}
          maxLength={260}
          data-initial-focus
          onChange={(e) => setValue(e.target.value)}
        />
      </form>
      <div className="dialog-buttons">
        <button type="button" className="xp-button is-default" disabled={!value.trim()} title={value.trim() ? undefined : 'Type the name of a program or folder first.'} onClick={submit}>
          OK
        </button>
        <button type="button" className="xp-button" onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          className="xp-button"
          onClick={async () => {
            const id = await browseForFolder({ title: 'Browse For Folder', prompt: 'Select a folder to open.', okLabel: 'OK' });
            if (id && isLive(get().fs, id)) {
              setValue(pathOf(get().fs, id));
              inputRef.current?.focus();
            }
          }}
        >
          Browse…
        </button>
      </div>
    </ModalDialog>
  );
}

function folderForNode(node: TreeChild): FolderId | null {
  if (node.location.kind === 'folder') return node.location.id;
  if (node.location.kind === 'desktop') return SEED_IDS.desktop;
  return null;
}

function BrowseFolderDialog({ modal }: { modal: Of<'browseFolder'> }) {
  const fs = useApp((s) => s.fs);
  const initialKey = modal.initial && isLive(fs, modal.initial) ? treeKeyFor(fs, LOC.folder(modal.initial)) : 'desktop';
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [selected, setSelected] = useState<FolderId | null>(modal.initial && isLive(fs, modal.initial) ? modal.initial : SEED_IDS.desktop);
  const [expanded, setExpanded] = useState<string[]>(() => {
    const parts = initialKey.split('/');
    return [...parts.map((_, i) => parts.slice(0, i + 1).join('/')), 'desktop', 'desktop/myComputer'];
  });
  const [error, setError] = useState<string | null>(null);
  const descId = useId();
  const done = (value: FolderId | null) => {
    closeModal(modal.id);
    modal.resolve(value);
  };
  const include = useMemo(() => (node: TreeChild) => node.id !== 'network' && node.id !== 'recycleBin', []);
  const canCreate = !!selected && isWritable(fs, selected);
  return (
    <ModalDialog title={modal.title} onCancel={() => done(null)} describedBy={descId} className="browse-dialog" width={320}>
      <p id={descId} className="browse-dialog__prompt">
        {modal.prompt}
      </p>
      <div className="browse-dialog__tree xp-scroll">
        <FolderTree
          fs={fs}
          label="Folders"
          expanded={expanded}
          selectedKey={selectedKey}
          include={include}
          dim={(node) => {
            const id = folderForNode(node);
            return !id || !isWritable(fs, id);
          }}
          onToggle={(key, expand) =>
            setExpanded((list) => {
              const has = list.includes(key);
              const want = expand ?? !has;
              return want ? (has ? list : [...list, key]) : list.filter((k) => k !== key);
            })
          }
          onSelect={(key, node) => {
            setSelectedKey(key);
            setSelected(folderForNode(node));
            setError(null);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="dialog-buttons dialog-buttons--split">
        <button
          type="button"
          className="xp-button"
          disabled={!canCreate}
          title={canCreate ? undefined : 'Choose Desktop, My Documents or one of their folders first.'}
          data-tip={canCreate ? undefined : 'Choose Desktop, My Documents or one of their folders first.'}
          onClick={() => {
            if (!selected) return;
            const r = createFolder(get().fs, selected, now());
            if (!r.ok) {
              setError(r.error.message);
              return;
            }
            commitFs(r.fs, { label: 'New Folder' });
            const key = `${selectedKey}/${r.value}`;
            setExpanded((list) => (list.includes(selectedKey) ? list : [...list, selectedKey]));
            setSelectedKey(key);
            setSelected(r.value);
          }}
        >
          Make New Folder
        </button>
        <span className="dialog-buttons__gap" />
        <button
          type="button"
          className="xp-button is-default"
          disabled={!selected}
          title={selected ? undefined : 'Select a folder first.'}
          onClick={() => {
            if (!selected || !isLive(get().fs, selected)) return;
            const message = modal.validate(selected);
            if (message) setError(message);
            else done(selected);
          }}
        >
          {modal.okLabel}
        </button>
        <button type="button" className="xp-button" onClick={() => done(null)}>
          Cancel
        </button>
      </div>
    </ModalDialog>
  );
}

function PromptDialog({ modal }: { modal: Of<'prompt'> }) {
  const [value, setValue] = useState(modal.value);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const done = (v: string | null) => {
    closeModal(modal.id);
    modal.resolve(v);
  };
  const submit = () => {
    const message = modal.validate(value);
    if (message) setError(message);
    else done(value.trim());
  };
  return (
    <ModalDialog title={modal.title} onCancel={() => done(null)} width={340}>
      <form
        className="prompt-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={id}>{modal.label}</label>
        <input
          id={id}
          className="xp-input"
          value={value}
          maxLength={255}
          data-initial-focus
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        {error && (
          <p id={`${id}-err`} role="alert" className="field-error">
            {error}
          </p>
        )}
      </form>
      <div className="dialog-buttons">
        <button type="button" className="xp-button is-default" onClick={submit}>
          OK
        </button>
        <button type="button" className="xp-button" onClick={() => done(null)}>
          Cancel
        </button>
      </div>
    </ModalDialog>
  );
}

function OrganizeFavoritesDialog({ modal }: { modal: Of<'organizeFavorites'> }) {
  const favorites = useApp((s) => s.prefs.favorites);
  const fs = useApp((s) => s.fs);
  const [selected, setSelected] = useState<string | null>(favorites[0]?.id ?? null);
  const close = () => closeModal(modal.id);
  const current = favorites.find((f) => f.id === selected) ?? null;
  return (
    <ModalDialog title="Organize Favorites" onCancel={close} width={380}>
      <div className="organize">
        <p className="organize__intro">Favorites are bookmarks to folders in this simulation. Select one to rename or delete it.</p>
        <div className="organize__body">
          <ul className="organize__list xp-scroll" role="listbox" aria-label="Favorites">
            {favorites.length === 0 && <li className="organize__empty">(Empty)</li>}
            {favorites.map((f) => (
              <li
                key={f.id}
                role="option"
                aria-selected={f.id === selected}
                tabIndex={f.id === (selected ?? favorites[0]?.id) ? 0 : -1}
                className={f.id === selected ? 'is-selected' : ''}
                onClick={() => setSelected(f.id)}
                onKeyDown={(e) => {
                  const i = favorites.findIndex((x) => x.id === f.id);
                  const next = e.key === 'ArrowDown' ? favorites[i + 1] : e.key === 'ArrowUp' ? favorites[i - 1] : null;
                  if (next) {
                    e.preventDefault();
                    setSelected(next.id);
                    (e.currentTarget.parentElement?.children[i + (e.key === 'ArrowDown' ? 1 : -1)] as HTMLElement | undefined)?.focus();
                  }
                }}
              >
                <Icon name="folder" size={16} />
                <span>{f.name}</span>
                {!isLive(fs, f.folderId) && <span className="organize__missing"> (unavailable)</span>}
              </li>
            ))}
          </ul>
          <div className="organize__actions">
            <button
              type="button"
              className="xp-button"
              disabled={!current}
              title={current ? undefined : 'Select a favorite first.'}
              onClick={async () => {
                if (!current) return;
                const name = await promptText('Rename Favorite', 'New name:', current.name);
                if (name) updatePrefs((p) => ({ ...p, favorites: p.favorites.map((f) => (f.id === current.id ? { ...f, name } : f)) }));
              }}
            >
              Rename…
            </button>
            <button
              type="button"
              className="xp-button"
              disabled={!current}
              title={current ? undefined : 'Select a favorite first.'}
              onClick={() => {
                if (!current) return;
                updatePrefs((p) => ({ ...p, favorites: p.favorites.filter((f) => f.id !== current.id) }));
                setSelected(favorites.find((f) => f.id !== current.id)?.id ?? null);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      <div className="dialog-buttons">
        <button type="button" className="xp-button is-default" data-initial-focus onClick={close}>
          Close
        </button>
      </div>
    </ModalDialog>
  );
}

function AboutDialog({ modal }: { modal: Of<'about'> }) {
  const close = () => closeModal(modal.id);
  const id = useId();
  return (
    <ModalDialog title={`About ${modal.product}`} onCancel={close} describedBy={id} width={400}>
      <div className="about">
        <div className="about__banner">
          <Icon name="start-logo" size={40} />
          <div>
            <strong>XP Desktop Simulation</strong>
            <div>Version 1.0 · Blue Luna configuration</div>
          </div>
        </div>
        <div id={id} className="about__text">
          <p>
            {modal.product} is part of a browser-based recreation of a Windows XP Professional SP2-era desktop. It is not Microsoft Windows, does not run
            programs, and cannot change your computer. All folders exist only in this browser.
          </p>
          <p>Artwork is original and generated for this project; it is a substitute for, not a copy of, Microsoft artwork.</p>
        </div>
      </div>
      <div className="dialog-buttons">
        <button type="button" className="xp-button is-default" data-initial-focus onClick={close}>
          OK
        </button>
      </div>
    </ModalDialog>
  );
}

function SessionDialog({ modal, kind }: { modal: Modal; kind: 'turnOff' | 'logOff' }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => closeModal(modal.id);
  useInitialFocus(ref);
  const title = kind === 'turnOff' ? 'Turn off computer' : 'Log Off Windows';
  const act = (fn: () => void) => {
    close();
    fn();
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="session-dialog"
      onKeyDown={(e) => trapKeys(e, ref.current, close)}
    >
      <div className="session-dialog__header">
        <h2 id={titleId}>{title}</h2>
        <Icon name="start-logo" size={30} />
      </div>
      <div className="session-dialog__body">
        {kind === 'turnOff' ? (
          <>
            <button type="button" className="session-btn session-btn--standby" onClick={() => act(standBy)}>
              <span className="session-btn__orb" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="22" height="22">
                  <path d="M20 6a11 11 0 1 0 6 16A9 9 0 1 1 20 6z" fill="#fff" />
                </svg>
              </span>
              <span>Stand By</span>
            </button>
            <button type="button" className="session-btn session-btn--off" onClick={() => act(turnOff)}>
              <span className="session-btn__orb" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="22" height="22">
                  <path d="M11 9.5a9 9 0 1 0 10 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <path d="M16 5v10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
              <span>Turn Off</span>
            </button>
            <button type="button" className="session-btn session-btn--restart" onClick={() => act(restart)}>
              <span className="session-btn__orb" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="22" height="22">
                  <path d="M24 16a8 8 0 1 1-3-6.2" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <path d="M17.5 5.5l5.5 4-6 3z" fill="#fff" />
                </svg>
              </span>
              <span>Restart</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="session-btn session-btn--switch is-disabled"
              aria-disabled="true"
              data-tip="Not simulated: this desktop has a single local user."
              aria-describedby={`${titleId}-switch`}
            >
              <span className="session-btn__orb" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="22" height="22">
                  <circle cx="12" cy="11" r="4" fill="#fff" />
                  <circle cx="21" cy="13" r="3.5" fill="#fff" />
                  <path d="M5 25c0-5 3-8 7-8s7 3 7 8zM16 25c.5-4 2.5-6.5 5-6.5s5 2.5 5 6.5z" fill="#fff" />
                </svg>
              </span>
              <span>Switch User</span>
              <span id={`${titleId}-switch`} className="sr-only">
                Not simulated: this desktop has a single local user.
              </span>
            </button>
            <button type="button" className="session-btn session-btn--logoff" onClick={() => act(logOff)}>
              <span className="session-btn__orb" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="22" height="22">
                  <circle cx="12" cy="13" r="5" fill="none" stroke="#fff" strokeWidth="2.6" />
                  <path d="M15.5 16.5l8.5 8.5M21.5 22.5l2-2" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
                </svg>
              </span>
              <span>Log Off</span>
            </button>
          </>
        )}
      </div>
      <div className="session-dialog__footer">
        <button type="button" className="xp-button" data-initial-focus onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ModalView({ modal }: { modal: Modal }) {
  switch (modal.kind) {
    case 'message':
      return <MessageBox modal={modal} />;
    case 'run':
      return <RunDialog modal={modal} />;
    case 'browseFolder':
      return <BrowseFolderDialog modal={modal} />;
    case 'prompt':
      return <PromptDialog modal={modal} />;
    case 'organizeFavorites':
      return <OrganizeFavoritesDialog modal={modal} />;
    case 'about':
      return <AboutDialog modal={modal} />;
    case 'turnOff':
      return <SessionDialog modal={modal} kind="turnOff" />;
    case 'logOff':
      return <SessionDialog modal={modal} kind="logOff" />;
  }
}

export function ModalLayer() {
  const modals = useApp((s) => s.modals);
  const [flash, setFlash] = useState(0);
  if (!modals.length) return null;
  return (
    <div className={`modal-layer${flash % 2 ? ' is-flashing' : ''}`}>
      {modals.map((m, i) => {
        const top = i === modals.length - 1;
        return (
          <div key={m.id} className="modal-slot" inert={!top}>
            {top && (
              <div
                className="modal-backdrop"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setFlash((n) => n + 1);
                  setTimeout(() => setFlash((n) => n + 1), 180);
                }}
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
            <ModalView modal={m} />
          </div>
        );
      })}
    </div>
  );
}
