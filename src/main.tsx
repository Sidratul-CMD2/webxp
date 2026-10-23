import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/window.css';
import './styles/menu.css';
import './styles/explorer.css';
import './styles/apps.css';
import './styles/dialogs.css';
import './styles/compact.css';
import './styles/forced.css';
import { App, ErrorBoundary } from './App';
import { bootstrap } from './state/sessionActions';

// External OS drops never upload files or navigate the page.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

bootstrap({ w: window.innerWidth, h: window.innerHeight });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
