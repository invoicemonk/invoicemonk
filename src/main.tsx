import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { PostHogProvider } from "@posthog/react";
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
};

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Something went wrong</p>}>
    <PostHogProvider
      apiKey={posthogKey}
      options={posthogOptions}
    >
      <App />
    </PostHogProvider>
  </Sentry.ErrorBoundary>
);
