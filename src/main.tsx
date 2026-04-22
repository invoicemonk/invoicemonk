import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { PostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import App from "./App.tsx";
import "./index.css";
import { initOneSignal } from "./lib/onesignal";

initOneSignal();

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: true,
});

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN || "phc_rbbFhXT5ChzKFa4DGdsfnBnpGQawxnyfFnPq37GED4QT";
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

const posthogOptions = {
  api_host: posthogHost,
  capture_exceptions: true,
};

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={<p>Something went wrong</p>}
    onError={(error, componentStack, eventId) => {
      try {
        posthog.captureException(error instanceof Error ? error : new Error(String(error)), {
          componentStack,
          sentry_event_id: eventId,
          source: "react_error_boundary",
        });
      } catch {
        // no-op: never let error reporting throw
      }
    }}
  >
    <PostHogProvider
      apiKey={posthogKey}
      options={posthogOptions}
    >
      <App />
    </PostHogProvider>
  </Sentry.ErrorBoundary>
);
