import * as Sentry from 'https://deno.land/x/sentry/index.mjs'

let initialized = false

export function initSentry() {
  if (initialized) return
  const dsn = Deno.env.get('SENTRY_DSN')
  if (!dsn) {
    console.warn('SENTRY_DSN not set, Sentry disabled')
    return
  }
  Sentry.init({
    dsn,
    defaultIntegrations: false,
    tracesSampleRate: 1.0,
  })
  Sentry.setTag('region', Deno.env.get('SB_REGION') || 'unknown')
  initialized = true
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return
  Sentry.withScope((scope: any) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
      if (context.function_name) {
        scope.setTag('function', context.function_name as string)
      }
    }
    Sentry.captureException(error)
  })
}

export { Sentry }
