import { createRoot } from "react-dom/client";
import "./index.css";

const rootElement = document.getElementById("root");

function StartupFailure() {
  return (
    <main className="min-h-screen bg-background px-6 flex items-center justify-center">
      <section className="w-full max-w-md border border-border bg-card p-8 text-center shadow-sm rounded-lg">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">IM</div>
        <h1 className="text-xl font-bold text-foreground">InvoiceMonk couldn't finish loading</h1>
        <p className="mt-3 text-sm text-muted-foreground">Your information is safe. Check your connection, then try again.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" onClick={() => window.location.reload()}>Reload</button>
          <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground" href="/login">Return to login</a>
        </div>
      </section>
    </main>
  );
}

import { withTimeout } from "./lib/startup";


async function startApp() {
  if (!rootElement) return;
  const root = createRoot(rootElement);

  try {
    const [{ default: App }, Sentry, { PostHogProvider }, { default: posthog }] = await withTimeout(
      Promise.all([
        import("./App.tsx"),
        import("@sentry/react"),
        import("@posthog/react"),
        import("posthog-js"),
      ]),
      12_000,
    );

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      sendDefaultPii: true,
    });

    const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN || "phc_rbbFhXT5ChzKFa4DGdsfnBnpGQawxnyfFnPq37GED4QT";
    const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
    root.render(
      <Sentry.ErrorBoundary
        fallback={<StartupFailure />}
        onError={(error, componentStack, eventId) => {
          try {
            posthog.captureException(error, { componentStack, sentry_event_id: eventId, source: "react_error_boundary" });
          } catch {
            // Error reporting must never replace the recovery screen.
          }
        }}
      >
        <PostHogProvider apiKey={posthogKey} options={{ api_host: posthogHost, capture_exceptions: true }}>
          <App />
        </PostHogProvider>
      </Sentry.ErrorBoundary>,
    );

    window.setTimeout(() => {
      import("./lib/onesignal").then(({ initOneSignal }) => initOneSignal()).catch(() => undefined);
    }, 1_500);
  } catch (error) {
    console.error("Application startup failed", error);
    root.render(<StartupFailure />);
  }
}

void startApp();
