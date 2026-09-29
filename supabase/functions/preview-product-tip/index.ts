import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { findJob, resolveJourney, SAMPLE_JOURNEYS } from '../_shared/product-tip-email.ts'
import { renderResearchEmail, type ResearchSegment, type ResearchStep } from '../_shared/research-email.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Authorization required' }, 401)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: 'Invalid or expired token' }, 401)
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'platform_admin' })
  if (!isAdmin) return json({ error: 'Forbidden' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  // Sample journeys
  if (body.samples === true) return json({ samples: SAMPLE_JOURNEYS.map((s, i) => ({ index: i, label: s.label, result: resolveJourney(s.input), events: s.input.events.map((e) => e.event_type), statedIntent: s.input.statedIntent ?? null })) })

  // Research email previews
  if (body.research && typeof body.research === 'object') {
    const r = body.research as Record<string, unknown>
    const segment = String(r.segment) as ResearchSegment, step = Number(r.step) as ResearchStep
    if (!['A', 'B', 'C'].includes(segment) || ![1, 2, 3].includes(step)) return json({ error: 'Invalid segment or step' }, 400)
    const email = renderResearchEmail({ name: typeof r.name === 'string' ? r.name.slice(0, 100) : 'Ada Obi', segment, step, cancellationReason: typeof r.cancellationReason === 'string' ? r.cancellationReason.slice(0, 50) : null, cancellationDetails: typeof r.cancellationDetails === 'string' ? r.cancellationDetails.slice(0, 500) : null, hasUsageHistory: segment === 'A' })
    return json({ email })
  }

  // Real user journeys
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !email.includes('@')) return json({ error: 'A valid email is required' }, 400)
  const journeyId = typeof body.journeyId === 'string' ? body.journeyId : ''
  if (journeyId && !uuid.test(journeyId)) return json({ error: 'Invalid journey ID' }, 400)
  const { data: profile } = await admin.from('profiles').select('id, full_name').ilike('email', email).maybeSingle()
  if (!profile) return json({ error: 'No user found for that email' }, 404)
  let jq = admin.from('product_activation').select('id, business_id, product_area, workflow, stopped_step, outcome_at, status, last_active_at').eq('user_id', profile.id)
  if (journeyId) jq = jq.eq('id', journeyId)
  const { data: journeys } = await jq.order('last_active_at', { ascending: false }).limit(journeyId ? 1 : 30)
  const { data: intents } = await admin.from('user_intents').select('intent, other_text, is_primary').eq('user_id', profile.id).order('is_primary', { ascending: false }).limit(1)
  const intent = intents?.[0]
  const out = []
  for (const j of journeys ?? []) {
    const job = findJob(j.product_area, j.workflow)
    let eq = admin.from('lifecycle_events').select('event_type, stage, created_at, metadata').eq('user_id', profile.id).eq('product_area', j.product_area)
    if (job) eq = eq.in('workflow', job.workflows); else if (j.workflow) eq = eq.eq('workflow', j.workflow)
    eq = j.business_id ? eq.eq('business_id', j.business_id) : eq.is('business_id', null)
    const { data: events } = await eq.order('created_at', { ascending: true }).limit(200)
    const result = j.outcome_at ? { status: 'outcome_completed', jobId: job?.id ?? null } : resolveJourney({ name: profile.full_name, productArea: j.product_area, workflow: j.workflow, stoppedStep: j.stopped_step, statedIntent: intent?.intent, statedIntentText: intent?.other_text, events: events ?? [] })
    out.push({ journey: j, job: job ? { id: job.id, label: job.label } : null, events: (events ?? []).map((e) => ({ event_type: e.event_type, created_at: e.created_at })), result })
  }
  return json({ user: { id: profile.id, name: profile.full_name }, statedIntent: intent ? { intent: intent.intent, text: intent.other_text } : null, journeys: out })
})
