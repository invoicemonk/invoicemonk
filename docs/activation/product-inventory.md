# Invoicemonk product inventory & activation map

Stages per product area (independent, concurrent journeys):
`started` (first event in area) → `activated` (first meaningful use) → `outcome` (value delivered) → `repeat` (activation/outcome happens again).
Source: T = DB trigger (server truth), C = client `trackProductEvent`.

| Area | Routes | Entities | Sub-workflows | Progress events | Activation | Outcome | Abandonment points (Phase 3) |
|---|---|---|---|---|---|---|---|
| invoicing | /invoices, /invoices/new, /invoices/:id | invoices, invoice_items | standard, deposit, final invoice; void; e-invoice XML | invoice_drafted, invoice_viewed, invoice_voided (T) | invoice_issued (T) | invoice_sent (T) | draft never issued; issued never sent |
| payments | /receivables, invoice detail | payments, online_payments, payment_proofs | record payment, online payment | — | payment_recorded (T) | invoice_paid (T) | invoice sent, never paid |
| receipts | /receipts | receipts | auto-receipt on payment, PDF, email | — | receipt_generated (T) | receipt_delivered (C) | receipt never delivered |
| credit_notes | /credit-notes | credit_notes | credit an issued invoice | — | credit_note_issued (T) | — | — |
| clients | /clients | clients | create/edit client | — | client_created (T) | (via invoicing) | client created, no invoice |
| products_services | /products | products_services | catalog item | — | item_created (T) | (via invoicing) | — |
| expenses | /expenses, /accounting/expenses | expenses | manual, with receipt | — | expense_recorded (T) | expense_documented (T: category + receipt) | expense without receipt/category |
| receipt_capture | /expenses/inbox | expense_inbox_items, scan_jobs | upload, scan receipt/invoice, approve/reject, bulk approve | document_uploaded, scan_failed, document_rejected (T) | document_scanned (T) | converted_to_expense (T) | uploaded, never approved; scan failed |
| recurring_expenses | /expenses | recurring_expenses | schedule, pause | — | recurring_expense_created (T) | — | — |
| vendors | /vendors | vendors | create, merge | — | vendor_created (T) | — | — |
| accounting | /accounting, /income, /result, /profitability | (views) | overview, income, result, profitability | income_viewed (C) | financial_summary_viewed (C) | profit_result_viewed (C) | overview viewed once only |
| tax_reports | /accounting/tax-reports | tax_report_mappings | tax report | — | tax_report_viewed (C) | tax_report_exported (C) | viewed, never exported |
| reports | /reports, /analytics | export_manifests | preview, download CSV/PDF, email | reports_opened (C) | report_previewed (C) | report_delivered (C) | previewed, never delivered |
| data_import | /import | — | CSV import, migration wizard | import_opened (C) | import_completed (C) | — | opened, not completed |
| data_export | settings | export_manifests | compliance export | — | export_generated (T) | export_generated (T) | — |
| team | /team | business_members | invite member | — | team_member_added (T) | — | — |
| e_invoicing | invoice detail | regulator_submissions | regulator submission | submission_failed (T) | submission_created (T) | submission_accepted (T) | submission rejected |

Existing systems reused: PostHog (`trackFunnel` onboarding funnel stays as is), `lifecycle_events` + `process-lifecycle-campaigns`, Brevo sync, `churn_feedback`, Admin Feedback.

Stated intent: `user_intents` (optional dashboard card; multi-select, primary, "something else"). Observed intent = product areas with events. Inferred intent = derived later, labelled separately.

Stated intent is deliberately user-level rather than business-level because it describes why a person joined Invoicemonk. Observed product journeys remain business-scoped.
