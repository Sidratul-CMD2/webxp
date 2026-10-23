import { useEffect, useId, useState } from 'react';
import {
  HOME_ROUTE,
  pageAddress,
  pageTitle,
  resolveBrowserAddress,
  type BrowserPage,
  type BrowserRoute,
} from '../domain/browserRoutes';
import { useApp } from '../state/app';
import { openAbout } from '../state/dialogs';
import { closeWindow, launch, setWindowTitle } from '../state/windowActions';
import { Icon } from '../ui/icons';
import { MenuBar, type MenuBarMenu } from '../ui/MenuBar';
import { ToolButton, Toolbar } from '../ui/Toolbar';

const NOT_SIMULATED = 'Not simulated: this browser has no Internet connection.';

/** Local IE6-style shell. Pages are bundled React content; no iframe, navigation or network request. */
export function BrowserApp({ windowId }: { windowId: string }) {
  const route = useApp((s) => s.params[windowId]?.route as BrowserRoute | undefined);
  const nonce = useApp((s) => s.params[windowId]?.nonce as number | undefined);
  const [history, setHistory] = useState<BrowserPage[]>([{ route: route ?? HOME_ROUTE }]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState(pageAddress(history[0]));
  const [showStatus, setShowStatus] = useState(true);
  const id = useId();
  const page = history[index];

  const open = (next: BrowserPage) => {
    const h = [...history.slice(0, index + 1), next];
    setHistory(h);
    setIndex(h.length - 1);
  };

  // A relaunch with a requested route (e.g. Help > browser topic) navigates the existing window.
  useEffect(() => {
    if (route && nonce) setHistory((h) => (h[h.length - 1]?.route === route ? h : [...h, { route }]));
  }, [route, nonce]);
  useEffect(() => setIndex(history.length - 1), [history.length]);
  useEffect(() => {
    setDraft(pageAddress(page));
    setWindowTitle(windowId, `${pageTitle(page)} - Internet Explorer`);
  }, [page, windowId]);

  const menus: MenuBarMenu[] = [
    { label: '&File', items: () => [{ id: 'close', label: '&Close', run: () => closeWindow(windowId) }] },
    {
      label: '&View',
      items: () => [
        { id: 'status', label: 'Status &Bar', checked: showStatus, run: () => setShowStatus((v) => !v) },
        { kind: 'separator', id: 's' },
        { id: 'refresh', label: '&Refresh', run: () => setHistory((h) => [...h]) },
      ],
    },
    {
      label: 'F&avorites',
      items: () => [{ id: 'add', label: '&Add to Favorites…', disabled: NOT_SIMULATED }],
    },
    {
      label: '&Tools',
      items: () => [{ id: 'options', label: 'Internet &Options…', disabled: NOT_SIMULATED }],
    },
    {
      label: '&Help',
      items: () => [
        { id: 'help', label: '&Help Topics', run: () => launch({ app: 'help', topic: 'browser' }) },
        { kind: 'separator', id: 's' },
        { id: 'about', label: '&About Internet Explorer', run: () => openAbout('Internet Explorer') },
      ],
    },
  ];

  const go = () => open(resolveBrowserAddress(draft));

  return (
    <div className="browser">
      <div className="explorer__bars">
        <MenuBar menus={menus} ownerWindowId={windowId} />
        <Toolbar label="Standard Buttons" className="explorer__toolbar">
          <ToolButton icon="back" label="Back" showLabel disabled={index === 0} disabledReason="there is no previous page" onClick={() => setIndex(index - 1)} />
          <ToolButton icon="forward" label="Forward" disabled={index >= history.length - 1} disabledReason="there is no next page" onClick={() => setIndex(index + 1)} />
          <ToolButton icon="stop" label="Stop" disabled disabledReason="nothing is loading" onClick={() => undefined} />
          <ToolButton icon="refresh" label="Refresh" onClick={() => setHistory((h) => [...h])} />
          <ToolButton icon="home" label="Home" onClick={() => open({ route: HOME_ROUTE })} />
        </Toolbar>
        <div className="address-bar">
          <label htmlFor={id} className="address-bar__label">
            A<span className="mnemonic">d</span>dress
          </label>
          <div className="address-bar__combo">
            <Icon name="browser" size={16} />
            <input
              id={id}
              className="address-bar__input"
              value={draft}
              spellCheck={false}
              autoComplete="off"
              maxLength={2048}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  go();
                } else if (e.key === 'Escape') setDraft(pageAddress(page));
              }}
            />
          </div>
          <button type="button" className="address-bar__go" onClick={go} aria-label="Go to the typed address">
            <Icon name="go" size={16} />
            <span>Go</span>
          </button>
        </div>
      </div>
      <article className="browser__page xp-scroll" data-autofocus tabIndex={-1} aria-label={pageTitle(page)}>
        <BrowserPageView page={page} open={open} />
      </article>
      {showStatus && (
        <div className="status-bar" role="status">
          <span className="status-bar__panel status-bar__panel--main">
            <Icon name="browser" size={16} /> Done
          </span>
          <span className="status-bar__panel status-bar__panel--zone">
            <Icon name="my-computer" size={16} />
            <span>My Computer</span>
          </span>
        </div>
      )}
    </div>
  );
}

function BrowserPageView({ page, open }: { page: BrowserPage; open: (p: BrowserPage) => void }) {
  if (page.route === 'welcome') {
    return (
      <div className="web web--welcome">
        <h1>Welcome</h1>
        <p>
          This browser window is part of the desktop simulation. It shows a few pages that are bundled with the simulation and never connects to the
          Internet.
        </p>
        <h2>Things to try on the desktop</h2>
        <ul>
          <li>Open My Documents and use “Make a new folder” in the task pane.</li>
          <li>Drag folders between Explorer windows, or use Cut and Paste.</li>
          <li>Delete a folder, then restore it from the Recycle Bin.</li>
          <li>Change the wallpaper in Display Properties.</li>
        </ul>
        <p>
          <button type="button" className="link-button" onClick={() => open({ route: 'help' })}>
            How this browser works
          </button>
          {' · '}
          <button type="button" className="link-button" onClick={() => launch({ app: 'help' })}>
            Open Help and Support
          </button>
        </p>
      </div>
    );
  }
  if (page.route === 'help') {
    return (
      <div className="web">
        <h1>Using This Browser</h1>
        <p>Type one of these addresses in the Address bar and press Enter:</p>
        <ul>
          <li>
            <code>about:welcome</code> — the welcome page (also the Home button)
          </li>
          <li>
            <code>about:help</code> — this page
          </li>
        </ul>
        <p>Back, Forward, Refresh and Home work between these pages. Any other address shows a local explanation page; no website is ever loaded.</p>
        <p>
          <button type="button" className="link-button" onClick={() => open({ route: 'welcome' })}>
            Back to the Welcome page
          </button>
        </p>
      </div>
    );
  }
  if (page.route !== 'error') return null;
  return (
    <div className="web web--error">
      <div className="web-error__head">
        <Icon name="info" size={32} />
        <h1>The page cannot be displayed</h1>
      </div>
      <p>
        The address <strong className="web-error__address">{page.address || '(blank)'}</strong> is not part of this simulation.
      </p>
      <hr className="xp-hr" />
      <p>This browser only shows pages bundled with the desktop simulation. It does not connect to the Internet or load other websites.</p>
      <ul>
        <li>
          <button type="button" className="link-button" onClick={() => open({ route: 'welcome' })}>
            Go to the Welcome page
          </button>
        </li>
        <li>
          <button type="button" className="link-button" onClick={() => open({ route: 'help' })}>
            See which addresses work
          </button>
        </li>
      </ul>
    </div>
  );
}
