import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

export function captureError(error: unknown, context?: Record<string, string>) {
  const err = error instanceof Error ? error : new Error(String(error));
  Sentry.captureException(err, {
    tags: context,
  });
  try {
    posthog.captureException(err, { ...context });
  } catch {
    // no-op: never let error reporting throw
  }
}
