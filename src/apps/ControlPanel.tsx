import { useId, useState } from 'react';
import { closeWindow, launch, type LaunchTarget } from '../state/windowActions';
import { openAbout } from '../state/dialogs';
import { Icon, type IconName } from '../ui/icons';
import { MenuBar, type MenuBarMenu } from '../ui/MenuBar';
import { ToolButton, Toolbar } from '../ui/Toolbar';

interface Applet {
  id: string;
  label: string;
  icon: IconName;
  launch: LaunchTarget;
  description: string;
}

const APPLETS: Applet[] = [
  { id: 'accessibility', label: 'Accessibility Options', icon: 'accessibility', launch: { app: 'accessibility' }, description: 'Adjust contrast, control size and motion.' },
  { id: 'datetime', label: 'Date and Time', icon: 'date-time', launch: { app: 'dateTime' }, description: 'View the date, time and time zone.' },
  { id: 'display', label: 'Display', icon: 'display', launch: { app: 'display' }, description: 'Change the desktop background and text size.' },
  { id: 'folderoptions', label: 'Folder Options', icon: 'folder-options', launch: { app: 'folderOptions' }, description: 'Change how folders are shown and opened.' },
  { id: 'sounds', label: 'Sounds and Audio Devices', icon: 'sounds', launch: { app: 'sounds' }, description: 'Change the simulated volume settings.' },
  { id: 'taskbar', label: 'Taskbar and Start Menu', icon: 'taskbar', launch: { app: 'taskbarProps' }, description: 'Customize the Start menu and taskbar.' },
];

interface Category {
  id: string;
  label: string;
  icon: IconName;
  tasks?: { label: string; launch: LaunchTarget }[];
  applets?: string[];
}

const CATEGORIES: Category[] = [
  {
    id: 'appearance',
    label: 'Appearance and Themes',
    icon: 'appearance',
    tasks: [
      { label: 'Change the desktop background', launch: { app: 'display', tab: 'desktop' } },
      { label: 'Change the text size', launch: { app: 'display', tab: 'appearance' } },
      { label: 'View the screen resolution', launch: { app: 'display', tab: 'settings' } },
    ],
    applets: ['display', 'folderoptions', 'taskbar'],
  },
  { id: 'network', label: 'Network and Internet Connections', icon: 'network-connections' },
  { id: 'addremove', label: 'Add or Remove Programs', icon: 'add-remove' },
  {
    id: 'sounds',
    label: 'Sounds, Speech, and Audio Devices',
    icon: 'sounds',
    tasks: [{ label: 'Adjust the system volume', launch: { app: 'sounds' } }],
    applets: ['sounds'],
  },
  { id: 'performance', label: 'Performance and Maintenance', icon: 'performance' },
  { id: 'printers', label: 'Printers and Other Hardware', icon: 'printer' },
  { id: 'users', label: 'User Accounts', icon: 'user-accounts' },
  {
    id: 'datetime',
    label: 'Date, Time, Language, and Regional Options',
    icon: 'date-time',
    tasks: [{ label: 'View the date and time', launch: { app: 'dateTime' } }],
    applets: ['datetime'],
  },
  {
    id: 'accessibility',
    label: 'Accessibility Options',
    icon: 'accessibility',
    tasks: [
      { label: 'Adjust the contrast for text and colors on your screen', launch: { app: 'accessibility' } },
      { label: 'Use larger controls', launch: { app: 'accessibility' } },
    ],
    applets: ['accessibility'],
  },
  { id: 'security', label: 'Security Center', icon: 'security' },
];

const NOT_SIMULATED = 'Not simulated: this category has no settings in this desktop.';

type Page = { view: 'category'; category: string | null } | { view: 'classic' };

export function ControlPanelApp({ windowId }: { windowId: string }) {
  const [history, setHistory] = useState<Page[]>([{ view: 'category', category: null }]);
  const [index, setIndex] = useState(0);
  const page = history[index];
  const noteId = useId();
  const go = (next: Page) => {
    const h = [...history.slice(0, index + 1), next];
    setHistory(h);
    setIndex(h.length - 1);
  };
  const classic = page.view === 'classic';
  const category = page.view === 'category' && page.category ? CATEGORIES.find((c) => c.id === page.category) : null;

  const menus: MenuBarMenu[] = [
    { label: '&File', items: () => [{ id: 'close', label: '&Close', run: () => closeWindow(windowId) }] },
    {
      label: '&View',
      items: () => [
        { id: 'cat', label: '&Category View', radio: true, checked: !classic, run: () => go({ view: 'category', category: null }) },
        { id: 'classic', label: 'C&lassic View', radio: true, checked: classic, run: () => go({ view: 'classic' }) },
      ],
    },
    {
      label: '&Help',
      items: () => [
        { id: 'help', label: 'Help and Support &Center', run: () => launch({ app: 'help', topic: 'settings' }) },
        { kind: 'separator', id: 's' },
        { id: 'about', label: '&About Control Panel', run: () => openAbout('Control Panel') },
      ],
    },
  ];

  const appletLink = (a: Applet, big = false) => (
    <button key={a.id} type="button" className={`cp-applet${big ? ' cp-applet--big' : ''}`} onClick={() => launch(a.launch)} data-tip={a.description}>
      <Icon name={a.icon} size={32} />
      <span>{a.label}</span>
    </button>
  );

  return (
    <div className="explorer cp">
      <div className="explorer__bars">
        <MenuBar menus={menus} ownerWindowId={windowId} />
        <Toolbar label="Standard Buttons" className="explorer__toolbar">
          <ToolButton icon="back" label="Back" showLabel disabled={index === 0} disabledReason="there is no previous page" onClick={() => setIndex(index - 1)} />
          <ToolButton icon="forward" label="Forward" disabled={index >= history.length - 1} disabledReason="there is no next page" onClick={() => setIndex(index + 1)} />
          <ToolButton
            icon="up"
            label="Up"
            disabled={!category}
            disabledReason="this is the top of Control Panel"
            onClick={() => go({ view: 'category', category: null })}
          />
        </Toolbar>
        <div className="address-bar">
          <span className="address-bar__label">Address</span>
          <div className="address-bar__combo address-bar__combo--static">
            <Icon name="control-panel" size={16} />
            <span className="address-bar__text">{category ? category.label : 'Control Panel'}</span>
          </div>
        </div>
      </div>
      <div className="explorer__body">
        <div className="explorer__pane explorer__pane--tasks">
          <div className="task-pane xp-scroll" role="complementary" aria-label="Tasks">
            <section className="task-group task-group--special">
              <h3 className="task-group__header">
                <span className="task-group__static">Control Panel</span>
              </h3>
              <div className="task-group__body">
                <button
                  type="button"
                  className="task-link"
                  onClick={() => go(classic ? { view: 'category', category: null } : { view: 'classic' })}
                >
                  <Icon name="control-panel" size={16} />
                  <span>{classic ? 'Switch to Category View' : 'Switch to Classic View'}</span>
                </button>
              </div>
            </section>
            <section className="task-group">
              <h3 className="task-group__header">
                <span className="task-group__static">See Also</span>
              </h3>
              <div className="task-group__body">
                <button type="button" className="task-link" onClick={() => launch({ app: 'help', topic: 'settings' })}>
                  <Icon name="help" size={16} />
                  <span>Help and Support</span>
                </button>
              </div>
            </section>
          </div>
        </div>
        <div className="content cp-content xp-scroll" data-autofocus tabIndex={-1}>
          {classic && (
            <div className="cp-classic" role="list" aria-label="Control Panel icons">
              {APPLETS.map((a) => (
                <div role="listitem" key={a.id}>
                  {appletLink(a)}
                </div>
              ))}
            </div>
          )}
          {!classic && !category && (
            <>
              <h2 className="cp-heading">Pick a category</h2>
              <ul className="cp-categories">
                {CATEGORIES.map((c) => (
                  <li key={c.id}>
                    {c.applets ? (
                      <button type="button" className="cp-category" onClick={() => go({ view: 'category', category: c.id })}>
                        <Icon name={c.icon} size={32} />
                        <span>{c.label}</span>
                      </button>
                    ) : (
                      <button type="button" className="cp-category is-disabled" aria-disabled="true" aria-describedby={noteId} data-tip={NOT_SIMULATED}>
                        <Icon name={c.icon} size={32} />
                        <span>{c.label}</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p id={noteId} className="cp-note">
                Grayed categories are not simulated: this desktop has no networking, programs, printers, accounts or security settings.
              </p>
            </>
          )}
          {category && (
            <div className="cp-category-page">
              <h2 className="cp-heading cp-heading--cat">
                <Icon name={category.icon} size={32} />
                {category.label}
              </h2>
              <h3 className="cp-subheading">Pick a task…</h3>
              <ul className="cp-tasks">
                {category.tasks?.map((t) => (
                  <li key={t.label}>
                    <button type="button" className="link-button cp-task" onClick={() => launch(t.launch)}>
                      <span className="cp-task__bullet" aria-hidden="true" />
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
              <h3 className="cp-subheading">or pick a Control Panel icon</h3>
              <div className="cp-icons">{category.applets?.map((id) => appletLink(APPLETS.find((a) => a.id === id)!, true))}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
