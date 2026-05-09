## Goal

Add 14 public, no-auth routes that render pixel-stable, on-brand product scenes you can screenshot at exactly 1600×1200 and export as JPGs.

## Architecture

**New folder:** `src/pages/marketing-shots/`

- `MarketingShotFrame.tsx` — wrapper that:
  - Locks viewport to a fixed 1600×1200 stage (`w-[1600px] h-[1200px] overflow-hidden bg-background`).
  - Centers itself so the route is screenshot-ready at 1600×1200 regardless of actual browser window.
  - Renders a faux Invoicemonk app shell on the left (sidebar from `BusinessSidebar` styling + real `invoicemonk-logo.png`) and a top header bar, mirroring `BusinessLayout`, but using static seed data so no auth/data fetches run.
  - Children render inside the main content area.

- `seed.ts` — single source of seeded demo data: clients (Acme Studio, Lagos Builders Ltd, Müller GmbH, Nairobi Coffee Roasters), invoices, estimates, receipts, currencies (USD/EUR/NGN/KES), FX rates.

**Why a faux shell instead of the real `BusinessLayout`:** the real layout requires auth, business context, subscription context, RLS data — none of which is appropriate for a public screenshot route. We reuse the same UI primitives (`Sidebar*` components, semantic tokens, logo) so it looks identical to the product without needing a logged-in business.

## Routes

Add to `src/App.tsx` (public, no `ProtectedRoute`):

```
/marketing-shots/invoicing-eu-vat
/marketing-shots/invoicing-africa
/marketing-shots/invoicing-global
/marketing-shots/estimates-templates
/marketing-shots/estimates-client-portal
/marketing-shots/estimates-tracking
/marketing-shots/estimates-conversion
/marketing-shots/clients-profiles
/marketing-shots/clients-communication
/marketing-shots/clients-segmentation
/marketing-shots/clients-alternating
/marketing-shots/receipts-scanning
/marketing-shots/receipts-storage
/marketing-shots/receipts-search
```

Each is a tiny page file that imports `MarketingShotFrame` + the relevant scene component.

## Scene composition (one per route)

All scenes use shadcn primitives (`Card`, `Table`, `Badge`, `Button`, `Tabs`, `Input`, `Avatar`, `Progress`) and Tailwind semantic tokens only. No red anywhere — status pills use teal/amber/blue/emerald/muted. Statuses currently using `bg-destructive` in demo files will be swapped for `bg-amber-500/10 text-amber-700` in these scenes.

**Invoicing**
1. `invoicing-eu-vat` — Invoice editor: header "Invoice INV-2026-0042 → Müller GmbH (Berlin)", bill-to card with EU VAT ID `DE123456789`, line items in EUR, 19% VAT line, totals card, reverse-charge note callout, currency = EUR.
2. `invoicing-africa` — Invoice editor for Lagos Builders Ltd, NGN, line items, 7.5% VAT line, payment-options card listing Paystack + Flutterwave + Bank Transfer with brand-neutral labels.
3. `invoicing-global` — Invoice list table: rows mixing USD/EUR/NGN/KES with currency column, "Total" column showing native + small "≈ $X,XXX USD" converted; filter chips active for "All currencies".

**Estimates**
4. `estimates-templates` — 6 template cards (Modern, Classic, Minimal, Bold, Studio, Construction) with thumbnail (lightweight CSS mockup), name, "Use template" button visible on the focused card.
5. `estimates-client-portal` — Public estimate view: company header w/ logo, line items, totals, Accept / Decline / Comment buttons row, signature block at bottom with name + date fields.
6. `estimates-tracking` — Kanban: 5 columns (Draft, Sent, Viewed, Accepted, Declined) with count + total per column header and 2–3 estimate cards per column.
7. `estimates-conversion` — "Convert to invoice" modal centered over a dimmed estimate detail page, showing line items being copied with checkmarks.

**Clients**
8. `clients-profiles` — Acme Studio detail: contact card, KPI tiles (Lifetime value $48,200, Outstanding $3,450, Invoices 27), recent invoices table.
9. `clients-communication` — Vertical activity timeline with icons: Invoice sent → Viewed → Reminder email → Partial payment → Thank-you note (timestamps).
10. `clients-segmentation` — Clients table with active filter chips ("Top 10% by revenue", "Overdue > 30 days", "Retainer") and tag chips per row.
11. `clients-alternating` — Overview dashboard: KPI tiles (Total clients 184, New this month 12, Churn 1.2%) + horizontal bar chart of top 5 clients (recharts).

**Receipts**
12. `receipts-scanning` — Two-column: left receipt image preview (use a local SVG/placeholder mock receipt — no AI gen), right extracted-fields card (Vendor, Date, Amount, Tax, Category) each with confidence Progress bar.
13. `receipts-storage` — Grid (4×3) of receipt thumbnail cards: vendor name, amount, date, category badge.
14. `receipts-search` — Receipts list with search input pre-filled "uber", filter row (date range, vendor, amount range, category), filtered result rows.

## Visual rules enforced everywhere

- Logo: `import logo from '@/assets/invoicemonk-logo.png'` in the shell.
- Primary teal `hsl(170 82% 26%)` already matches `--primary`. Components use `bg-primary` / `text-primary`.
- No `text-red-*`, `bg-red-*`, or `bg-destructive` in these scenes (warnings → amber, info → blue, success → emerald).
- Cards: `rounded-xl border bg-card shadow-sm`.
- Each scene component receives the seed data as props and renders fully synchronously — no fetch, no auth, no context needed.

## Out of scope

- No new business logic, no DB changes, no edge function changes.
- No screenshotting automation — you stated you'll capture each route manually at 1600×1200.
- Real `BusinessLayout` is not modified; the faux shell only mimics it visually.

## Verification

1. Visit each of the 14 routes at 1600×1200 — content fits with no scrollbars.
2. Grep the new folder for `red-`, `destructive`, `lorem` — should be zero hits.
3. Sidebar + logo + teal primary visible on every scene.
