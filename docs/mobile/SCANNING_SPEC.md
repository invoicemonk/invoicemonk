# Scanning Spec — Hero Feature

## Why this feature exists

Businesses lose tax deductions and unbilled reimbursements because paper
receipts pile up and get lost. If the phone in their pocket captures every
receipt in <10 seconds, that leakage disappears. **This is the reason the
mobile app exists.** Every design decision in the scan flow should be judged
against "does this help capture the receipt right now, with no friction?"

## User flow

```text
Home tab bar → [ Scan ] (huge circular button in the center)
   ↓
Camera opens (Receipt mode default; toggle for Invoice mode)
   ↓
Auto edge-detect frames the document on the viewfinder
   ↓
Capture (single tap) or Add another page (multi-page mode)
   ↓
Auto-crop + perspective correction preview
   ↓
[ Re-crop ] [ Retake ] [ Looks good ]
   ↓
Upload begins immediately (queued to SQLite outbox if offline)
   ↓
Extraction status: "Extracting…" with a shimmer
   ↓
Review screen: fields with confidence bars, edit any field
   ↓
Optional: [ Bill this to a client ] toggle → pick client + project
   ↓
[ Save ]
   ↓
Toast: "Receipt saved to <business>. It's in your expense inbox."
   ↓
Deep link on tap: opens the expense inbox item detail
```

## Requirements

### Capture
- Front-and-center Scan tab. Single tap to capture.
- Torch toggle. Ratio toggle (auto for receipts, A4 for invoices).
- Multi-page mode: capture > "add page" > staple into a single PDF via
  `expo-print` before upload.
- Auto edge-detection overlay while framing (green quad).
- If the document isn't detected within 5s, still allow manual capture.

### Post-capture image processing
- Perspective correction using detected quad (fallback: rectangle crop UI).
- Auto brightness/contrast normalization.
- Compress to ≤1600px long edge, JPEG q80.
- Compute perceptual hash for duplicate detection.

### Upload
- Direct-to-storage: `receipt-scans/{businessId}/{uuid}.jpg`
  (or `.pdf` for multi-page).
- **Offline-first**: if the network call fails, enqueue in
  `expo-sqlite` outbox table `scan_outbox` and retry with exponential
  backoff on connectivity change (`NetInfo`).
- Show a badge on the Scan tab: "3 pending" while items are in the queue.

### Extraction
- Client calls `supabase.functions.invoke('scan-document', { body })`.
- On success, the extracted JSON is displayed with per-field confidence bars
  (mirror the visual pattern in
  `../../src/pages/marketing-shots/ReceiptsScanning.tsx`).
- Fields under 90% confidence highlighted amber; user must confirm.
- Fields under 70% confidence highlighted red.

### Review & save
- Editable fields:
  - Vendor (autocomplete against existing `vendors`; offer "Create vendor")
  - Date, currency, subtotal, tax, total, tax rate, category, payment method
  - Line items (add/edit/remove rows)
- **Reimbursement toggle**: "Bill this to a client / project" →
  picks a client + optional project tag stored on the expense row.
- Duplicate check: hash + (vendor, date, amount) against last 90 days.
  If a match, show inline warning "Looks like the Hilton Berlin receipt from
  May 2 — same vendor & amount. Save anyway?"
- **Save** creates the row via `supabase.from('expense_inbox_items').insert(...)`
  (receipt mode) or `supabase.from('invoices').insert({ status: 'draft', ...})`
  (invoice mode), and updates `scan_jobs.linked_expense_inbox_id` /
  `linked_invoice_id` so we can audit later.

### Notifications
- If the user backgrounds the app while extraction is running, send a local
  push via `expo-notifications` when the job finishes:
  "We extracted your Hilton receipt — tap to review".
- Tap → deep link to the review screen for that `scan_jobs.id`.

## Acceptance criteria

- [ ] Cold-start-to-first-capture in under 3 seconds on a 2020-era iPhone.
- [ ] Works fully offline: capture → queue → auto-upload later.
- [ ] Multi-page PDF stapling works for 5+ pages.
- [ ] Vendor autocomplete hits existing `vendors` within 300ms.
- [ ] Fields with <90% confidence are visually flagged.
- [ ] Duplicate detection triggers on identical vendor+date+amount within
      90 days.
- [ ] Saving a receipt appears in the web `expense_inbox_items` immediately.
- [ ] Saving an invoice appears in the web `invoices` list as a draft.
- [ ] Free-tier users hit the 3/month cap → upgrade prompt → web checkout.
- [ ] Tab bar shows a badge while items are in the outbox.
- [ ] Local push fires when extraction finishes while app is backgrounded.

## Failure modes to handle explicitly

| Failure | UX |
|---|---|
| Camera permission denied | Screen with "Enable camera in settings" + `Linking.openSettings()` button. |
| Network failure during upload | Silent queue in outbox; toast "Saved offline. Will upload when back online." |
| AI 429 | Toast "Busy — retrying in a moment." Auto-retry with jitter, up to 3x. |
| AI 402 (credits exhausted) | Modal: "AI scans temporarily paused. Contact support." + Sentry breadcrumb. |
| AI returns malformed JSON | Row status = `failed`, show raw text in a debug expander, offer "Enter manually". |
| Duplicate detected | Inline banner, not a blocker. |
| Free-tier cap hit | Upgrade sheet, opens web billing in in-app browser. |

## Analytics events (PostHog)

Match web funnel naming:
- `scan_started` — tab opened
- `scan_captured` — image captured
- `scan_uploaded` — file in storage
- `scan_extracted` — edge function returned success
- `scan_saved` — row created in inbox/invoices
- `scan_failed` — with `{ stage, error }`
- `scan_duplicate_warning_shown`
- `scan_billable_to_client` — reimbursement toggle used
