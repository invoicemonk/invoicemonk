// Lightweight PostHog server-side error capture for Supabase Edge Functions.
// Posts an `$exception` event to PostHog's /capture/ endpoint.

const POSTHOG_HOST = Deno.env.get('POSTHOG_HOST') || 'https://us.i.posthog.com'

export async function capturePosthogException(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const token = Deno.env.get('POSTHOG_PROJECT_TOKEN')
  if (!token) return

  const err = error instanceof Error ? error : new Error(String(error))
  const functionName =
    (context?.function_name as string | undefined) ||
    Deno.env.get('SB_FUNCTION_NAME') ||
    'edge-function'

  const distinctId =
    (context?.user_id as string | undefined) ||
    (context?.distinct_id as string | undefined) ||
    `edge:${functionName}`

  const exceptionList = [
    {
      type: err.name || 'Error',
      value: err.message,
      mechanism: { handled: true, type: 'generic' },
      stacktrace: err.stack
        ? {
            type: 'raw',
            raw: err.stack,
          }
        : undefined,
    },
  ]

  const payload = {
    api_key: token,
    event: '$exception',
    distinct_id: distinctId,
    properties: {
      $exception_list: exceptionList,
      $exception_message: err.message,
      $exception_type: err.name || 'Error',
      $exception_source: 'edge_function',
      function_name: functionName,
      ...context,
    },
    timestamp: new Date().toISOString(),
  }

  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.warn('PostHog capture failed:', e)
  }
}
