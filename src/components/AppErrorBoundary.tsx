import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { captureError } from '@/lib/sentry';
import { isChunkLoadError } from '@/lib/lazy-import';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Application error', error, info.componentStack);
    captureError(error, { source: 'app_error_boundary' });
    this.setState({ info });
  }

  handleRetry = () => this.setState({ error: null, info: null });

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const isChunkError = isChunkLoadError(error);

    return (
      <main className="min-h-[60vh] flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            {isChunkError ? 'This page could not load' : 'This page ran into a problem'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isChunkError
              ? 'A newer version of Invoicemonk may be available. Reload the page to continue.'
              : 'Your data is safe. Try again, or reload the page if the problem persists.'}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
             <Button onClick={isChunkError ? () => window.location.reload() : this.handleRetry}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload page
            </Button>
          </div>
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">Technical details</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px] text-muted-foreground">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
              {info?.componentStack ?? ''}
            </pre>
          </details>
        </section>
      </main>
    );
  }
}

/** Resets the boundary whenever the route changes, so navigating away clears a stuck error. */
export function AppErrorBoundary({ children }: Props) {
  const location = useLocation();
  return <ErrorBoundaryInner key={location.key}>{children}</ErrorBoundaryInner>;
}

/** Boundary for use outside a Router context (no route-based reset). */
export const StaticErrorBoundary = ErrorBoundaryInner;
