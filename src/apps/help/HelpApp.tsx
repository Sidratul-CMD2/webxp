import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApp } from '../../state/app';
import { resetSimulation } from '../../state/sessionActions';
import { openAbout } from '../../state/dialogs';
import { closeWindow } from '../../state/windowActions';
import { Icon } from '../../ui/icons';
import { MenuBar, type MenuBarMenu } from '../../ui/MenuBar';
import { ToolButton, Toolbar } from '../../ui/Toolbar';
import { ARTICLES, articleText } from './articles';

export function HelpApp({ windowId }: { windowId: string }) {
  const topic = useApp((s) => (s.params[windowId]?.topic as string | undefined) ?? 'home');
  const nonce = useApp((s) => s.params[windowId]?.nonce as number | undefined);
  const [history, setHistory] = useState<string[]>([topic]);
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[] | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const searchId = useId();
  const current = ARTICLES.find((a) => a.id === history[index]) ?? ARTICLES[0];

  const open = (id: string) => {
    const h = [...history.slice(0, index + 1), id];
    setHistory(h);
    setIndex(h.length - 1);
    setResults(null);
    requestAnimationFrame(() => articleRef.current?.focus());
  };

  useEffect(() => {
    if (!nonce) return;
    setHistory((h) => (h[h.length - 1] === topic ? h : [...h, topic]));
  }, [topic, nonce]);
  useEffect(() => setIndex(history.length - 1), [history.length]);

  const search = () => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      setResults(null);
      return;
    }
    setResults(ARTICLES.filter((a) => words.every((w) => articleText(a).toLowerCase().includes(w))).map((a) => a.id));
  };

  const menus: MenuBarMenu[] = useMemo(
    () => [
      { label: '&File', items: () => [{ id: 'close', label: '&Close', run: () => closeWindow(windowId) }] },
      {
        label: '&Help',
        items: () => [{ id: 'about', label: '&About Help and Support Center', run: () => openAbout('Help and Support Center') }],
      },
    ],
    [windowId],
  );

  return (
    <div className="help">
      <MenuBar menus={menus} ownerWindowId={windowId} />
      <div className="help__banner">
        <Toolbar label="Navigation" className="help__nav">
          <ToolButton icon="back" label="Back" showLabel disabled={index === 0} disabledReason="there is no previous page" onClick={() => setIndex(index - 1)} />
          <ToolButton icon="forward" label="Forward" disabled={index >= history.length - 1} disabledReason="there is no next page" onClick={() => setIndex(index + 1)} />
          <ToolButton icon="home" label="Home" showLabel onClick={() => open('home')} />
        </Toolbar>
        <div className="help__brand">
          <Icon name="help" size={32} />
          <span>
            Help and Support Center
            <small>Windows XP desktop simulation</small>
          </span>
        </div>
      </div>
      <form
        className="help__search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <label htmlFor={searchId}>Search</label>
        <input id={searchId} className="xp-input" value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="help__go" aria-label="Start searching">
          <Icon name="go" size={16} />
        </button>
      </form>
      <div className="help__body">
        <nav className="help__toc xp-scroll" aria-label={results ? 'Search results' : 'Help topics'}>
          <h2>{results ? `Search results (${results.length})` : 'Help topics'}</h2>
          {results && results.length === 0 && <p className="help__none">No topics matched your search.</p>}
          <ul>
            {(results ?? ARTICLES.map((a) => a.id)).map((id) => {
              const a = ARTICLES.find((x) => x.id === id)!;
              return (
                <li key={id}>
                  <button type="button" className={`help__topic${a.id === current.id ? ' is-current' : ''}`} aria-current={a.id === current.id ? 'page' : undefined} onClick={() => open(a.id)}>
                    <Icon name={a.icon} size={16} />
                    <span>{a.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {results && (
            <button type="button" className="link-button help__clear" onClick={() => setResults(null)}>
              Show all topics
            </button>
          )}
        </nav>
        <article ref={articleRef} className="help__article xp-scroll" tabIndex={-1} aria-labelledby={`${searchId}-title`} data-autofocus>
          <h2 id={`${searchId}-title`}>
            <Icon name={current.icon} size={32} />
            {current.title}
          </h2>
          {current.body({ open, reset: () => void resetSimulation() })}
        </article>
      </div>
    </div>
  );
}
