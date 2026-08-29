'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearLocalDocument } from './persistence';

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') console.error(error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error">
        <div>
          <span className="brand-mark" aria-hidden="true">S</span>
          <h1>The editor needs to restart</h1>
          <p>Your locally saved project is still on this device. Reload first; reset only if the problem continues.</p>
          <div className="fatal-actions">
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>
              Reload editor
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                if (!window.confirm('Reset the saved local project on this device? This cannot be undone.')) return;
                await clearLocalDocument();
                window.location.reload();
              }}
            >
              Reset local project
            </button>
          </div>
        </div>
      </main>
    );
  }
}

