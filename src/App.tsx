import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { APP_COMPONENTS } from './apps/registry';
import { VolumePopup } from './apps/Applets';
import { closeMenu, dismissBalloon, focusDesktopSoon, set, useApp } from './state/app';
import { Desktop } from './shell/Desktop';
import { ModalLayer } from './shell/ModalLayer';
import { OffScreen, RestartingScreen, StandbyOverlay, WelcomeScreen } from './shell/SessionScreens';
import { StartMenu } from './shell/StartMenu';
import { Taskbar } from './shell/Taskbar';
import { WindowFrame } from './shell/WindowFrame';
import { emptyWm } from './domain/windows';
import { Icon } from './ui/icons';
import { MenuLayer } from './ui/Menu';
import { TooltipLayer } from './ui/TooltipLayer';

function WindowView({ id }: { id: string }) {
  const appId = useApp((s) => s.wm.windows[id]?.appId);
  if (!appId) return null;
  const AppComponent = APP_COMPONENTS[appId];
  return (
    <WindowFrame id={id}>
      <AppComponent windowId={id} />
    </WindowFrame>
  );
}

function WindowLayer() {
  const ids = useApp((s) => Object.keys(s.wm.windows));
  return (
    <div className="window-layer">
      {ids.map((id) => (
        <WindowView key={id} id={id} />
      ))}
    </div>
  );
}

function BalloonNotice() {
  const balloon = useApp((s) => s.balloon);
  const barH = useApp((s) => (s.prefs.largerControls ? 36 : 30));
  if (!balloon) return null;
  return (
    <section className={`balloon balloon--${balloon.tone}`} role="region" aria-label="Notification" style={{ bottom: barH + 8 }}>
      <div className="balloon__title">
        <Icon name={balloon.tone === 'error' ? 'error' : balloon.tone === 'warning' ? 'warning' : 'info'} size={16} />
        <strong>{balloon.title}</strong>
        <button type="button" className="balloon__close" aria-label="Close notification" onClick={dismissBalloon}>
          ×
        </button>
      </div>
      <p role="status">{balloon.text}</p>
      {balloon.actions.length > 0 && (
        <div className="balloon__actions">
          {balloon.actions.map((a) => (
            <button key={a.label} type="button" className="xp-button" onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function LiveRegion() {
  const announcement = useApp((s) => s.announcement);
  // Alternate a zero-width character so repeated messages are re-announced.
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement.text}
      {announcement.n % 2 ? '​' : ''}
    </div>
  );
}

function usePreferenceClasses() {
  const textScale = useApp((s) => s.prefs.textScale);
  const highContrast = useApp((s) => s.prefs.highContrast);
  const largerControls = useApp((s) => s.prefs.largerControls);
  const motion = useApp((s) => s.prefs.motion);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('text-large', textScale === 'large');
    root.classList.toggle('text-xlarge', textScale === 'extraLarge');
    root.classList.toggle('high-contrast', highContrast);
    root.classList.toggle('larger-controls', largerControls);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => root.classList.toggle('reduce-motion', motion === 'reduce' || (motion === 'system' && media.matches));
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [textScale, highContrast, largerControls, motion]);
}

export function App() {
  const session = useApp((s) => s.session);
  const modalOpen = useApp((s) => s.modals.length > 0);
  const dimmed = useApp((s) => s.modals.some((m) => m.kind === 'turnOff' || m.kind === 'logOff'));
  usePreferenceClasses();

  let screen: ReactNode;
  if (session === 'running' || session === 'standby') {
    screen = (
      <div className={`shell${dimmed ? ' is-dimmed' : ''}`} inert={modalOpen || session === 'standby'}>
        <Desktop />
        <WindowLayer />
        <Taskbar />
        <BalloonNotice />
      </div>
    );
  } else if (session === 'loggedOff') {
    screen = (
      <div className={`shell${dimmed ? ' is-dimmed' : ''}`} inert={modalOpen}>
        <WelcomeScreen />
      </div>
    );
  } else if (session === 'off') {
    screen = <OffScreen />;
  } else {
    screen = <RestartingScreen />;
  }

  return (
    <>
      {screen}
      <MenuLayer
        renderSpecial={(menu) =>
          menu.kind === 'start' ? (
            <StartMenu menu={menu} />
          ) : (
            <div
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  closeMenu(true);
                }
              }}
            >
              <VolumePopup />
            </div>
          )
        }
      />
      <ModalLayer />
      {session === 'standby' && <StandbyOverlay />}
      <TooltipLayer />
      <LiveRegion />
    </>
  );
}

interface BoundaryState {
  error: Error | null;
}

/** Offers recovery without erasing saved folders or preferences. */
export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Simulation error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="crash" role="alert">
        <h1>The desktop simulation ran into a problem</h1>
        <p>Your saved folders and settings have not been changed. You can restart the desktop or reload the page.</p>
        <pre>{this.state.error.message}</pre>
        <div className="dialog-buttons">
          <button
            type="button"
            className="xp-button"
            onClick={() => {
              set((s) => ({ ...s, wm: emptyWm, explorers: {}, params: {}, modals: [], menu: null, moveSize: null, session: 'running' }));
              this.setState({ error: null });
              focusDesktopSoon();
            }}
          >
            Restart desktop
          </button>
          <button type="button" className="xp-button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </main>
    );
  }
}
