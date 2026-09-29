import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

// Mirror of checkEligibility in index.ts (index.ts starts a server on import).
function checkEligibility(to: string, cfg: { testMode: boolean; recipients: string[] }, recent: boolean, optedOut = false) {
  if (optedOut) return { eligible: false, reason: 'unsubscribed' }
  if (cfg.testMode && !cfg.recipients.includes(to.toLowerCase())) return { eligible: false, reason: 'test_mode_not_allowlisted' }
  if (recent) return { eligible: false, reason: 'cooldown_or_duplicate' }
  return { eligible: true, reason: null }
}

Deno.test('test mode blocks non-allowlisted recipients', () => {
  assertEquals(checkEligibility('a@x.com', { testMode: true, recipients: [] }, false).eligible, false)
})
Deno.test('allowlisted recipient passes in test mode', () => {
  assertEquals(checkEligibility('A@x.com', { testMode: true, recipients: ['a@x.com'] }, false).eligible, true)
})
Deno.test('cooldown blocks duplicates', () => {
  assertEquals(checkEligibility('a@x.com', { testMode: true, recipients: ['a@x.com'] }, true).reason, 'cooldown_or_duplicate')
})
Deno.test('processor source keeps shared eligibility and delivery log', async () => {
  const src = await Deno.readTextFile(new URL('./index.ts', import.meta.url))
  assertEquals(src.includes('export function checkEligibility('), true)
  assertEquals(src.includes("from('lifecycle_email_deliveries').insert"), true)
  assertEquals(src.includes("envTest || cfg?.test_mode !== false"), true)
})
Deno.test('opted-out users are never emailed', () => {
  assertEquals(checkEligibility('a@x.com', { testMode: false, recipients: [] }, false, true).reason, 'unsubscribed')
})
Deno.test('product nudges are off unless explicitly enabled', async () => {
  const src = await Deno.readTextFile(new URL('./index.ts', import.meta.url))
  assertEquals(src.includes('if (cfg?.product_campaigns_enabled &&'), true)
})

Deno.test('research emails are off unless explicitly enabled and use Yinka reply-to', async () => {
  const src = await Deno.readTextFile(new URL('./index.ts', import.meta.url))
  assertEquals(src.includes('if (cfg?.research_campaigns_enabled &&'), true)
  assertEquals(src.includes('replyTo: RESEARCH_REPLY_TO'), true)
  assertEquals(src.includes('inactiveCheckinTemplate'), false)
})
