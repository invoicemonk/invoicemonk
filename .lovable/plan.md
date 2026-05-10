# 11 New Marketing Screenshot Routes

Extends the existing `/marketing-shots/<slug>` pattern (already used for the 14 prior shots). Reuses `MarketingShotFrame`, real shadcn components, semantic tokens, the real `invoicemonk-logo.png`, and seeded generic data. Strict 1600×1200 frame, light theme, teal primary, no red, no lorem ipsum.

## Routes to build

| # | Slug | Active sidebar | Scene summary |
|---|------|----------------|---------------|
| 1 | `expenses-receipt-scanning` | expenses | Phone-style capture card on left (receipt thumbnail), AI-extracted fields panel on right (vendor, date, amount, category, tax) with confidence chips and "Save expense" CTA. |
| 2 | `expenses-categories` | expenses | Expenses table grouped by Office Supplies / Software / Travel / Meals with colored category pills; right rail shows a recharts donut + category legend with totals. |
| 3 | `expenses-tax-tracking` | expenses | Expenses table with per-row "Tax-deductible" toggle/badge; top KPI tile "Tax-deductible YTD: $18,420"; "Download tax report" button in header. |
| 4 | `expenses-automation` | expenses | Three-pane: (a) receipt being auto-parsed with field extraction overlay, (b) list of already-categorized expenses with "Auto" badge, (c) "Generate report" CTA card with month coverage. |
| 5 | `accounting-chart-of-accounts` | reports | Hierarchical chart of accounts (Assets / Liabilities / Equity / Revenue / Expenses) as expandable groups with account codes (1000–5999) and YTD balances. |
| 6 | `accounting-financial-reports` | reports | Profit & Loss statement with section totals, this-period vs last-period column, % change, and "Export PDF / Export CSV" buttons. |
| 7 | `accounting-multi-entity` | dashboard | Entity switcher dropdown shown open with 3 businesses (Acme Studio, Müller GmbH, Lagos Builders Ltd); below it a consolidated dashboard — per-entity revenue tiles + combined total + small bar chart. |
| 8 | `accounting-automation` | reports | Bank-feed reconciliation list — imported transactions auto-matched to invoices/expenses with emerald "Matched" badges; floating "Live P&L" card in corner with mini sparkline. |
| 9 | `feature-relief` | invoices | Invoice detail (INV-2026-0042 to Müller GmbH) with right-side audit trail timeline (Created → Sent → Viewed → Paid with timestamps & actor) and "Immutable record" badge in header. |
| 10 | `feature-professional` | invoices | Polished branded invoice preview — InvoiceMonk-styled — with logo, sender/recipient blocks, line items, VAT breakdown, totals, payment instructions. |
| 11 | `feature-compliance` | settings | Compliance dashboard — jurisdictions list (EU VAT, UK MTD, India GST, Nigeria FIRS, France FE) each with emerald "Compliant" pill + last-checked date; KPI tile "Audit-ready records: 1,284". |

## Implementation

**New files** (all in `src/pages/marketing-shots/`):
- 11 new scene components matching the slugs above (PascalCase filenames, e.g. `ExpensesReceiptScanning.tsx`).
- Append exports to existing `index.ts`.

**Modified files:**
- `src/App.tsx` — add 11 new public `<Route path="/marketing-shots/...">` entries next to the existing block.
- `src/pages/marketing-shots/seed.ts` — extend with: `expensesByCategory`, `taxDeductibleExpenses`, `bankFeedMatches`, `chartOfAccounts`, `plRows` (P&L sections), `entitiesConsolidated`, `auditTrail`, `complianceJurisdictions`. All generic-realistic, no PII, no lorem.

**Reuses without modification:**
- `MarketingShotFrame` for sidebar/topbar/logo/branding.
- shadcn `Card`, `Badge`, `Button`, `Table`, `Tabs`, `Switch`, `Progress`, `Avatar`, `Input`, `DropdownMenu` (or static open-state for entity switcher).
- `recharts` for the donut (categories) and small bar/sparkline (multi-entity, live P&L).

## Visual rules (enforced everywhere)
- Primary: `bg-primary` / `text-primary` only — `hsl(170 82% 26%)` from tokens.
- Status colors: paid/matched/compliant → emerald; pending/sent → blue; warnings → amber. **No red, no `bg-destructive`, no `text-red-*`.**
- Cards: `rounded-xl border bg-card shadow-sm`.
- All scenes are fully synchronous static JSX — no fetches, no auth, no contexts.
- Logo: `import logo from '@/assets/invoicemonk-logo.png'` (already done inside the frame).

## Out of scope
- No business-logic, DB, edge-function, or routing changes beyond adding the 11 public routes.
- No screenshotting automation — you'll capture each route at 1600×1200 manually.
- No changes to the existing 14 marketing-shot routes.

## Verification
After build: grep new files for `red-`, `destructive`, `lorem`, `placeholder`, `Image here` to confirm zero matches; spot-check each route in preview at 1600×1200 to confirm no scrollbars or clipped content.
