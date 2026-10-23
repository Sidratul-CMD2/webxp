import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { WALLPAPERS, WALLPAPER_POSITIONS, type MotionMode, type Prefs, type TextScale, type WallpaperId, type WallpaperPosition } from '../domain/prefs';
import { useApp } from '../state/app';
import { resetSimulation, updatePrefs } from '../state/sessionActions';
import { WALLPAPER_NAMES, wallpaperStyle } from '../shell/Desktop';
import { Icon } from '../ui/icons';
import { PropertySheet, sheetKeyDown, type SheetTab } from '../ui/PropertySheet';

function Check({ label, checked, onChange, disabled, note }: { label: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: string; note?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label className="xp-check" data-tip={disabled}>
        <input type="checkbox" checked={checked} disabled={!!disabled} aria-describedby={disabled || note ? id : undefined} onChange={(e) => onChange?.(e.target.checked)} />
        <span>{label}</span>
      </label>
      {(disabled || note) && (
        <span id={id} className={disabled ? 'sr-only' : 'field__note'}>
          {disabled ?? note}
        </span>
      )}
    </div>
  );
}

function Radio({ name, label, checked, onChange, disabled }: { name: string; label: string; checked: boolean; onChange?: () => void; disabled?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label className="xp-radio" data-tip={disabled}>
        <input type="radio" name={name} checked={checked} disabled={!!disabled} aria-describedby={disabled ? id : undefined} onChange={() => onChange?.()} />
        <span>{label}</span>
      </label>
      {disabled && (
        <span id={id} className="sr-only">
          {disabled}
        </span>
      )}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="sheet-note">
      <Icon name="info" size={16} />
      <span>{children}</span>
    </p>
  );
}

function Monitor({ style, children }: { style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className="monitor" aria-hidden="true">
      <div className="monitor__screen" style={style}>
        {children}
      </div>
      <div className="monitor__stand" />
    </div>
  );
}

const NOT_SIMULATED = 'Not simulated in this desktop.';

// ---------------------------------------------------------------- Display

type DisplayDraft = Pick<Prefs, 'wallpaper' | 'wallpaperPosition' | 'backgroundColor' | 'textScale'>;

const SWATCHES = ['#3a6ea5', '#004e98', '#008080', '#2f6f2f', '#5a4a7a', '#7a2f2f', '#000000', '#404040', '#808080', '#a0a0a0', '#d4d0c8', '#c0a060'];

export function DisplayApplet({ windowId }: { windowId: string }) {
  const prefs = useApp((s) => s.prefs);
  const viewport = useApp((s) => s.viewport);
  const tab = useApp((s) => s.params[windowId]?.tab as string | undefined);
  const nonce = useApp((s) => s.params[windowId]?.nonce as number | undefined);
  const committed: DisplayDraft = {
    wallpaper: prefs.wallpaper,
    wallpaperPosition: prefs.wallpaperPosition,
    backgroundColor: prefs.backgroundColor,
    textScale: prefs.textScale,
  };
  const listId = useId();
  const tabs: SheetTab<DisplayDraft>[] = [
    {
      id: 'themes',
      label: 'Themes',
      render: (d) => (
        <>
          <p>A theme is a background plus a set of colors and other elements to help you personalize your desktop.</p>
          <label className="field field--row">
            <span>Theme:</span>
            <select className="xp-select" value="xp" onChange={() => undefined} aria-describedby={`${listId}-theme`}>
              <option value="xp">Windows XP (blue)</option>
            </select>
          </label>
          <span id={`${listId}-theme`} className="sr-only">
            Other themes are not simulated.
          </span>
          <Monitor style={wallpaperStyle(d)}>
            <div className="monitor__window" />
          </Monitor>
          <Note>Only the blue Luna theme is available in this simulation.</Note>
        </>
      ),
    },
    {
      id: 'desktop',
      label: 'Desktop',
      render: (d, update) => (
        <>
          <Monitor style={wallpaperStyle(d)} />
          <div className="desktop-tab">
            <div className="field">
              <label id={`${listId}-bg`}>Background:</label>
              <select
                className="bg-list xp-scroll"
                size={5}
                aria-labelledby={`${listId}-bg`}
                value={d.wallpaper}
                onChange={(e) => update({ wallpaper: e.target.value as WallpaperId })}
              >
                {WALLPAPERS.map((w) => (
                  <option key={w} value={w}>
                    {WALLPAPER_NAMES[w]}
                  </option>
                ))}
              </select>
            </div>
            <div className="desktop-tab__side">
              <label className="field">
                <span>Position:</span>
                <select
                  className="xp-select"
                  value={d.wallpaperPosition}
                  disabled={d.wallpaper === 'none'}
                  title={d.wallpaper === 'none' ? 'Choose a background picture first.' : undefined}
                  onChange={(e) => update({ wallpaperPosition: e.target.value as WallpaperPosition })}
                >
                  {WALLPAPER_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="swatches">
                <legend>Color:</legend>
                {SWATCHES.map((c) => (
                  <label key={c} className={`swatch${d.backgroundColor === c ? ' is-selected' : ''}`} style={{ background: c }}>
                    <input type="radio" name={`${listId}-color`} className="sr-only" checked={d.backgroundColor === c} onChange={() => update({ backgroundColor: c })} />
                    <span className="sr-only">{c}</span>
                  </label>
                ))}
              </fieldset>
            </div>
          </div>
          <p className="sheet-small">Hillside is an original substitute image, not the Windows XP “Bliss” photograph.</p>
        </>
      ),
    },
    {
      id: 'appearance',
      label: 'Appearance',
      render: (d, update) => (
        <>
          <div className="appearance-preview" aria-hidden="true">
            <div className="appearance-preview__window">
              <div className="appearance-preview__title">Active Window</div>
              <div className="appearance-preview__body" style={{ fontSize: d.textScale === 'normal' ? 11 : d.textScale === 'large' ? 13 : 15 }}>
                Window Text
              </div>
            </div>
          </div>
          <label className="field field--row">
            <span>Windows and buttons:</span>
            <select className="xp-select" value="xp" onChange={() => undefined}>
              <option value="xp">Windows XP style</option>
            </select>
          </label>
          <label className="field field--row">
            <span>Color scheme:</span>
            <select className="xp-select" value="blue" onChange={() => undefined}>
              <option value="blue">Default (blue)</option>
            </select>
          </label>
          <label className="field field--row">
            <span>Font size:</span>
            <select className="xp-select" value={d.textScale} onChange={(e) => update({ textScale: e.target.value as TextScale })}>
              <option value="normal">Normal</option>
              <option value="large">Large Fonts</option>
              <option value="extraLarge">Extra Large Fonts</option>
            </select>
          </label>
          <Note>Larger fonts scale text throughout this simulation. Increased contrast and larger controls are in Accessibility Options.</Note>
        </>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      render: () => (
        <>
          <Monitor style={wallpaperStyle(prefs)} />
          <dl className="readout">
            <dt>Display:</dt>
            <dd>Browser viewport</dd>
            <dt>Screen area:</dt>
            <dd>
              {viewport.w} by {viewport.h} pixels
            </dd>
            <dt>Color quality:</dt>
            <dd>Highest (32 bit)</dd>
          </dl>
          <Note>These values describe your browser window. This simulation cannot change your screen resolution or colors; use your browser’s zoom to change size.</Note>
        </>
      ),
    },
  ];
  return (
    <div className="applet" onKeyDown={sheetKeyDown(windowId)}>
      <PropertySheet
        key={nonce}
        windowId={windowId}
        tabs={tabs}
        committed={committed}
        initialTab={tab}
        apply={(d) => updatePrefs((p) => ({ ...p, ...d }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Taskbar and Start Menu

interface TaskbarDraft {
  autoHide: boolean;
  grouping: boolean;
  quickLaunch: boolean;
  showClock: boolean;
  clearRecent: boolean;
}

export function TaskbarApplet({ windowId }: { windowId: string }) {
  const tb = useApp((s) => s.prefs.taskbar);
  const recentCount = useApp((s) => s.prefs.recentApps.length);
  const committed: TaskbarDraft = { ...tb, clearRecent: false };
  const tabs: SheetTab<TaskbarDraft>[] = [
    {
      id: 'taskbar',
      label: 'Taskbar',
      render: (d, update) => (
        <>
          <div className="taskbar-preview" aria-hidden="true">
            <span className="taskbar-preview__start">start</span>
            {d.quickLaunch && <span className="taskbar-preview__ql" />}
            <span className="taskbar-preview__btn">{d.grouping ? '2 Windows Explorer' : 'My Documents'}</span>
            {!d.grouping && <span className="taskbar-preview__btn">My Computer</span>}
            <span className="taskbar-preview__tray">{d.showClock ? '1:30 PM' : ''}</span>
          </div>
          <fieldset className="xp-group">
            <legend>Taskbar appearance</legend>
            <Check label="Auto-hide the taskbar" checked={d.autoHide} onChange={(v) => update({ autoHide: v })} />
            <Check label="Group similar taskbar buttons" checked={d.grouping} onChange={(v) => update({ grouping: v })} />
            <Check label="Show Quick Launch" checked={d.quickLaunch} onChange={(v) => update({ quickLaunch: v })} />
          </fieldset>
          <fieldset className="xp-group">
            <legend>Notification area</legend>
            <Check label="Show the clock" checked={d.showClock} onChange={(v) => update({ showClock: v })} />
          </fieldset>
          <Note>The taskbar always stays at the bottom of the screen in this simulation.</Note>
        </>
      ),
    },
    {
      id: 'start',
      label: 'Start Menu',
      render: (d, update) => (
        <>
          <Radio name="startstyle" label="Start menu" checked onChange={() => undefined} />
          <p className="sheet-indent">Select this menu style for easy access to the Internet, programs you use often and the folders on this computer.</p>
          <Radio name="startstyle" label="Classic Start menu" checked={false} disabled={NOT_SIMULATED} />
          <fieldset className="xp-group">
            <legend>Programs</legend>
            <p>The Start menu lists programs you used recently.</p>
            <button
              type="button"
              className="xp-button"
              disabled={d.clearRecent || recentCount === 0}
              title={d.clearRecent ? 'The list will be cleared when you click OK or Apply.' : recentCount === 0 ? 'The list is already empty.' : undefined}
              onClick={() => update({ clearRecent: true })}
            >
              Clear List
            </button>
            {d.clearRecent && <p className="field__note">The list will be cleared when you click OK or Apply.</p>}
          </fieldset>
        </>
      ),
    },
  ];
  return (
    <div className="applet" onKeyDown={sheetKeyDown(windowId)}>
      <PropertySheet
        windowId={windowId}
        tabs={tabs}
        committed={committed}
        apply={(d) =>
          updatePrefs((p) => ({
            ...p,
            taskbar: { autoHide: d.autoHide, grouping: d.grouping, quickLaunch: d.quickLaunch, showClock: d.showClock },
            recentApps: d.clearRecent ? [] : p.recentApps,
          }))
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- Sounds

type SoundDraft = Prefs['sound'];

export function SoundsApplet({ windowId }: { windowId: string }) {
  const sound = useApp((s) => s.prefs.sound);
  const id = useId();
  const tabs: SheetTab<SoundDraft>[] = [
    {
      id: 'volume',
      label: 'Volume',
      render: (d, update) => (
        <>
          <div className="sounds-head">
            <Icon name={d.muted ? 'volume-muted' : 'sounds'} size={32} />
            <span>Simulated audio device</span>
          </div>
          <fieldset className="xp-group">
            <legend>Device volume</legend>
            <div className="slider-row">
              <span aria-hidden="true">Low</span>
              <input
                id={`${id}-vol`}
                type="range"
                className="xp-slider"
                min={0}
                max={100}
                step={5}
                value={d.volume}
                aria-label="Device volume"
                aria-valuetext={`${d.volume}%`}
                disabled={d.muted}
                title={d.muted ? 'Clear Mute to change the volume.' : undefined}
                onChange={(e) => update({ volume: Number(e.target.value) })}
              />
              <span aria-hidden="true">High</span>
            </div>
            <Check label="Mute" checked={d.muted} onChange={(v) => update({ muted: v })} />
            <Check label="Place volume icon in the taskbar" checked={d.showTrayIcon} onChange={(v) => update({ showTrayIcon: v })} />
          </fieldset>
          <Note>This simulation does not play sounds and never changes your computer’s volume. These settings control only the simulated volume icon.</Note>
        </>
      ),
    },
  ];
  return (
    <div className="applet" onKeyDown={sheetKeyDown(windowId)}>
      <PropertySheet windowId={windowId} tabs={tabs} committed={sound} apply={(d) => updatePrefs((p) => ({ ...p, sound: d }))} />
    </div>
  );
}

/** Tray volume popup: simulation-only slider and mute. */
export function VolumePopup() {
  const sound = useApp((s) => s.prefs.sound);
  const barH = useApp((s) => (s.prefs.largerControls ? 36 : 30));
  const id = useId();
  return (
    <div className="volume-popup" role="dialog" aria-label="Volume" style={{ bottom: barH + 2 }}>
      <p className="volume-popup__title">Volume</p>
      <input
        id={id}
        type="range"
        className="xp-slider xp-slider--vertical"
        min={0}
        max={100}
        step={5}
        value={sound.volume}
        aria-label="Volume"
        aria-valuetext={`${sound.volume}%`}
        data-initial-focus
        autoFocus
        onChange={(e) => {
          const volume = Number(e.target.value);
          updatePrefs((p) => ({ ...p, sound: { ...p.sound, volume } }));
        }}
      />
      <label className="xp-check">
        <input type="checkbox" checked={sound.muted} onChange={(e) => updatePrefs((p) => ({ ...p, sound: { ...p.sound, muted: e.target.checked } }))} />
        <span>Mute</span>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------- Date and Time

function Calendar({ year, month }: { year: number; month: number }) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (
    <table className="calendar" aria-label={first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}>
      <thead>
        <tr>
          {names.map((n, i) => (
            <th key={i} scope="col" abbr={long[i]}>
              {n}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((w, i) => (
          <tr key={i}>
            {w.map((d, j) => {
              const isToday = d !== null && today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
              return (
                <td key={j} className={isToday ? 'is-today' : ''} aria-current={isToday ? 'date' : undefined}>
                  {d ?? ''}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AnalogClock({ time }: { time: Date }) {
  const h = (time.getHours() % 12) * 30 + time.getMinutes() * 0.5;
  const m = time.getMinutes() * 6;
  const s = time.getSeconds() * 6;
  return (
    <svg className="analog-clock" viewBox="0 0 100 100" width="110" height="110" aria-hidden="true">
      <circle cx="50" cy="50" r="47" fill="#fff" stroke="#7f9db9" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="48.5" y="6" width="3" height="7" fill={i % 3 === 0 ? '#0a246a' : '#7f9db9'} transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <line x1="50" y1="50" x2="50" y2="26" stroke="#0a246a" strokeWidth="5" strokeLinecap="round" transform={`rotate(${h} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="14" stroke="#0a246a" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${m} 50 50)`} />
      <line x1="50" y1="56" x2="50" y2="12" stroke="#c00" strokeWidth="1.2" transform={`rotate(${s} 50 50)`} />
      <circle cx="50" cy="50" r="3" fill="#0a246a" />
    </svg>
  );
}

export function DateTimeApplet({ windowId }: { windowId: string }) {
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const id = useId();
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const months = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }));
  const tabs: SheetTab<Record<string, never>>[] = [
    {
      id: 'datetime',
      label: 'Date & Time',
      render: () => (
        <div className="datetime">
          <fieldset className="xp-group datetime__date">
            <legend>Date</legend>
            <div className="datetime__nav">
              <button type="button" className="xp-button xp-button--small" aria-label="Previous month" onClick={() => setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 }))}>
                ‹
              </button>
              <select className="xp-select" aria-label="Month" value={view.month} onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}>
                {months.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                className="xp-input datetime__year"
                type="number"
                aria-label="Year"
                min={1601}
                max={9999}
                value={view.year}
                onChange={(e) => {
                  const year = Number(e.target.value);
                  if (Number.isInteger(year) && year >= 1601 && year <= 9999) setView((v) => ({ ...v, year }));
                }}
              />
              <button type="button" className="xp-button xp-button--small" aria-label="Next month" onClick={() => setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }))}>
                ›
              </button>
            </div>
            <Calendar year={view.year} month={view.month} />
          </fieldset>
          <fieldset className="xp-group datetime__time">
            <legend>Time</legend>
            <AnalogClock time={now} />
            <output className="xp-input datetime__digital" aria-label="Current time" id={id}>
              {now.toLocaleTimeString()}
            </output>
          </fieldset>
          <Note>This shows your computer’s local date and time. The clock cannot be changed from this simulation.</Note>
        </div>
      ),
    },
    {
      id: 'zone',
      label: 'Time Zone',
      render: () => (
        <>
          <dl className="readout">
            <dt>Time zone:</dt>
            <dd>{zone}</dd>
            <dt>Current offset:</dt>
            <dd>{now.toLocaleTimeString(undefined, { timeZoneName: 'long' }).split(' ').slice(2).join(' ') || zone}</dd>
          </dl>
          <Note>The time zone comes from your browser and is shown for reference only.</Note>
        </>
      ),
    },
  ];
  return (
    <div className="applet" onKeyDown={sheetKeyDown(windowId)}>
      <PropertySheet windowId={windowId} tabs={tabs} committed={{}} apply={() => true} />
    </div>
  );
}

// ---------------------------------------------------------------- Accessibility

type A11yDraft = Pick<Prefs, 'highContrast' | 'largerControls' | 'motion'>;

export function AccessibilityApplet({ windowId }: { windowId: string }) {
  const prefs = useApp((s) => s.prefs);
  const committed: A11yDraft = { highContrast: prefs.highContrast, largerControls: prefs.largerControls, motion: prefs.motion };
  const tabs: SheetTab<A11yDraft>[] = [
    {
      id: 'display',
      label: 'Display',
      render: (d, update) => (
        <>
          <fieldset className="xp-group">
            <legend>Contrast</legend>
            <Check label="Use increased contrast" checked={d.highContrast} onChange={(v) => update({ highContrast: v })} note="Darker text, borders and stronger focus outlines throughout the simulation." />
          </fieldset>
          <fieldset className="xp-group">
            <legend>Controls</legend>
            <Check label="Use larger controls" checked={d.largerControls} onChange={(v) => update({ largerControls: v })} note="Taller title bars, buttons, menus and taskbar for easier pointing and touch." />
          </fieldset>
          <fieldset className="xp-group">
            <legend>Motion</legend>
            {(['system', 'reduce', 'allow'] as MotionMode[]).map((m) => (
              <Radio
                key={m}
                name="motion"
                label={m === 'system' ? 'Follow my browser’s motion setting' : m === 'reduce' ? 'Reduce motion' : 'Allow animations'}
                checked={d.motion === m}
                onChange={() => update({ motion: m })}
              />
            ))}
          </fieldset>
        </>
      ),
    },
    {
      id: 'general',
      label: 'General',
      render: () => (
        <>
          <fieldset className="xp-group">
            <legend>Reset</legend>
            <p>Erase all folders you created, empty the Recycle Bin and restore every setting in this simulation to its original state. Only this simulation’s data in this browser is affected.</p>
            <button type="button" className="xp-button" onClick={() => void resetSimulation()}>
              Reset Simulation…
            </button>
          </fieldset>
          <Note>Text size is set on the Appearance tab of Display Properties. Browser zoom also works throughout.</Note>
        </>
      ),
    },
  ];
  return (
    <div className="applet" onKeyDown={sheetKeyDown(windowId)}>
      <PropertySheet windowId={windowId} tabs={tabs} committed={committed} apply={(d) => updatePrefs((p) => ({ ...p, ...d }))} />
    </div>
  );
}

// ---------------------------------------------------------------- Folder Options

type FolderOptionsDraft = Pick<Prefs['explorer'], 'showTasks' | 'newWindowPerFolder' | 'fullPathInAddress' | 'fullPathInTitle'>;

export function FolderOptionsApplet({ windowId }: { windowId: string }) {
  const e = useApp((s) => s.prefs.explorer);
  const committed: FolderOptionsDraft = {
    showTasks: e.showTasks,
    newWindowPerFolder: e.newWindowPerFolder,
    fullPathInAddress: e.fullPathInAddress,
    fullPathInTitle: e.fullPathInTitle,
  };
  const defaults: FolderOptionsDraft = { showTasks: true, newWindowPerFolder: false, fullPathInAddress: false, fullPathInTitle: false };
  const tabs: SheetTab<FolderOptionsDraft>[] = [
    {
      id: 'general',
      label: 'General',
      render: (d, update) => (
        <>
          <fieldset className="xp-group">
            <legend>Tasks</legend>
            <Radio name="tasks" label="Show common tasks in folders" checked={d.showTasks} onChange={() => update({ showTasks: true })} />
            <Radio name="tasks" label="Use Windows classic folders" checked={!d.showTasks} onChange={() => update({ showTasks: false })} />
          </fieldset>
          <fieldset className="xp-group">
            <legend>Browse folders</legend>
            <Radio name="browse" label="Open each folder in the same window" checked={!d.newWindowPerFolder} onChange={() => update({ newWindowPerFolder: false })} />
            <Radio name="browse" label="Open each folder in its own window" checked={d.newWindowPerFolder} onChange={() => update({ newWindowPerFolder: true })} />
          </fieldset>
          <div className="sheet-right">
            <button type="button" className="xp-button" onClick={() => update({ showTasks: defaults.showTasks, newWindowPerFolder: defaults.newWindowPerFolder })}>
              Restore Defaults
            </button>
          </div>
        </>
      ),
    },
    {
      id: 'view',
      label: 'View',
      render: (d, update) => (
        <>
          <fieldset className="xp-group">
            <legend>Advanced settings</legend>
            <Check label="Display the full path in the address bar" checked={d.fullPathInAddress} onChange={(v) => update({ fullPathInAddress: v })} />
            <Check label="Display the full path in the title bar" checked={d.fullPathInTitle} onChange={(v) => update({ fullPathInTitle: v })} />
          </fieldset>
          <Note>Only folders exist in this simulation, so file-related options are not shown.</Note>
          <div className="sheet-right">
            <button type="button" className="xp-button" onClick={() => update({ fullPathInAddress: false, fullPathInTitle: false })}>
              Restore Defaults
            </button>
          </div>
        </>
      ),
    },
  ];
  return (
    <div className="applet" onKeyDown={sheetKeyDown(windowId)}>
      <PropertySheet windowId={windowId} tabs={tabs} committed={committed} apply={(d) => updatePrefs((p) => ({ ...p, explorer: { ...p.explorer, ...d } }))} />
    </div>
  );
}
