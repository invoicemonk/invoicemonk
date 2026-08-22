# Use the real logo on the loading screen and fix brand spelling

## What's wrong today

- The startup screen in `index.html` draws a fabricated green "IM" square plus the word "InvoiceMonk" as plain text. Neither is the brand logo.
- The name is spelled "InvoiceMonk" (camel case) in 74 places across the app, edge-function emails, and the loading/failure screens. The correct spelling is **Invoicemonk**.

## Changes

1. **Real logo in the loading shell**
   - Replace the "IM" box and text lockup with the actual logo file already in `public/invoicemonk-logo.png`, preloaded in `<head>` so it appears immediately.
   - Keep the subtitle line ("Loading secure workspace…") and keep the shell inline/dependency-free so it still renders before any JavaScript runs. Add a small alt text fallback so a failed image never shows a broken icon.

2. **Real logo on the startup failure screen**
   - The recovery screen in `src/main.tsx` also shows the name as text; use the same logo image there.

3. **Correct the spelling everywhere**
   - Replace "InvoiceMonk" with "Invoicemonk" across `src/` (auth layout, demo layout, marketing shots, reports, verify/public invoice pages, admin) and `supabase/functions/` email templates, senders, and subject lines.
   - Leave unrelated identifiers alone (file names, storage keys, URLs, existing DB values).

4. **Lock the rule in project memory**
   - Update the branding memory so the correct spelling is "Invoicemonk" and the loading/error screens must use the logo asset, never a fabricated monogram.

## Technical notes

Files: `index.html`, `src/main.tsx`, the 26 files containing the misspelling under `src/` and `supabase/functions/`, plus the branding memory entry. No database, billing, or auth logic changes.
