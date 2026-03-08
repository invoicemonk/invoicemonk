# Fix Lifecycle Campaign Email Branding

## Problems Identified

1. **Wrong colors**: Each campaign email uses a different gradient (amber, blue, red, etc.) instead of InvoiceMonk's brand teal (`#1d6b5a` / `hsl(166, 56%, 26%)`)
2. **No logo**: The email header is text-only — should include the InvoiceMonk logo
3. **Footer formatting**: Says "Sent by Invoicemonk · app.invoicemonk.com" — needs proper branding with the full name "InvoiceMonk"

## Changes

### File: `supabase/functions/process-lifecycle-campaigns/index.ts`

**Update `emailWrapper` function (lines 49-66):**

- Add InvoiceMonk logo image in the header (hosted from `public/invoicemonk-logo.png` via the app domain: `https://app.invoicemonk.com/invoicemonk-logo.png`)
- Replace the dynamic `headerColor` parameter with InvoiceMonk's brand teal gradient: `linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%)`
- Fix footer to read: "Sent by Invoicemonk · invoicemonk.com"

**Update all campaign template functions (A through I):**

- Remove the custom `headerColor` argument from each call to `emailWrapper` (since the header color is now standardized)
- Keep CTA button colors consistent — use the brand teal (`#1d6b5a`) for all primary buttons instead of per-campaign colors
- Accent/highlight boxes can keep contextual colors (red for overdue alerts, etc.) for visual distinction

### Detailed Template Changes


| Element                  | Before                                      | After                                   |
| ------------------------ | ------------------------------------------- | --------------------------------------- |
| Header background        | Per-campaign gradients (amber, blue, red…)  | Brand teal `#1d6b5a → #155a4a` gradient |
| Header content           | Text-only `<h1>`                            | Logo image + title text                 |
| CTA buttons              | Per-campaign colors                         | Brand teal `#1d6b5a`                    |
| Footer text              | "Sent by Invoicemonk · app.invoicemonk.com" | "Sent by Invoicemonk · invoicemonk.com" |
| `emailWrapper` signature | `(title, headerColor, bodyHtml)`            | `(title, bodyHtml)` — color is fixed    |


### No other files need changes

The edge function will be auto-deployed after editing.