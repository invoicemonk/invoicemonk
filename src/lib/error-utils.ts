/**
 * Sanitize error messages to prevent leaking Supabase internals to users.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  
  const msg = error instanceof Error ? error.message : String(error);
  
  // Strip Supabase-specific patterns
  const patterns: [RegExp, string][] = [
    [/new row violates row-level security policy/i, 'You do not have permission to perform this action.'],
    [/JWT expired/i, 'Your session has expired. Please log in again.'],
    [/invalid input syntax for type uuid/i, 'Invalid record reference. Please refresh and try again.'],
    [/duplicate key value violates unique constraint/i, 'This record already exists.'],
    [/violates foreign key constraint/i, 'This record is referenced by other data and cannot be modified.'],
    [/relation ".*" does not exist/i, 'A system error occurred. Please contact support.'],
    [/Could not find the .* column/i, 'A system error occurred. Please contact support.'],
    [/FetchError|fetch failed|NetworkError/i, 'Network error. Please check your connection and try again.'],
    [/timeout|AbortError/i, 'The request timed out. Please try again.'],
    [/too many connections/i, 'The service is temporarily busy. Please try again in a moment.'],
  ];

  for (const [pattern, replacement] of patterns) {
    if (pattern.test(msg)) return replacement;
  }

  // If the message looks safe (no internal details), return as-is
  if (msg.length < 200 && !/supabase|postgres|pg_|auth\.|storage\./i.test(msg)) {
    return msg;
  }

  return 'An unexpected error occurred. Please try again.';
}
