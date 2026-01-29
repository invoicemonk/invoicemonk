import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserPreference {
  user_id: string
  email_payment_reminders: boolean
  reminder_days_before: number
  reminder_schedule: number[] | null
  overdue_reminder_enabled: boolean
  overdue_reminder_schedule: number[] | null
  reminder_email_template: string | null
}

interface InvoiceWithRelations {
  id: string
  invoice_number: string
  due_date: string
  total_amount: number
  currency: string
  user_id: string
  business_id: string
  client_id: string
  clients: { id: string; name: string; email: string } | null
  businesses: { id: string; name: string; contact_email: string } | null
}

Deno.serve(async (req) => {
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

    // Get all users with payment reminders enabled
    const { data: userPrefs, error: prefsError } = await adminClient
      .from('user_preferences')
      .select('user_id, email_payment_reminders, reminder_days_before, reminder_schedule, overdue_reminder_enabled, overdue_reminder_schedule, reminder_email_template')
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

    for (const pref of userPrefs as UserPreference[]) {
      // Collect all days we need to check for this user
      const daysToCheck: { daysOffset: number; isOverdue: boolean }[] = []

      // Before due date reminders
      const beforeDays = pref.reminder_schedule && pref.reminder_schedule.length > 0
        ? pref.reminder_schedule
        : [pref.reminder_days_before]
      
      for (const days of beforeDays) {
        daysToCheck.push({ daysOffset: days, isOverdue: false })
      }

      // After due date (overdue) reminders
      if (pref.overdue_reminder_enabled && pref.overdue_reminder_schedule && pref.overdue_reminder_schedule.length > 0) {
        for (const days of pref.overdue_reminder_schedule) {
          daysToCheck.push({ daysOffset: -days, isOverdue: true })
        }
      }

      for (const { daysOffset, isOverdue } of daysToCheck) {
        // Calculate target date
        const targetDate = new Date(today)
        targetDate.setDate(targetDate.getDate() + daysOffset)
        const targetDateStr = targetDate.toISOString().split('T')[0]

        // For pre-due reminders, find invoices due on target date
        // For overdue reminders, find invoices that were due on target date (in the past)
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
            clients (id, name, email),
            businesses (id, name, contact_email)
          `)
          .eq('user_id', pref.user_id)
          .eq('due_date', targetDateStr)
          .in('status', ['issued', 'sent', 'viewed'])

        if (invoicesError) {
          console.error(`Error fetching invoices for user ${pref.user_id}:`, invoicesError)
          continue
        }

        if (!invoices || invoices.length === 0) {
          continue
        }

        const reminderType = isOverdue 
          ? `INVOICE_OVERDUE_REMINDER` 
          : 'INVOICE_REMINDER_SENT'
        const daysLabel = Math.abs(daysOffset)

        console.log(`Found ${invoices.length} invoices ${isOverdue ? 'overdue by' : 'due in'} ${daysLabel} days for user ${pref.user_id}`)

        // Check for already sent reminders with same type and day offset
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: existingNotifications } = await adminClient
          .from('notifications')
          .select('entity_id, message')
          .in('type', ['INVOICE_REMINDER_SENT', 'INVOICE_OVERDUE_REMINDER'])
          .in('entity_id', invoices.map(i => i.id))
          .gte('created_at', oneDayAgo)

        // Create a set of invoice IDs that already have this specific reminder
        const alreadyNotifiedIds = new Set(
          existingNotifications
            ?.filter(n => n.message.includes(`${daysLabel} day`))
            .map(n => n.entity_id) || []
        )

        for (const invoice of invoices) {
          const invoiceData = invoice as any
          if (alreadyNotifiedIds.has(invoiceData.id)) {
            console.log(`Already sent ${daysLabel}-day reminder for invoice ${invoiceData.invoice_number}`)
            continue
          }

          const client = invoiceData.clients as { id: string; name: string; email: string } | null
          const business = invoiceData.businesses as { id: string; name: string; contact_email: string } | null
          const clientEmail = client?.email
          const clientName = client?.name || 'Customer'
          const businessName = business?.name || 'Our Company'

          // Send email to client
          if (clientEmail && resend) {
            try {
              const verificationUrl = `${supabaseUrl.replace('.supabase.co', '')}-preview--82ffc045-b041-402c-abe1-c53a60141b70.lovable.app/verify/${invoice.id}`
              
              const subject = isOverdue
                ? `Overdue: Invoice ${invoiceData.invoice_number} was due ${daysLabel} days ago`
                : `Reminder: Invoice ${invoiceData.invoice_number} is due in ${daysLabel} days`
              
              const statusText = isOverdue
                ? `<span style="color: #dc2626; font-weight: bold;">OVERDUE</span> - was due ${daysLabel} days ago`
                : `due in <strong>${daysLabel} days</strong> (${invoiceData.due_date})`

              const customMessage = pref.reminder_email_template
                ? `<div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
                    <p style="margin: 0; color: #0369a1;">${pref.reminder_email_template}</p>
                   </div>`
                : ''

              await resend.emails.send({
                from: `${businessName} <onboarding@resend.dev>`,
                to: [clientEmail],
                subject,
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  </head>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: ${isOverdue ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                      <h1 style="margin: 0; font-size: 24px;">${isOverdue ? 'Payment Overdue' : 'Payment Reminder'}</h1>
                    </div>
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
                      <p>Dear ${clientName},</p>
                      <p>This is a ${isOverdue ? 'notice' : 'friendly reminder'} that invoice <strong>${invoiceData.invoice_number}</strong> is ${statusText}.</p>
                      
                      ${customMessage}
                      
                      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isOverdue ? '#dc2626' : '#667eea'};">
                        <table style="width: 100%;">
                          <tr>
                            <td style="padding: 5px 0; color: #666;">Invoice Number:</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: bold;">${invoiceData.invoice_number}</td>
                          </tr>
                          <tr>
                            <td style="padding: 5px 0; color: #666;">Amount Due:</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: bold; font-size: 18px; color: ${isOverdue ? '#dc2626' : '#667eea'};">${invoiceData.currency} ${Number(invoiceData.total_amount).toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td style="padding: 5px 0; color: #666;">Due Date:</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: bold; ${isOverdue ? 'color: #dc2626;' : ''}">${invoiceData.due_date}</td>
                          </tr>
                        </table>
                      </div>
                      
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" style="display: inline-block; background: ${isOverdue ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: bold;">View Invoice</a>
                      </div>
                      
                      <p style="color: #666; font-size: 14px;">${isOverdue ? 'Please arrange payment at your earliest convenience to avoid any further action.' : 'If you have already made this payment, please disregard this reminder.'}</p>
                      
                      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                      <p style="color: #888; font-size: 12px; text-align: center;">
                        This email was sent by ${businessName}
                      </p>
                    </div>
                  </body>
                  </html>
                `,
              })

              console.log(`${isOverdue ? 'Overdue' : 'Reminder'} email sent to ${clientEmail} for invoice ${invoiceData.invoice_number}`)
              totalEmailsSent++
            } catch (emailError) {
              console.error(`Failed to send email for invoice ${invoiceData.invoice_number}:`, emailError)
            }
          }

          // Create in-app notification for the invoice owner
          const notificationMessage = isOverdue
            ? `Overdue reminder sent to ${clientName} for invoice ${invoiceData.invoice_number} (${daysLabel} days overdue)`
            : `Reminder sent to ${clientName} for invoice ${invoiceData.invoice_number} (due in ${daysLabel} days)`

          const { error: notifError } = await adminClient
            .from('notifications')
            .insert({
              user_id: invoiceData.user_id,
              business_id: invoiceData.business_id,
              type: reminderType,
              title: isOverdue ? 'Overdue Reminder Sent' : 'Payment Reminder Sent',
              message: notificationMessage,
              entity_type: 'invoice',
              entity_id: invoiceData.id,
              is_read: false,
            })

          if (notifError) {
            console.error(`Error creating notification for invoice ${invoiceData.id}:`, notifError)
          } else {
            totalRemindersCreated++
          }
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
