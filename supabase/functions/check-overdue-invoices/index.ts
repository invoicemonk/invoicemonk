import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const resend = resendApiKey ? new Resend(resendApiKey) : null

    // Find all overdue invoices (issued or sent, past due date, not paid/voided)
    const today = new Date().toISOString().split('T')[0]
    
    const { data: overdueInvoices, error: invoicesError } = await adminClient
      .from('invoices')
      .select(`
        id, 
        invoice_number, 
        user_id, 
        business_id, 
        due_date, 
        total_amount, 
        currency,
        businesses (
          name,
          contact_email
        )
      `)
      .in('status', ['issued', 'sent'])
      .lt('due_date', today)
      .not('due_date', 'is', null)

    if (invoicesError) {
      console.error('Error fetching overdue invoices:', invoicesError)
      throw invoicesError
    }

    console.log(`Found ${overdueInvoices?.length || 0} overdue invoices`)

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No overdue invoices found', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for existing INVOICE_OVERDUE notifications in the last 24 hours to avoid spam
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: existingNotifications, error: notifError } = await adminClient
      .from('notifications')
      .select('entity_id')
      .eq('type', 'INVOICE_OVERDUE')
      .gte('created_at', oneDayAgo)

    if (notifError) {
      console.error('Error fetching existing notifications:', notifError)
    }

    const alreadyNotifiedIds = new Set(existingNotifications?.map(n => n.entity_id) || [])

    // Get user preferences for email alerts
    const userIds = [...new Set(overdueInvoices.map(i => i.user_id).filter(Boolean))]
    const { data: userPrefs } = await adminClient
      .from('user_preferences')
      .select('user_id, email_overdue_alerts')
      .in('user_id', userIds)

    const userPrefsMap = new Map(userPrefs?.map(p => [p.user_id, p]) || [])

    // Get user profiles for email addresses
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds)

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

    let emailsSent = 0

    // Create notifications for invoices not yet notified
    const notificationsToCreate = overdueInvoices
      .filter(invoice => !alreadyNotifiedIds.has(invoice.id))
      .map(invoice => ({
        user_id: invoice.user_id,
        business_id: invoice.business_id,
        type: 'INVOICE_OVERDUE',
        title: 'Invoice Overdue',
        message: `Invoice ${invoice.invoice_number} is past due (due: ${invoice.due_date})`,
        entity_type: 'invoice',
        entity_id: invoice.id,
        is_read: false,
      }))

    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await adminClient
        .from('notifications')
        .insert(notificationsToCreate)

      if (insertError) {
        console.error('Error creating notifications:', insertError)
        throw insertError
      }

      console.log(`Created ${notificationsToCreate.length} overdue notifications`)

      // Send emails to users who have email_overdue_alerts enabled
      if (resend) {
        for (const invoice of overdueInvoices.filter(i => !alreadyNotifiedIds.has(i.id))) {
          const userPref = userPrefsMap.get(invoice.user_id)
          // Default to true if no preferences exist
          const shouldSendEmail = userPref?.email_overdue_alerts !== false
          
          if (shouldSendEmail) {
            const profile = profilesMap.get(invoice.user_id)
            if (profile?.email) {
              try {
                const business = invoice.businesses as any
                const businessName = business?.name || 'InvoiceMonk'
                const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))

                await resend.emails.send({
                  from: `InvoiceMonk <onboarding@resend.dev>`,
                  to: [profile.email],
                  subject: `⚠️ Invoice ${invoice.invoice_number} is ${daysOverdue} day(s) overdue`,
                  html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="utf-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px;">⚠️ Overdue Invoice Alert</h1>
                      </div>
                      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
                        <p>Hi ${profile.full_name || 'there'},</p>
                        <p>This is to alert you that the following invoice is now <strong>${daysOverdue} day(s) overdue</strong>:</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                          <table style="width: 100%;">
                            <tr>
                              <td style="padding: 5px 0; color: #666;">Invoice Number:</td>
                              <td style="padding: 5px 0; text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
                            </tr>
                            <tr>
                              <td style="padding: 5px 0; color: #666;">Business:</td>
                              <td style="padding: 5px 0; text-align: right;">${businessName}</td>
                            </tr>
                            <tr>
                              <td style="padding: 5px 0; color: #666;">Amount:</td>
                              <td style="padding: 5px 0; text-align: right; font-weight: bold; font-size: 18px; color: #dc2626;">${invoice.currency} ${Number(invoice.total_amount).toLocaleString()}</td>
                            </tr>
                            <tr>
                              <td style="padding: 5px 0; color: #666;">Due Date:</td>
                              <td style="padding: 5px 0; text-align: right; font-weight: bold;">${invoice.due_date}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <p>Consider following up with your client to collect this payment.</p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        <p style="color: #888; font-size: 12px; text-align: center;">
                          You can manage your email notification preferences in Settings.<br>
                          This email was sent by InvoiceMonk.
                        </p>
                      </div>
                    </body>
                    </html>
                  `,
                })

                console.log(`Overdue alert email sent to ${profile.email} for invoice ${invoice.invoice_number}`)
                emailsSent++
              } catch (emailError) {
                console.error(`Failed to send overdue email for invoice ${invoice.invoice_number}:`, emailError)
              }
            }
          }
        }
      }
    } else {
      console.log('All overdue invoices already notified in the last 24 hours')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${overdueInvoices.length} overdue invoices`,
        notifications_created: notificationsToCreate.length,
        emails_sent: emailsSent
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Check overdue invoices error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
