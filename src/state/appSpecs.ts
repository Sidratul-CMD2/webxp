import type { AppId, Size } from '../domain/windows';
import type { IconName } from '../ui/icons';

export interface AppSpec {
  title: string;
  icon: IconName;
  size: Size;
  minSize: Size;
  resizable: boolean;
  /** Reopening focuses/restores the existing instance. */
  single: boolean;
  /** Dialog-like applets open centered and show only Help/Close title buttons. */
  dialog: boolean;
  /** Name used for taskbar grouping. */
  groupLabel: string;
}

const dialogApplet = (title: string, icon: IconName, h = 452): AppSpec => ({
  title,
  icon,
  size: { w: 404, h },
  minSize: { w: 404, h },
  resizable: false,
  single: true,
  dialog: true,
  groupLabel: title,
});

export const APP_SPECS: Record<AppId, AppSpec> = {
  explorer: {
    title: 'My Documents',
    icon: 'folder-open',
    size: { w: 640, h: 460 },
    minSize: { w: 360, h: 260 },
    resizable: true,
    single: false,
    dialog: false,
    groupLabel: 'Windows Explorer',
  },
  calculator: {
    title: 'Calculator',
    icon: 'calculator',
    size: { w: 262, h: 258 },
    minSize: { w: 262, h: 258 },
    resizable: false,
    single: true,
    dialog: false,
    groupLabel: 'Calculator',
  },
  controlPanel: {
    title: 'Control Panel',
    icon: 'control-panel',
    size: { w: 700, h: 500 },
    minSize: { w: 420, h: 300 },
    resizable: true,
    single: true,
    dialog: false,
    groupLabel: 'Control Panel',
  },
  display: dialogApplet('Display Properties', 'display'),
  taskbarProps: dialogApplet('Taskbar and Start Menu Properties', 'taskbar'),
  sounds: dialogApplet('Sounds and Audio Devices Properties', 'sounds'),
  dateTime: dialogApplet('Date and Time Properties', 'date-time', 392),
  accessibility: dialogApplet('Accessibility Options', 'accessibility'),
  folderOptions: dialogApplet('Folder Options', 'folder-options'),
  folderProps: { ...dialogApplet('Properties', 'folder', 420), single: false, groupLabel: 'Properties' },
  help: {
    title: 'Help and Support Center',
    icon: 'help',
    size: { w: 760, h: 540 },
    minSize: { w: 420, h: 320 },
    resizable: true,
    single: true,
    dialog: false,
    groupLabel: 'Help and Support Center',
  },
  ie: {
    title: 'Welcome - Internet Explorer',
    icon: 'browser',
    size: { w: 720, h: 520 },
    minSize: { w: 400, h: 300 },
    resizable: true,
    single: true,
    dialog: false,
    groupLabel: 'Internet Explorer',
  },
  taskManager: {
    title: 'Windows Task Manager',
    icon: 'task-manager',
    size: { w: 400, h: 440 },
    minSize: { w: 360, h: 320 },
    resizable: true,
    single: true,
    dialog: false,
    groupLabel: 'Windows Task Manager',
  },
};
