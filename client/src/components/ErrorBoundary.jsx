import React from 'react';
import { ErrorState } from './ui';

/*
 * The one place a broken screen is caught. A page chunk that could not be
 * fetched because the clinic server was unreachable for a moment, or a bug in
 * one page, becomes a message with a way to try again rather than a blank
 * window with nothing to click. The rest of the application stays up.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempts: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Screen failed:', error);
  }

  componentDidUpdate(prevProps) {
    // Moving to another screen clears the failure of the last one, and its
    // count of attempts: each screen gets its own chance to try again.
    if (prevProps.resetKey !== this.props.resetKey && (this.state.error || this.state.attempts)) {
      if (this.state.error && this.props.onReset) this.props.onReset();
      this.setState({ error: null, attempts: 0 });
    }
  }

  reset() {
    if (this.props.onReset) this.props.onReset();
    this.setState((prev) => ({ error: null, attempts: prev.attempts + 1 }));
  }

  render() {
    if (!this.state.error) return this.props.children;
    const failedToLoad = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk/i.test(String(this.state.error?.message || ''));
    // When trying again in place has also failed, the surest recovery is a
    // fresh copy of the application. The screen comes back from the address
    // bar, so the user lands where they were.
    const reloadInstead = this.state.attempts >= 1;
    return (
      <ErrorState
        title={failedToLoad ? 'This screen could not be loaded' : 'This screen stopped working'}
        detail={failedToLoad
          ? 'The clinic server could not be reached to fetch it. Check the network and try again.'
          : 'Try again. If it keeps happening, note what you were doing and tell the administrator.'}
        retryLabel={reloadInstead ? 'Reload the application' : 'Try again'}
        onRetry={() => (reloadInstead ? window.location.reload() : this.reset())}
      />
    );
  }
}
