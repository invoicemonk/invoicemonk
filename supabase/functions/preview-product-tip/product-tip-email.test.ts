import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { BANNED_PHRASES, INVOICEMONK_EMAIL_LOGO_URL, PRODUCT_JOBS, productTipCampaignKey, resolveJourney, SAMPLE_JOURNEYS } from '../_shared/product-tip-email.ts'
import { nextResearchStep, renderResearchEmail, researchCampaignKey } from '../_shared/research-email.ts'

const ev = (area: string, names: string[]) => names.map((n, i) => ({ event_type: `product.${area}.${n}`, created_at: `2026-09-0${i + 1}T00:00:00Z` }))
const run = (area: string, workflow: string, names: string[], statedIntent?: string) => resolveJourney({ name: 'Ada Obi', productArea: area, workflow, statedIntent, events: ev(area, names) })
const email = (r: ReturnType<typeof resolveJourney>) => { assertEquals(r.status, 'email'); return (r as any).email }

Deno.test('team: invite opened but no one added → add-team-member email', () => {
  const e = email(run('team', 'invite_member', ['member_invite_opened']))
  assertEquals(e.jobId, 'add_team_member'); assertEquals(e.buttonLabel, 'Add a team member'); assertStringIncludes(e.text, 'opened the invite form')
})
Deno.test('team: member added → no email', () => assertEquals(run('team', 'invite_member', ['team_member_added']).status, 'outcome_completed'))
Deno.test('credit notes are never nudged', () => {
  assertEquals(run('credit_notes', 'credit_note', ['credit_note_issued']).status, 'outcome_completed')
  assertEquals(run('credit_notes', 'credit_note', ['something_else']).status, 'insufficient_journey_context')
})
Deno.test('account overview viewing never produces an abandonment email', () => {
  for (const [wf, evt] of [['overview', 'financial_summary_viewed'], ['income', 'income_viewed'], ['result', 'profit_result_viewed']]) assertEquals(run('accounting', wf, [evt]).status, 'outcome_completed')
})
Deno.test('expense inbox: scanned receipt → review your expense; spans upload+scan workflows', () => {
  const e = email(run('receipt_capture', 'scan_receipt', ['document_uploaded', 'document_scanned']))
  assertEquals(e.buttonLabel, 'Review your expense'); assertEquals(e.evidence, ['document_uploaded', 'document_scanned'])
})
Deno.test('products: created item → no email; later unsaved attempt → email', () => {
  assertEquals(run('products_services', 'catalog', ['item_created']).status, 'outcome_completed')
  const e = email(run('products_services', 'catalog', ['item_created', 'item_form_opened']))
  assertStringIncludes(e.text, 'done this before')
})
Deno.test('invoice drafted vs issued produce different emails', () => {
  assertEquals(email(run('invoicing', 'standard_invoice', ['invoice_drafted'])).buttonLabel, 'Review your draft')
  assertEquals(email(run('invoicing', 'standard_invoice', ['invoice_drafted', 'invoice_issued'])).buttonLabel, 'Send your invoice')
  assertEquals(run('invoicing', 'standard_invoice', ['invoice_drafted', 'invoice_issued', 'invoice_sent']).status, 'outcome_completed')
})
Deno.test('stated intent only when explicitly given and relevant', () => {
  assertStringIncludes(email(run('invoicing', 'standard_invoice', ['invoice_drafted'], 'send_invoices')).text, 'You told us you wanted to send professional invoices')
  assertEquals(email(run('invoicing', 'standard_invoice', ['invoice_drafted'])).text.includes('You told us'), false)
  assertEquals(email(run('invoicing', 'standard_invoice', ['invoice_drafted'], 'scan_receipts')).text.includes('You told us'), false)
})
Deno.test('insufficient context suppresses instead of a generic email', () => {
  assertEquals(run('clients', 'client_management', ['started']).status, 'insufficient_journey_context')
  assertEquals(run('clients', 'client_management', ['client_viewed']).status, 'insufficient_journey_context')
  assertEquals(run('unknown_area', 'x', ['a']).status, 'insufficient_journey_context')
})
Deno.test('no email contains banned generic phrases', () => {
  const texts: string[] = []
  for (const j of PRODUCT_JOBS) for (const step of Object.keys(j.steps)) { const r = run(j.area, j.workflows[0], [step], 'send_invoices'); if (r.status === 'email') texts.push(r.email.text.toLowerCase(), r.email.subject.toLowerCase()) }
  for (const s of SAMPLE_JOURNEYS) { const r = resolveJourney(s.input); if (r.status === 'email') texts.push(r.email.text.toLowerCase()) }
  for (const seg of ['A', 'B', 'C'] as const) for (const step of [1, 2, 3] as const) texts.push(renderResearchEmail({ segment: seg, step, cancellationReason: 'switching_competitor', hasUsageHistory: true })!.text.toLowerCase())
  assert(texts.length > 20)
  for (const t of texts) for (const p of BANNED_PHRASES) assertEquals(t.includes(p), false, `"${p}" in: ${t.slice(0, 80)}`)
})
Deno.test('official logo and stable per-job campaign key', () => {
  const e = email(run('invoicing', 'deposit_invoice', ['invoice_drafted']))
  assertStringIncludes(e.html, INVOICEMONK_EMAIL_LOGO_URL); assertEquals(e.campaignKey, productTipCampaignKey('create_and_send_invoice'))
})

// ---- Dormant research ----
const base = { segment: 'A' as const, research_sent_count: 0, last_research_at: null, responded_at: null, has_open_abandonment: false }
const day = 86400000, now = new Date('2026-10-30T00:00:00Z'), ago = (d: number) => new Date(now.getTime() - d * day).toISOString()
Deno.test('excluded and unsubscribed users never get research emails', () => {
  assertEquals(nextResearchStep({ ...base, segment: 'D' }, now), { send: false, reason: 'account_excluded' })
  assertEquals(nextResearchStep({ ...base, segment: 'E' }, now), { send: false, reason: 'unsubscribed' })
  assertEquals(renderResearchEmail({ segment: 'D', step: 1 }), null)
})
Deno.test('sequence: 1 → +7d → +14d → stop', () => {
  assertEquals(nextResearchStep(base, now), { send: true, step: 1 })
  assertEquals(nextResearchStep({ ...base, research_sent_count: 1, last_research_at: ago(6) }, now).send, false)
  assertEquals(nextResearchStep({ ...base, research_sent_count: 1, last_research_at: ago(7) }, now), { send: true, step: 2 })
  assertEquals(nextResearchStep({ ...base, research_sent_count: 2, last_research_at: ago(13) }, now).send, false)
  assertEquals(nextResearchStep({ ...base, research_sent_count: 2, last_research_at: ago(14) }, now), { send: true, step: 3 })
  assertEquals(nextResearchStep({ ...base, research_sent_count: 3, last_research_at: ago(90) }, now), { send: false, reason: 'sequence_complete' })
})
Deno.test('a logged reply stops the remaining emails', () => assertEquals(nextResearchStep({ ...base, research_sent_count: 1, last_research_at: ago(30), responded_at: ago(1) }, now), { send: false, reason: 'responded' }))
Deno.test('never overlaps an open abandonment journey', () => assertEquals(nextResearchStep({ ...base, has_open_abandonment: true }, now), { send: false, reason: 'abandonment_active' }))
Deno.test('known cancellation reason personalises instead of asking why again', () => {
  const e = renderResearchEmail({ name: 'Ada', segment: 'C', step: 1, cancellationDetails: 'my accountant now generates invoices for me' })!
  assertStringIncludes(e.text, 'my accountant now generates invoices for me'); assertEquals(/why did you (stop|leave|cancel)/i.test(e.text), false)
  assertStringIncludes(renderResearchEmail({ segment: 'C', step: 1, cancellationReason: 'too_expensive' })!.text, 'too expensive')
})
Deno.test('segments get different first emails; A step 2 asks about alternatives only with history', () => {
  assertStringIncludes(renderResearchEmail({ segment: 'A', step: 1 })!.text, 'what changed')
  assertStringIncludes(renderResearchEmail({ segment: 'B', step: 1 })!.text, 'originally come to Invoicemonk')
  assertEquals(renderResearchEmail({ segment: 'A', step: 2, hasUsageHistory: true })!.subject, 'What did you end up using instead?')
  assertEquals(renderResearchEmail({ segment: 'B', step: 2 })!.subject === 'What did you end up using instead?', false)
  assertEquals(renderResearchEmail({ segment: 'A', step: 3 })!.campaignKey, researchCampaignKey(3))
})
