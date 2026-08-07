# Fix "Add another business": silent button, wrong currency, no delete option

Three separate problems in the add-business flow. All three are confirmed in the code and in the live data.

## What is actually wrong

**1. The Create button silently does nothing**

The create dialog's button is disabled until *both* a business name and a country are chosen, but nothing on screen says so — no hint, no error, no reason. If the country combobox selection doesn't take (it's a searchable popover nested inside the dialog), the user types a name, clicks Create repeatedly, and gets zero feedback. There is also no error surfaced if the click does fire and the insert fails, because the dialog stays open with no message.

**2. New businesses have no currency at all — so they show the primary business's**

The create dialog collects Business Name, Business Type and Country, but never sets the new business's currency, and Business Type is collected and then thrown away (never sent). The database has no fallback currency, so the new business is saved with an empty currency.

Because the currency is empty, the database rule that normally creates the business's first currency account skips it — the new business ends up with **zero** currency accounts. The app then falls back to whatever currency account was last active, which is the primary business's. Verified in live data: the three businesses created today all have an empty currency and zero currency accounts.

**3. Delete exists, but is effectively invisible**

There *is* a working Delete Business flow (Danger Zone with type-the-name confirmation) — but it only lives at the very bottom of the Business Profile settings page, and only for non-primary businesses. It is not offered anywhere near the business list or switcher, which is where a user looks after creating one by mistake. Deletion is also correctly blocked once the business has invoices, credit notes or receipts, but the switcher gives no indication any of this exists.

## The fix

### Create dialog
- Add a **Currency** field. When a country is picked, auto-fill the currency from that country (and let the user override it). Fall back to USD if the country's currency isn't one we support.
- Send the currency and the business type through on create, so the new business gets a real currency and its first currency account is created automatically.
- Stop the silent dead-click: show inline "required" hints on the name and country fields, and keep the button enabled so the click produces a visible validation message instead of nothing.
- Surface create failures as an error inside the dialog (currently the dialog just sits there).
- Reset all dialog fields on close/success so a second attempt doesn't inherit stale values.

### Country selection reliability
Replace the nested searchable-popover country picker in this dialog with the same pattern used elsewhere in the app for in-dialog selects, so a selected country reliably registers.

### Delete
- Add a **Delete** action to each non-primary business row in the business switcher, opening the existing confirmation dialog.
- Add a short line in the Danger Zone explaining when deletion is blocked (invoices, credit notes or receipts exist), so the error isn't a surprise.
- Keep the existing rule that the primary business can never be deleted.

### Repair the businesses already created without a currency
A one-off data fix for the businesses currently saved with an empty currency: set their currency from their country, and create their missing default currency account. This only touches businesses with no currency and no currency accounts.

## Technical notes

- `src/components/app/BusinessSwitcher.tsx` — add currency state derived from `COUNTRIES[].currency`, pass `default_currency` and `business_type` into `useCreateBusiness`, replace the `Popover`+`Command` country picker, add validation messaging and full state reset, add per-row delete wired to `DeleteBusinessDialog` + `useDeleteBusiness`.
- `businesses.default_currency` has no DB default and `auto_create_default_currency_account()` early-returns on `NULL`, which is why `currency_accounts` is empty for the new rows.
- Currency options come from `ALL_CURRENCIES` in `src/hooks/use-business-currency.ts` (36 supported); a country whose currency is outside that set falls back to USD.
- Backfill runs as a data update over `businesses` where `default_currency IS NULL`, joining `COUNTRIES`-equivalent mapping inline, plus an insert into `currency_accounts` for those businesses.
- No change to `delete_empty_business` — its guards (owner-only, not primary, no invoices/credit notes/receipts) are correct as-is.
