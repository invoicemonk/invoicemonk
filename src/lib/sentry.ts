import * as Sentry from "@sentry/react";

export function captureError(error: unknown, context?: Record<string, string>) {
  const err = error instanceof Error ? error : new Error(String(error));
  Sentry.captureException(err, {
    tags: context,
  });
}
