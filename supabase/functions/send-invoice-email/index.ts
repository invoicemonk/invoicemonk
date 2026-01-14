import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendInvoiceRequest {
  invoice_id: string
  recipient_email: string
  custom_message?: string
}

interface IssuerSnapshot {
  legal_name?: string
  name?: string
  contact_email?: string
}

interface RecipientSnapshot {
  name?: string
  email?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id

    // Parse request body
    const body: SendInvoiceRequest = await req.json()
    
    if (!body.invoice_id || !body.recipient_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice ID and recipient email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`*, clients (*)`)
      .eq('id', body.invoice_id)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice fetch error:', invoiceError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only issued invoices can be sent
    if (invoice.status === 'draft') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot send draft invoices. Please issue the invoice first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get SMTP credentials from secrets
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = Deno.env.get('SMTP_PORT')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')
    const smtpFromEmail = Deno.env.get('SMTP_FROM_EMAIL')
    const smtpFromName = Deno.env.get('SMTP_FROM_NAME') || 'Invoicemonk'

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFromEmail) {
      console.error('SMTP credentials not configured')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email sending is not configured. Please add SMTP credentials.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate PDF by calling the generate-pdf function internally
    const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({ invoice_id: body.invoice_id })
    })

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text()
      console.error('PDF generation failed:', errorText)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate invoice PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get PDF as base64
    const pdfBuffer = await pdfResponse.arrayBuffer()
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)))

    // Parse snapshots for email content
    const issuerSnapshot = invoice.issuer_snapshot as IssuerSnapshot | null
    const recipientSnapshot = invoice.recipient_snapshot as RecipientSnapshot | null
    
    const businessName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk'
    const clientName = recipientSnapshot?.name || invoice.clients?.name || 'Valued Customer'

    // Format currency
    const formatCurrency = (amount: number, currency: string = 'NGN') => {
      const localeMap: Record<string, string> = {
        'NGN': 'en-NG', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB'
      }
      const locale = localeMap[currency] || 'en-US'
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
    }

    // Format date
    const formatDate = (date: string | null) => {
      if (!date) return 'Not specified'
      return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      })
    }

    // Verification URL
    const verificationUrl = invoice.verification_id 
      ? `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/verify/invoice/${invoice.verification_id}`
      : null

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; font-size: 24px; color: #1f2937;">${businessName}</h1>
            </td>
          </tr>
        </table>

        <!-- Main Content -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 24px 0;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">Dear ${clientName},</p>
              
              ${body.custom_message ? `<p style="margin: 0 0 16px; color: #374151; font-size: 16px;">${body.custom_message}</p>` : ''}
              
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
                Please find attached invoice <strong>${invoice.invoice_number}</strong> for your review.
              </p>

              <!-- Invoice Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Invoice Number:</span>
                        </td>
                        <td style="text-align: right; padding: 8px 0;">
                          <strong style="color: #1f2937; font-size: 14px;">${invoice.invoice_number}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Issue Date:</span>
                        </td>
                        <td style="text-align: right; padding: 8px 0;">
                          <span style="color: #1f2937; font-size: 14px;">${formatDate(invoice.issue_date)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Due Date:</span>
                        </td>
                        <td style="text-align: right; padding: 8px 0;">
                          <span style="color: #1f2937; font-size: 14px;">${formatDate(invoice.due_date)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 0; border-top: 1px solid #e5e7eb;">
                          <strong style="color: #1f2937; font-size: 16px;">Total Amount:</strong>
                        </td>
                        <td style="text-align: right; padding: 12px 0 0; border-top: 1px solid #e5e7eb;">
                          <strong style="color: #1f2937; font-size: 18px;">${formatCurrency(invoice.total_amount, invoice.currency)}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${verificationUrl ? `
              <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">
                You can verify the authenticity of this invoice at:
                <br>
                <a href="${verificationUrl}" style="color: #2563eb; text-decoration: underline;">${verificationUrl}</a>
              </p>
              ` : ''}

              <p style="margin: 24px 0 0; color: #374151; font-size: 16px;">
                If you have any questions, please don't hesitate to contact us.
              </p>
              
              <p style="margin: 16px 0 0; color: #374151; font-size: 16px;">
                Best regards,<br>
                <strong>${businessName}</strong>
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                This is an automated email from Invoicemonk. The attached invoice is an official financial document.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

    // Send email via SMTP
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: parseInt(smtpPort || '587'),
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword
        }
      }
    })

    try {
      await client.send({
        from: `${smtpFromName} <${smtpFromEmail}>`,
        to: body.recipient_email,
        subject: `Invoice ${invoice.invoice_number} from ${businessName}`,
        html: emailHtml,
        attachments: [
          {
            filename: `${invoice.invoice_number}.pdf`,
            content: pdfBase64,
            encoding: 'base64',
            contentType: 'application/pdf'
          }
        ]
      })

      await client.close()
    } catch (smtpError) {
      console.error('SMTP error:', smtpError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send email. Please check SMTP configuration.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update invoice status to 'sent' if currently 'issued'
    if (invoice.status === 'issued') {
      await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', body.invoice_id)
    }

    // Log audit event using service role for proper logging
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey)
      await adminClient.rpc('log_audit_event', {
        _event_type: 'INVOICE_SENT',
        _entity_type: 'invoice',
        _entity_id: body.invoice_id,
        _user_id: userId,
        _business_id: invoice.business_id,
        _metadata: {
          recipient_email: body.recipient_email,
          sent_at: new Date().toISOString()
        }
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invoice sent successfully',
        recipient: body.recipient_email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Send invoice error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
