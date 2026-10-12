import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { manualResearchSuppressionReason } from '../_shared/research-send-policy.ts'
import { nextResearchStep, renderResearchEmail } from '../_shared/research-email.ts'

Deno.test('manual sends deliver to any eligible recipient (no test mode)', () => {
  assertEquals(manualResearchSuppressionReason({ optedOut: false, duplicateOrCooldown: false, underDeliveryCap: true }), null)
})

Deno.test('opt-outs, duplicates and the rolling delivery cap suppress delivery', () => {
  const base = { optedOut: false, duplicateOrCooldown: false, underDeliveryCap: true }
  assertEquals(manualResearchSuppressionReason({ ...base, optedOut: true }), 'unsubscribed')
  assertEquals(manualResearchSuppressionReason({ ...base, duplicateOrCooldown: true }), 'already_received')
  assertEquals(manualResearchSuppressionReason({ ...base, underDeliveryCap: false }), 'email_cap_reached')
})

Deno.test('the renderer uses the official logo and footer and escapes user-provided content', () => {
  const email = renderResearchEmail({ name: '<Ada>', segment: 'C', step: 1, cancellationDetails: '<img src=x onerror="alert(1)">' })
  assertEquals(email?.html.includes('email-assets/invoicemonk-logo.png'), true)
  assertEquals(email?.html.includes('Sent by Invoicemonk'), true)
  assertEquals(email?.html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'), true)
  assertEquals(email?.html.includes('<img src=x onerror='), false)
})

Deno.test('sequence step cannot be overridden by a manual send request', () => {
  const dueForSecond = { segment: 'A' as const, research_sent_count: 1, last_research_at: new Date(Date.now() - 8 * 86400000).toISOString(), responded_at: null, has_open_abandonment: false }
  const decision = nextResearchStep(dueForSecond)
  assertEquals(decision, { send: true, step: 2 })
  assertEquals(renderResearchEmail({ segment: 'D', step: 1 }), null)
})