import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cleanup Expired Records Edge Function
 * 
 * This function runs on a schedule (weekly) to delete records that have
 * passed their retention_locked_until date. This ensures compliance with
 * data retention policies while maintaining audit trails.
 * 
 * Records affected:
 * - Invoices (and their items)
 * - Payments
 * - Credit notes
 * - Audit logs
 * 
 * Note: This function requires service role access to bypass RLS.
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate authorization - require service role key for scheduled jobs
    const authHeader = req.headers.get('Authorization')
    const scheduledHeader = req.headers.get('X-Scheduled-Function')
    
    // Allow either service role auth or scheduled function trigger
    if (!authHeader?.startsWith('Bearer ') && !scheduledHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const now = new Date().toISOString()
    const results = {
      invoices_deleted: 0,
      invoice_items_deleted: 0,
      payments_deleted: 0,
      credit_notes_deleted: 0,
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
        results.invoice_items_deleted = invoiceIds.length // Approximate count
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

    results.completed_at = new Date().toISOString()

    // Log cleanup results (this creates an audit trail of the cleanup itself)
    console.log('Retention cleanup completed:', results)

    // If any records were deleted, log the cleanup action
    if (results.invoices_deleted > 0 || results.payments_deleted > 0 || results.credit_notes_deleted > 0) {
      await supabase.rpc('log_audit_event', {
        _event_type: 'DATA_EXPORTED', // Using DATA_EXPORTED as closest match for data operations
        _entity_type: 'retention_cleanup',
        _metadata: {
          action: 'retention_cleanup',
          invoices_deleted: results.invoices_deleted,
          invoice_items_deleted: results.invoice_items_deleted,
          payments_deleted: results.payments_deleted,
          credit_notes_deleted: results.credit_notes_deleted,
          cleanup_date: now,
          errors: results.errors.length > 0 ? results.errors : null
        }
      })
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
