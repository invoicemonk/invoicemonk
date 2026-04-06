
# Fix: Signup Still Fails Because Owner Is Being Inserted Twice

## Root Cause

The earlier team-limit fix addressed one failure path, but the current codebase still has a second signup blocker:

1. `handle_new_user()` creates the profile and user role
2. `create_default_business()` creates the default business
3. The existing `add_business_creator_as_owner_trigger` automatically inserts the creator into `business_members` as `owner`
4. But the latest `create_default_business()` function also manually inserts the same owner into `business_members`
5. `business_members` has a unique constraint on `(user_id, business_id)`, so the second insert fails
6. Supabase surfaces that as the generic toast: `"Database error saving new user"`

So the current error is now most likely a duplicate-owner insert, not the team-member limit anymore.

## Implementation Plan

### 1. Fix the duplicate owner insertion
Create a new migration that updates `public.create_default_business()` so it only:
- creates the business
- returns `NEW`

It should no longer insert into `public.business_members` directly, because the existing `add_business_creator_as_owner_trigger` already handles that.

### 2. Add a defensive safeguard
Update `public.add_business_creator_as_owner()` to be idempotent:
- either `INSERT ... ON CONFLICT DO NOTHING`
- or insert only when that owner membership does not already exist

This prevents future regressions if another code path accidentally tries to add the owner again.

### 3. Preserve the previous owner-limit bypass
Keep the already-added `check_team_member_limit()` owner bypass in place. That migration is still valid and should remain, because once the duplicate insert is removed, the owner row still needs to bypass team-member limits during signup.

### 4. Verify the signup flow end-to-end
After the migration:
- create a fresh account
- confirm profile row is created
- confirm default business is created
- confirm exactly one `business_members` row exists for the owner
- confirm signup no longer throws the database error

## Files to Change

| File | Change |
|---|---|
| New Supabase migration | Update `create_default_business()` to remove the manual owner insert |
| New Supabase migration | Harden `add_business_creator_as_owner()` with idempotent insert logic |

## Technical Details

Current conflict in the schema:

```text
auth.users insert
  -> create_default_business()
      -> INSERT businesses
          -> add_business_creator_as_owner_trigger
              -> INSERT business_members (owner)
      -> INSERT business_members (owner) again   <-- duplicate
```

The unique constraint already exists on `business_members`:

```text
UNIQUE(user_id, business_id)
```

So the correct architecture is:

```text
create_default_business() -> create business only
add_business_creator_as_owner_trigger -> add owner membership once
```

## Notes

- No frontend change is required to stop this specific error.
- If desired, a later follow-up can improve signup error reporting so backend trigger failures are easier to diagnose from the UI.
