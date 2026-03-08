

# Fix: Lifecycle Campaigns Not Working for Most Users

## Root Causes Found

There are **three interconnected problems** preventing lifecycle campaigns from working:

### Problem 1: Missing `user_activity_state` rows (23 of 26 users)
The `bootstrap_user_activity_state` trigger was added in a migration on Feb 24, but 23 users who signed up before that date have no row in `user_activity_state`. Campaigns query this table to find targets, so those users are invisible.

### Problem 2: `user_id` is NULL on all business invoices
When an invoice is created for a business, line 148 of `use-invoices.ts` sets `user_id: null`:
```typescript
user_id: isBusinessInvoice ? null : user.id
```
Since every user gets an auto-created business on signup, **all invoices are business invoices**, so `user_id` is always NULL. This breaks:
- **Campaign C** (overdue nudge) — queries invoices by `user_id`
- **Campaign E** (draft nudge) — queries draft invoices by `user_id`
- **Campaign F** (weekly summary) — queries recent invoices by `user_id`
- **`on_invoice_issued_lifecycle` trigger** — uses `NEW.user_id` which is null, so `total_invoices` never increments
- **Campaign D** (inactivity) — checks `total_invoices > 0`, always false
- **Campaign I** (upsell) — checks `total_invoices >= 2`, always false

### Problem 3: `last_login_at` never gets updated
Campaign D checks `last_login_at`, but there's no mechanism updating this field when users log in.

---

## Solution

### 1. Database migration: Backfill `user_activity_state`

Insert missing rows for all 23 users who signed up before the trigger was added, computing their actual `email_verified`, `has_business`, `last_business_created_at`, and `total_invoices` from existing data.

### 2. Fix `on_invoice_issued_lifecycle` trigger

Update the trigger to resolve the user from `business_members` when `user_id` is null:

```sql
-- If user_id is null, look up the business owner
IF NEW.user_id IS NOT NULL THEN
  _target_user_id := NEW.user_id;
ELSE
  SELECT bm.user_id INTO _target_user_id
  FROM business_members bm
  WHERE bm.business_id = NEW.business_id AND bm.role = 'owner'
  LIMIT 1;
END IF;
```

### 3. Update campaign queries in the Edge Function

Modify campaigns C, E, and F to join through `business_members` instead of relying on `invoices.user_id`:

- **Campaign C**: Query overdue invoices via `business_members` → `invoices` join by `business_id`
- **Campaign E**: Query draft invoices via `business_members` → `invoices` join by `business_id`
- **Campaign F**: Query recent invoices via `business_members` → `invoices` join by `business_id`

Since the Supabase JS client can't do complex joins with aggregations easily, the approach will be:
1. Get all invoices matching the criteria (with `business_id`)
2. Look up owners from `business_members` for each `business_id`
3. Group by user for processing

### 4. Add `last_login_at` tracking

Add a call to update `user_activity_state.last_login_at` in the auth context when users log in, so Campaign D's inactivity check works.

### 5. Backfill `total_invoices` counter

Run a one-time update to set the correct `total_invoices` count for each user based on their business's non-draft invoices.

---

## Files to Change

| File | Change |
|------|--------|
| **New migration** | Backfill `user_activity_state` for existing users; fix `on_invoice_issued_lifecycle` trigger to resolve user via business_members; backfill `total_invoices` |
| `supabase/functions/process-lifecycle-campaigns/index.ts` | Update Campaigns C, E, F to query invoices by `business_id` via `business_members` instead of `user_id` |
| `src/contexts/AuthContext.tsx` | Add `last_login_at` update on successful auth |

