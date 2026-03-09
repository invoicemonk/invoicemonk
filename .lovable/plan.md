

# Standardize Input Sanitization + Add Rate Limiting

## Problem Summary

1. **Input Sanitization**: The shared `_shared/validation.ts` module exists but **no edge function imports from it**. Instead, 10+ functions duplicate `validateUUID`, `sanitizeString`, `isAllowedOrigin`, `getCorsHeaders`, etc. inline. Some functions that accept user text input (e.g., `attribute-referral`, `send-support-notification`, `submit-invoice-to-regulator`) lack sanitization entirely.

2. **Rate Limiting**: No rate limiting exists anywhere in the stack. Any authenticated user can call edge functions at unlimited rates.

---

## Plan

### Part 1: Standardize Shared Validation Imports

**Approach**: Deno edge functions in Supabase can import from relative paths within the `supabase/functions/` directory. We will update all edge functions to import from `../_shared/validation.ts` instead of re-declaring utilities inline.

**Shared module update** (`_shared/validation.ts`):
- Add a `checkRateLimit` helper (see Part 2)
- Keep existing exports: `validateUUID`, `validateString`, `validateAmount`, `validateEnum`, `validateDate`, `validateEmail`, `sanitizeString`, `isAllowedOrigin`, `getCorsHeaders`, `corsHeaders`
- Normalize the return type: currently the shared module returns `ValidationError | null` (object) while inline copies return `string | null`. We will add a `validateUUIDSimple` variant that returns `string | null` for backward compatibility, OR update all functions to use the object form. The simpler path: add string-returning wrappers to the shared module.

**Functions to update** (remove inline duplicates, import from shared):

| Function | Duplicated utilities |
|---|---|
| `issue-invoice` | validateUUID, isAllowedOrigin, getCorsHeaders |
| `manage-subscription` | validateEnum, isAllowedOrigin, getCorsHeaders |
| `record-payment` | validateUUID, validateAmount, validateString, sanitizeString, isAllowedOrigin, getCorsHeaders |
| `void-invoice` | validateUUID, validateString, sanitizeString, isAllowedOrigin, getCorsHeaders |
| `send-invoice-email` | validateUUID, validateEmail, validateString, sanitizeString, isAllowedOrigin, getCorsHeaders |
| `send-receipt-email` | validateUUID, validateEmail, validateString, sanitizeString, isAllowedOrigin, getCorsHeaders |
| `generate-pdf` | validateUUID, isAllowedOrigin, getCorsHeaders |
| `generate-receipt-pdf` | isAllowedOrigin, getCorsHeaders |
| `generate-report` | isAllowedOrigin, getCorsHeaders |
| `generate-xml-artifact` | corsHeaders (legacy wildcard) |
| `export-records` | validateUUID, validateDate, isAllowedOrigin, getCorsHeaders |
| `create-checkout-session` | validateEnum, validateString, isAllowedOrigin, getCorsHeaders |
| `check-overdue-invoices` | isAllowedOrigin, getCorsHeaders |
| `send-due-date-reminders` | isAllowedOrigin, getCorsHeaders |
| `send-invoice-reminder` | isAllowedOrigin, getCorsHeaders |
| `send-support-notification` | isAllowedOrigin, getCorsHeaders |
| `cleanup-expired-records` | isAllowedOrigin, getCorsHeaders |
| `attribute-referral` | corsHeaders (legacy wildcard — upgrade to dynamic) |
| `submit-invoice-to-regulator` | corsHeaders (legacy wildcard — upgrade to dynamic) |
| `generate-artifacts` | corsHeaders (legacy wildcard — upgrade to dynamic) |
| `verify-invoice` | validateUUID, corsHeaders |
| `verify-receipt` | corsHeaders |
| `view-invoice` | validateUUID, corsHeaders |
| `tawk-identity` | corsHeaders (legacy wildcard) |
| `stripe-webhook` | none needed (webhook, not user-facing) |
| `lock-commissions` | corsHeaders (service-role only) |

**Key decisions**:
- Add string-returning wrapper functions to `_shared/validation.ts` (e.g., `validateUUIDStr`) so existing function code needs minimal changes
- Functions that currently use legacy wildcard `corsHeaders` will be upgraded to use dynamic `getCorsHeaders(req)` (except public endpoints which use `getCorsHeaders(req, true)`)

### Part 2: Postgres-Based Rate Limiting

**Database migration** — create a `rate_limit_log` table and a checking function:

```text
┌─────────────────────────────────────┐
│         rate_limit_log              │
├─────────────────────────────────────┤
│ id          UUID PK                 │
│ key         TEXT (user_id or IP)    │
│ endpoint    TEXT (function name)    │
│ created_at  TIMESTAMPTZ DEFAULT NOW │
└─────────────────────────────────────┘

+ Function: check_rate_limit(key, endpoint, window_seconds, max_requests)
  → Returns BOOLEAN (true = allowed)
  → Cleans up old entries automatically
```

**Shared helper** in `_shared/validation.ts`:

```typescript
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  endpoint: string,
  windowSeconds: number,
  maxRequests: number
): Promise<boolean>
```

**Rate limit tiers** (requests per minute):

| Endpoint category | Limit |
|---|---|
| Invoice issue/void/send | 30/min |
| PDF generation | 20/min |
| Payment recording | 30/min |
| Email sending | 10/min |
| Report generation | 10/min |
| Public verification | 60/min (by IP) |
| Checkout/subscription | 10/min |

**Integration**: Each edge function calls `checkRateLimit()` early in its handler, after authentication (using `user.id` as key) or before authentication for public endpoints (using IP hash as key). Returns `429 Too Many Requests` if exceeded.

### Part 3: Cleanup of Legacy CORS

Four functions still use the legacy wildcard `corsHeaders` (`attribute-referral`, `submit-invoice-to-regulator`, `generate-artifacts`, `tawk-identity`). These will be updated to use the shared dynamic CORS.

---

## Files Changed

- `supabase/functions/_shared/validation.ts` — add string-returning wrappers, rate limit helper
- 1 new migration — `rate_limit_log` table + `check_rate_limit` function
- ~25 edge function files — replace inline utilities with imports from shared module, add rate limiting calls

