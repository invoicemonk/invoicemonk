import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateUUIDStr as validateUUID, validateEmailStr as validateEmail, validateStringStr as validateString, sanitizeString, escapeHtml, sanitizeHeaderValue, getCorsHeaders, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'

interface SendReceiptRequest {
  receipt_id: string;
  recipient_email: string;
  custom_message?: string;
  app_url?: string;
}

const formatCurrencyHtml = (amount: number, currency: string): string => {
  const localeMap: Record<string, string> = {
    'NGN': 'en-NG', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB',
    'INR': 'en-IN', 'CAD': 'en-CA', 'AUD': 'en-AU', 'ZAR': 'en-ZA',
    'KES': 'en-KE', 'GHS': 'en-GH', 'EGP': 'en-EG', 'AED': 'ar-AE'
  };
  const locale = localeMap[currency] || 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
};

const formatDate = (date: string | null): string => {
  if (!date) return 'Not specified';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatLabel = (key: string): string => {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = userData.user.id;

    // Rate limit: max 10 receipts/hour, 50 emails/day per user
    const hourlyAllowed = await checkRateLimit(serviceRoleKey, userId, 'send-receipt-email', 3600, 10);
    if (!hourlyAllowed) return rateLimitResponse(corsHeaders);
    const dailyAllowed = await checkRateLimit(serviceRoleKey, userId, 'email-daily', 86400, 50);
    if (!dailyAllowed) return rateLimitResponse(corsHeaders);

    // Validate body
    const body: SendReceiptRequest = await req.json();

    const receiptIdError = validateUUID(body.receipt_id, 'receipt_id');
    if (receiptIdError) {
      return new Response(
        JSON.stringify({ success: false, error: receiptIdError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailError = validateEmail(body.recipient_email, 'recipient_email');
    if (emailError) {
      return new Response(
        JSON.stringify({ success: false, error: emailError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customMessageError = validateString(body.custom_message, 'custom_message', 2000);
    if (customMessageError) {
      return new Response(
        JSON.stringify({ success: false, error: customMessageError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const sanitizedCustomMessage = body.custom_message ? sanitizeString(body.custom_message) : null;

    // Check Brevo config
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com';

    if (!brevoApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email sending is not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch receipt (RLS enforces access)
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', body.receipt_id)
      .maybeSingle();

    if (receiptError || !receipt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Receipt not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const issuer = (receipt.issuer_snapshot || {}) as Record<string, unknown>;
    const payer = (receipt.payer_snapshot || {}) as Record<string, unknown>;
    const invoice = (receipt.invoice_snapshot || {}) as Record<string, unknown>;
    const payment = (receipt.payment_snapshot || {}) as Record<string, unknown>;
    const issuerAddress = (issuer.address || {}) as Record<string, string>;

    const businessName = escapeHtml((issuer.legal_name || issuer.name || 'Invoicemonk') as string);
    const payerName = escapeHtml((payer.name || 'Valued Customer') as string);
    const issuerEmail = escapeHtml((issuer.contact_email || '') as string);
    const issuerPhone = escapeHtml((issuer.contact_phone || '') as string);
    const issuerAddressStr = escapeHtml([issuerAddress.street, issuerAddress.city, issuerAddress.country].filter(Boolean).join(', '));

    // Get logo URL from business table
    let issuerLogoUrl = (issuer.logo_url || null) as string | null;
    if (!issuerLogoUrl && receipt.business_id) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: business } = await adminClient
        .from('businesses')
        .select('logo_url')
        .eq('id', receipt.business_id)
        .single();
      issuerLogoUrl = business?.logo_url || null;
    }

    // Generate PDF via the existing generate-receipt-pdf function
    console.log('Generating receipt PDF for email attachment...');
    const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-receipt-pdf`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ receipt_id: body.receipt_id }),
    });

    if (!pdfResponse.ok) {
      const pdfError = await pdfResponse.json();
      console.error('PDF generation failed:', pdfError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate receipt PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pdfResult = await pdfResponse.json();
    const attachmentContent = pdfResult.pdf;
    const attachmentName = pdfResult.filename || `${receipt.receipt_number}.pdf`;

    // Build verification URL
    let appUrl = body.app_url || Deno.env.get('APP_URL') || 'https://app.invoicemonk.com';
    if (appUrl.includes('lovableproject.com') || appUrl.includes('lovable.app')) {
      appUrl = Deno.env.get('APP_URL') || 'https://app.invoicemonk.com';
    }

    const verificationUrl = receipt.verification_id
      ? `${appUrl}/verify/receipt/${receipt.verification_id}`
      : null;

    const qrCodeUrl = verificationUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verificationUrl)}&format=png`
      : null;

    const paymentMethod = payment.payment_method
      ? formatLabel(String(payment.payment_method))
      : 'Not specified';

    const formattedAmount = formatCurrencyHtml(Number(receipt.amount), receipt.currency as string);
    const paymentDate = formatDate((payment.payment_date as string) || receipt.issued_at);

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
      <td style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Branded Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 24px 32px;">
          <tr>
            <td style="text-align: center;">
              ${issuerLogoUrl ? `<img src="${issuerLogoUrl}" alt="${businessName}" style="height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 12px;" /><br>` : ''}
              <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${businessName}</span>
            </td>
          </tr>
        </table>

        <!-- Main Content -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px;">
          <tr>
            <td>
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">Dear ${payerName},</p>
              
              ${sanitizedCustomMessage ? `<p style="margin: 0 0 16px; color: #374151; font-size: 16px;">${sanitizedCustomMessage}</p>` : ''}
              
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
                Please find attached your payment receipt <strong>${receipt.receipt_number}</strong>. Thank you for your payment.
              </p>

              <!-- Receipt Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #a7f3d0;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Receipt Number:</span></td>
                        <td style="text-align: right; padding: 8px 0;"><strong style="color: #1f2937; font-size: 14px;">${receipt.receipt_number}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Payment Date:</span></td>
                        <td style="text-align: right; padding: 8px 0;"><span style="color: #1f2937; font-size: 14px;">${paymentDate}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Payment Method:</span></td>
                        <td style="text-align: right; padding: 8px 0;"><span style="color: #1f2937; font-size: 14px;">${paymentMethod}</span></td>
                      </tr>
                      ${invoice.invoice_number ? `
                      <tr>
                        <td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Invoice:</span></td>
                        <td style="text-align: right; padding: 8px 0;"><span style="color: #1f2937; font-size: 14px;">${invoice.invoice_number}</span></td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 12px 0 0; border-top: 1px solid #a7f3d0;"><strong style="color: #065f46; font-size: 16px;">Amount Received:</strong></td>
                        <td style="text-align: right; padding: 12px 0 0; border-top: 1px solid #a7f3d0;"><strong style="color: #065f46; font-size: 18px;">${formattedAmount}</strong></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${verificationUrl ? `
              <!-- Verification Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top;">
                          <p style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 600;">Verify Receipt Authenticity</p>
                          <p style="margin: 0 0 12px; color: #374151; font-size: 14px;">Scan the QR code or click the button to verify this receipt is genuine.</p>
                          <a href="${verificationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Verify Receipt</a>
                          <p style="margin: 12px 0 0; color: #6b7280; font-size: 12px;">Verification ID: ${receipt.verification_id}</p>
                        </td>
                        ${qrCodeUrl ? `
                        <td style="width: 120px; text-align: right; vertical-align: top;">
                          <img src="${qrCodeUrl}" alt="QR Code" style="width: 100px; height: 100px; border-radius: 4px;" />
                          <p style="margin: 4px 0 0; color: #6b7280; font-size: 10px; text-align: center;">Scan to verify</p>
                        </td>
                        ` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Attachment Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #166534; font-size: 14px;">
                      <strong>Receipt Attached:</strong> Please find your payment receipt PDF attached to this email.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #374151; font-size: 16px;">If you have any questions, please don't hesitate to contact us.</p>
              <p style="margin: 16px 0 0; color: #374151; font-size: 16px;">Best regards,<br><strong>${businessName}</strong></p>
            </td>
          </tr>
        </table>

        <!-- Business Contact Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1f2937;">${businessName}</p>
              ${issuerPhone ? `<p style="margin: 8px 0 0; font-size: 14px; color: #374151;">${issuerPhone}</p>` : ''}
              ${issuerEmail ? `<p style="margin: 4px 0 0; font-size: 14px; color: #374151;">${issuerEmail}</p>` : ''}
              ${issuerAddressStr ? `<p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">${issuerAddressStr}</p>` : ''}
            </td>
          </tr>
        </table>

        <!-- Platform Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 16px 32px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.7);">
                Powered by Invoicemonk | &copy; ${new Date().getFullYear()} Invoicemonk LTD
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;

    // Send email via Brevo
    console.log('Sending receipt email via Brevo to:', body.recipient_email);

    const brevoPayload: Record<string, unknown> = {
      sender: { name: sanitizeHeaderValue((issuer.legal_name || issuer.name || 'Invoicemonk') as string), email: smtpFrom },
      to: [{ email: body.recipient_email, name: sanitizeHeaderValue((payer.name || 'Valued Customer') as string) }],
      subject: `Payment Receipt ${receipt.receipt_number} from ${sanitizeHeaderValue((issuer.legal_name || issuer.name || 'Invoicemonk') as string)}`,
      htmlContent: emailHtml,
      attachment: [{ content: attachmentContent, name: attachmentName }],
    };

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!brevoResponse.ok) {
      const errorData = await brevoResponse.json();
      console.error('Brevo API error:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to send email: ${errorData.message || 'Brevo API error'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const brevoResult = await brevoResponse.json();
    console.log('Receipt email sent successfully:', brevoResult);

    // Audit log + notification
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    try {
      await adminClient.rpc('log_audit_event', {
        _event_type: 'RECEIPT_SENT',
        _entity_type: 'receipt',
        _entity_id: receipt.id,
        _user_id: userId,
        _business_id: receipt.business_id,
        _metadata: {
          recipient_email: body.recipient_email,
          sent_at: new Date().toISOString(),
          verification_url: verificationUrl,
          attachment_type: 'pdf',
        }
      });
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    try {
      await adminClient.from('notifications').insert({
        user_id: userId,
        business_id: receipt.business_id,
        type: 'RECEIPT_SENT',
        title: 'Receipt Sent',
        message: `Receipt ${receipt.receipt_number} was sent to ${body.recipient_email}`,
        entity_type: 'receipt',
        entity_id: receipt.id,
        is_read: false,
      });
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Receipt sent successfully with PDF attachment',
        recipient: body.recipient_email,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send receipt email error:', error);
    const corsHeaders2 = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders2, 'Content-Type': 'application/json' } }
    );
  }
});
