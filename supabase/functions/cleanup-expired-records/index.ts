import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Dynamic CORS configuration - allows any Lovable preview domain + production
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.lovableproject.com') ||
    origin === 'https://app.invoicemonk.com' ||
    origin === 'https://invoicemonk.com' ||
    origin.startsWith('http://localhost:')
  );
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : 'https://app.invoicemonk.com';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

/**
 * Cleanup Expired Records Edge Function
 * 
 * This function runs on a schedule (weekly) to delete records that have
 * passed their retention_locked_until date. This ensures compliance with
 * data retention policies while maintaining audit trails.
 * 
 * Authentication: Requires either:
 * - CLEANUP_SECRET as Bearer token
 * - Supabase service role key as Bearer token
 * 
 * Records affected:
 * - Invoices (and their items)
 * - Payments
 * - Credit notes
 * 
 * Note: This function requires service role access to bypass RLS.
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Strict authentication: require Bearer token matching either CLEANUP_SECRET or service role key
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Bearer token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (token !== serviceRoleKey) {
      console.error('Cleanup function called with invalid credentials')
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid credentials' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const now = new Date().toISOString()
    const results = {
      invoices_deleted: 0,
      invoice_items_deleted: 0,
      payments_deleted: 0,
      credit_notes_deleted: 0,
      verification_logs_deleted: 0,
      export_manifests_deleted: 0,
      started_at: now,
      completed_at: '',
      errors: [] as string[]
    }

    // Step 1: Find expired invoices
    const { data: expiredInvoices, error: invoiceQueryError } = await supabase
      .from('invoices')
      .select('id')
      .lt('retention_locked_until', now.split('T')[0])
      .not('retention_locked_until', 'is', null)

    if (invoiceQueryError) {
      console.error('Error querying expired invoices:', invoiceQueryError)
      results.errors.push(`Invoice query error: ${invoiceQueryError.message}`)
    }

    if (expiredInvoices && expiredInvoices.length > 0) {
      const invoiceIds = expiredInvoices.map(i => i.id)

      // Step 2: Delete invoice items for expired invoices
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .in('invoice_id', invoiceIds)

      if (itemsError) {
        console.error('Error deleting invoice items:', itemsError)
        results.errors.push(`Invoice items deletion error: ${itemsError.message}`)
      } else {
        results.invoice_items_deleted = invoiceIds.length
      }

      // Step 3: Delete payments for expired invoices
      const { error: paymentsError } = await supabase
        .from('payments')
        .delete()
        .in('invoice_id', invoiceIds)

      if (paymentsError) {
        console.error('Error deleting payments:', paymentsError)
        results.errors.push(`Payments deletion error: ${paymentsError.message}`)
      }

      // Step 4: Delete credit notes for expired invoices
      const { error: creditNotesError } = await supabase
        .from('credit_notes')
        .delete()
        .in('original_invoice_id', invoiceIds)

      if (creditNotesError) {
        console.error('Error deleting credit notes:', creditNotesError)
        results.errors.push(`Credit notes deletion error: ${creditNotesError.message}`)
      }

      // Step 5: Delete the expired invoices
      const { error: invoicesError } = await supabase
        .from('invoices')
        .delete()
        .in('id', invoiceIds)

      if (invoicesError) {
        console.error('Error deleting invoices:', invoicesError)
        results.errors.push(`Invoices deletion error: ${invoicesError.message}`)
      } else {
        results.invoices_deleted = invoiceIds.length
      }
    }

    // Step 6: Clean up verification_access_logs older than 90 days
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const { error: verLogError } = await supabase
        .from('verification_access_logs')
        .delete()
        .lt('accessed_at', ninetyDaysAgo)

      if (verLogError) {
        console.error('Error cleaning verification_access_logs:', verLogError)
        results.errors.push(`Verification logs cleanup error: ${verLogError.message}`)
      } else {
        results.verification_logs_deleted = (results.verification_logs_deleted || 0) + 1
      }
    } catch (err) {
      console.error('Verification logs cleanup error:', err)
    }

    // Step 7: Clean up export_manifests older than 365 days
    try {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      const { error: exportError } = await supabase
        .from('export_manifests')
        .delete()
        .lt('timestamp_utc', oneYearAgo)

      if (exportError) {
        console.error('Error cleaning export_manifests:', exportError)
        results.errors.push(`Export manifests cleanup error: ${exportError.message}`)
      } else {
        results.export_manifests_deleted = (results.export_manifests_deleted || 0) + 1
      }
    } catch (err) {
      console.error('Export manifests cleanup error:', err)
    }

    results.completed_at = new Date().toISOString()

    // Log cleanup results as RETENTION_CLEANUP audit event
    console.log('Retention cleanup completed:', results)

    if (results.invoices_deleted > 0 || results.payments_deleted > 0 || results.credit_notes_deleted > 0) {
          try {
        await supabase.rpc('log_audit_event', {
          _event_type: 'RETENTION_CLEANUP',
          _entity_type: 'retention_cleanup',
          _metadata: {
            action: 'retention_cleanup',
            auth_method: 'service_role',
            invoices_deleted: results.invoices_deleted,
            invoice_items_deleted: results.invoice_items_deleted,
            payments_deleted: results.payments_deleted,
            credit_notes_deleted: results.credit_notes_deleted,
            cleanup_date: now,
            errors: results.errors.length > 0 ? results.errors : null
          }
        })
      } catch (auditErr) {
        console.error('Failed to log cleanup audit event:', auditErr)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Retention cleanup completed',
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Cleanup expired records error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})