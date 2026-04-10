import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()

interface VerificationNotificationRequest {
  type: 'submission' | 'approved' | 'rejected' | 'requires_action';
  business_id: string;
  reason?: string;
}

const APP_URL = 'https://app.invoicemonk.com';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateSubmissionEmail(businessName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Logo Bar -->
          <tr>
            <td style="background: #ffffff; padding: 20px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="https://app.invoicemonk.com/invoicemonk-logo.png" alt="InvoiceMonk" style="height: 36px;" />
            </td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">📋 New Verification Submission</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px;">
                A business has submitted documents for verification and is awaiting your review.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Business:</td>
                        <td style="padding: 4px 0; color: #18181b; font-size: 14px; font-weight: 600;">${escapeHtml(businessName)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Status:</td>
                        <td style="padding: 4px 0;">
                          <span style="display: inline-block; background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">PENDING REVIEW</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/admin/verifications" style="display: inline-block; background: #1d6b5a; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      Review in Admin Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                This is an automated notification from Invoicemonk Verification System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateApprovedEmail(businessName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: #ffffff; padding: 20px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="https://app.invoicemonk.com/invoicemonk-logo.png" alt="InvoiceMonk" style="height: 36px;" />
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">✅ Verification Approved</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px;">
                Great news! Your business <strong>${escapeHtml(businessName)}</strong> has been successfully verified.
              </p>
              <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
                  Your business identity has been confirmed. You now have full access to all verified business features, including online payments.
                </p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}" style="display: inline-block; background: #1d6b5a; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      Go to Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Best regards,<br/>The Invoicemonk Team
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateRejectedEmail(businessName: string, reason: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: #ffffff; padding: 20px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="https://app.invoicemonk.com/invoicemonk-logo.png" alt="InvoiceMonk" style="height: 36px;" />
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">❌ Verification Not Approved</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px;">
                Unfortunately, the verification for <strong>${escapeHtml(businessName)}</strong> was not approved.
              </p>
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 4px; color: #991b1b; font-size: 13px; font-weight: 600;">Reason:</p>
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">${escapeHtml(reason)}</p>
              </div>
              <p style="margin: 0 0 24px; color: #52525b; font-size: 14px;">
                You can update your documents and resubmit for review at any time.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}" style="display: inline-block; background: #1d6b5a; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      Update Documents →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Best regards,<br/>The Invoicemonk Team
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateRequiresActionEmail(businessName: string, reason: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: #ffffff; padding: 20px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="https://app.invoicemonk.com/invoicemonk-logo.png" alt="InvoiceMonk" style="height: 36px;" />
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">⚠️ Additional Documents Required</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px;">
                We need additional information to complete the verification for <strong>${escapeHtml(businessName)}</strong>.
              </p>
              <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 4px; color: #92400e; font-size: 13px; font-weight: 600;">What's needed:</p>
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">${escapeHtml(reason)}</p>
              </div>
              <p style="margin: 0 0 24px; color: #52525b; font-size: 14px;">
                Please upload the requested documents and resubmit for review.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}" style="display: inline-block; background: #1d6b5a; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      Upload Documents →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Best regards,<br/>The Invoicemonk Team
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com';

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: VerificationNotificationRequest = await req.json();
    const { type, business_id, reason } = body;

    console.log(`Processing verification notification: type=${type}, business_id=${business_id}`);

    if (!type || !business_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: type and business_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validTypes = ['submission', 'approved', 'rejected', 'requires_action'];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch business info
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, created_by')
      .eq('id', business_id)
      .single();

    if (businessError || !business) {
      console.error('Business not found:', businessError);
      return new Response(
        JSON.stringify({ success: false, error: 'Business not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const businessName = business.name || 'Unnamed Business';

    let emailsToSend: Array<{ to: string; subject: string; htmlContent: string }> = [];

    if (type === 'submission') {
      // Notify all platform admins
      const { data: admins, error: adminsError } = await supabase
        .rpc('get_platform_admin_emails');

      if (adminsError) {
        console.error('Error fetching admin emails:', adminsError);
      }

      const adminEmails = (admins || []).map((a: { email: string }) => a.email).filter(Boolean);

      if (adminEmails.length === 0) {
        console.warn('No platform admins found to notify');
        return new Response(
          JSON.stringify({ success: true, warning: 'No platform admins to notify' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const htmlContent = generateSubmissionEmail(businessName);
      emailsToSend = adminEmails.map((email: string) => ({
        to: email,
        subject: `📋 New Verification Submission: ${businessName}`,
        htmlContent,
      }));

      console.log(`Sending submission notification to ${adminEmails.length} admin(s)`);

      // Insert in-app notifications for all platform admins
      const { data: adminUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'platform_admin');

      if (adminUsers && adminUsers.length > 0) {
        const adminNotifications = adminUsers.map((admin: { user_id: string }) => ({
          user_id: admin.user_id,
          business_id: null,
          type: 'ADMIN_VERIFICATION_SUBMITTED',
          title: 'New Verification Submission',
          message: `${businessName} has submitted documents for review`,
          entity_type: 'business',
          entity_id: business_id,
          is_read: false,
        }));

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(adminNotifications);

        if (notifError) {
          console.error('Error inserting admin notifications:', notifError);
        } else {
          console.log(`Inserted ${adminNotifications.length} admin in-app notification(s)`);
        }
      }

    } else {
      // approved, rejected, requires_action → notify business owner
      if (!business.created_by) {
        console.warn('Business has no owner (created_by is null)');
        return new Response(
          JSON.stringify({ success: true, warning: 'Business has no owner' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', business.created_by)
        .single();

      if (!ownerProfile?.email) {
        console.warn('Owner email not found');
        return new Response(
          JSON.stringify({ success: true, warning: 'Owner email not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let subject: string;
      let htmlContent: string;
      let notificationType: string;
      let notificationTitle: string;
      let notificationMessage: string;

      if (type === 'approved') {
        subject = `✅ Verification Approved: ${businessName}`;
        htmlContent = generateApprovedEmail(businessName);
        notificationType = 'VERIFICATION_APPROVED';
        notificationTitle = 'Verification Approved';
        notificationMessage = `Your business "${businessName}" has been successfully verified.`;
      } else if (type === 'rejected') {
        subject = `❌ Verification Not Approved: ${businessName}`;
        htmlContent = generateRejectedEmail(businessName, reason || 'No reason provided.');
        notificationType = 'VERIFICATION_REJECTED';
        notificationTitle = 'Verification Not Approved';
        notificationMessage = `Your verification for "${businessName}" was not approved. Reason: ${reason || 'No reason provided.'}`;
      } else {
        // requires_action
        subject = `⚠️ Additional Documents Required: ${businessName}`;
        htmlContent = generateRequiresActionEmail(businessName, reason || 'Please provide additional documentation.');
        notificationType = 'VERIFICATION_REQUIRES_ACTION';
        notificationTitle = 'Additional Documents Required';
        notificationMessage = `Additional documents are needed for "${businessName}". ${reason || 'Please provide additional documentation.'}`;
      }

      emailsToSend = [{ to: ownerProfile.email, subject, htmlContent }];

      // Insert in-app notification for the business owner
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: business.created_by,
          business_id: business_id,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          entity_type: 'business',
          entity_id: business_id,
          is_read: false,
        });

      if (notifError) {
        console.error('Error inserting owner notification:', notifError);
      } else {
        console.log(`Inserted in-app notification for owner: ${notificationType}`);
      }
    }

    // Send emails via Brevo
    let sentCount = 0;
    for (const emailData of emailsToSend) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { email: smtpFrom, name: 'Invoicemonk' },
            to: [{ email: emailData.to }],
            subject: emailData.subject,
            htmlContent: emailData.htmlContent,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to send email to ${emailData.to}:`, errorText);
        } else {
          sentCount++;
          console.log(`Email sent successfully to ${emailData.to}`);
        }
      } catch (emailError) {
        console.error(`Error sending email to ${emailData.to}:`, emailError);
        captureException(emailError, { function_name: 'send-verification-notification' });
      }
    }

    return new Response(
      JSON.stringify({ success: true, emails_sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-verification-notification:', error);
    captureException(error, { function_name: 'send-verification-notification' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
