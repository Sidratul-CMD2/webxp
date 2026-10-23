import { useEffect, useRef } from 'react';
import { pushModal } from '../state/app';
import { resumeSession, turnOn, wake } from '../state/sessionActions';
import { Icon } from '../ui/icons';

export function WelcomeScreen() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <main className="welcome" aria-labelledby="welcome-title">
      <div className="welcome__top" />
      <div className="welcome__middle">
        <div className="welcome__left">
          <Icon name="start-logo" size={64} />
          <h1 id="welcome-title">To begin, click your user name</h1>
        </div>
        <div className="welcome__divider" aria-hidden="true" />
        <div className="welcome__right">
          <button ref={ref} type="button" className="welcome__user" onClick={resumeSession}>
            <span className="welcome__avatar">
              <Icon name="user" size={48} />
            </span>
            <span>User</span>
          </button>
        </div>
      </div>
      <div className="welcome__bottom">
        <button
          type="button"
          className="welcome__off"
          onClick={() => pushModal({ kind: 'turnOff', invoker: document.activeElement as HTMLElement | null, ownerWindowId: null })}
        >
          <Icon name="turn-off" size={24} />
          <span>Turn off computer</span>
        </button>
        <p>After you log on, you can add or change accounts. Accounts are not simulated: there is one local user.</p>
      </div>
    </main>
  );
}

export function StandbyOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (['Control', 'Shift', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      e.preventDefault();
      wake();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div ref={ref} className="standby" role="dialog" aria-modal="true" aria-label="Stand by" tabIndex={-1} onPointerDown={wake}>
      <p className="standby__hint">Standing by. Press any key or click to resume.</p>
    </div>
  );
}

export function OffScreen() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <main className="off-screen" aria-labelledby="off-title">
      <h1 id="off-title">The simulation is turned off.</h1>
      <p>Your folders and settings have been kept. Nothing on your computer was turned off.</p>
      <button ref={ref} type="button" className="off-screen__power" onClick={turnOn}>
        <Icon name="turn-off" size={32} />
        <span>Start again</span>
      </button>
    </main>
  );
}

export function RestartingScreen() {
  return (
    <main className="restarting" aria-live="polite" aria-busy="true">
      <Icon name="start-logo" size={64} />
      <p>Starting the simulation…</p>
      <div className="restarting__bar" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
