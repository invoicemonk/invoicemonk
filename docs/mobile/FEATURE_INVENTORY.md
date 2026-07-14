# Feature Inventory — InvoiceMonk Mobile v1

Definitive scope. Everything the web app offers, minus admin/partner.

## Included

### Auth & onboarding
- Email + password sign up / sign in
- Google sign in
- Email verification
- Password reset (`/reset-password` deep link)
- 30-minute inactivity auto-logout
- Account deletion
- Onboarding wizard: business profile, jurisdiction, currency, business type
- Free-tier default (no paywall gate at signup)
- Plan selection as an *upgrade* page (not a gate)

### Multi-business
- Business switcher in header
- Route params scope to `businessId` (mirrors web `/b/:businessId/*`)
- `BusinessContext` equivalent on mobile

### Dashboard
- KPIs (revenue, expenses, receivables, cash)
- Cashflow summary
- Receivables card
- Profitability card
- Compliance confidence + analytics
- Quick setup checklist
- Banners: payment issue, starter sunset, immutability, FR e-invoicing, online payments

### Invoices
- List with filters (status, date, client, currency)
- View invoice (with PDF preview via `expo-print`)
- Create / edit invoice with line items
- Deposit invoices + eligible parent linking
- Credit notes
- Send invoice dialog (email)
- Mark paid + record payment
- Payment proofs upload
- Compliance artifacts section
- Regulatory status section
- Deep-link share to public `/invoice/:id`
- Realtime updates via Supabase Realtime channel

### Estimates / quotes
- List, create, edit, send, convert to invoice (if present in web)

### Clients
- List, filters, search
- Add / edit client with validation
- Client detail sheet
- Segmentation tags
- Communication history

### Products & services
- List, add, edit
- Combobox picker inside invoice creation

### Vendors
- List, add, edit, merge duplicates, detail sheet
- Vendor picker inside expense creation

### Expenses
- Full CRUD
- Categories + tax tracking
- Recurring expenses (list, add, edit)
- Expense inbox (unmatched scans + manual entries)

### Receipts
- List, view, verify, send receipt dialog
- PDF download
- Search & storage view

### Accounting
- Chart of accounts (read)
- Financial reports (read)
- Tax report + diagnostics
- Disclaimers, period selector, jurisdiction badges
- Insight cards, money-flow card
- Missing-business-data banner
- Full write parity where the web supports it

### Payments
- Online payments (Stripe hosted checkout via in-app browser)
- Payment methods CRUD
- Payment history for invoices
- Orphaned payment recovery

### Billing (self)
- Current plan + tier limits + usage
- "Upgrade" → opens web checkout in in-app browser
- Downgrade feedback dialog
- Cancellation
- Payment history (subscription invoices/receipts)
- **No native IAP in v1**

### Currency accounts
- Switcher in header alongside business switcher
- All money queries filter by `currency_account_id`
- Per-currency isolation strictly enforced

### Import
- CSV import wizard
- Migration wizard from other tools

### Notifications
- Notification center (read/unread)
- Per-device push toggle
- Per-channel prefs (invoices, payments, compliance, marketing)

### Support
- Tawk.to chat (RN SDK)
- Contact form
- Support tickets (read-only; system deprecated on web but keep visible)

### Reports & exports
- Email report dialog
- Export manifests
- Download exports

### Verification (business KYC)
- Submit documents via camera capture
- Verification status view
- Stripe Connect handoff via in-app browser

### Settings
- Profile
- Business profile
- Verification documents
- Online payments settings
- User preferences (theme, locale, notifications)
- Accounting preferences
- Retention policies (read)
- Audit log (read — user's own business)
- Account closure

### Referrals (customer-side only)
- View your own referral link
- Native share sheet
- Referral stats

### Public / verify deep links
- `/verify/invoice/:id`
- `/verify/receipt/:id`
- `/invoice/:id` (public view)

### Marketing / legal
- SLA, privacy, terms open in in-app browser

---

## Excluded from v1 (do not build)

### Platform Admin — `/admin/*`
- Admin dashboard, users, businesses, invoices, partners
- Security, verifications review, risk monitoring, fraud flags
- Admin notifications, feedback, audit logs
- Retention policies management, invoice templates admin
- Regulatory submissions, billing admin, country modules
- Admin system settings
- **Impersonation**

### Partner / affiliate portal — `/partner/*`
- Partner dashboard, commissions, links, payouts
- Partner referrals list, partner settings
- Partner sidebar / layout

### Deferred features
- Native in-app subscription purchases (Apple/Google IAP)
- Any staff-only tool

### Rule of thumb
If a route lives under `/admin` or `/partner`, or a hook is prefixed
`use-admin-*`, `use-partner-*`, `use-platform-admin`, `use-realtime-admin`,
`use-impersonation` → **out of scope**.

Admin/partner users on mobile see only the customer experience. They keep
using the web app for staff work.
