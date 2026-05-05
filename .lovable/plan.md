# Fix Country Dropdown in Create Business Dialog

## Problem

In `src/components/app/BusinessSwitcher.tsx`, the "Create a New Business" dialog hardcodes only 6 countries (NG, GH, KE, ZA, US, GB) and defaults the country state to `'NG'` (Nigeria). New users see Nigeria pre-selected and have no way to pick most countries.

## Fix

**File: `src/components/app/BusinessSwitcher.tsx`**

1. **Remove the default value** — change `useState('NG')` to `useState('')` so no country is pre-selected.
2. **Replace the hardcoded 6 `<SelectItem>`s** (lines 332–337) with a `.map()` over the `COUNTRIES` array imported from `src/lib/countries.ts` (already the project's single source of truth, ~195 ISO countries grouped by region).
3. **Add searchability** — since the list is long (~195 items), use the existing `Command`/`Combobox` pattern (already used in the app, e.g. `ProductServiceCombobox`) instead of a plain `Select`, so users can type to filter. Display format: country name only (codes hidden in the value).
4. **Validate before submit** — disable the "Create" button when `newBusinessCountry` is empty (currently only checks `newBusinessName`), and show "Select country" placeholder.
5. **Add the import**: `import { COUNTRIES } from '@/lib/countries';`

## Out of scope

No DB/migration changes — `jurisdiction` column already accepts any ISO code. Other dropdowns in the app (e.g. BusinessProfile country selector) already use the full `COUNTRIES` list; only this dialog was outdated.
