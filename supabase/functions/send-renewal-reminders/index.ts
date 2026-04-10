import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()

async function sendBrevoEmail(
  brevoApiKey: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  htmlContent: string,
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
        sender: { name: 'InvoiceMonk', email: fromEmail },
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
    captureException(err, { function_name: 'send-renewal-reminders' })
    return false
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function buildRenewalEmailHtml(
  userName: string,
  tierName: string,
  renewalDate: string,
  appUrl: string,
): string {
  const formattedDate = formatDate(renewalDate)
  const safeName = escapeHtml(userName || 'there')
  const safeTier = escapeHtml(tierName.charAt(0).toUpperCase() + tierName.slice(1))

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="background:#18181b;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">InvoiceMonk</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 8px;font-size:18px;color:#18181b;">Your subscription is renewing soon</h2>
          <p style="margin:0 0 24px;color:#71717a;font-size:14px;">Hi ${safeName},</p>
          <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
            Your <strong>${safeTier}</strong> plan will automatically renew on <strong>${formattedDate}</strong>.
            No action is needed — your access will continue uninterrupted.
          </p>
          <p style="margin:0 0 24px;color:#3f3f46;font-size:14px;line-height:1.6;">
            If you'd like to review your billing details or make changes to your subscription, you can do so from your account settings.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#18181b;border-radius:8px;padding:12px 24px;">
              <a href="${escapeHtml(appUrl)}/app/billing" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">Manage Subscription</a>
            </td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">
            You're receiving this because you have an active paid subscription on InvoiceMonk.
            If you have any questions, reach out to our support team.
          </p>
          <p style="margin:8px 0 0;color:#a1a1aa;font-size:12px;">
            &copy; ${new Date().getFullYear()} InvoiceMonk. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  try {
    console.log('send-renewal-reminders: starting')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com'
    const appUrl = Deno.env.get('APP_URL') || 'https://invoicemonk.com'

    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured')
      return new Response(JSON.stringify({ success: false, error: 'Email service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find active paid subscriptions expiring in 1-3 days
    const now = new Date()
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()

    const { data: expiringSubscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('id, user_id, tier, current_period_end')
      .eq('status', 'active')
      .neq('tier', 'starter')
      .gte('current_period_end', oneDayFromNow)
      .lte('current_period_end', threeDaysFromNow)

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      console.log('No subscriptions expiring in 1-3 days')
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${expiringSubscriptions.length} expiring subscriptions`)

    // Get user IDs to check for recent reminders
    const userIds = expiringSubscriptions.map((s) => s.user_id)

    // Check lifecycle_events for recent renewal reminders (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentReminders, error: reminderError } = await supabase
      .from('lifecycle_events')
      .select('user_id')
      .eq('event_type', 'subscription_renewal_reminder')
      .gte('created_at', sevenDaysAgo)
      .in('user_id', userIds)

    if (reminderError) {
      console.error('Error checking recent reminders:', reminderError)
    }

    const recentlyRemindedUserIds = new Set(
      (recentReminders || []).map((r) => r.user_id)
    )

    // Filter out users who already received a reminder
    const subscriptionsToNotify = expiringSubscriptions.filter(
      (s) => !recentlyRemindedUserIds.has(s.user_id)
    )

    if (subscriptionsToNotify.length === 0) {
      console.log('All expiring users already received a reminder in the last 7 days')
      return new Response(JSON.stringify({ success: true, sent: 0, skipped: expiringSubscriptions.length }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch profiles for these users
    const notifyUserIds = subscriptionsToNotify.map((s) => s.user_id)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', notifyUserIds)

    if (profileError) {
      console.error('Error fetching profiles:', profileError)
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch user profiles' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    )

    let sentCount = 0
    let failCount = 0

    for (const sub of subscriptionsToNotify) {
      const profile = profileMap.get(sub.user_id)
      if (!profile || !profile.email) {
        console.warn(`No profile/email for user ${sub.user_id}, skipping`)
        continue
      }

      const subject = `Your ${sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1)} plan renews on ${formatDate(sub.current_period_end)} — InvoiceMonk`
      const html = buildRenewalEmailHtml(
        profile.full_name || '',
        sub.tier,
        sub.current_period_end,
        appUrl,
      )

      const sent = await sendBrevoEmail(brevoApiKey, smtpFrom, profile.email, subject, html)

      if (sent) {
        // Log to lifecycle_events
        const { error: logError } = await supabase
          .from('lifecycle_events')
          .insert({
            user_id: sub.user_id,
            event_type: 'subscription_renewal_reminder',
            metadata: {
              subscription_id: sub.id,
              tier: sub.tier,
              renewal_date: sub.current_period_end,
              email: profile.email,
            },
          })

        if (logError) {
          console.error(`Failed to log lifecycle event for user ${sub.user_id}:`, logError)
        }

        sentCount++
        console.log(`Renewal reminder sent to ${profile.email} (tier: ${sub.tier}, renews: ${sub.current_period_end})`)
      } else {
        failCount++
      }
    }

    console.log(`send-renewal-reminders complete: sent=${sentCount}, failed=${failCount}, skipped=${recentlyRemindedUserIds.size}`)

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failCount,
        skipped: recentlyRemindedUserIds.size,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('send-renewal-reminders error:', error)
    captureException(error, { function_name: 'send-renewal-reminders' })
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
