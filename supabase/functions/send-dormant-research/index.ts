import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.24.2'
import { nextResearchStep, renderResearchEmail, RESEARCH_REPLY_TO, RESEARCH_SENDER_NAME, type ResearchStep } from '../_shared/research-email.ts'
import { manualResearchSuppressionReason } from '../_shared/research-send-policy.ts'

const RequestSchema = z.object({
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  userIds: z.array(z.string().uuid()).min(1).max(100),
}).strict()
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

type Candidate = {
  user_id: string
  email: string | null
  full_name: string | null
  segment: 'A' | 'B' | 'C' | 'D' | 'E'
  cancellation_reason: string | null
  cancellation_details: string | null
  research_sent_count: number
  last_research_at: string | null
  responded_at: string | null
  has_open_abandonment: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return response({ error: 'Authorization required' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return response({ error: 'Email sending is not configured.' }, 503)

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return response({ error: 'Invalid or expired token' }, 401)
  const { data: isAdmin, error: roleError } = await admin.rpc('has_role', { _user_id: user.id, _role: 'platform_admin' })
  if (roleError || !isAdmin) return response({ error: 'Forbidden' }, 403)

  let rawBody: unknown
  try { rawBody = await req.json() } catch { return response({ error: 'Invalid JSON body' }, 400) }
  const parsed = RequestSchema.safeParse(rawBody)
  if (!parsed.success) return response({ error: parsed.error.flatten().fieldErrors }, 400)
  const { step, userIds } = parsed.data
  const uniqueIds = [...new Set(userIds)]

  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) return response({ error: 'Email sending is not configured.' }, 503)

  const [{ data: config, error: configError }, { data: candidates, error: candidateError }] = await Promise.all([
    admin.from('lifecycle_campaign_config').select('test_mode, test_recipients, cooldown_days').eq('id', true).maybeSingle(),
    admin.rpc('get_dormant_research_candidates', { _days: 21 }),
  ])
  if (configError || candidateError) return response({ error: 'Could not verify current email safeguards or recipient eligibility.' }, 503)

  const envTestMode = (Deno.env.get('LIFECYCLE_EMAIL_TEST_MODE') ?? 'true').toLowerCase() !== 'false'
  const envRecipients = (Deno.env.get('LIFECYCLE_EMAIL_TEST_RECIPIENTS') ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  const dbRecipients: string[] = (config?.test_recipients ?? []).map((item: string) => item.toLowerCase())
  const allowedRecipients = dbRecipients.length ? envRecipients.filter((item) => dbRecipients.includes(item)) : envRecipients
  const testMode = envTestMode || config?.test_mode !== false
  const cooldownDays = config?.cooldown_days ?? 14
  const candidateById = new Map<string, Candidate>((candidates ?? []).map((candidate: Candidate) => [candidate.user_id, candidate]))
  const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com'
  const results: { userId: string; status: 'sent' | 'suppressed' | 'failed'; reason?: string }[] = []
  const now = new Date()

  const logDelivery = async (candidate: Candidate, campaignKey: string, status: 'sent' | 'suppressed' | 'failed', reason: string | null, metadata: Record<string, unknown> = {}) => {
    const { error } = await admin.from('lifecycle_email_deliveries').insert({
      user_id: candidate.user_id,
      product_area: 'discovery',
      campaign_key: campaignKey,
      recipient_email: candidate.email ?? '',
      eligible: status === 'sent' || status === 'failed',
      suppression_reason: reason,
      delivery_status: status,
      metadata: { source: 'admin_manual', selected_step: step, test_mode: testMode, ...metadata },
    })
    if (error) console.error('Research delivery audit insert failed:', error.message)
  }

  for (const userId of uniqueIds) {
    const candidate = candidateById.get(userId)
    if (!candidate?.email) {
      const { data: profile } = await admin.from('profiles').select('id,email').eq('id', userId).maybeSingle()
      if (profile?.email) {
        const unavailable = { user_id: userId, email: profile.email, full_name: null, segment: 'D', cancellation_reason: null, cancellation_details: null, research_sent_count: 0, last_research_at: null, responded_at: null, has_open_abandonment: false } satisfies Candidate
        await logDelivery(unavailable, `research-v1:${step}` as const, 'suppressed', 'candidate_not_eligible')
      }
      results.push({ userId, status: 'suppressed', reason: 'candidate_not_eligible' })
      continue
    }

    const decision = nextResearchStep(candidate, now)
    if (!decision.send || decision.step !== step) {
      const reason = !decision.send ? decision.reason : 'sequence_step_mismatch'
      await logDelivery(candidate, `research-v1:${step}` as const, 'suppressed', reason)
      results.push({ userId, status: 'suppressed', reason })
      continue
    }

    const campaignEmail = renderResearchEmail({
      name: candidate.full_name,
      segment: candidate.segment,
      step: decision.step,
      cancellationReason: candidate.cancellation_reason,
      cancellationDetails: candidate.cancellation_details,
      hasUsageHistory: candidate.segment === 'A',
    })
    if (!campaignEmail) {
      await logDelivery(candidate, `research-v1:${step}` as const, 'suppressed', 'email_not_available')
      results.push({ userId, status: 'suppressed', reason: 'email_not_available' })
      continue
    }

    const sinceCooldown = new Date(now.getTime() - cooldownDays * 86400000).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
    const [{ data: preference, error: preferenceError }, { count: recentDuplicate, error: duplicateError }, { count: recentEmails, error: capError }] = await Promise.all([
      admin.from('user_preferences').select('email_product_tips').eq('user_id', userId).maybeSingle(),
      admin.from('lifecycle_email_deliveries').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('campaign_key', campaignEmail.campaignKey).eq('delivery_status', 'sent').gte('created_at', sinceCooldown),
      admin.from('lifecycle_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('event_type', 'lifecycle_email_sent').gte('created_at', thirtyDaysAgo),
    ])
    if (preferenceError || duplicateError || capError) {
      await logDelivery(candidate, campaignEmail.campaignKey, 'suppressed', 'policy_check_failed')
      results.push({ userId, status: 'suppressed', reason: 'policy_check_failed' })
      continue
    }
    const reason = manualResearchSuppressionReason({
      email: candidate.email,
      testMode,
      allowedRecipients,
      optedOut: preference?.email_product_tips === false || candidate.segment === 'E',
      duplicateOrCooldown: (recentDuplicate ?? 0) > 0,
      underDeliveryCap: (recentEmails ?? 0) < 5,
    })
    if (reason) {
      await logDelivery(candidate, campaignEmail.campaignKey, 'suppressed', reason)
      results.push({ userId, status: 'suppressed', reason })
      continue
    }

    try {
      const sendResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { accept: 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: RESEARCH_SENDER_NAME, email: smtpFrom },
          to: [{ email: candidate.email }],
          subject: testMode ? `[TEST] ${campaignEmail.subject}` : campaignEmail.subject,
          htmlContent: campaignEmail.html,
          textContent: campaignEmail.text,
          replyTo: { email: RESEARCH_REPLY_TO },
        }),
      })
      const brevoResult = await sendResponse.text()
      if (!sendResponse.ok) {
        const failure = `brevo_${sendResponse.status}`
        await logDelivery(candidate, campaignEmail.campaignKey, 'failed', failure, { provider_response: brevoResult.slice(0, 500) })
        results.push({ userId, status: 'failed', reason: failure })
        continue
      }
      await logDelivery(candidate, campaignEmail.campaignKey, 'sent', null)
      const { error: eventError } = await admin.from('lifecycle_events').insert({
        user_id: userId,
        event_type: 'lifecycle_email_sent',
        product_area: 'discovery',
        source: 'admin_manual',
        metadata: { campaign: campaignEmail.campaignKey, sent_at: now.toISOString() },
      })
      if (eventError) console.error('Research email cap event insert failed:', eventError.message)
      results.push({ userId, status: 'sent' })
    } catch (error) {
      console.error('Manual research email send failed:', error)
      await logDelivery(candidate, campaignEmail.campaignKey, 'failed', 'provider_request_failed')
      results.push({ userId, status: 'failed', reason: 'provider_request_failed' })
    }
  }

  return response({
    requested: uniqueIds.length,
    sent: results.filter((item) => item.status === 'sent').length,
    suppressed: results.filter((item) => item.status === 'suppressed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  })
})