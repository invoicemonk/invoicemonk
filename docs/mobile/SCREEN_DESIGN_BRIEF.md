# InvoiceMonk Mobile — Product Plan & Screen Design Brief

> For handing to **Claude Design**. Part 1 is the plan (features + full screen
> map). Part 2 is the per-screen design brief — one block per screen, written so
> each can be pasted into Claude Design on its own.
>
> Sources: `CLAUDE.md`, `FEATURE_INVENTORY.md`, `ARCHITECTURE.md`,
> `SCANNING_SPEC.md`, `BACKEND_CONTRACT.md`, `DESIGN_TOKENS.md`.
> Competitor reference: invoicemonk.com (parity target), easy-expense
> (receipt-scanner UX target).

---

# PART 1 — THE PLAN

## 1.1 What we're building

A native **iOS + Android** app (Expo / React Native) that delivers everything
the InvoiceMonk web app does — **minus the Admin (`/admin`) and Partner
(`/partner`) portals** — plus one hero capability the web can't match:

> **Point the phone at a receipt or invoice → it's captured, categorized, and
> synced into accounting in under 10 seconds.**

Same Supabase backend, same auth users, same tables. Anything created on mobile
appears on web instantly and vice-versa.

## 1.2 The three pillars

1. **Scan → categorize → sync** (the reason the app exists). Camera capture,
   auto-crop, AI extraction, review with confidence bars, one-tap save into the
   expense inbox / accounting.
2. **Full invoicing & accounting on the go** — invoices, estimates, clients,
   products, vendors, expenses, receipts, payments, reports.
3. **Compliance-first** — currency-scoped accounts, jurisdiction badges, KYC
   verification, audit trail. This is InvoiceMonk's differentiator vs.
   easy-expense.

## 1.3 Platforms & constraints (design-relevant)

- Two platforms, one design that respects each: iOS safe areas / Dynamic Island,
  Android status bar + back gesture. Bottom tab bar on both.
- **Light + dark mode** — every screen must be designed in both (tokens exist
  for both in `DESIGN_TOKENS.md`).
- **Every screen has 4 states**: loading (skeleton), empty, error+retry, and
  loaded. Design all four for list/detail screens.
- **Offline-first**: scan and mutations queue locally. UI shows pending badges
  and "saved offline" affordances.
- **No paywall at signup.** Free tier is the default; upgrades are a *page*, not
  a gate. Tier caps surface as contextual upgrade sheets.

## 1.4 Navigation model

```
Bottom tab bar (5 slots):
  [ Dashboard ]  [ Invoices ]  ( ⬤ SCAN )  [ Expenses ]  [ More ]
                                   ^hero center FAB, raised

Header (persistent):
  [Business switcher ▾]     InvoiceMonk     [Currency ▾] [🔔] [avatar]

"More" → modal drawer with everything not on the tab bar:
  Estimates · Clients · Vendors · Products & Services · Receipts ·
  Accounting · Reports · Payments · Import · Referrals · Support · Settings
```

Business switcher + currency-account switcher live in the header on every tab,
exactly like web. Deep links open native screens where they exist, in-app
browser (`expo-web-browser`) for Stripe checkout, KYC handoff, and legal pages.

## 1.5 Complete screen inventory

Grouped by area. **★ = hero-path screen, gets the most design polish.**

### A. Auth & onboarding (7)
1. Splash / session bootstrap
2. Sign in (email + Google)
3. Sign up
4. Verify email
5. Forgot password
6. Reset password
7. Onboarding business wizard (multi-step: profile → jurisdiction → currency → business type)

### B. Shell & global (5)
8. Bottom tab bar + center Scan FAB (component, not a route)
9. App header (business + currency switchers, notifications bell, avatar)
10. Business switcher sheet
11. Currency-account switcher sheet
12. "More" drawer (grid of remaining sections)

### C. Scan — hero flow (6) ★
13. ★ Camera capture (receipt/invoice toggle, torch, edge-detect overlay, multi-page)
14. ★ Crop / perspective-correction preview (Re-crop / Retake / Looks good)
15. ★ Upload + extracting status (shimmer, offline queue badge)
16. ★ Review & edit (confidence bars, editable fields, line items)
17. ★ Bill-to-client (reimbursement) sheet
18. ★ Duplicate-detected inline warning state
19. Scan history / outbox (pending, failed, retry) — (call it 6+1)

### D. Dashboard (1)
20. Dashboard (KPIs, cashflow, receivables, profitability, compliance confidence, quick-setup checklist, banners)

### E. Invoices (6)
21. Invoice list (filters: status, date, client, currency)
22. Invoice detail (PDF preview, actions)
23. Invoice create / edit (line items, deposit, parent linking)
24. Send invoice dialog
25. Record payment / mark paid (+ payment proof upload)
26. Credit note create

### F. Estimates / quotes (3)
27. Estimate list
28. Estimate detail
29. Estimate create / edit (+ convert to invoice)

### G. Clients (3)
30. Client list (search, filters, segmentation tags)
31. Client detail sheet (communication history)
32. Client add / edit

### H. Products & services (2)
33. Product/service list
34. Product/service add / edit (also appears as combobox inside invoice create)

### I. Vendors (3)
35. Vendor list
36. Vendor detail sheet
37. Vendor add / edit (+ merge duplicates)

### J. Expenses (5)
38. Expense list (categories, tax)
39. Expense detail
40. Expense add / edit
41. Recurring expenses list + add/edit
42. Expense inbox (unmatched scans + manual entries) ★ — scan lands here

### K. Receipts (3)
43. Receipt list (search, storage view)
44. Receipt detail (verify, PDF download)
45. Send receipt dialog

### L. Accounting (2)
46. Accounting hub (chart of accounts, insight cards, money-flow, missing-data banner)
47. Financial reports + tax report/diagnostics (period selector, jurisdiction badges, disclaimers)

### M. Payments (3)
48. Payment methods list + CRUD
49. Payment history (per invoice / global)
50. Orphaned payment recovery

### N. Billing (self) (3)
51. Plan & usage (current tier, limits, usage meters)
52. Upgrade page (plan comparison → opens web checkout)
53. Cancel / downgrade feedback dialog

### O. Notifications (2)
54. Notification center (read/unread)
55. Notification preferences (per-device toggle + per-channel)

### P. Verification / KYC (2)
56. Verification status
57. Document capture for verification (camera) + Stripe Connect handoff

### Q. Reports & exports (2)
58. Reports hub / email report dialog
59. Export manifests + downloads

### R. Import (2)
60. CSV import wizard
61. Migration wizard (from other tools)

### S. Referrals (1)
62. Referrals (own link, native share, stats)

### T. Support (2)
63. Support hub (Tawk.to chat, contact form)
64. Support tickets (read-only list + thread)

### U. Settings (7)
65. Settings index
66. Profile
67. Business profile
68. Preferences (theme, locale, notifications)
69. Accounting preferences
70. Currency accounts management
71. Account closure

### V. Public / verify (3)
72. Public invoice view (`/invoice/:id`)
73. Verify invoice (`/verify/invoice/:id`)
74. Verify receipt (`/verify/receipt/:id`)

### W. System states (shared components, design once)
75. Empty state template
76. Error + retry template
77. Loading skeleton template
78. Upgrade / tier-cap sheet
79. Toast / notification banner
80. Camera-permission-denied screen

**~74 unique screens + ~6 shared state templates.**

## 1.6 Suggested design order (matches build milestones)

1. **Foundation first** — design tokens, tab bar + FAB, header, and the 6 shared
   state templates (#75–80). Everything else reuses these.
2. **M1**: Auth (2–7), onboarding wizard (7), dashboard (20), switchers (10–12).
3. **M2 — hero**: full scan flow (13–19) + expense inbox (42). Spend the most
   design time here.
4. **M3**: Invoices (21–26), Clients (30–32), Products (33–34).
5. **M4**: Expenses (38–41), Receipts (43–45), Vendors (35–37), Accounting (46–47).
6. **M5**: Billing (51–53), Notifications (54–55), Payments (48–50).
7. **M6**: Settings (65–71), Import (60–61), Reports (58–59), Referrals (62),
   Verification (56–57), Public/verify (72–74).

---

# PART 2 — SCREEN-BY-SCREEN DESIGN BRIEF

## 2.0 Global design foundation (applies to every screen)

**Brand.** InvoiceMonk (camelCase). Primary teal **#1D6B5A**. Feel:
trustworthy, calm, compliance-grade — not a flashy consumer app. Generous
whitespace, clear hierarchy, tabular numerals for money.

**Color tokens** (use semantic names, never hardcode):
- Light: background `#FCFDFE`, foreground `#0F172A`, card `#FFFFFF`,
  primary `#1D6B5A`, primary-fg `#FFFFFF`, secondary `#F5F8FA`,
  muted `#EEF2F5`, muted-fg `#4B5563`, accent (soft teal tint) `#EAFBF5`,
  destructive `#EF4444`, warning `#F59E0B`, success `#16A34A`,
  border `#E2E8F0`.
- Dark: background `#0F172A`-ish (`222 47% 11%`), card `222 40% 14%`,
  primary brightens to `174 58% 39%`. Design every screen in dark too.

**Radius.** Cards `12px` (rounded-lg), sheets/large `16px` (rounded-xl),
inputs `10px`, pills/avatars/FAB `full`.

**Shadows.** Card `0 4px 24px -4px rgba(15,23,42,.08)`; elevated/hover
`0 12px 32px -8px rgba(15,23,42,.15)`; primary glow (FAB/hero)
`0 0 60px rgba(29,107,90,.2)`.

**Hero gradient.** `linear-gradient(135deg, #1D6B5A 0%, #2FA98C 100%)` — use on
the Scan FAB, onboarding hero, and empty-state illustrations sparingly.

**Type scale.** Display 32/700 · H1 24/700 · H2 20/600 · H3 18/600 ·
Body 16/400 · Body-sm 14/400 · Caption 12/500 (uppercase labels). System font
(SF Pro / Roboto). Money always tabular-nums.

**Spacing.** 4px base. Screen padding 16px. Card padding 16px. Section gap 24px.

**Layout rules.** Persistent header (56px) with business/currency switchers +
bell + avatar. Bottom tab bar (5 slots) with a **raised circular Scan FAB** in
the center using the hero gradient + primary glow. Respect iOS + Android safe
areas. Content never scrolls under the FAB — lists get bottom padding.

**Every list/detail screen ships four states:** skeleton loading, empty (icon +
one-line explainer + primary CTA), error (icon + message + Retry), and loaded.

---

### GROUP A — AUTH & ONBOARDING

**Screen 1 — Splash / bootstrap.** Full-bleed hero-gradient background,
centered InvoiceMonk wordmark + monogram, subtle activity indicator at bottom.
No buttons. Shown while `getSession()` restores. Dark = same gradient, slightly
deeper.

**Screen 2 — Sign in.** Clean centered card on plain background. Logo top,
"Welcome back" H1, subhead. Fields: Email, Password (with show/hide eye).
Primary full-width teal **Sign in** button. Below: **Continue with Google**
(outlined button, Google mark). Links: "Forgot password?" (right-aligned under
password) and "Don't have an account? Sign up" footer. Inline field validation,
error banner slot at top. Keyboard-avoiding. Loading = button spinner.

**Screen 3 — Sign up.** Same shell as sign in. "Create your account" H1.
Fields: Full name, Email, Password (with strength hint), optional business name.
Primary **Create account**. Google option. Fine print: "By continuing you agree
to Terms & Privacy" (links open in-app browser). Footer: "Already have an
account? Sign in." **No plan/paywall step** — free tier is implied.

**Screen 4 — Verify email.** Centered illustration (envelope with teal accent),
H2 "Check your inbox", body showing the masked email, **Resend email**
(secondary, with cooldown timer), **Open mail app** (primary), and "Wrong
email? Go back". Auto-advances when the deep link is followed.

**Screen 5 — Forgot password.** Minimal: "Reset your password" H2, explainer,
single Email field, **Send reset link** primary, back link. Success = inline
confirmation state replacing the form.

**Screen 6 — Reset password** (reached via deep link). New password + confirm,
strength meter, **Update password** primary. Success → auto-route to app.

**Screen 7 — Onboarding business wizard.** Multi-step, full-screen, with a slim
**progress indicator** (4 dots/segments) at top and Back/Next footer. Warm,
welcoming, hero-gradient accent header per step. Steps:
- 7a **Business profile** — name, logo upload (optional, camera/library),
  business email/phone.
- 7b **Jurisdiction** — country/region picker (search list), sets compliance
  rules; show a reassuring "This tailors tax & invoicing rules" caption.
- 7c **Currency** — primary currency picker (this becomes the first
  currency-account). Note per-currency isolation subtly.
- 7d **Business type** — segmented choices (freelancer, LLC, retailer, etc.)
  with icons.
- Final: "You're all set" success screen with a **Scan your first receipt** CTA
  (routes to the hero) + "Go to dashboard" secondary. Reinforce free-tier
  ("Free plan active — no card needed").

---

### GROUP B — SHELL & GLOBAL

**Screen 8 — Bottom tab bar + Scan FAB.** 5 slots: Dashboard, Invoices,
**Scan (center, raised circular FAB, hero gradient + glow, camera glyph)**,
Expenses, More. Active tab = primary teal icon + label; inactive = muted-fg.
The Scan FAB shows a small **count badge** ("3") when the scan outbox has
pending items. Frosted/blur background over content on iOS.

**Screen 9 — App header.** Left: **business switcher** (business avatar + name +
chevron). Right cluster: **currency-account switcher** (currency code pill),
notifications **bell** (unread dot), user **avatar** (opens quick menu). Title
centered only on sub-screens; tabs show the switcher on the left instead.

**Screen 10 — Business switcher sheet.** Bottom sheet. List of businesses
(avatar, name, role badge, current-check). Search if many. "Add business" row at
bottom. Tapping switches context app-wide and dismisses.

**Screen 11 — Currency-account switcher sheet.** Bottom sheet listing currency
accounts (flag/emoji, currency code, name, balance hint). Current one checked.
Caption: "Data is isolated per currency." "Manage currency accounts" link →
Settings.

**Screen 12 — "More" drawer.** Full-height modal. Grid of labeled icon tiles:
Estimates, Clients, Vendors, Products & Services, Receipts, Accounting, Reports,
Payments, Import, Referrals, Support, Settings. Each tile: teal-tinted (accent
bg) rounded square icon + caption. Search field at top. User card (avatar, name,
plan badge) pinned at bottom → Settings.

---

### GROUP C — SCAN (HERO FLOW) ★

> This is the app. Judge every choice against "does it help capture the receipt
> *right now* with zero friction?" Reference easy-expense's fast capture but keep
> InvoiceMonk's calm, trustworthy tone.

**Screen 13 — Camera capture. ★** Full-screen live camera. Minimal chrome:
- Top bar: close (X), **torch toggle**, **ratio toggle** (Auto for receipts /
  A4 for invoices).
- A **green quad overlay** that snaps to the detected document edges; subtle
  "Align the receipt" hint when nothing detected; after 5s allow manual capture
  regardless.
- **Mode segmented control** at the bottom: **Receipt** (default) · **Invoice**.
- Large circular **shutter** button. To its left: last-thumbnail / gallery
  import (`expo-image-picker`). To its right: **multi-page** toggle showing a
  page counter ("Page 2") when active with an **Add page** affordance.
- Everything one-handed and thumb-reachable. Dark UI (camera is dark).

**Screen 14 — Crop / perspective preview. ★** Shows the captured frame with an
adjustable **crop quad** (draggable corner handles) over an auto-corrected,
brightness-normalized image. Footer buttons: **Re-crop** (secondary),
**Retake** (secondary/destructive-tint), **Looks good** (primary). For
multi-page: a horizontal filmstrip of captured pages with reorder/delete and an
**Add page** tile.

**Screen 15 — Upload + extracting. ★** Immediately after "Looks good", upload
starts. Show the thumbnail with an **"Extracting…" shimmer** overlay and a
progress feel (skeleton fields animating in below). If offline: a calm inline
chip "Saved offline — will upload when you're back online," and it still lets the
user move on. A subtle **outbox indicator** (e.g., "1 pending") is visible.

**Screen 16 — Review & edit. ★** The payoff screen. Header: vendor name (big) +
thumbnail. Then a form of extracted fields, **each with a confidence bar**:
- ≥90% = normal (teal/neutral).
- 70–89% = **amber** bar + "Please confirm".
- <70% = **red** bar, must be corrected.
Fields: **Vendor** (autocomplete against existing vendors, with "Create vendor"),
Date, Currency, Subtotal, Tax, Tax rate, Total, Category (picker), Payment
method. **Line items** as an editable list (add/edit/remove rows, each with
description/qty/amount). Sticky footer: **Save** (primary). A secondary
"Bill this to a client / project" toggle sits above Save (→ Screen 17). Keep it
scannable — the user should be able to accept a clean extraction in one tap.

**Screen 17 — Bill-to-client (reimbursement) sheet. ★** Bottom sheet triggered
by the reimbursement toggle. Client picker (search existing clients) + optional
project/tag field. Explainer: "This marks the expense as billable so you can
recover it." Confirm returns to Review with a billable chip shown.

**Screen 18 — Duplicate-detected state. ★** Not a blocker — an **inline amber
banner** at the top of Review: "Looks like the Hilton Berlin receipt from May 2
— same vendor & amount. Save anyway?" with "View existing" and dismiss. Design
the banner variant of the Review screen.

**Screen 19 — Scan history / outbox.** List of scan jobs: thumbnail, vendor/
amount (or "Extracting…"/"Failed"), status chip (pending / uploading /
extracted / saved / failed). Failed rows show **Retry** and, for malformed AI
output, an **"Enter manually"** action + a debug expander with raw text. Pull to
refresh. Empty state: "No scans yet — tap the center button to capture one."

**Post-save toast** (shared): "Receipt saved to «Business». It's in your expense
inbox." Tapping deep-links to the inbox item (Screen 42).

---

### GROUP D — DASHBOARD

**Screen 20 — Dashboard.** Scrollable, card-based home. Top: greeting + current
business/currency context echoed. Content, in order:
- **KPI row** — Revenue, Expenses, Receivables, Cash. Each a compact card with
  label (caption), big tabular number, and a small period-delta chip
  (green/red). Horizontally scrollable on small screens.
- **Cashflow summary** — a simple in/out bar or mini line chart, period toggle.
- **Receivables card** — outstanding total + count, "overdue" segment
  highlighted amber, CTA "View invoices".
- **Profitability card** — margin snapshot.
- **Compliance confidence** — a teal gauge/score + short analytics; taps into
  Accounting.
- **Quick-setup checklist** — dismissible card with steps (add business info,
  create first invoice, scan a receipt, add a client) with checkmarks and
  progress.
- **Banner slots** (stackable, dismissible, colored by type): payment issue
  (destructive), starter-plan sunset (warning), immutability notice, FR
  e-invoicing, online-payments prompt.
Empty/new-user variant leans on the checklist and a big "Scan your first
receipt" CTA. All money currency-scoped — never mix currencies.

---

### GROUP E — INVOICES

**Screen 21 — Invoice list.** Sticky filter bar (chips: Status, Date, Client,
Currency) + search. Each row: client name, invoice #, status pill
(draft/sent/paid/overdue with semantic colors), amount (tabular), due date.
FAB or header **+** to create. Infinite scroll (paginated). Realtime updates.
Empty: "No invoices yet — create your first." Loading skeleton rows.

**Screen 22 — Invoice detail.** Header: client, invoice #, status pill, big
total. **PDF preview** (via expo-print) in a card with a "View / Share PDF"
action. Sections: line items, totals breakdown (subtotal/tax/discount/total),
payment status + history, **payment proofs**, **compliance artifacts**,
**regulatory status** (jurisdiction badges). Action bar: **Send** (→24),
**Record payment** (→25), Edit, more menu (duplicate, credit note, share public
link, download PDF). Deposit invoices show linked parent.

**Screen 23 — Invoice create / edit.** Multi-section form:
- Client picker (search + "Add client"), invoice # (auto), issue + due dates.
- **Line items** editor: product/service combobox (search existing → autofills
  price/tax) or free entry; qty, unit price, tax, line total; add/remove rows;
  running subtotal.
- Discount, tax summary, **total** (large, sticky).
- Options: deposit invoice toggle (+ parent linking), notes/terms, currency
  (from current account), template.
Sticky footer: **Save draft** + **Save & send**. Tier-cap check before save (free
= 3/month → upgrade sheet).

**Screen 24 — Send invoice dialog.** Bottom sheet: recipient email(s)
(prefilled from client), subject, message (editable template), attach-PDF toggle,
"send me a copy". **Send** primary. Requires explicit confirm (outbound action).

**Screen 25 — Record payment / mark paid.** Sheet: amount (defaults to balance),
date, payment method picker, reference/note, **upload payment proof**
(camera/library). "Mark as fully paid" quick toggle. Save updates status +
history.

**Screen 26 — Credit note create.** Form referencing the source invoice: reason,
amount/lines to credit, date. Save → linked on the invoice detail.

---

### GROUP F — ESTIMATES / QUOTES

**Screen 27 — Estimate list.** Mirrors invoice list; status pills
(draft/sent/accepted/declined/expired).

**Screen 28 — Estimate detail.** Mirrors invoice detail; primary action
**Convert to invoice** plus Send, Edit. PDF preview.

**Screen 29 — Estimate create / edit.** Mirrors invoice create (line items,
client, validity date). Footer: Save draft / Save & send.

---

### GROUP G — CLIENTS

**Screen 30 — Client list.** Search + filter (segmentation tags). Rows: avatar/
initials, name, company, tag chips, outstanding-balance hint. Header **+** to
add. Alphabetical section headers optional. Empty state CTA "Add your first
client."

**Screen 31 — Client detail sheet.** Contact block (email, phone, address,
tags), quick stats (total billed, outstanding, invoices count), **communication
history** timeline (sent invoices, emails, receipts), and quick actions (new
invoice, edit, call/email). Segmentation tag editor.

**Screen 32 — Client add / edit.** Form: name, company, email, phone, billing
address, currency default, tax id, segmentation tags, notes. Inline validation.
Save primary.

---

### GROUP H — PRODUCTS & SERVICES

**Screen 33 — Product/service list.** Search. Rows: name, unit price (tabular),
tax rate, type (product/service) chip. Header **+**. Empty CTA.

**Screen 34 — Product/service add / edit.** Form: name, description, unit price,
currency, tax rate/category, SKU (optional), type toggle. Also rendered as a
**combobox** inside invoice/estimate creation — design that compact inline
picker variant (search field + result rows + "Create new").

---

### GROUP I — VENDORS

**Screen 35 — Vendor list.** Search. Rows: vendor name, category, total spend
hint. Header **+**. Duplicate-merge affordance (multi-select → Merge). Empty CTA.

**Screen 36 — Vendor detail sheet.** Contact + category, spend stats, linked
expenses/receipts list, edit action.

**Screen 37 — Vendor add / edit + merge.** Form: name, contact, category, tax
id, notes. **Merge duplicates** flow: pick two vendors → preview merged result →
confirm.

---

### GROUP J — EXPENSES

**Screen 38 — Expense list.** Filter chips (category, date, billable, tax). Rows:
vendor, category chip, amount (tabular), date, billable/tax badges. Header **+**.
A prominent entry point back to **Scan** ("Scan a receipt"). Empty CTA.

**Screen 39 — Expense detail.** Vendor, amount, category, tax, date, payment
method, attached **receipt image/PDF** preview, billable-to-client info if set,
notes. Actions: edit, delete, "attach to invoice" if billable.

**Screen 40 — Expense add / edit.** Manual form mirroring the scan review fields:
vendor (autocomplete), amount, category, tax rate, date, payment method,
billable toggle (→ client/project), attach receipt (camera/library), notes.

**Screen 41 — Recurring expenses.** List of recurring rules (vendor, amount,
frequency, next date). Add/edit sheet: amount, category, **frequency**
(weekly/monthly/…), start/end, auto-post toggle.

**Screen 42 — Expense inbox. ★** Where scans land. Two logical buckets:
**Needs review** (unmatched scans + manual entries) and **Recently added**.
Cards show thumbnail, vendor, amount, confidence hint, and quick actions
**Categorize** / **Match to vendor** / **Approve → accounting**. Bulk select →
approve/categorize. This is the bridge between the hero scan flow and
accounting — make the "one tap to file it" path obvious. Empty state:
"Inbox zero 🎉 — scanned receipts appear here."

---

### GROUP K — RECEIPTS

**Screen 43 — Receipt list.** Search + storage view. Rows: number, client/
payment, amount, date, verified badge. Header actions. Empty CTA.

**Screen 44 — Receipt detail.** Receipt summary, **verified** badge + public
verify link, **PDF download** (generate-receipt-pdf), send action. Payment
linkage shown.

**Screen 45 — Send receipt dialog.** Sheet mirroring send-invoice: recipient,
message, attach PDF, confirm.

---

### GROUP L — ACCOUNTING

**Screen 46 — Accounting hub.** Read-first, write where web supports it.
Top: **insight cards** (net position, top categories) + a **money-flow** card
(in vs out). **Chart of accounts** list (account name, type, balance). A
**missing-business-data banner** (warning) when profile info is incomplete,
linking to settings. Jurisdiction badge in header. Disclaimer footnote ("Not
tax advice"). This is where synced scan → expense data shows its impact.

**Screen 47 — Financial reports + tax report.** Period selector (month/quarter/
year/custom) + jurisdiction badge. Report cards: P&L, balance snapshot, tax
report with **diagnostics** (flagged issues). Each expandable to line detail.
Disclaimers prominent. Export/email actions. Currency-scoped.

---

### GROUP M — PAYMENTS

**Screen 48 — Payment methods.** List of saved methods (card/bank icons, masked
number, default badge). Add/edit/remove. **Note:** entering card/bank numbers is
handled by Stripe's hosted UI in the in-app browser, never native fields.

**Screen 49 — Payment history.** Chronological list (amount, method, invoice
ref, status). Filter by date/method. Per-invoice variant embedded in Screen 22.

**Screen 50 — Orphaned payment recovery.** List of payments not matched to an
invoice; each row offers **Match to invoice** (picker) or dismiss. Explainer
banner.

---

### GROUP N — BILLING (SELF)

**Screen 51 — Plan & usage.** Current plan card (tier name, price, renewal).
**Usage meters** (invoices this month X/3, clients X/1, team X/1, AI scans) with
teal progress bars turning amber near the cap. "Manage billing on web" +
**Upgrade** primary (→52). Payment history link (list-stripe-payments).

**Screen 52 — Upgrade page.** Plan comparison cards (Free / Pro / …) with
feature checklists and price toggle (monthly/annual). Selecting a paid plan opens
**Stripe checkout in the in-app browser** (no native IAP in v1). Highlight what
the user unlocks (accounting, unlimited invoices, no watermark).

**Screen 53 — Cancel / downgrade feedback.** Retention sheet: reason picker
(churn feedback), "what would change your mind" note, confirm downgrade/cancel
(destructive), and a "keep my plan" primary escape.

---

### GROUP O — NOTIFICATIONS

**Screen 54 — Notification center.** List grouped by date. Rows: icon by type
(invoice/payment/compliance/system), title, snippet, timestamp, unread dot.
Swipe to mark read / delete. "Mark all read" header action. Tapping deep-links.
Empty: "You're all caught up."

**Screen 55 — Notification preferences.** **Per-device push** master toggle +
per-channel switches: Invoices, Payments, Compliance, Marketing. Explainer that
this device's push token is managed here. Grouped list style.

---

### GROUP P — VERIFICATION / KYC

**Screen 56 — Verification status.** Status card (not started / pending /
verified / rejected) with a progress checklist of required documents. Reassuring
compliance tone. CTA **Continue verification** (→57) or **Complete on Stripe**
(in-app browser handoff).

**Screen 57 — Document capture (KYC).** Guided camera capture per document type
(ID front/back, business registration): framing guide, capture, confirm/retake,
upload progress. Then Stripe Connect KYC handoff in in-app browser where
required. Clear "your documents are encrypted" reassurance.

---

### GROUP Q — REPORTS & EXPORTS

**Screen 58 — Reports hub / email report dialog.** List of report types; each →
period selector + **Email report** dialog (recipient, format, confirm) or
on-screen view. Reuses the tax/financial report cards.

**Screen 59 — Export manifests + downloads.** List of generated exports
(manifest name, date, status). **Download** (asks permission per the file-
download rule) and share. Generate-new action.

---

### GROUP R — IMPORT

**Screen 60 — CSV import wizard.** Steps: pick file (document-picker) → map
columns (source → InvoiceMonk field, with preview table) → validate (show
errors/warnings) → import (progress) → summary. Slim step progress header.

**Screen 61 — Migration wizard.** "Coming from another tool?" Source picker →
guided steps/instructions → upload/connect → import progress → summary.

---

### GROUP S — REFERRALS

**Screen 62 — Referrals.** Hero card with the user's **referral link** (copy
button) + **native share sheet** trigger. **Stats**: clicks, signups, rewards
earned (small stat tiles). "How it works" 3-step explainer. Customer-side only —
no partner/commission UI.

---

### GROUP T — SUPPORT

**Screen 63 — Support hub.** **Tawk.to live chat** entry (primary card),
**contact form** (subject, category, message, attach), and links to help/legal
(in-app browser). Response-time expectation caption.

**Screen 64 — Support tickets.** Read-only list of past tickets (subject,
status, updated). Tap → thread view (messages, status). Banner noting the ticket
system is being phased out but history stays visible.

---

### GROUP U — SETTINGS

**Screen 65 — Settings index.** Grouped list: **Account** (Profile, Preferences),
**Business** (Business profile, Verification, Accounting preferences, Currency
accounts), **Billing** (Plan & usage), **Data** (Import, Export, Retention,
Audit log), **Danger zone** (Account closure). User card at top (avatar, name,
plan badge). Sign-out row at bottom.

**Screen 66 — Profile.** Avatar (edit via camera/library), name, email (verify
state), phone, password change, connected accounts (Google). Save.

**Screen 67 — Business profile.** Logo, legal name, address, tax IDs,
jurisdiction (read/badge), contact, default template. Feeds the accounting
missing-data banner. Save.

**Screen 68 — Preferences.** **Theme** (system/light/dark), locale/language,
date & number format, default notification prefs link. Toggles/pickers, grouped.

**Screen 69 — Accounting preferences.** Fiscal year start, default tax schema,
categories, rounding, jurisdiction-specific options. Read + write where web
supports.

**Screen 70 — Currency accounts management.** List of currency accounts (code,
name, default badge, isolation note). Add/edit/set-default. Reinforce "money is
never aggregated across currencies."

**Screen 71 — Account closure.** Danger-zone screen. Clear consequences list,
export-your-data prompt first, reason picker, typed confirmation, destructive
**Close account** button. Multiple guardrails.

---

### GROUP V — PUBLIC / VERIFY (in-app rendered from deep links)

**Screen 72 — Public invoice view.** Clean, client-facing invoice render
(business logo, line items, total, pay button if online payments enabled →
Stripe in-app browser). Reachable via `https://invoicemonk.com/invoice/:id`.

**Screen 73 — Verify invoice.** Trust screen: green **Verified** check,
business + invoice metadata, issue date, immutability/compliance note. Or a
"not found / tampered" negative state.

**Screen 74 — Verify receipt.** Same pattern for receipts — verified badge,
receipt metadata, business identity, verify timestamp.

---

### GROUP W — SHARED STATE TEMPLATES (design once, reuse everywhere)

**Screen 75 — Empty state.** Centered soft-teal (accent) icon, one-line H3,
supporting caption, single primary CTA. One variant per major list, same layout.

**Screen 76 — Error + retry.** Centered muted icon, "Something went wrong"
message, optional detail, **Retry** primary + "Contact support" secondary.

**Screen 77 — Loading skeleton.** Shimmer placeholders matching each screen's
real layout (cards, rows, KPI tiles). Never a bare spinner for content screens.

**Screen 78 — Upgrade / tier-cap sheet.** Bottom sheet triggered when a free-tier
cap is hit (e.g., 4th invoice, accounting access, watermark removal). Shows the
limit hit, what upgrading unlocks, **Upgrade** (→ web checkout) + "Maybe later".
Consistent across every capped action.

**Screen 79 — Toast / banner.** Success (teal/green), info (neutral), warning
(amber), error (red). Bottom-anchored above the tab bar, auto-dismiss, optional
action link (e.g., scan-saved toast → "View").

**Screen 80 — Camera permission denied.** Friendly full screen: illustration,
"InvoiceMonk needs camera access to scan receipts," **Open Settings**
(`Linking.openSettings()`) primary + "Not now". Also the fallback when scanning
without permission.

---

## 2.1 Handing this to Claude Design — how to use it

- Design **Group W (shared templates) + the shell (8–12) + tokens first.** They
  define the visual language everything else inherits.
- Then design in the **milestone order** in §1.6, leading with the **Scan hero
  flow (13–19) + expense inbox (42)** — that's the product.
- For each screen, paste its brief block plus §2.0 (global foundation) so Claude
  Design has the tokens and rules in context.
- Ask for **light + dark** and the **four states** (loading/empty/error/loaded)
  on every list/detail screen.
- Keep money **tabular-nums** and **currency-scoped** in every mockup — never
  show mixed-currency totals.
