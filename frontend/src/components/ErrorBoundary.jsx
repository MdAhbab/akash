import { Component } from 'react';
import { Link } from 'react-router-dom';

// Catches render-time errors anywhere in the routed page tree so a single broken
// view never white-screens the whole app. Nav/Footer live outside this boundary
// and stay usable. Kept dependency-light (no canvas / framer-motion) so the
// fallback renders reliably even while something else is failing.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface for debugging; never leaks to the customer-facing UI.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="shell grid min-h-[70vh] place-items-center py-24 text-center">
        <div className="max-w-md">
          <div className="label mb-4 text-faint">Error · something went sideways</div>
          <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-tight">
            This view drifted off course.
          </h1>
          <p className="mt-4 text-muted">
            An unexpected error interrupted this screen. The rest of Akash is
            still running - head back and try again.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/" onClick={this.reset} className="btn btn-primary" data-cursor>
              Back to safety
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-ghost"
              data-cursor
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
