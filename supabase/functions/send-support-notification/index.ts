import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Dynamic CORS configuration
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface SendSupportNotificationRequest {
  type: 'ticket_created' | 'admin_reply' | 'user_reply';
  ticket_id: string;
  message_id?: string;
}

const APP_URL = 'https://app.invoicemonk.com';

// Format date for display
const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

// Category and priority labels
const CATEGORY_LABELS: Record<string, string> = {
  general: 'General Question',
  billing: 'Billing & Payments',
  technical: 'Technical Issue',
  feature: 'Feature Request',
  bug: 'Bug Report',
  account: 'Account Help',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  normal: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

// Generate email for admins when new ticket is created
function generateNewTicketEmail(ticket: Record<string, unknown>, userEmail: string): string {
  const priority = ticket.priority as string;
  const priorityColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.normal;
  const category = CATEGORY_LABELS[ticket.category as string] || ticket.category;
  
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
          <!-- Header -->
          <tr>
            <td style="background: #18181b; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">🎫 New Support Ticket</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px;">
                A new support ticket has been submitted and requires your attention.
              </p>
              
              <!-- Ticket Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">From:</td>
                        <td style="padding: 4px 0; color: #18181b; font-size: 14px; font-weight: 600;">${userEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Category:</td>
                        <td style="padding: 4px 0; color: #18181b; font-size: 14px;">${category}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Priority:</td>
                        <td style="padding: 4px 0;">
                          <span style="display: inline-block; background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${priority}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Submitted:</td>
                        <td style="padding: 4px 0; color: #18181b; font-size: 14px;">${formatDate(ticket.created_at as string)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Subject -->
              <h2 style="margin: 0 0 12px; color: #18181b; font-size: 18px; font-weight: 600;">
                ${ticket.subject}
              </h2>
              
              <!-- Description -->
              <div style="background: #fafafa; border-left: 4px solid #18181b; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${(ticket.description as string).slice(0, 500)}${(ticket.description as string).length > 500 ? '...' : ''}</p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/admin/support" style="display: inline-block; background: #18181b; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      View in Admin Dashboard →
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
                This is an automated notification from Invoicemonk Support System.
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

// Generate email for user when admin replies
function generateAdminReplyEmail(ticket: Record<string, unknown>, message: Record<string, unknown>): string {
  const STATUS_LABELS: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    waiting: 'Waiting on You',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  const statusLabel = STATUS_LABELS[ticket.status as string] || ticket.status;
  
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
          <!-- Header -->
          <tr>
            <td style="background: #059669; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Support Update</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px;">
                Our support team has responded to your ticket.
              </p>
              
              <!-- Ticket Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Ticket:</td>
                        <td style="padding: 4px 0; color: #18181b; font-size: 14px; font-weight: 600;">${ticket.subject}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Status:</td>
                        <td style="padding: 4px 0;">
                          <span style="display: inline-block; background: #059669; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${statusLabel}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Reply Content -->
              <h3 style="margin: 0 0 12px; color: #18181b; font-size: 16px; font-weight: 600;">
                Latest Response
              </h3>
              <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message.message as string}</p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/app/support/${ticket.id}" style="display: inline-block; background: #059669; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      View Full Conversation →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-align: center;">
                If you have additional questions, simply reply to your ticket.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Best regards,<br/>The Invoicemonk Support Team
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
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com';

    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: SendSupportNotificationRequest = await req.json();
    const { type, ticket_id, message_id } = body;

    console.log(`Processing support notification: type=${type}, ticket_id=${ticket_id}`);

    // Validate input
    if (!type || !ticket_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: type and ticket_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ success: false, error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let emailsToSend: Array<{ to: string; subject: string; htmlContent: string }> = [];

    if (type === 'ticket_created') {
      // Fetch user email
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', ticket.user_id)
        .single();

      const userEmail = userProfile?.email || 'Unknown';

      // Fetch all platform admin emails
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

      // Create email for each admin
      const htmlContent = generateNewTicketEmail(ticket, userEmail);
      emailsToSend = adminEmails.map((email: string) => ({
        to: email,
        subject: `🎫 New Support Ticket: ${ticket.subject}`,
        htmlContent,
      }));

      console.log(`Sending new ticket notification to ${adminEmails.length} admin(s)`);

    } else if (type === 'admin_reply') {
      // Fetch the message
      const { data: message, error: messageError } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticket_id)
        .eq('is_admin', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (messageError || !message) {
        console.error('Message not found:', messageError);
        // Still return success - in-app notification was already created by trigger
        return new Response(
          JSON.stringify({ success: true, warning: 'Message not found for email' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch user email
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', ticket.user_id)
        .single();

      if (!userProfile?.email) {
        console.warn('User email not found');
        return new Response(
          JSON.stringify({ success: true, warning: 'User email not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const htmlContent = generateAdminReplyEmail(ticket, message);
      emailsToSend = [{
        to: userProfile.email,
        subject: `Support Update: ${ticket.subject}`,
        htmlContent,
      }];


    } else if (type === 'user_reply') {
      // Fetch the message
      const { data: message, error: messageError } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('id', message_id)
        .single();

      if (messageError || !message) {
        console.error('Message not found:', messageError);
        return new Response(
          JSON.stringify({ success: true, warning: 'Message not found for email' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch user email for message context
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', message.sender_id)
        .single();

      // Fetch all platform admin emails
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

      const senderEmail = userProfile?.email || 'Unknown';
      
      // Generate HTML for user reply
      const htmlContent = `<!DOCTYPE html>
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
          <!-- Header -->
          <tr>
            <td style="background: #2563eb; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">📬 User Reply Received</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px;">
                A user has replied to a support ticket requiring your attention.
              </p>
              
              <!-- Ticket Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Ticket:</td>
                        <td style="padding: 4px 0; color: #18181b; font-size: 14px; font-weight: 600;">${ticket.subject}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">From:</td>
                        <td style="padding: 4px 0; color: #18181b; font-size: 14px;">${senderEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Replied:</td>
                        <td style="padding: 4px 0; color: #18181b; font-size: 14px;">${formatDate(message.created_at)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Reply Content -->
              <h3 style="margin: 0 0 12px; color: #18181b; font-size: 16px; font-weight: 600;">
                User's Reply
              </h3>
              <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${(message.message as string).slice(0, 500)}${(message.message as string).length > 500 ? '...' : ''}</p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/admin/support" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      View in Admin Dashboard →
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
                This is an automated notification from Invoicemonk Support System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      emailsToSend = adminEmails.map((email: string) => ({
        to: email,
        subject: `📬 User Reply: ${ticket.subject}`,
        htmlContent,
      }));

      console.log(`Sending user reply notification to ${adminEmails.length} admin(s)`);
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
            sender: { email: smtpFrom, name: 'Invoicemonk Support' },
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
      }
    }

    // Log audit event
    try {
      await supabase.rpc('log_audit_event', {
        _entity_type: 'support_ticket',
        _entity_id: ticket_id,
        _event_type: type === 'ticket_created' ? 'SUPPORT_TICKET_CREATED' : 'SUPPORT_TICKET_REPLY',
        _metadata: { emails_sent: sentCount, notification_type: type },
      });
    } catch (auditError) {
      console.error('Failed to log audit event:', auditError);
    }

    return new Response(
      JSON.stringify({ success: true, emails_sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-support-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
