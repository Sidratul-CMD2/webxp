import type { CSSProperties } from 'react';

const modules = import.meta.glob<string>('../assets/icons/*.svg', { eager: true, query: '?url', import: 'default' });

const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  URLS[path.slice(path.lastIndexOf('/') + 1, -4)] = url;
}

export type IconName =
  | 'accessibility'
  | 'add-remove'
  | 'appearance'
  | 'back'
  | 'browser'
  | 'calculator'
  | 'control-panel'
  | 'copy'
  | 'date-time'
  | 'delete'
  | 'display'
  | 'drive'
  | 'error'
  | 'explorer'
  | 'folder'
  | 'folder-open'
  | 'folder-options'
  | 'folders'
  | 'forward'
  | 'go'
  | 'help'
  | 'home'
  | 'info'
  | 'log-off'
  | 'move'
  | 'my-computer'
  | 'my-documents'
  | 'my-music'
  | 'my-pictures'
  | 'network'
  | 'network-connections'
  | 'new-folder'
  | 'performance'
  | 'printer'
  | 'question'
  | 'recycle-empty'
  | 'recycle-full'
  | 'refresh'
  | 'rename'
  | 'restore'
  | 'run'
  | 'search'
  | 'security'
  | 'show-desktop'
  | 'sounds'
  | 'start-logo'
  | 'stop'
  | 'task-manager'
  | 'taskbar'
  | 'turn-off'
  | 'up'
  | 'user'
  | 'user-accounts'
  | 'views'
  | 'volume'
  | 'volume-muted'
  | 'warning';

export function iconUrl(name: IconName): string {
  return URLS[name] ?? URLS.folder;
}

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Blend with the selection color, as XP does for selected desktop/list icons. */
  tinted?: boolean;
  /** Dimmed for cut items. */
  ghosted?: boolean;
  style?: CSSProperties;
}

/** Decorative icon: accessible names always come from adjacent text. */
export function Icon({ name, size = 16, className, tinted, ghosted, style }: IconProps) {
  const url = iconUrl(name);
  return (
    <span
      className={`xp-icon${ghosted ? ' xp-icon--ghosted' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
    >
      <img src={url} width={size} height={size} alt="" draggable={false} />
      {tinted && <span className="xp-icon__tint" style={{ maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")` }} />}
    </span>
  );
}
