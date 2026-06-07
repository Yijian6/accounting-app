import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2>Runtime Error</h2>
          <p>{this.state.error.message}</p>
          <p>{this.state.error.stack}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

let refreshingForServiceWorker = false;

function notifyServiceWorkerUpdate(worker) {
  window.dispatchEvent(new CustomEvent('shiyu:pwa-update-ready', {
    detail: { worker },
  }));
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshingForServiceWorker) return;
      refreshingForServiceWorker = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyServiceWorkerUpdate(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notifyServiceWorkerUpdate(installingWorker);
            }
          });
        });
      })
      .catch(() => {});
  });
}
