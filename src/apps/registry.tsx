import type { ComponentType } from 'react';
import type { AppId } from '../domain/windows';
import { AccessibilityApplet, DateTimeApplet, DisplayApplet, FolderOptionsApplet, SoundsApplet, TaskbarApplet } from './Applets';
import { BrowserApp } from './Browser';
import { CalculatorApp } from './Calculator';
import { ControlPanelApp } from './ControlPanel';
import { ExplorerApp } from './explorer/ExplorerApp';
import { FolderPropertiesApp } from './FolderProperties';
import { HelpApp } from './help/HelpApp';
import { TaskManagerApp } from './TaskManager';

export const APP_COMPONENTS: Record<AppId, ComponentType<{ windowId: string }>> = {
  explorer: ExplorerApp,
  calculator: CalculatorApp,
  controlPanel: ControlPanelApp,
  display: DisplayApplet,
  taskbarProps: TaskbarApplet,
  sounds: SoundsApplet,
  dateTime: DateTimeApplet,
  accessibility: AccessibilityApplet,
  folderOptions: FolderOptionsApplet,
  folderProps: FolderPropertiesApp,
  help: HelpApp,
  ie: BrowserApp,
  taskManager: TaskManagerApp,
};
