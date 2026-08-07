import { supabase } from '@/integrations/supabase/client';
import { captureError } from '@/lib/sentry';
import * as Sentry from '@sentry/react';

export class SessionExpiredError extends Error {
  constructor(message = 'Your session expired. Please sign in again and retry.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Returns the live authenticated user id, refreshing the session if it is
 * missing or about to expire.
 *
 * React state can hold a stale `user` after a failed token refresh, which makes
 * writes reach PostgREST without a valid JWT and fail RLS with
 * "new row violates row-level security policy". Always derive the owner id from
 * here instead of the in-memory user before an ownership-checked insert.
 *
 * @param context short label used for diagnostics (e.g. 'create-business')
 * @param expectedUserId the in-memory user id, logged when it disagrees
 */
export async function requireFreshUserId(
  context: string,
  expectedUserId?: string | null,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  const expiresAt = session?.expires_at ? session.expires_at * 1000 : null;
  const secondsToExpiry = expiresAt ? Math.round((expiresAt - Date.now()) / 1000) : null;
  const mismatch = !!session?.user && !!expectedUserId && session.user.id !== expectedUserId;

  // Diagnostic breadcrumb: tells us, on the next failure, whether the session
  // was absent, stale, or simply near expiry.
  Sentry.addBreadcrumb({
    category: 'auth',
    level: mismatch || !session ? 'warning' : 'info',
    message: `session-check:${context}`,
    data: {
      hasSession: !!session,
      hasExpectedUser: !!expectedUserId,
      userMatchesMemory: session?.user ? !mismatch : false,
      secondsToExpiry,
    },
  });

  const needsRefresh = !session || (secondsToExpiry !== null && secondsToExpiry < 60);

  if (needsRefresh) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session?.user) {
      captureError(error ?? new Error('Session refresh returned no user'), {
        context,
        reason: session ? 'expired' : 'missing',
      });
      throw new SessionExpiredError();
    }
    return refreshed.session.user.id;
  }

  if (!session.user) throw new SessionExpiredError();
  return session.user.id;
}