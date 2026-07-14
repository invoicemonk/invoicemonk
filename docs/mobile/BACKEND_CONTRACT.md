# Backend Contract

The mobile app talks to the same Supabase project as the web app.

## Connection

```ts
// mobile/src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://skcxogeaerudoadluexz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3hvZ2VhZXJ1ZG9hZGx1ZXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTkyODcsImV4cCI6MjA4Mzg3NTI4N30._G14u4zLW4sTO0VIIgeNideez3vwBuxKAa_ef4rvImc';

// Wrap SecureStore so it behaves like AsyncStorage for supabase-js.
// Tokens > 2KB fall back to AsyncStorage because SecureStore has a 2KB cap.
const secureStorage = {
  async getItem(key: string) {
    try { return await SecureStore.getItemAsync(key); }
    catch { return await AsyncStorage.getItem(key); }
  },
  async setItem(key: string, value: string) {
    if (value.length > 2000) return AsyncStorage.setItem(key, value);
    try { await SecureStore.setItemAsync(key, value); }
    catch { await AsyncStorage.setItem(key, value); }
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN doesn't have URL hash
  },
});
```

**Never ship the service-role key.** Only the anon key. All privileged ops
run inside edge functions with `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.

## Tables the mobile app reads/writes

All tables have RLS. Every query still passes `business_id` explicitly for
clarity. See `src/integrations/supabase/types.ts` on the web side for the
authoritative typing — regenerate the same file into `mobile/src/integrations/`.

Primary tables (see the full list in `../../src/integrations/supabase/types.ts`):

- `profiles`, `businesses`, `business_members`, `business_sensitive_data`
- `user_roles`, `user_preferences`, `user_activity_state`
- `clients`, `vendors`, `products_services`
- `invoices`, `invoice_items`, `invoice_templates`, `credit_notes`
- `expenses`, `expense_inbox_items`, `recurring_expenses`
- `receipts`, `payments`, `payment_methods`, `payment_proofs`, `online_payments`
- `accounting_preferences`, `tax_report_mappings`, `tax_schemas`
- `subscriptions`, `tier_limits`, `churn_feedback`
- `notifications`, `support_tickets`, `support_ticket_messages`
- `currency_accounts`, `pricing_regions`
- `compliance_artifacts`, `compliance_risks`, `regulatory_events`
- `verification_documents`, `retention_policies`, `audit_logs`
- `referral_links`, `referral_clicks`, `referrals`
- **New for mobile**: `push_tokens`, `scan_jobs`

Do **NOT** read: `partner_*`, `commissions`, `payout_batches`, `fraud_flags`,
`compliance_system_policy`, `platform_fee_config`, `submission_queue`,
`sync_subscription_runs`, `rate_limit_log`, `admin_*` views/functions.

## Storage buckets

- `receipt-scans` (**private, new**) — mobile scan uploads.
  Path convention: `{businessId}/{uuid}.{ext}`.
  RLS: business members can read/write inside their own business's folder.
- Existing buckets used by web (avatars, invoice attachments, etc.) — read
  from web migrations before using.

## Edge functions the mobile app calls

Invoke with `supabase.functions.invoke('name', { body })`.

| Function | Purpose |
|---|---|
| `scan-document` | **New.** Extracts structured data from a receipt/invoice image via Lovable AI Gateway. |
| `generate-receipt-pdf` | Returns base64 receipt PDF for download. |
| `generate-receipt` | Manually generate a receipt for a payment. |
| `list-stripe-payments` | Billing history for the settings > billing screen. |
| `verify-receipt` | Public verification endpoint. |
| Others | Enumerate `supabase/functions/*` — they are auto-deployed. Do NOT call admin-only functions from mobile. |

## `scan-document` contract

```
POST /functions/v1/scan-document
Authorization: Bearer <supabase user JWT>
Content-Type: application/json

Body:
{
  "storage_path": "b42ad810-58cb-4ab5-a1ec-3912f830db31/9f3c...jpg",
  "source": "receipt" | "invoice",
  "business_id": "b42ad810-58cb-4ab5-a1ec-3912f830db31"
}

200 OK:
{
  "job_id": "uuid",
  "status": "done",
  "extracted": { vendor, date, currency, subtotal, tax, total, line_items[], ... },
  "confidence": 0-100
}

401 Missing/invalid token
403 Not a business member
400 Invalid body / path outside business folder
429 AI rate limit — retry with backoff
402 AI credits exhausted — show billing UI
500 { error, job_id }
```

The job row is persisted in `scan_jobs` regardless of success/failure so the
UI can retry from history. On success, the client is responsible for either
creating an `expense_inbox_items` row (receipts) or an `invoices` draft
(invoices) using the extracted data — the edge function does not auto-create
those so the user can review and edit first.

## Tier limits enforcement

The mobile app must check `tier_limits` **before** mutations, exactly like the
web (`src/hooks/use-tier-features.ts`). If a check fails, show the same
upgrade prompt the web shows and open the web billing page in an in-app
browser.

Free tier caps (see `mem://features/onboarding-free-tier`):
- 3 invoices / month
- 1 client
- 1 team member
- No accounting access
- Watermarked PDFs

## Realtime

Subscribe inside `useEffect` and clean up with `supabase.removeChannel(channel)`
on unmount. See `mem://` note on Realtime — bare `.subscribe()` at component
scope leaks channels and triggers reconnect loops.

## Auth events

Register `supabase.auth.onAuthStateChange` at app boot. Use `getUser()` for
identity checks that must trust the user; `getSession()` only for token
attachment.

On sign-out: `DELETE FROM push_tokens WHERE device_id = <this device>` before
`supabase.auth.signOut()`.
