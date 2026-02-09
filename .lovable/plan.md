

# Fix: Invoice Issuing "[Object Object]" Error

## Problem Analysis

Two bugs are causing invoice issuing to fail with an unhelpful "[Object Object]" error message:

### Bug 1: Database function `issue_invoice` fails (Root Cause)
The `issue_invoice` RPC function uses `digest()` (from the `pgcrypto` extension) to generate SHA-256 hashes. However, the function is declared with `SET search_path TO 'public'`, and `digest()` lives in the `extensions` schema. When the function runs, it cannot find `digest()` and throws:

```
function digest(bytea, unknown) does not exist
```

### Bug 2: Error displayed as "[Object Object]" (Display Bug)
When the RPC fails, Supabase returns a plain error object (not an `Error` instance). The code does `throw error` on this plain object. In `sanitizeErrorMessage()`, `String(error)` converts a plain object to `[object Object]` instead of extracting the `.message` property.

### Bug 3: Build error in `export-records` edge function
The select query for invoices does not include `payment_method_snapshot`, but the mapping code tries to access it, causing a TypeScript error.

## Fix Plan

### 1. Fix the `issue_invoice` database function
Update the SQL function to qualify `digest()` with the `extensions` schema:

```sql
-- Change this line in issue_invoice:
_invoice_hash := encode(digest(_hash_input::bytea, 'sha256'), 'hex');
-- To:
_invoice_hash := encode(extensions.digest(_hash_input::bytea, 'sha256'), 'hex');
```

This is a database migration that replaces the function definition with the schema-qualified call.

### 2. Fix `sanitizeErrorMessage` in `src/lib/error-utils.ts`
Update the function to handle plain Supabase error objects that have a `.message` property but are not `Error` instances:

```typescript
// Before:
const msg = error instanceof Error ? error.message : String(error);

// After:
const msg = error instanceof Error
  ? error.message
  : (typeof error === 'object' && error !== null && 'message' in error)
    ? String((error as Record<string, unknown>).message)
    : String(error);
```

### 3. Fix `export-records` edge function build error
Add `payment_method_snapshot` to the invoice select query in `supabase/functions/export-records/index.ts`.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Fix `issue_invoice` to use `extensions.digest()` |
| `src/lib/error-utils.ts` | Handle plain object errors with `.message` property |
| `supabase/functions/export-records/index.ts` | Add `payment_method_snapshot` to invoice select query |

## Testing

After the fix:
1. Create a draft invoice and issue it -- should succeed
2. If there is a real validation error (e.g., tier limit), the error message should display properly instead of "[Object Object]"

