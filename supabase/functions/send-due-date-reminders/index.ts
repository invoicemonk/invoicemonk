import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
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

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Get all users with their reminder preferences
    const { data: userPrefs, error: prefsError } = await adminClient
      .from('user_preferences')
      .select('user_id, email_payment_reminders, reminder_days_before')
      .eq('email_payment_reminders', true)

    if (prefsError) {
      console.error('Error fetching user preferences:', prefsError)
      throw prefsError
    }

    if (!userPrefs || userPrefs.length === 0) {
      console.log('No users have payment reminders enabled')
      return new Response(
        JSON.stringify({ success: true, message: 'No users have reminders enabled', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${userPrefs.length} users with reminders enabled`)

    let totalRemindersCreated = 0
    let totalEmailsSent = 0

    for (const pref of userPrefs) {
      // Calculate the target due date (today + reminder_days_before)
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() + pref.reminder_days_before)
      const targetDateStr = targetDate.toISOString().split('T')[0]

      // Find invoices for this user that are due on the target date
      const { data: invoices, error: invoicesError } = await adminClient
        .from('invoices')
        .select(`
          id,
          invoice_number,
          due_date,
          total_amount,
          currency,
          user_id,
          business_id,
          client_id,
          clients (
            id,
            name,
            email
          ),
          businesses (
            id,
            name,
            contact_email
          )
        `)
        .eq('user_id', pref.user_id)
        .eq('due_date', targetDateStr)
        .in('status', ['issued', 'sent'])

      if (invoicesError) {
        console.error(`Error fetching invoices for user ${pref.user_id}:`, invoicesError)
        continue
      }

      if (!invoices || invoices.length === 0) {
        continue
      }

      console.log(`Found ${invoices.length} invoices due in ${pref.reminder_days_before} days for user ${pref.user_id}`)

      // Check for already sent reminders in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: existingNotifications } = await adminClient
        .from('notifications')
        .select('entity_id')
        .eq('type', 'INVOICE_REMINDER_SENT')
        .in('entity_id', invoices.map(i => i.id))
        .gte('created_at', oneDayAgo)

      const alreadyNotifiedIds = new Set(existingNotifications?.map(n => n.entity_id) || [])

      for (const invoice of invoices) {
        if (alreadyNotifiedIds.has(invoice.id)) {
          console.log(`Already sent reminder for invoice ${invoice.invoice_number}`)
          continue
        }

        const client = invoice.clients as any
        const business = invoice.businesses as any
        const clientEmail = client?.email
        const clientName = client?.name || 'Customer'
        const businessName = business?.name || 'Our Company'

        // Send email to client if we have their email and Resend is configured
        if (clientEmail && resend) {
          try {
            const verificationUrl = `https://id-preview--82ffc045-b041-402c-abe1-c53a60141b70.lovable.app/verify/${invoice.id}`
            
            await resend.emails.send({
              from: `${businessName} <onboarding@resend.dev>`,
              to: [clientEmail],
              subject: `Reminder: Invoice ${invoice.invoice_number} is due in ${pref.reminder_days_before} days`,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">Payment Reminder</h1>
                  </div>
                  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
                    <p>Dear ${clientName},</p>
                    <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> is due in <strong>${pref.reminder_days_before} days</strong> (${invoice.due_date}).</p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                      <table style="width: 100%;">
                        <tr>
                          <td style="padding: 5px 0; color: #666;">Invoice Number:</td>
                          <td style="padding: 5px 0; text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px 0; color: #666;">Amount Due:</td>
                          <td style="padding: 5px 0; text-align: right; font-weight: bold; font-size: 18px; color: #667eea;">${invoice.currency} ${Number(invoice.total_amount).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px 0; color: #666;">Due Date:</td>
                          <td style="padding: 5px 0; text-align: right; font-weight: bold;">${invoice.due_date}</td>
                        </tr>
                      </table>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: bold;">View Invoice</a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">If you have already made this payment, please disregard this reminder.</p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #888; font-size: 12px; text-align: center;">
                      This email was sent by ${businessName}
                    </p>
                  </div>
                </body>
                </html>
              `,
            })

            console.log(`Reminder email sent to ${clientEmail} for invoice ${invoice.invoice_number}`)
            totalEmailsSent++
          } catch (emailError) {
            console.error(`Failed to send email for invoice ${invoice.invoice_number}:`, emailError)
          }
        }

        // Create in-app notification for the invoice owner
        const { error: notifError } = await adminClient
          .from('notifications')
          .insert({
            user_id: invoice.user_id,
            business_id: invoice.business_id,
            type: 'INVOICE_REMINDER_SENT',
            title: 'Payment Reminder Sent',
            message: `Reminder sent to ${clientName} for invoice ${invoice.invoice_number} (due in ${pref.reminder_days_before} days)`,
            entity_type: 'invoice',
            entity_id: invoice.id,
            is_read: false,
          })

        if (notifError) {
          console.error(`Error creating notification for invoice ${invoice.id}:`, notifError)
        } else {
          totalRemindersCreated++
        }
      }
    }

    console.log(`Completed: ${totalRemindersCreated} reminders created, ${totalEmailsSent} emails sent`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed due date reminders`,
        notifications_created: totalRemindersCreated,
        emails_sent: totalEmailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Send due date reminders error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})