import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Send email via Brevo (Sendinblue) API
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

// =============================================
// Email Templates
// =============================================

function emailWrapper(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <img src="https://app.invoicemonk.com/invoicemonk-logo.png" alt="InvoiceMonk" style="height: 32px; margin-bottom: 12px;" />
    <h1 style="margin: 0; font-size: 22px;">${title}</h1>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px;">
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 11px; text-align: center;">
      Sent by InvoiceMonk · <a href="https://invoicemonk.com" style="color: #999;">invoicemonk.com</a>
    </p>
  </div>
</body>
</html>`
}

function campaignATemplate(userName: string): string {
  return emailWrapper(
    'Complete Your Setup',
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    `<p>Hi ${userName},</p>
    <p>We noticed you haven't verified your email yet. Verifying unlocks the full power of Invoicemonk:</p>
    <ul style="color: #555;">
      <li>Issue professional invoices with compliance features</li>
      <li>Get notified when clients view your invoices</li>
      <li>Access your data across devices</li>
    </ul>
    <p>Check your inbox for the verification email, or <a href="https://app.invoicemonk.com/settings" style="color: #d97706; font-weight: bold;">resend it from your settings</a>.</p>
    <p style="color: #888; font-size: 13px;">If you've already verified, you can ignore this email.</p>`
  )
}

function campaignBTemplate(userName: string): string {
  return emailWrapper(
    'Ready to Send Your First Invoice?',
    'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    `<p>Hi ${userName},</p>
    <p>Your Invoicemonk account is verified and ready to go! Here's how to get started in under 2 minutes:</p>
    <ol style="color: #555;">
      <li><strong>Add a client</strong> — name and email is all you need</li>
      <li><strong>Create an invoice</strong> — add line items, set a due date</li>
      <li><strong>Issue &amp; send</strong> — your client gets a professional, verifiable invoice</li>
    </ol>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/invoices/new" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Create Your First Invoice →</a>
    </div>
    <p style="color: #888; font-size: 13px;">Every invoice includes a unique verification ID and tamper-proof hash — compliance built in.</p>`
  )
}

function campaignCTemplate(userName: string, overdueCount: number): string {
  return emailWrapper(
    'You Have Overdue Invoices',
    'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    `<p>Hi ${userName},</p>
    <p>You currently have <strong>${overdueCount} overdue invoice${overdueCount > 1 ? 's' : ''}</strong> that ${overdueCount > 1 ? 'haven\'t' : 'hasn\'t'} been paid yet.</p>
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
      <p style="margin: 0; color: #991b1b; font-size: 14px;">
        💡 <strong>Tip:</strong> Send a payment reminder directly from the invoice detail page. Clients are 3× more likely to pay after a reminder.
      </p>
    </div>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/invoices" style="display: inline-block; background: #ef4444; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review Overdue Invoices →</a>
    </div>
    <p style="color: #888; font-size: 13px;">You can also enable automatic reminders in your notification settings.</p>`
  )
}

function campaignDTemplate(userName: string): string {
  return emailWrapper(
    'We Miss You!',
    'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    `<p>Hi ${userName},</p>
    <p>It's been a while since you logged into Invoicemonk. Your dashboard is ready and waiting — here's what you can do today:</p>
    <ul style="color: #555;">
      <li>Check on outstanding invoices and payments</li>
      <li>Send reminders to clients with overdue balances</li>
      <li>Create and issue a new invoice in under 2 minutes</li>
    </ul>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/dashboard" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Dashboard →</a>
    </div>
    <p style="color: #888; font-size: 13px;">Your data is always secure and waiting for you.</p>`
  )
}

function campaignETemplate(userName: string, invoiceNumber: string): string {
  return emailWrapper(
    'Your Draft Invoice is Waiting',
    'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    `<p>Hi ${userName},</p>
    <p>You started invoice <strong>${invoiceNumber}</strong> but haven't issued it yet. Completing and sending it only takes a moment.</p>
    <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; color: #1e40af; font-size: 14px;">
        📝 <strong>Quick tip:</strong> Review line items, set a due date, and hit "Issue" — your client will receive a professional, verifiable invoice.
      </p>
    </div>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/invoices" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Complete Your Invoice →</a>
    </div>
    <p style="color: #888; font-size: 13px;">Drafts are saved automatically — pick up right where you left off.</p>`
  )
}

function campaignFTemplate(
  userName: string,
  invoiceCount: number,
  totalAmount: string,
  overdueCount: number,
  currency: string
): string {
  const overdueSection = overdueCount > 0
    ? `<div style="background: #fef2f2; padding: 12px 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #ef4444;">
        <p style="margin: 0; color: #991b1b; font-size: 14px;">⚠️ You have <strong>${overdueCount}</strong> overdue invoice${overdueCount > 1 ? 's' : ''} that need${overdueCount === 1 ? 's' : ''} attention.</p>
      </div>`
    : ''

  return emailWrapper(
    'Your Weekly Revenue Summary',
    'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    `<p>Hi ${userName},</p>
    <p>Here's your invoicing activity for the past 7 days:</p>
    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <div style="display: inline-block; margin: 0 20px; text-align: center;">
        <p style="margin: 0; font-size: 28px; font-weight: bold; color: #059669;">${invoiceCount}</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Invoices Issued</p>
      </div>
      <div style="display: inline-block; margin: 0 20px; text-align: center;">
        <p style="margin: 0; font-size: 28px; font-weight: bold; color: #059669;">${currency} ${totalAmount}</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Total Revenue</p>
      </div>
    </div>
    ${overdueSection}
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/dashboard" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Full Dashboard →</a>
    </div>
    <p style="color: #888; font-size: 13px;">This summary is sent weekly. Keep up the great work!</p>`
  )
}

// =============================================
// NEW Campaign Templates (G, H, I)
// =============================================

function campaignGTemplate(userName: string): string {
  return emailWrapper(
    'Set Up Your Business Profile',
    'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
    `<p>Hi ${userName},</p>
    <p>Your email is verified — great start! Now set up your business profile to unlock invoicing:</p>
    <ul style="color: #555;">
      <li><strong>Add your business details</strong> — name, address, and tax info</li>
      <li><strong>Choose your currency</strong> — we support multiple currencies</li>
      <li><strong>Start invoicing</strong> — create professional, compliant invoices</li>
    </ul>
    <div style="background: #f5f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
      <p style="margin: 0; color: #5b21b6; font-size: 14px;">
        🏢 <strong>It takes less than 2 minutes</strong> to set up your business profile and start sending invoices.
      </p>
    </div>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/dashboard" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Set Up Business Profile →</a>
    </div>
    <p style="color: #888; font-size: 13px;">Your compliance-ready invoicing workspace is waiting.</p>`
  )
}

function campaignHTemplate(userName: string): string {
  return emailWrapper(
    'Your Business is Ready — Create Your First Invoice',
    'linear-gradient(135deg, #14b8a6 0%, #059669 100%)',
    `<p>Hi ${userName},</p>
    <p>Your business profile is set up and ready to go! Here's how to create your first invoice:</p>
    <ol style="color: #555;">
      <li><strong>Add a client</strong> — just a name and email to start</li>
      <li><strong>Create an invoice</strong> — add line items, choose a template</li>
      <li><strong>Issue &amp; send</strong> — your client receives a professional, verifiable invoice</li>
    </ol>
    <div style="background: #f0fdfa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #14b8a6;">
      <p style="margin: 0; color: #0f766e; font-size: 14px;">
        ✅ <strong>Every invoice</strong> includes a unique verification ID and tamper-proof hash — compliance is built in from day one.
      </p>
    </div>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/dashboard" style="display: inline-block; background: linear-gradient(135deg, #14b8a6, #059669); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Create Your First Invoice →</a>
    </div>
    <p style="color: #888; font-size: 13px;">Get paid faster with professional invoices.</p>`
  )
}

function campaignITemplate(userName: string, invoiceCount: number): string {
  return emailWrapper(
    'Unlock Compliance Permanently',
    'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    `<p>Hi ${userName},</p>
    <p>You've issued <strong>${invoiceCount} invoices</strong> — nice work! You're clearly serious about your business. Here's what upgrading to <strong>Professional</strong> unlocks:</p>
    <ul style="color: #555;">
      <li>✅ <strong>Unlimited invoices</strong> — no monthly caps</li>
      <li>🔒 <strong>Full audit trail</strong> — tamper-proof compliance records</li>
      <li>📊 <strong>Advanced reports</strong> — revenue analytics and insights</li>
      <li>🎨 <strong>Custom branding</strong> — your logo on every invoice</li>
      <li>📤 <strong>Data exports</strong> — CSV and PDF downloads anytime</li>
    </ul>
    <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        🚀 <strong>Professional users</strong> save an average of 4 hours per week on invoicing and compliance.
      </p>
    </div>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/billing" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Upgrade to Professional →</a>
    </div>
    <p style="color: #888; font-size: 13px;">Compliance-grade invoicing for growing businesses.</p>`
  )
}

// =============================================
// Main Handler
// =============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()
    const MAX_EXECUTION_MS = 20_000 // 20 second guard

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com'

    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'BREVO_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const summary: Record<string, { targeted: number; sent: number; skipped: number; errors: number }> = {
      campaign_a: { targeted: 0, sent: 0, skipped: 0, errors: 0 },
      campaign_b: { targeted: 0, sent: 0, skipped: 0, errors: 0 },
      campaign_c: { targeted: 0, sent: 0, skipped: 0, errors: 0 },
      campaign_d: { targeted: 0, sent: 0, skipped: 0, errors: 0 },
      campaign_e: { targeted: 0, sent: 0, skipped: 0, errors: 0 },
      campaign_f: { targeted: 0, sent: 0, skipped: 0, errors: 0 },
      campaign_g: { targeted: 0, sent: 0, skipped: 0, errors: 0 },
      campaign_h: { targeted: 0, sent: 0, skipped: 0, errors: 0 },
      campaign_i: { targeted: 0, sent: 0, skipped: 0, errors: 0 },
    }

    let timedOut = false

    function checkTimeout(campaignName: string): boolean {
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.warn(`Execution time guard: stopping before ${campaignName} (${Date.now() - startTime}ms elapsed)`)
        timedOut = true
        return true
      }
      return false
    }

    // =============================================
    // Step 1: Refresh overdue counts via CTE-style update
    // =============================================
    console.log('Step 1: Refreshing overdue counts...')

    const { data: overdueData, error: overdueError } = await adminClient
      .from('invoices')
      .select('user_id')
      .in('status', ['issued', 'sent', 'viewed'])
      .lt('due_date', now.toISOString().split('T')[0])
      .not('user_id', 'is', null)

    if (overdueError) {
      console.error('Error fetching overdue invoices:', overdueError)
    } else if (overdueData) {
      const overdueCounts: Record<string, number> = {}
      for (const row of overdueData) {
        if (row.user_id) {
          overdueCounts[row.user_id] = (overdueCounts[row.user_id] || 0) + 1
        }
      }

      await adminClient
        .from('user_activity_state')
        .update({ overdue_count: 0, updated_at: now.toISOString() })
        .gt('overdue_count', 0)

      for (const [userId, count] of Object.entries(overdueCounts)) {
        await adminClient
          .from('user_activity_state')
          .update({ overdue_count: count, updated_at: now.toISOString() })
          .eq('user_id', userId)
      }
      console.log(`Refreshed overdue counts for ${Object.keys(overdueCounts).length} users`)
    }

    // Helper: check 30-day email cap (LIMIT 5)
    async function isUnderCap(userId: string): Promise<boolean> {
      const { data: capCheck } = await adminClient
        .from('lifecycle_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'lifecycle_email_sent')
        .gte('created_at', thirtyDaysAgo)
        .limit(5)

      return !capCheck || capCheck.length < 5
    }

    // Helper: get user profile (email + name)
    async function getUserProfile(userId: string): Promise<{ email: string; name: string } | null> {
      const { data } = await adminClient
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single()

      if (!data || !data.email) return null
      return { email: data.email, name: data.full_name || 'there' }
    }

    // Helper: record email sent
    async function recordEmailSent(userId: string, campaignKey: string, extraMetadata?: Record<string, unknown>) {
      await adminClient
        .from('lifecycle_events')
        .insert({
          user_id: userId,
          event_type: 'lifecycle_email_sent',
          metadata: { campaign: campaignKey, sent_at: now.toISOString(), ...extraMetadata },
        })
    }

    // =============================================
    // Campaign A: Unverified Email Nudge
    // =============================================
    if (!checkTimeout('Campaign A')) {
      try {
        console.log('Campaign A: Unverified email nudge...')
        const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const { data: targetsA } = await adminClient
          .from('user_activity_state')
          .select('user_id')
          .eq('email_verified', false)
          .lt('created_at', fortyEightHoursAgo)
          .or(`last_unverified_email_at.is.null,last_unverified_email_at.lt.${sevenDaysAgo}`)
          .limit(50)

        if (targetsA && targetsA.length > 0) {
          summary.campaign_a.targeted = targetsA.length
          console.log(`Campaign A: ${targetsA.length} targets`)

          for (const target of targetsA) {
            try {
              if (!(await isUnderCap(target.user_id))) {
                summary.campaign_a.skipped++
                continue
              }

              const profile = await getUserProfile(target.user_id)
              if (!profile) {
                summary.campaign_a.skipped++
                continue
              }

              const sent = await sendBrevoEmail(
                brevoApiKey,
                smtpFrom,
                'Invoicemonk',
                profile.email,
                'Complete your Invoicemonk setup',
                campaignATemplate(profile.name)
              )

              if (sent) {
                await adminClient
                  .from('user_activity_state')
                  .update({ last_unverified_email_at: now.toISOString(), updated_at: now.toISOString() })
                  .eq('user_id', target.user_id)

                await recordEmailSent(target.user_id, 'campaign_a')
                summary.campaign_a.sent++
              } else {
                summary.campaign_a.errors++
              }
            } catch (userErr) {
              console.error(`Campaign A: Error for user ${target.user_id}:`, userErr)
              summary.campaign_a.errors++
            }
          }
        } else {
          console.log('Campaign A: No targets found')
        }
      } catch (campaignErr) {
        console.error('Campaign A failed:', campaignErr)
      }
    }

    // =============================================
    // Campaign B: First Invoice Encouragement
    // =============================================
    if (!checkTimeout('Campaign B')) {
      try {
        console.log('Campaign B: First invoice encouragement...')
        const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

        const { data: targetsB } = await adminClient
          .from('user_activity_state')
          .select('user_id')
          .eq('email_verified', true)
          .eq('total_invoices', 0)
          .lt('created_at', seventyTwoHoursAgo)
          .or(`last_first_invoice_email_at.is.null,last_first_invoice_email_at.lt.${fourteenDaysAgo}`)
          .limit(50)

        if (targetsB && targetsB.length > 0) {
          summary.campaign_b.targeted = targetsB.length
          console.log(`Campaign B: ${targetsB.length} targets`)

          for (const target of targetsB) {
            try {
              if (!(await isUnderCap(target.user_id))) {
                summary.campaign_b.skipped++
                continue
              }

              const profile = await getUserProfile(target.user_id)
              if (!profile) {
                summary.campaign_b.skipped++
                continue
              }

              const sent = await sendBrevoEmail(
                brevoApiKey,
                smtpFrom,
                'Invoicemonk',
                profile.email,
                'Ready to send your first invoice?',
                campaignBTemplate(profile.name)
              )

              if (sent) {
                await adminClient
                  .from('user_activity_state')
                  .update({ last_first_invoice_email_at: now.toISOString(), updated_at: now.toISOString() })
                  .eq('user_id', target.user_id)

                await recordEmailSent(target.user_id, 'campaign_b')
                summary.campaign_b.sent++
              } else {
                summary.campaign_b.errors++
              }
            } catch (userErr) {
              console.error(`Campaign B: Error for user ${target.user_id}:`, userErr)
              summary.campaign_b.errors++
            }
          }
        } else {
          console.log('Campaign B: No targets found')
        }
      } catch (campaignErr) {
        console.error('Campaign B failed:', campaignErr)
      }
    }

    // =============================================
    // Campaign C: Overdue Invoice Nudge
    // =============================================
    if (!checkTimeout('Campaign C')) {
      try {
        console.log('Campaign C: Overdue invoice nudge...')
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const { data: targetsC } = await adminClient
          .from('user_activity_state')
          .select('user_id, overdue_count')
          .gt('overdue_count', 0)
          .or(`last_login_at.is.null,last_login_at.lt.${threeDaysAgo}`)
          .or(`last_overdue_email_at.is.null,last_overdue_email_at.lt.${sevenDaysAgo}`)
          .limit(50)

        if (targetsC && targetsC.length > 0) {
          summary.campaign_c.targeted = targetsC.length
          console.log(`Campaign C: ${targetsC.length} targets`)

          for (const target of targetsC) {
            try {
              if (!(await isUnderCap(target.user_id))) {
                summary.campaign_c.skipped++
                continue
              }

              const profile = await getUserProfile(target.user_id)
              if (!profile) {
                summary.campaign_c.skipped++
                continue
              }

              const sent = await sendBrevoEmail(
                brevoApiKey,
                smtpFrom,
                'Invoicemonk',
                profile.email,
                `You have ${target.overdue_count} overdue invoice${target.overdue_count > 1 ? 's' : ''}`,
                campaignCTemplate(profile.name, target.overdue_count)
              )

              if (sent) {
                await adminClient
                  .from('user_activity_state')
                  .update({ last_overdue_email_at: now.toISOString(), updated_at: now.toISOString() })
                  .eq('user_id', target.user_id)

                await recordEmailSent(target.user_id, 'campaign_c')
                summary.campaign_c.sent++
              } else {
                summary.campaign_c.errors++
              }
            } catch (userErr) {
              console.error(`Campaign C: Error for user ${target.user_id}:`, userErr)
              summary.campaign_c.errors++
            }
          }
        } else {
          console.log('Campaign C: No targets found')
        }
      } catch (campaignErr) {
        console.error('Campaign C failed:', campaignErr)
      }
    }

    // =============================================
    // Campaign D: 7-Day Inactivity Nudge
    // =============================================
    if (!checkTimeout('Campaign D')) {
      try {
        console.log('Campaign D: 7-day inactivity nudge...')
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const { data: targetsD } = await adminClient
          .from('user_activity_state')
          .select('user_id')
          .eq('email_verified', true)
          .gt('total_invoices', 0)
          .lt('last_login_at', sevenDaysAgo)
          .or(`last_inactivity_email_at.is.null,last_inactivity_email_at.lt.${sevenDaysAgo}`)
          .limit(50)

        if (targetsD && targetsD.length > 0) {
          summary.campaign_d.targeted = targetsD.length
          console.log(`Campaign D: ${targetsD.length} targets`)

          for (const target of targetsD) {
            try {
              if (!(await isUnderCap(target.user_id))) {
                summary.campaign_d.skipped++
                continue
              }

              const profile = await getUserProfile(target.user_id)
              if (!profile) {
                summary.campaign_d.skipped++
                continue
              }

              const sent = await sendBrevoEmail(
                brevoApiKey,
                smtpFrom,
                'Invoicemonk',
                profile.email,
                'We miss you — come back and send your next invoice',
                campaignDTemplate(profile.name)
              )

              if (sent) {
                await adminClient
                  .from('user_activity_state')
                  .update({ last_inactivity_email_at: now.toISOString(), updated_at: now.toISOString() })
                  .eq('user_id', target.user_id)

                await recordEmailSent(target.user_id, 'campaign_d')
                summary.campaign_d.sent++
              } else {
                summary.campaign_d.errors++
              }
            } catch (userErr) {
              console.error(`Campaign D: Error for user ${target.user_id}:`, userErr)
              summary.campaign_d.errors++
            }
          }
        } else {
          console.log('Campaign D: No targets found')
        }
      } catch (campaignErr) {
        console.error('Campaign D failed:', campaignErr)
      }
    }

    // =============================================
    // Campaign E: Abandoned Draft Invoice Nudge
    // =============================================
    if (!checkTimeout('Campaign E')) {
      try {
        console.log('Campaign E: Abandoned draft invoice nudge...')
        const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

        const { data: draftInvoices } = await adminClient
          .from('invoices')
          .select('id, user_id, invoice_number')
          .eq('status', 'draft')
          .lt('created_at', fortyEightHoursAgo)
          .not('user_id', 'is', null)
          .limit(50)

        if (draftInvoices && draftInvoices.length > 0) {
          summary.campaign_e.targeted = draftInvoices.length
          console.log(`Campaign E: ${draftInvoices.length} draft invoices found`)

          for (const draft of draftInvoices) {
            try {
              if (!draft.user_id) {
                summary.campaign_e.skipped++
                continue
              }

              if (!(await isUnderCap(draft.user_id))) {
                summary.campaign_e.skipped++
                continue
              }

              const { data: recentSends } = await adminClient
                .from('lifecycle_events')
                .select('metadata')
                .eq('user_id', draft.user_id)
                .eq('event_type', 'lifecycle_email_sent')
                .gte('created_at', threeDaysAgo)

              const alreadySentForDraft = recentSends?.some(
                (evt) => evt.metadata && (evt.metadata as Record<string, string>).campaign === 'campaign_e'
                  && (evt.metadata as Record<string, string>).invoice_id === draft.id
              )

              if (alreadySentForDraft) {
                summary.campaign_e.skipped++
                continue
              }

              const profile = await getUserProfile(draft.user_id)
              if (!profile) {
                summary.campaign_e.skipped++
                continue
              }

              const sent = await sendBrevoEmail(
                brevoApiKey,
                smtpFrom,
                'Invoicemonk',
                profile.email,
                'Your invoice draft is waiting — complete it now',
                campaignETemplate(profile.name, draft.invoice_number)
              )

              if (sent) {
                await adminClient
                  .from('user_activity_state')
                  .update({ last_abandoned_draft_email_at: now.toISOString(), updated_at: now.toISOString() })
                  .eq('user_id', draft.user_id)

                await recordEmailSent(draft.user_id, 'campaign_e', { invoice_id: draft.id })
                summary.campaign_e.sent++
              } else {
                summary.campaign_e.errors++
              }
            } catch (userErr) {
              console.error(`Campaign E: Error for draft ${draft.id}:`, userErr)
              summary.campaign_e.errors++
            }
          }
        } else {
          console.log('Campaign E: No abandoned drafts found')
        }
      } catch (campaignErr) {
        console.error('Campaign E failed:', campaignErr)
      }
    }

    // =============================================
    // Campaign F: Weekly Revenue Summary
    // =============================================
    if (!checkTimeout('Campaign F')) {
      try {
        console.log('Campaign F: Weekly revenue summary...')
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()

        const { data: recentInvoices } = await adminClient
          .from('invoices')
          .select('user_id, total_amount, currency')
          .in('status', ['issued', 'sent', 'viewed', 'paid', 'partially_paid'])
          .gte('issued_at', sevenDaysAgo)
          .not('user_id', 'is', null)

        if (recentInvoices && recentInvoices.length > 0) {
          const userSummaries: Record<string, { count: number; total: number; currency: string }> = {}
          for (const inv of recentInvoices) {
            if (!inv.user_id) continue
            if (!userSummaries[inv.user_id]) {
              userSummaries[inv.user_id] = { count: 0, total: 0, currency: inv.currency || 'NGN' }
            }
            userSummaries[inv.user_id].count++
            userSummaries[inv.user_id].total += Number(inv.total_amount) || 0
          }

          const userIds = Object.keys(userSummaries).slice(0, 50)
          summary.campaign_f.targeted = userIds.length
          console.log(`Campaign F: ${userIds.length} users with recent invoices`)

          for (const userId of userIds) {
            try {
              if (!(await isUnderCap(userId))) {
                summary.campaign_f.skipped++
                continue
              }

              const { data: activityState } = await adminClient
                .from('user_activity_state')
                .select('last_weekly_summary_email_at')
                .eq('user_id', userId)
                .single()

              if (activityState?.last_weekly_summary_email_at && activityState.last_weekly_summary_email_at > sixDaysAgo) {
                summary.campaign_f.skipped++
                continue
              }

              const profile = await getUserProfile(userId)
              if (!profile) {
                summary.campaign_f.skipped++
                continue
              }

              const { data: overdueInvoices } = await adminClient
                .from('invoices')
                .select('id')
                .eq('user_id', userId)
                .in('status', ['issued', 'sent', 'viewed'])
                .lt('due_date', now.toISOString().split('T')[0])

              const overdueCount = overdueInvoices?.length || 0
              const userSum = userSummaries[userId]
              const formattedAmount = userSum.total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

              const sent = await sendBrevoEmail(
                brevoApiKey,
                smtpFrom,
                'Invoicemonk',
                profile.email,
                'Your weekly revenue summary',
                campaignFTemplate(profile.name, userSum.count, formattedAmount, overdueCount, userSum.currency)
              )

              if (sent) {
                await adminClient
                  .from('user_activity_state')
                  .update({ last_weekly_summary_email_at: now.toISOString(), updated_at: now.toISOString() })
                  .eq('user_id', userId)

                await recordEmailSent(userId, 'campaign_f')
                summary.campaign_f.sent++
              } else {
                summary.campaign_f.errors++
              }
            } catch (userErr) {
              console.error(`Campaign F: Error for user ${userId}:`, userErr)
              summary.campaign_f.errors++
            }
          }
        } else {
          console.log('Campaign F: No users with recent invoices')
        }
      } catch (campaignErr) {
        console.error('Campaign F failed:', campaignErr)
      }
    }

    // =============================================
    // Campaign G: Verified but no business (72h)
    // =============================================
    if (!checkTimeout('Campaign G')) {
      try {
        console.log('Campaign G: Verified but no business...')
        const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const { data: targetsG } = await adminClient
          .from('user_activity_state')
          .select('user_id')
          .eq('email_verified', true)
          .eq('has_business', false)
          .lte('created_at', seventyTwoHoursAgo)
          .or(`last_no_business_email_at.is.null,last_no_business_email_at.lt.${sevenDaysAgo}`)
          .limit(100)

        if (targetsG && targetsG.length > 0) {
          summary.campaign_g.targeted = targetsG.length
          console.log(`Campaign G: ${targetsG.length} targets`)

          for (const target of targetsG) {
            try {
              if (!(await isUnderCap(target.user_id))) {
                summary.campaign_g.skipped++
                continue
              }

              const profile = await getUserProfile(target.user_id)
              if (!profile) {
                summary.campaign_g.skipped++
                continue
              }

              const sent = await sendBrevoEmail(
                brevoApiKey,
                smtpFrom,
                'Invoicemonk',
                profile.email,
                'Set up your business profile to start invoicing',
                campaignGTemplate(profile.name)
              )

              if (sent) {
                await adminClient
                  .from('user_activity_state')
                  .update({ last_no_business_email_at: now.toISOString(), updated_at: now.toISOString() })
                  .eq('user_id', target.user_id)

                await recordEmailSent(target.user_id, 'campaign_g')
                summary.campaign_g.sent++
              } else {
                summary.campaign_g.errors++
              }
            } catch (userErr) {
              console.error(`Campaign G: Error for user ${target.user_id}:`, userErr)
              summary.campaign_g.errors++
            }
          }
        } else {
          console.log('Campaign G: No targets found')
        }
      } catch (campaignErr) {
        console.error('Campaign G failed:', campaignErr)
      }
    }

    // =============================================
    // Campaign H: Business created but no invoice (3 days)
    // =============================================
    if (!checkTimeout('Campaign H')) {
      try {
        console.log('Campaign H: Business created but no invoice...')
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const { data: targetsH } = await adminClient
          .from('user_activity_state')
          .select('user_id')
          .eq('email_verified', true)
          .eq('has_business', true)
          .eq('total_invoices', 0)
          .lte('last_business_created_at', threeDaysAgo)
          .or(`last_no_invoice_email_at.is.null,last_no_invoice_email_at.lt.${sevenDaysAgo}`)
          .limit(100)

        if (targetsH && targetsH.length > 0) {
          summary.campaign_h.targeted = targetsH.length
          console.log(`Campaign H: ${targetsH.length} targets`)

          for (const target of targetsH) {
            try {
              if (!(await isUnderCap(target.user_id))) {
                summary.campaign_h.skipped++
                continue
              }

              const profile = await getUserProfile(target.user_id)
              if (!profile) {
                summary.campaign_h.skipped++
                continue
              }

              const sent = await sendBrevoEmail(
                brevoApiKey,
                smtpFrom,
                'Invoicemonk',
                profile.email,
                'Your business is ready — create your first invoice',
                campaignHTemplate(profile.name)
              )

              if (sent) {
                await adminClient
                  .from('user_activity_state')
                  .update({ last_no_invoice_email_at: now.toISOString(), updated_at: now.toISOString() })
                  .eq('user_id', target.user_id)

                await recordEmailSent(target.user_id, 'campaign_h')
                summary.campaign_h.sent++
              } else {
                summary.campaign_h.errors++
              }
            } catch (userErr) {
              console.error(`Campaign H: Error for user ${target.user_id}:`, userErr)
              summary.campaign_h.errors++
            }
          }
        } else {
          console.log('Campaign H: No targets found')
        }
      } catch (campaignErr) {
        console.error('Campaign H failed:', campaignErr)
      }
    }

    // =============================================
    // Campaign I: Second invoice upgrade CTA (one-shot)
    // =============================================
    if (!checkTimeout('Campaign I')) {
      try {
        console.log('Campaign I: Second invoice upgrade CTA...')

        // Query users with total_invoices >= 2 and no upgrade CTA email sent yet
        const { data: targetsI } = await adminClient
          .from('user_activity_state')
          .select('user_id, total_invoices')
          .gte('total_invoices', 2)
          .is('last_upgrade_cta_email_at', null)
          .limit(100)

        if (targetsI && targetsI.length > 0) {
          console.log(`Campaign I: ${targetsI.length} potential targets, checking tier...`)

          for (const target of targetsI) {
            try {
              // Tier check: only target starter tier users
              const { data: subscription } = await adminClient
                .from('subscriptions')
                .select('tier')
                .eq('user_id', target.user_id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

              const tier = subscription?.tier || 'starter'
              if (tier !== 'starter') {
                summary.campaign_i.skipped++
                continue
              }

              summary.campaign_i.targeted++

              if (!(await isUnderCap(target.user_id))) {
                summary.campaign_i.skipped++
                continue
              }

              const profile = await getUserProfile(target.user_id)
              if (!profile) {
                summary.campaign_i.skipped++
                continue
              }

              const sent = await sendBrevoEmail(
                brevoApiKey,
                smtpFrom,
                'Invoicemonk',
                profile.email,
                'Unlock compliance permanently — upgrade to Professional',
                campaignITemplate(profile.name, target.total_invoices)
              )

              if (sent) {
                await adminClient
                  .from('user_activity_state')
                  .update({ last_upgrade_cta_email_at: now.toISOString(), updated_at: now.toISOString() })
                  .eq('user_id', target.user_id)

                await recordEmailSent(target.user_id, 'campaign_i', {
                  trigger: 'second_invoice',
                  invoice_count: target.total_invoices,
                })
                summary.campaign_i.sent++
              } else {
                summary.campaign_i.errors++
              }
            } catch (userErr) {
              console.error(`Campaign I: Error for user ${target.user_id}:`, userErr)
              summary.campaign_i.errors++
            }
          }
        } else {
          console.log('Campaign I: No targets found')
        }
      } catch (campaignErr) {
        console.error('Campaign I failed:', campaignErr)
      }
    }

    console.log(`Lifecycle campaigns complete (${Date.now() - startTime}ms, timedOut=${timedOut}):`, JSON.stringify(summary))

    return new Response(
      JSON.stringify({ success: true, timedOut, executionMs: Date.now() - startTime, summary }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Lifecycle campaigns fatal error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
