// Journey-aware product-tip emails. Areas are containers; emails are written
// per user JOB (workflow) from the actual recorded event trail. When the trail
// does not support a specific, truthful message, NO email is produced — the
// caller records the case as `insufficient_journey_context` for admin review.

export const PRODUCT_TIP_CAMPAIGN_PREFIX = 'product-tip-v2'
export const INVOICEMONK_EMAIL_LOGO_URL = 'https://skcxogeaerudoadluexz.supabase.co/storage/v1/object/public/email-assets/invoicemonk-logo.png'
const APP_URL = 'https://app.invoicemonk.com'

export type JourneyEvent = { event_type: string; stage?: string | null; created_at?: string | null; metadata?: Record<string, unknown> | null }
export type JourneyEmailInput = { name?: string | null; productArea: string; workflow?: string | null; stoppedStep?: string | null; statedIntent?: string | null; statedIntentText?: string | null; events: JourneyEvent[]; now?: Date }
export type ProductTipEmail = { campaignKey: string; jobId: string; jobLabel: string; subject: string; heading: string; html: string; text: string; completedAction: string; lastAction: string; nextAction: string; destination: string; buttonLabel: string; evidence: string[]; statedIntent: string | null }
export type JourneyResolution =
  | { status: 'email'; email: ProductTipEmail }
  | { status: 'outcome_completed'; jobId: string | null }
  | { status: 'insufficient_journey_context'; jobId: string | null; detail: string }

/** Copy for a specific point in a job. Paragraphs are joined as-is so each job reads differently. */
type StepCopy = { subject: string; heading: string; paragraphs: string[]; completedAction: string; nextAction: string; buttonLabel: string; destination?: string }
export type JobDefinition = {
  id: string; area: string; label: string; workflows: string[]; destination: string
  outcomes: string[]
  /** Last meaningful event → copy. Events without copy never produce an email. */
  steps: Record<string, StepCopy>
  /** Jobs where a nudge would be inappropriate (e.g. destructive actions) never email. */
  noNudge?: boolean
}

export const PRODUCT_JOBS: JobDefinition[] = [
  { id: 'create_and_send_invoice', area: 'invoicing', label: 'Create and send an invoice', workflows: ['standard_invoice', 'deposit_invoice', 'final_invoice'], destination: '/invoices', outcomes: ['invoice_sent'], steps: {
    invoice_drafted: { subject: 'Your draft invoice is still saved', heading: 'Your draft invoice', paragraphs: ['You started an invoice in Invoicemonk and it was saved as a draft.', 'When you’re ready, open it, check the line items and issue it — issuing gives it a permanent invoice number.'], completedAction: 'Saved an invoice as a draft', nextAction: 'Review and issue the draft', buttonLabel: 'Review your draft' },
    invoice_issued: { subject: 'Your invoice is issued — ready to send?', heading: 'Ready to send', paragraphs: ['You issued an invoice, but it hasn’t been sent to your client from Invoicemonk yet.', 'Sending it by email lets you see when your client opens it.'], completedAction: 'Issued an invoice', nextAction: 'Send the invoice to the client', buttonLabel: 'Send your invoice' },
  } },
  { id: 'get_invoice_paid', area: 'payments', label: 'Get an invoice paid', workflows: ['invoice_payment'], destination: '/receivables', outcomes: ['invoice_paid'], steps: {} },
  { id: 'record_payment', area: 'payments', label: 'Record a payment', workflows: ['record_payment'], destination: '/receivables', outcomes: ['payment_recorded'], steps: {} },
  { id: 'share_payment_receipt', area: 'receipts', label: 'Share a payment receipt', workflows: ['payment_receipt', 'receipt_pdf'], destination: '/receipts', outcomes: ['receipt_delivered'], steps: {
    receipt_generated: { subject: 'A payment receipt is ready for your client', heading: 'Your receipt is ready', paragraphs: ['When you recorded a payment, Invoicemonk generated a receipt for it.', 'It hasn’t been shared with your client yet. You can download it or send it from the receipt page.'], completedAction: 'A receipt was generated from a recorded payment', nextAction: 'Share the receipt with the client', buttonLabel: 'View the receipt' },
  } },
  // Credit notes are created by voiding an issued invoice; nudging someone to void an invoice would be inappropriate.
  { id: 'issue_credit_note', area: 'credit_notes', label: 'Issue a credit note by voiding an invoice', workflows: ['credit_note'], destination: '/credit-notes', outcomes: ['credit_note_issued'], steps: {}, noNudge: true },
  { id: 'add_client', area: 'clients', label: 'Add a client', workflows: ['client_management'], destination: '/clients', outcomes: ['client_created'], steps: {
    client_form_opened: { subject: 'The client you were adding wasn’t saved', heading: 'Add your client', paragraphs: ['You opened the form to add a client, but it was closed before the client was saved.', 'Saving a client means their details are filled in automatically on every invoice.'], completedAction: 'Opened the add-client form', nextAction: 'Save the client’s details', buttonLabel: 'Add a client' },
  } },
  { id: 'add_catalogue_item', area: 'products_services', label: 'Add a product or service', workflows: ['catalog'], destination: '/products', outcomes: ['item_created'], steps: {
    item_form_opened: { subject: 'Your product or service wasn’t saved', heading: 'Add to your catalogue', paragraphs: ['You began adding a product or service, but it wasn’t saved.', 'Once it’s in your catalogue, you can pick it from a list instead of typing the price each time.'], completedAction: 'Opened the new product/service form', nextAction: 'Save the item to your catalogue', buttonLabel: 'Add a product or service' },
  } },
  { id: 'add_vendor', area: 'vendors', label: 'Add a vendor', workflows: ['vendor_management'], destination: '/vendors', outcomes: ['vendor_created'], steps: {
    vendor_form_opened: { subject: 'The vendor you were adding wasn’t saved', heading: 'Add your vendor', paragraphs: ['You opened the form to add a vendor, but the vendor wasn’t saved.', 'Saved vendors can be picked when you record expenses, so your spending is grouped by supplier.'], completedAction: 'Opened the add-vendor form', nextAction: 'Save the vendor', buttonLabel: 'Add a vendor' },
  } },
  { id: 'add_team_member', area: 'team', label: 'Add a team member', workflows: ['invite_member'], destination: '/team', outcomes: ['team_member_added'], steps: {
    member_invite_opened: { subject: 'Your team invitation wasn’t sent', heading: 'Invite your teammate', paragraphs: ['You opened the invite form on your Team page, but no one was added.', 'If you still want someone to help with invoices or records, you can invite them and choose their role.'], completedAction: 'Opened the team invite form', nextAction: 'Send the invitation', buttonLabel: 'Add a team member' },
  } },
  { id: 'record_expense', area: 'expenses', label: 'Record an expense', workflows: ['manual_expense'], destination: '/expenses', outcomes: ['expense_recorded'], steps: {} },
  { id: 'record_documented_expense', area: 'expenses', label: 'Record an expense with its receipt', workflows: ['expense_with_receipt'], destination: '/expenses', outcomes: ['expense_documented'], steps: {} },
  { id: 'capture_receipt_to_expense', area: 'receipt_capture', label: 'Turn a receipt into an expense', workflows: ['expense_inbox', 'scan_receipt', 'scan_invoice'], destination: '/expenses/inbox', outcomes: ['converted_to_expense'], steps: {
    document_uploaded: { subject: 'Your uploaded receipt is in your Expense Inbox', heading: 'Your receipt is waiting', paragraphs: ['You uploaded a document to your Expense Inbox, and it’s still sitting there.', 'Open it to check the details and approve it — it then becomes an expense in your records.'], completedAction: 'Uploaded a document to the Expense Inbox', nextAction: 'Review and approve the document', buttonLabel: 'Open your Expense Inbox' },
    document_scanned: { subject: 'We read your receipt — take a quick look', heading: 'Your receipt has been read', paragraphs: ['The receipt you uploaded has been scanned and the amount, date and vendor were pulled out for you.', 'It hasn’t been approved yet, so it isn’t counted in your expenses. A quick check and one click will add it.'], completedAction: 'A receipt was uploaded and scanned', nextAction: 'Check the extracted details and approve the expense', buttonLabel: 'Review your expense' },
    scan_failed: { subject: 'We couldn’t read one of your receipts', heading: 'A receipt needs your help', paragraphs: ['A document you uploaded to your Expense Inbox couldn’t be read automatically.', 'You can open it and fill in the details yourself, so it still ends up in your expenses.'], completedAction: 'Uploaded a document that could not be read', nextAction: 'Enter the details by hand', buttonLabel: 'Open your Expense Inbox' },
  } },
  { id: 'set_up_recurring_expense', area: 'recurring_expenses', label: 'Set up a recurring expense', workflows: ['recurring_expense'], destination: '/expenses', outcomes: ['recurring_expense_created'], steps: {} },
  // Account overview: viewing is the value itself, so these jobs never nudge.
  { id: 'review_overview', area: 'accounting', label: 'Review the account overview', workflows: ['overview'], destination: '/accounting', outcomes: ['financial_summary_viewed'], steps: {} },
  { id: 'review_income', area: 'accounting', label: 'Review income', workflows: ['income'], destination: '/accounting/income', outcomes: ['income_viewed'], steps: {} },
  { id: 'review_profit', area: 'accounting', label: 'Review profit and result', workflows: ['result', 'profitability'], destination: '/accounting/result', outcomes: ['profit_result_viewed'], steps: {} },
  { id: 'export_tax_report', area: 'tax_reports', label: 'Export a tax report', workflows: ['tax_report'], destination: '/accounting/tax-reports', outcomes: ['tax_report_exported'], steps: {
    tax_report_viewed: { subject: 'The tax report you opened can be exported', heading: 'Your tax report', paragraphs: ['You looked at a tax report in Invoicemonk but didn’t export it.', 'If you need it for filing or for your accountant, you can export it from the same page.'], completedAction: 'Viewed a tax report', nextAction: 'Export the report', buttonLabel: 'Open tax reports' },
  } },
  { id: 'deliver_report', area: 'reports', label: 'Download or email a report', workflows: ['reports', 'analytics', 'report_preview', 'report_download', 'report_email'], destination: '/reports', outcomes: ['report_delivered'], steps: {
    report_previewed: { subject: 'The report you previewed is ready to download', heading: 'Your report is ready', paragraphs: ['You previewed a report but didn’t download or email it.', 'It’s ready whenever you want to keep a copy or send it to someone.'], completedAction: 'Previewed a report', nextAction: 'Download or email the report', buttonLabel: 'View your report' },
  } },
  { id: 'import_records', area: 'data_import', label: 'Import records', workflows: ['csv_import', 'migration'], destination: '/import', outcomes: ['import_completed'], steps: {
    import_opened: { subject: 'Bringing your records into Invoicemonk', heading: 'Your import', paragraphs: ['You opened the import page, but no records were imported.', 'You can upload a CSV of clients, products, invoices or expenses whenever your file is ready.'], completedAction: 'Opened the import page', nextAction: 'Upload a CSV file', buttonLabel: 'Import your records' },
  } },
  { id: 'export_data', area: 'data_export', label: 'Export data', workflows: ['export'], destination: '/settings', outcomes: ['export_generated'], steps: {} },
  { id: 'submit_to_regulator', area: 'e_invoicing', label: 'Submit an invoice to the tax authority', workflows: ['regulator_submission'], destination: '/invoices', outcomes: ['submission_accepted'], steps: {
    submission_failed: { subject: 'An invoice submission wasn’t accepted', heading: 'A submission needs attention', paragraphs: ['One of your invoice submissions to the tax authority wasn’t accepted.', 'Open the invoice to see the details and what to correct.'], completedAction: 'Submitted an invoice that was not accepted', nextAction: 'Review the submission details', buttonLabel: 'Review the submission' },
  } },
]

const INTENTS: Record<string, string> = { send_invoices: 'send professional invoices', get_paid: 'get paid and keep track of payments', track_expenses: 'track your business expenses', scan_receipts: 'scan and organise receipts', understand_finances: 'understand your profit and finances', tax_compliance: 'handle tax reporting and compliance', switch_tool: 'move your records over from another tool' }
const INTENT_AREAS: Record<string, string[]> = { send_invoices: ['invoicing', 'clients', 'products_services'], get_paid: ['payments', 'receipts'], track_expenses: ['expenses', 'vendors', 'recurring_expenses', 'receipt_capture'], scan_receipts: ['receipt_capture'], understand_finances: ['accounting', 'reports'], tax_compliance: ['tax_reports', 'e_invoicing'], switch_tool: ['data_import'] }

export const BANNED_PHRASES = ['finish what you started', 'you started using', 'finish line', 'we do not have enough recorded detail', 'continue setting up', 'it only takes a minute']

const eventName = (e: JourneyEvent) => e.event_type.split('.').pop() ?? e.event_type
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c))
export const productTipCampaignKey = (jobId: string) => `${PRODUCT_TIP_CAMPAIGN_PREFIX}:${jobId}`.slice(0, 120)
export const findJob = (area: string, workflow?: string | null) => workflow ? PRODUCT_JOBS.find((j) => j.area === area && j.workflows.includes(workflow)) ?? null : null

/** Meaningful events = not the synthetic per-area "started" marker, ordered by time. */
function meaningful(events: JourneyEvent[]) {
  return events.filter((e) => !e.event_type.endsWith('.started')).map((e, i) => ({ e, i }))
    .sort((a, b) => String(a.e.created_at ?? '').localeCompare(String(b.e.created_at ?? '')) || a.i - b.i).map((x) => x.e)
}

export function resolveJourney(input: JourneyEmailInput): JourneyResolution {
  const job = findJob(input.productArea, input.workflow)
  if (!job) return { status: 'insufficient_journey_context', jobId: null, detail: `No known job for ${input.productArea}/${input.workflow ?? 'none'}` }
  const trail = meaningful(input.events)
  if (!trail.length) return { status: 'insufficient_journey_context', jobId: job.id, detail: 'No meaningful actions recorded' }
  const last = trail[trail.length - 1], lastName = eventName(last)
  // Outcome reached after the most recent attempt → nothing to nudge.
  if (job.outcomes.includes(lastName) || last.stage === 'outcome') return { status: 'outcome_completed', jobId: job.id }
  const lastOutcomeIdx = trail.map(eventName).map((n, i) => job.outcomes.includes(n) ? i : -1).reduce((a, b) => Math.max(a, b), -1)
  const attempt = trail.slice(lastOutcomeIdx + 1)
  if (job.noNudge) return { status: 'insufficient_journey_context', jobId: job.id, detail: 'Job is never nudged' }
  const copy = job.steps[lastName]
  if (!copy) return { status: 'insufficient_journey_context', jobId: job.id, detail: `No truthful next step for "${lastName}"` }
  const repeat = lastOutcomeIdx >= 0
  const intentText = input.statedIntent === 'other' ? input.statedIntentText?.trim() || null
    : input.statedIntent && (INTENT_AREAS[input.statedIntent] ?? []).includes(job.area) ? INTENTS[input.statedIntent] ?? null : null
  const firstName = input.name?.trim().split(/\s+/)[0] || null
  const destination = copy.destination ?? job.destination, href = `${APP_URL}${destination}`
  const paragraphs = [...copy.paragraphs]
  if (repeat) paragraphs[0] = paragraphs[0].replace(/^You /, 'You’ve done this before — this time you ')
  if (intentText) paragraphs.push(`You told us you wanted to ${intentText}, so we thought this was worth a quick note.`)
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const html = wrapper(copy.heading, `<p>${esc(greeting)}</p>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}<p style="margin:26px 0"><a href="${href}" style="display:inline-block;background:#1d6b5a;color:#fff;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:600">${esc(copy.buttonLabel)}</a></p><p style="color:#777;font-size:12px">Don’t want these tips? Turn off “Product tips” in Settings → Notifications.</p>`)
  const text = `${greeting}\n\n${paragraphs.join('\n\n')}\n\n${copy.buttonLabel}: ${href}\n\nDon’t want these tips? Turn off “Product tips” in Settings → Notifications.`
  return { status: 'email', email: { campaignKey: productTipCampaignKey(job.id), jobId: job.id, jobLabel: job.label, subject: copy.subject, heading: copy.heading, html, text, completedAction: copy.completedAction, lastAction: lastName, nextAction: copy.nextAction, destination, buttonLabel: copy.buttonLabel, evidence: attempt.map(eventName), statedIntent: intentText } }
}

/** Back-compat: returns the email or null (no email for outcome or insufficient context). */
export function renderProductTipEmail(input: JourneyEmailInput): ProductTipEmail | null {
  const r = resolveJourney(input)
  return r.status === 'email' ? r.email : null
}

export function brandedEmailShell(heading: string, body: string) { return wrapper(heading, body) }
function wrapper(heading: string, body: string) { return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;padding:20px"><div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden"><div style="padding:22px 30px;text-align:center;border-bottom:1px solid #e5e7eb"><img src="${INVOICEMONK_EMAIL_LOGO_URL}" width="186" height="36" alt="Invoicemonk" style="display:inline-block;width:186px;height:36px;object-fit:contain"></div><div style="background:#1d6b5a;color:#fff;padding:24px 30px;text-align:center"><h1 style="margin:0;font-size:22px">${esc(heading)}</h1></div><div style="padding:30px">${body}<hr style="border:none;border-top:1px solid #eee;margin:30px 0"><p style="color:#777;font-size:11px;text-align:center">Sent by Invoicemonk · <a href="https://invoicemonk.com" style="color:#777">invoicemonk.com</a></p></div></div></body></html>` }

/** Representative journeys for the admin preview. */
export const SAMPLE_JOURNEYS: { label: string; input: JourneyEmailInput }[] = [
  { label: 'Receipt scanned, not approved', input: { name: 'Ada Obi', productArea: 'receipt_capture', workflow: 'expense_inbox', events: [{ event_type: 'product.receipt_capture.document_uploaded' }, { event_type: 'product.receipt_capture.document_scanned' }] } },
  { label: 'Receipt could not be read', input: { name: 'Ada Obi', productArea: 'receipt_capture', workflow: 'expense_inbox', events: [{ event_type: 'product.receipt_capture.document_uploaded' }, { event_type: 'product.receipt_capture.scan_failed' }] } },
  { label: 'Invoice drafted, not issued', input: { name: 'Ada Obi', productArea: 'invoicing', workflow: 'standard_invoice', events: [{ event_type: 'product.invoicing.invoice_drafted' }] } },
  { label: 'Invoice issued, not sent (stated intent)', input: { name: 'Ada Obi', productArea: 'invoicing', workflow: 'standard_invoice', statedIntent: 'send_invoices', events: [{ event_type: 'product.invoicing.invoice_drafted' }, { event_type: 'product.invoicing.invoice_issued' }] } },
  { label: 'Team invite opened, no one added', input: { name: 'Ada Obi', productArea: 'team', workflow: 'invite_member', events: [{ event_type: 'product.team.member_invite_opened' }] } },
  { label: 'Client form opened, not saved', input: { name: 'Ada Obi', productArea: 'clients', workflow: 'client_management', events: [{ event_type: 'product.clients.client_form_opened' }] } },
  { label: 'Product form opened, not saved', input: { name: 'Ada Obi', productArea: 'products_services', workflow: 'catalog', events: [{ event_type: 'product.products_services.item_form_opened' }] } },
  { label: 'Product created (outcome — no email)', input: { name: 'Ada Obi', productArea: 'products_services', workflow: 'catalog', events: [{ event_type: 'product.products_services.item_created' }] } },
  { label: 'Credit note issued (never nudged)', input: { name: 'Ada Obi', productArea: 'credit_notes', workflow: 'credit_note', events: [{ event_type: 'product.credit_notes.credit_note_issued' }] } },
  { label: 'Account overview viewed (no email)', input: { name: 'Ada Obi', productArea: 'accounting', workflow: 'overview', events: [{ event_type: 'product.accounting.financial_summary_viewed' }] } },
  { label: 'Only "started" marker (insufficient)', input: { name: 'Ada Obi', productArea: 'clients', workflow: 'client_management', events: [{ event_type: 'product.clients.started' }] } },
]
