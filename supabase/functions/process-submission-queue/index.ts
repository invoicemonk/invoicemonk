import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Authenticate: require CRON_SECRET header
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const incomingSecret = req.headers.get('x-cron-secret') ?? ''
  if (!cronSecret || incomingSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Fetch unprocessed queue items
    const { data: queueItems, error: qError } = await serviceClient
      .from('submission_queue')
      .select('*, regulator_submissions(*)')
      .is('processed_at', null)
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (qError) throw qError

    const results = { processed: 0, succeeded: 0, failed: 0, skipped: 0 }

    for (const item of (queueItems || [])) {
      try {
        const submission = item.regulator_submissions as Record<string, unknown>
        if (!submission) {
          results.skipped++
          continue
        }

        // Currently all jurisdictions are stubbed - log and mark as processed
        // In production, this would call the actual regulator API
        console.log(`[Queue] Would submit to ${submission.regulator_code} for invoice ${submission.invoice_id}`)

        // Transition: pending -> queued -> submitted (stubbed success)
        if (submission.submission_status === 'pending') {
          await serviceClient.rpc('update_submission_status', {
            p_submission_id: item.submission_id,
            p_new_status: 'queued',
          })
        }

        // Mark queue item as processed
        await serviceClient
          .from('submission_queue')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', item.id)

        results.processed++
        results.succeeded++
      } catch (err) {
        console.error(`[Queue] Failed to process item ${item.id}:`, err)
        captureException(err, { function_name: 'process-submission-queue' })

        await serviceClient
          .from('submission_queue')
          .update({
            processed_at: new Date().toISOString(),
            error_message: err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('id', item.id)

        results.processed++
        results.failed++
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('process-submission-queue error:', error)
    captureException(error, { function_name: 'process-submission-queue' })
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
