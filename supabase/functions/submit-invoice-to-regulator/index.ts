import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'

const ADAPTERS: Record<string, { submissionRequired: boolean; regulatorCode: string }> = {
  NG: { submissionRequired: false, regulatorCode: 'NGA-NRS' },
  GB: { submissionRequired: false, regulatorCode: 'GBR-HMRC' },
  DE: { submissionRequired: false, regulatorCode: 'DEU-BFINV' },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { invoice_id } = await req.json()
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Load invoice (RLS ensures access)
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*, compliance_artifacts(*)')
      .eq('id', invoice_id)
      .single()

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Determine jurisdiction
    const issuerSnapshot = (invoice.issuer_snapshot || {}) as Record<string, unknown>
    const jurisdiction = (issuerSnapshot.jurisdiction as string) || ''
    const adapter = ADAPTERS[jurisdiction]

    if (!adapter || !adapter.submissionRequired) {
      return new Response(JSON.stringify({ status: 'not_required', message: `Regulatory submission not required for jurisdiction: ${jurisdiction || 'unknown'}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Find artifact with XML
    const artifacts = (invoice.compliance_artifacts || []) as Array<Record<string, unknown>>
    const xmlArtifact = artifacts.find(a => a.xml_content)
    if (!xmlArtifact) {
      return new Response(JSON.stringify({ error: 'No artifact with XML content found. Generate XML first.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Create submission via DB function
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: submissionId, error: subError } = await serviceClient.rpc('create_regulatory_submission', {
      p_invoice_id: invoice_id,
      p_artifact_id: xmlArtifact.id,
      p_business_id: invoice.business_id,
      p_jurisdiction: jurisdiction,
      p_regulator_code: adapter.regulatorCode,
      p_created_by: userData.user.id,
    })

    if (subError) {
      // Check for idempotent constraint violation
      if (subError.message?.includes('unique') || subError.message?.includes('duplicate')) {
        return new Response(JSON.stringify({ error: 'Active submission already exists for this artifact', status: 'already_exists' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      throw subError
    }

    return new Response(JSON.stringify({ submission_id: submissionId, status: 'pending' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('submit-invoice-to-regulator error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
