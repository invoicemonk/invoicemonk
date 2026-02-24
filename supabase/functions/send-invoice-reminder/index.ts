import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sendBrevoEmail(
  brevoApiKey: string,
  fromEmail: string,
  fromName: string,
  toEmail: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail }],
        subject,
        htmlContent,
      }),
    })
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Brevo API error (${response.status}):`, errorText)
      return false
    }
    return true
  } catch (err) {
    console.error('Brevo email send error:', err)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com'

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    // Parse body
    const { invoice_id } = await req.json()
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'Missing invoice_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Fetch invoice with client
    const { data: invoice, error: invoiceError } = await adminClient
      .from('invoices')
      .select('id, invoice_number, status, due_date, total_amount, currency, business_id, reminder_count, last_reminder_sent_at, client_id, clients(name, email)')
      .eq('id', invoice_id)
      .single()

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate status
    if (invoice.status !== 'issued' && invoice.status !== 'sent' && invoice.status !== 'viewed') {
      return new Response(JSON.stringify({ error: 'Invoice is not in a remindable status' }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate overdue
    const today = new Date().toISOString().split('T')[0]
    if (!invoice.due_date || invoice.due_date >= today) {
      return new Response(JSON.stringify({ error: 'Invoice is not overdue' }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate client email
    const client = invoice.clients as any
    if (!client?.email) {
      return new Response(JSON.stringify({ error: 'Client does not have an email address' }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate business membership
    const { data: membership } = await adminClient
      .from('business_members')
      .select('id')
      .eq('business_id', invoice.business_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not authorized for this business' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate 24-hour cooldown
    if (invoice.last_reminder_sent_at) {
      const lastSent = new Date(invoice.last_reminder_sent_at).getTime()
      const hoursElapsed = (Date.now() - lastSent) / (1000 * 60 * 60)
      if (hoursElapsed < 24) {
        const remaining = Math.ceil(24 - hoursElapsed)
        return new Response(JSON.stringify({ error: 'Cooldown active', cooldown_remaining_hours: remaining }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Fetch business name
    const { data: business } = await adminClient
      .from('businesses')
      .select('name')
      .eq('id', invoice.business_id)
      .single()

    const businessName = business?.name || 'InvoiceMonk'

    // Build email
    const publicInvoiceUrl = `https://app.invoicemonk.com/invoice/${invoice.id}`
    const formattedAmount = `${invoice.currency} ${Number(invoice.total_amount).toLocaleString()}`
    const formattedDueDate = new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">Payment Reminder</h1>
  </div>
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>Dear ${client.name},</p>
    <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong>, originally due on <strong>${formattedDueDate}</strong>, remains unpaid.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0d9488;">
      <table style="width: 100%;">
        <tr><td style="padding: 5px 0; color: #666;">Invoice Number:</td><td style="padding: 5px 0; text-align: right; font-weight: bold;">${invoice.invoice_number}</td></tr>
        <tr><td style="padding: 5px 0; color: #666;">Amount Due:</td><td style="padding: 5px 0; text-align: right; font-weight: bold; font-size: 18px; color: #0d9488;">${formattedAmount}</td></tr>
        <tr><td style="padding: 5px 0; color: #666;">Due Date:</td><td style="padding: 5px 0; text-align: right; font-weight: bold;">${formattedDueDate}</td></tr>
      </table>
    </div>
    <p>Please arrange payment at your earliest convenience. If you have already made this payment, kindly disregard this reminder.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${publicInvoiceUrl}" style="background: #0d9488; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View Invoice</a>
    </div>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #888; font-size: 12px; text-align: center;">
      This reminder was sent on behalf of ${businessName} via InvoiceMonk.
    </p>
  </div>
</body>
</html>`

    // Send email
    if (!brevoApiKey) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const sent = await sendBrevoEmail(brevoApiKey, smtpFrom, businessName, client.email, `Reminder: Invoice ${invoice.invoice_number} is overdue`, htmlContent)
    if (!sent) {
      return new Response(JSON.stringify({ error: 'Failed to send reminder email' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const newReminderCount = (invoice.reminder_count || 0) + 1

    // Update invoice reminder fields
    await adminClient
      .from('invoices')
      .update({ reminder_count: newReminderCount, last_reminder_sent_at: new Date().toISOString() })
      .eq('id', invoice_id)

    // Insert lifecycle event
    await adminClient
      .from('lifecycle_events')
      .insert({
        event_type: 'invoice_reminder_sent',
        user_id: userId,
        metadata: {
          invoice_id: invoice.id,
          business_id: invoice.business_id,
          amount: invoice.total_amount,
          currency: invoice.currency,
          reminder_count: newReminderCount,
        }
      })

    console.log(`Reminder #${newReminderCount} sent for invoice ${invoice.invoice_number} to ${client.email}`)

    return new Response(
      JSON.stringify({ success: true, reminder_count: newReminderCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Send invoice reminder error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
