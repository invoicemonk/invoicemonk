import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()

function safeISODate(epochSeconds: number | undefined | null): string | undefined {
  if (!epochSeconds) return undefined;
  const d = new Date(epochSeconds * 1000);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Send email via Brevo
async function sendBrevoEmail(
  brevoApiKey: string,
  toEmail: string,
  toName: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    const smtpFrom = Deno.env.get("SMTP_FROM") || "noreply@invoicemonk.com";
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "InvoiceMonk", email: smtpFrom },
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Brevo API error (${response.status}):`, errorText);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Brevo email send error:", err);
    captureException(err, { function_name: 'stripe-webhook' })
    return false;
  }
}

function professionalUpgradeEmailTemplate(userName: string, nextBillingDate: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: #ffffff; padding: 20px 30px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 1px solid #e5e7eb;">
    <img src="https://app.invoicemonk.com/invoicemonk-logo.png" alt="InvoiceMonk" style="height: 36px;" />
  </div>
  <div style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); color: white; padding: 24px 30px; text-align: center;">
    <h1 style="margin: 0; font-size: 22px;">🎉 Welcome to Professional!</h1>
    <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Your upgrade is confirmed and active</p>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>Hi ${userName},</p>
    <p>I'm Ayo, the founder of InvoiceMonk. Thank you for upgrading to Professional — you've just unlocked the full power of the platform. Here's everything you can now do:</p>

    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1d6b5a;">
      <p style="margin: 0; color: #155a4a; font-size: 14px;">
        <strong>Plan:</strong> Professional<br>
        <strong>Next billing date:</strong> ${nextBillingDate}
      </p>
    </div>

    <h2 style="font-size: 16px; color: #1d6b5a; margin: 25px 0 10px;">✨ What's Now Unlocked</h2>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; width: 28px;">👥</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <strong>Team Collaboration</strong> — Invite up to 5 team members<br>
          <a href="https://app.invoicemonk.com/team" style="color: #1d6b5a; font-size: 13px;">Invite your team →</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">🎨</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <strong>Custom Branding</strong> — Remove the watermark, add your logo & brand color<br>
          <a href="https://app.invoicemonk.com/settings" style="color: #1d6b5a; font-size: 13px;">Set up branding →</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">📄</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <strong>Unlimited Invoices & Receipts</strong> — No more monthly limits<br>
          <a href="https://app.invoicemonk.com/invoices/new" style="color: #1d6b5a; font-size: 13px;">Create an invoice →</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">💱</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <strong>Unlimited Currency Accounts</strong> — Invoice in any currency<br>
          <a href="https://app.invoicemonk.com/settings" style="color: #1d6b5a; font-size: 13px;">Add currencies →</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">📸</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <strong>AI Receipt Scanning</strong> — Snap a receipt, auto-extract data<br>
          <a href="https://app.invoicemonk.com/expenses" style="color: #1d6b5a; font-size: 13px;">Scan a receipt →</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">📊</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <strong>Advanced Accounting</strong> — Profitability, income & expense analysis<br>
          <a href="https://app.invoicemonk.com/accounting" style="color: #1d6b5a; font-size: 13px;">View accounting →</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">🔒</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <strong>Audit Logs & Compliance</strong> — Full activity trail for regulatory compliance<br>
          <a href="https://app.invoicemonk.com/audit-logs" style="color: #1d6b5a; font-size: 13px;">View audit logs →</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; vertical-align: top;">📥</td>
        <td style="padding: 10px 0;">
          <strong>Data Exports</strong> — Export invoices, expenses, and reports<br>
          <a href="https://app.invoicemonk.com/reports" style="color: #1d6b5a; font-size: 13px;">Generate reports →</a>
        </td>
      </tr>
    </table>

    <h2 style="font-size: 16px; color: #1d6b5a; margin: 25px 0 10px;">🏁 Recommended First Steps</h2>

    <div style="background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0 0 8px;"><strong>1.</strong> <a href="https://app.invoicemonk.com/settings" style="color: #1d6b5a;">Upload your logo</a> to remove the InvoiceMonk watermark</p>
      <p style="margin: 0 0 8px;"><strong>2.</strong> <a href="https://app.invoicemonk.com/team" style="color: #1d6b5a;">Invite a team member</a> to help with invoicing</p>
      <p style="margin: 0;"><strong>3.</strong> <a href="https://app.invoicemonk.com/expenses" style="color: #1d6b5a;">Try AI Receipt Scanning</a> — snap a physical receipt and watch it auto-fill</p>
    </div>

    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/dashboard" style="display: inline-block; background: #1d6b5a; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Dashboard →</a>
    </div>

    <p>If you ever need help, just reply to this email or use the chat widget on the platform.</p>

    <p style="margin-top: 25px;">
      Cheers,<br>
      <strong>Ayo</strong><br>
      <span style="color: #666; font-size: 13px;">Founder, InvoiceMonk</span>
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 11px; text-align: center;">
      Sent by InvoiceMonk · <a href="https://invoicemonk.com" style="color: #999;">invoicemonk.com</a>
    </p>
  </div>
</body>
</html>`;
}

function businessUpgradeEmailTemplate(userName: string, nextBillingDate: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: #ffffff; padding: 20px 30px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 1px solid #e5e7eb;">
    <img src="https://app.invoicemonk.com/invoicemonk-logo.png" alt="InvoiceMonk" style="height: 36px;" />
  </div>
  <div style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); color: white; padding: 24px 30px; text-align: center;">
    <h1 style="margin: 0; font-size: 22px;">🎉 Welcome to Business!</h1>
    <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">You've unlocked the most powerful InvoiceMonk plan</p>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>Hi ${userName},</p>
    <p>I'm Ayo, the founder of InvoiceMonk. Thank you for upgrading to the Business plan — you now have access to absolutely everything on the platform. Here's what's included:</p>

    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1d6b5a;">
      <p style="margin: 0; color: #155a4a; font-size: 14px;">
        <strong>Plan:</strong> Business<br>
        <strong>Next billing date:</strong> ${nextBillingDate}
      </p>
    </div>

    <h2 style="font-size: 16px; color: #1d6b5a; margin: 25px 0 10px;">✨ Business-Exclusive Features</h2>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; width: 28px;">👥</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <strong>Unlimited Team Members</strong> — Invite your entire team<br>
          <a href="https://app.invoicemonk.com/team" style="color: #1d6b5a; font-size: 13px;">Manage your team →</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">🔌</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <strong>API Access</strong> — Integrate InvoiceMonk into your workflows<br>
          <a href="https://app.invoicemonk.com/docs/api" style="color: #1d6b5a; font-size: 13px;">View API docs →</a>
        </td>
      </tr>
    </table>

    <h2 style="font-size: 16px; color: #1d6b5a; margin: 25px 0 10px;">Plus Everything in Professional</h2>

    <table style="width: 100%; border-collapse: collapse; color: #555;">
      <tr><td style="padding: 6px 0;">🎨 Custom Branding — <a href="https://app.invoicemonk.com/settings" style="color: #1d6b5a;">Set up →</a></td></tr>
      <tr><td style="padding: 6px 0;">📄 Unlimited Invoices & Receipts — <a href="https://app.invoicemonk.com/invoices/new" style="color: #1d6b5a;">Create →</a></td></tr>
      <tr><td style="padding: 6px 0;">💱 Unlimited Currency Accounts — <a href="https://app.invoicemonk.com/settings" style="color: #1d6b5a;">Add currencies →</a></td></tr>
      <tr><td style="padding: 6px 0;">📸 AI Receipt Scanning — <a href="https://app.invoicemonk.com/expenses" style="color: #1d6b5a;">Scan a receipt →</a></td></tr>
      <tr><td style="padding: 6px 0;">📊 Advanced Accounting — <a href="https://app.invoicemonk.com/accounting" style="color: #1d6b5a;">View →</a></td></tr>
      <tr><td style="padding: 6px 0;">🔒 Audit Logs & Compliance — <a href="https://app.invoicemonk.com/audit-logs" style="color: #1d6b5a;">View →</a></td></tr>
      <tr><td style="padding: 6px 0;">📥 Data Exports — <a href="https://app.invoicemonk.com/reports" style="color: #1d6b5a;">Reports →</a></td></tr>
    </table>

    <h2 style="font-size: 16px; color: #1d6b5a; margin: 25px 0 10px;">🏁 Recommended First Steps</h2>

    <div style="background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0 0 8px;"><strong>1.</strong> <a href="https://app.invoicemonk.com/team" style="color: #1d6b5a;">Invite your team</a> — unlimited seats on Business</p>
      <p style="margin: 0 0 8px;"><strong>2.</strong> <a href="https://app.invoicemonk.com/settings" style="color: #1d6b5a;">Upload your logo</a> to remove the watermark</p>
      <p style="margin: 0;"><strong>3.</strong> <a href="https://app.invoicemonk.com/docs/api" style="color: #1d6b5a;">Explore the API</a> for custom integrations</p>
    </div>

    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/dashboard" style="display: inline-block; background: #1d6b5a; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Dashboard →</a>
    </div>

    <p>If you ever need help, just reply to this email or use the chat widget on the platform.</p>

    <p style="margin-top: 25px;">
      Cheers,<br>
      <strong>Ayo</strong><br>
      <span style="color: #666; font-size: 13px;">Founder, InvoiceMonk</span>
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 11px; text-align: center;">
      Sent by InvoiceMonk · <a href="https://invoicemonk.com" style="color: #999;">invoicemonk.com</a>
    </p>
  </div>
</body>
</html>`;
}

function starterUpgradeEmailTemplate(userName: string, nextBillingDate: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: #ffffff; padding: 20px 30px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 1px solid #e5e7eb;">
    <img src="https://app.invoicemonk.com/invoicemonk-logo.png" alt="InvoiceMonk" style="height: 36px;" />
  </div>
  <div style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); color: white; padding: 24px 30px; text-align: center;">
    <h1 style="margin: 0; font-size: 22px;">🎉 Upgrade Confirmed!</h1>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>Hi ${userName},</p>
    <p>Thank you for upgrading to the <strong>Starter</strong> plan! Your subscription is now active.</p>
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1d6b5a;">
      <p style="margin: 0; color: #155a4a; font-size: 14px;">
        <strong>Plan:</strong> Starter<br>
        <strong>Next billing date:</strong> ${nextBillingDate}
      </p>
    </div>
    <p>You now have access to unlimited invoices and receipts, plus up to 3 currency accounts and 2 payment methods.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/dashboard" style="display: inline-block; background: #1d6b5a; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Dashboard →</a>
    </div>
    <p style="margin-top: 25px;">
      Cheers,<br>
      <strong>Ayo</strong><br>
      <span style="color: #666; font-size: 13px;">Founder, InvoiceMonk</span>
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 11px; text-align: center;">
      Sent by InvoiceMonk · <a href="https://invoicemonk.com" style="color: #999;">invoicemonk.com</a>
    </p>
  </div>
</body>
</html>`;
}

function getUpgradeEmailTemplate(userName: string, tier: string, nextBillingDate: string): { subject: string; html: string } {
  const tierLower = tier.toLowerCase();
  if (tierLower === 'professional') {
    return {
      subject: `Welcome to Professional, ${userName}! Here's everything you've unlocked`,
      html: professionalUpgradeEmailTemplate(userName, nextBillingDate),
    };
  }
  if (tierLower === 'business') {
    return {
      subject: `Welcome to Business, ${userName}! You've unlocked the full platform`,
      html: businessUpgradeEmailTemplate(userName, nextBillingDate),
    };
  }
  // Starter or fallback
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  return {
    subject: `Your InvoiceMonk ${tierName} plan is now active!`,
    html: starterUpgradeEmailTemplate(userName, nextBillingDate),
  };
}

async function sendUpgradeEmail(
  supabase: any,
  businessId: string,
  tier: string,
  periodEnd: string
) {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    console.log("BREVO_API_KEY not configured, skipping upgrade email");
    return;
  }

  try {
    // Find business owner
    const { data: ownerMember } = await supabase
      .from("business_members")
      .select("user_id")
      .eq("business_id", businessId)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerMember?.user_id) {
      console.log("No owner found for business:", businessId);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", ownerMember.user_id)
      .maybeSingle();

    if (!profile?.email) {
      console.log("No email found for owner:", ownerMember.user_id);
      return;
    }

    const name = profile.full_name || "there";
    const nextBilling = new Date(periodEnd).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const { subject, html } = getUpgradeEmailTemplate(name, tier, nextBilling);

    const sent = await sendBrevoEmail(
      brevoApiKey,
      profile.email,
      name,
      subject,
      html
    );

    console.log(sent ? "Upgrade email sent to:" : "Failed to send upgrade email to:", profile.email);
  } catch (err) {
    console.error("Error sending upgrade email:", err);
    captureException(err, { function_name: 'stripe-webhook' })
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    console.error("Stripe secret key not configured");
    return new Response("Stripe not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2023-10-16",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;
    
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      console.error("CRITICAL: STRIPE_WEBHOOK_SECRET is not configured. Rejecting webhook.");
      return new Response(
        JSON.stringify({ error: "Webhook signature verification not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!signature) {
      console.error("Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    try {
      // Use constructEventAsync for Deno's async SubtleCrypto
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      captureException(err, { function_name: 'stripe-webhook' })
      return new Response(
        JSON.stringify({ error: "Webhook signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received webhook event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session completed:", session.id);

        // === INVOICE PAYMENT via Stripe Checkout ===
        if (session.mode === "payment" && session.metadata?.type === "invoice_payment") {
          const invoiceId = session.metadata.invoice_id;
          const businessId = session.metadata.business_id;
          const verificationId = session.metadata.verification_id;
          const invoiceNumber = session.metadata.invoice_number;
          const providerReference = session.id;

          console.log("Processing invoice payment:", invoiceNumber, "session:", session.id);

          // Idempotency: check if already processed
          const { data: existingOp } = await supabase
            .from("online_payments")
            .select("id, status")
            .eq("provider_reference", providerReference)
            .maybeSingle();

          if (existingOp?.status === "completed") {
            console.log("Already processed Stripe invoice payment:", providerReference);
            break;
          }

          // Fetch invoice
          const { data: inv } = await supabase
            .from("invoices")
            .select("id, total_amount, amount_paid, currency, status, user_id, business_id, invoice_number")
            .eq("id", invoiceId)
            .maybeSingle();

          if (!inv || ["draft", "voided"].includes(inv.status)) {
            console.warn("Invoice not payable:", invoiceId, inv?.status);
            break;
          }

          // Currency mismatch check
          const paymentCurrency = (session.currency || "").toUpperCase();
          if (paymentCurrency && paymentCurrency !== inv.currency) {
            console.error(`Currency mismatch: payment=${paymentCurrency}, invoice=${inv.currency}`);
            if (existingOp) {
              await supabase.from("online_payments").update({ status: "failed" }).eq("id", existingOp.id);
            }
            break;
          }

          const amountPaid = (session.amount_total || 0) / 100;
          const remainingBalance = inv.total_amount - (inv.amount_paid || 0);
          const effectiveAmount = Math.min(amountPaid, remainingBalance);

          if (effectiveAmount <= 0) {
            console.log("Invoice already fully paid:", invoiceId);
            if (existingOp) {
              await supabase.from("online_payments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", existingOp.id);
            }
            break;
          }

          // Update online_payments
          if (existingOp) {
            await supabase.from("online_payments").update({
              status: "completed",
              completed_at: new Date().toISOString(),
              provider_metadata: { session_id: session.id, payment_intent: session.payment_intent },
            }).eq("id", existingOp.id);
          } else {
            await supabase.from("online_payments").insert({
              invoice_id: inv.id,
              business_id: inv.business_id,
              provider: "stripe",
              provider_reference: providerReference,
              provider_session_id: session.id,
              amount: effectiveAmount,
              currency: inv.currency,
              status: "completed",
              completed_at: new Date().toISOString(),
              provider_metadata: { session_id: session.id, payment_intent: session.payment_intent },
            });
          }

          // Record payment
          const paymentDate = new Date().toISOString().split("T")[0];
          const { data: paymentRecord } = await supabase
            .from("payments")
            .insert({
              invoice_id: inv.id,
              amount: effectiveAmount,
              payment_method: "stripe_online",
              payment_reference: `Stripe: ${session.id}`,
              payment_date: paymentDate,
              notes: "Online payment via Stripe",
              recorded_by: inv.user_id,
            })
            .select("id")
            .single();

          // Update invoice
          const newAmountPaid = (inv.amount_paid || 0) + effectiveAmount;
          const isFullyPaid = newAmountPaid >= inv.total_amount;
          const newStatus = isFullyPaid ? "paid" : inv.status;

          await supabase
            .from("invoices")
            .update({ amount_paid: newAmountPaid, status: newStatus })
            .eq("id", inv.id);

          // Create receipt
          if (paymentRecord?.id) {
            try {
              await supabase.rpc("create_receipt_from_payment", { _payment_id: paymentRecord.id });
            } catch (receiptErr) {
              console.error("Receipt creation failed:", receiptErr);
              captureException(receiptErr, { function_name: 'stripe-webhook' })
            }
          }

          // Notification
          try {
            let formattedAmount: string;
            try {
              formattedAmount = new Intl.NumberFormat("en", { style: "currency", currency: inv.currency }).format(effectiveAmount);
            } catch {
              formattedAmount = `${inv.currency} ${effectiveAmount}`;
            }
            await supabase.from("notifications").insert({
              user_id: inv.user_id,
              business_id: inv.business_id,
              type: "ONLINE_PAYMENT_RECEIVED",
              title: "Online Payment Received",
              message: `Payment of ${formattedAmount} received via Stripe for invoice ${inv.invoice_number}. ${isFullyPaid ? "Invoice is now fully paid!" : ""}`,
              entity_type: "invoice",
              entity_id: inv.id,
            });
          } catch (notifErr) {
            console.error("Notification error:", notifErr);
            captureException(notifErr, { function_name: 'stripe-webhook' })
          }

          // Audit log
          await supabase.rpc("log_audit_event", {
            _event_type: "PAYMENT_RECORDED",
            _entity_type: "payment",
            _entity_id: paymentRecord?.id,
            _user_id: inv.user_id,
            _business_id: inv.business_id,
            _new_state: { status: newStatus, amount_paid: newAmountPaid },
            _metadata: {
              provider: "stripe",
              provider_reference: providerReference,
              invoice_id: inv.id,
              invoice_number: inv.invoice_number,
              fully_paid: isFullyPaid,
              online_payment: true,
            },
          });

          console.log(`Stripe invoice payment processed: ${effectiveAmount} ${inv.currency} for ${inv.invoice_number}`);
          break;
        }

        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string" 
            ? session.subscription 
            : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = session.metadata?.user_id || subscription.metadata?.user_id;
          const businessId = session.metadata?.business_id || subscription.metadata?.business_id;
          const tier = session.metadata?.tier || subscription.metadata?.tier || "professional";
          const pricingRegion = subscription.metadata?.pricing_region;
          const billingCurrency = subscription.metadata?.billing_currency;
          const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          if (!businessId) {
            console.error("No business_id in metadata - falling back to user_id lookup");
            if (userId) {
              const { data: userBusiness } = await supabase
                .from("business_members")
                .select("business_id, businesses(is_default)")
                .eq("user_id", userId)
                .limit(10);
              
              const defaultBusiness = userBusiness?.find((m: any) => m.businesses?.is_default) || userBusiness?.[0];
              if (defaultBusiness) {
                await updateSubscriptionByBusiness(supabase, subscription, defaultBusiness.business_id, tier, pricingRegion, billingCurrency, session.customer as string);
                await sendUpgradeEmail(supabase, defaultBusiness.business_id, tier, periodEnd);
              }
            }
            break;
          }

          // Resolve the business owner's user_id to populate on the subscription
          let resolvedUserId = userId;
          if (!resolvedUserId) {
            const { data: ownerMember } = await supabase
              .from("business_members")
              .select("user_id")
              .eq("business_id", businessId)
              .eq("role", "owner")
              .maybeSingle();
            resolvedUserId = ownerMember?.user_id || null;
          }

          // Check if business has existing subscription
          const { data: existingSub } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("business_id", businessId)
            .maybeSingle();

          if (existingSub) {
            await supabase
              .from("subscriptions")
              .update({
                tier,
                status: "active",
                user_id: resolvedUserId,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: periodEnd,
                pricing_region: pricingRegion,
                billing_currency: billingCurrency,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingSub.id);

            console.log("Updated subscription for business:", businessId, "user_id:", resolvedUserId);
          } else {
            await supabase
              .from("subscriptions")
              .insert({
                business_id: businessId,
                user_id: resolvedUserId,
                tier,
                status: "active",
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: periodEnd,
                pricing_region: pricingRegion,
                billing_currency: billingCurrency,
              });

            console.log("Created subscription for business:", businessId, "user_id:", resolvedUserId);
          }

          // Send upgrade confirmation email
          await sendUpgradeEmail(supabase, businessId, tier, periodEnd);

          // Log audit event
          await supabase.rpc("log_audit_event", {
            _event_type: "SUBSCRIPTION_CHANGED",
            _entity_type: "subscription",
            _user_id: userId,
            _business_id: businessId,
            _metadata: { tier, action: "upgraded", stripe_subscription_id: subscriptionId },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription updated:", subscription.id);

        const businessId = subscription.metadata?.business_id;
        const userId = subscription.metadata?.user_id;
        
        if (businessId) {
          await doUpdateSubscriptionByBusiness(supabase, subscription, businessId);
        } else if (userId) {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("business_id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();

          if (sub?.business_id) {
            await doUpdateSubscriptionByBusiness(supabase, subscription, sub.business_id);
          } else {
            await doUpdateSubscription(supabase, subscription, userId);
          }
        } else {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("business_id, user_id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();

          if (sub?.business_id) {
            await doUpdateSubscriptionByBusiness(supabase, subscription, sub.business_id);
          } else if (sub?.user_id) {
            await doUpdateSubscription(supabase, subscription, sub.user_id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription deleted:", subscription.id);

        // Find the subscription record before updating
        const { data: cancelledSub } = await supabase
          .from("subscriptions")
          .select("id, business_id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        const { error } = await supabase
          .from("subscriptions")
          .update({
            tier: "starter",
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Error updating cancelled subscription:", error);
        } else {
          console.log("Subscription cancelled, reverted to starter");
        }

        // Void any pending/locked commissions tied to this subscription
        if (cancelledSub?.id) {
          const { data: voidedComms, error: voidErr } = await supabase
            .from("commissions")
            .update({
              status: "voided" as const,
            })
            .eq("subscription_id", cancelledSub.id)
            .in("status", ["pending", "locked"])
            .select("id");

          if (voidErr) {
            console.error("Error voiding commissions:", voidErr);
          } else {
            console.log(`Voided ${voidedComms?.length || 0} commissions for cancelled subscription`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Payment failed for invoice:", invoice.id);

        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

          const { data: subData } = await supabase
            .from("subscriptions")
            .select("id, business_id, businesses(name)")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();

          await supabase
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          if (subData?.id) {
            const businessName = (subData.businesses as any)?.name || 'Unknown business';
            await supabase.rpc('notify_admin_payment_failed', {
              _subscription_id: subData.id,
              _business_name: businessName
            });
            console.log("Admin notification created for payment failure");
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Invoice paid:", invoice.id);

        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          // --- REFERRAL COMMISSION LOGIC ---
          try {
            const { data: subRecord } = await supabase
              .from("subscriptions")
              .select("id, business_id, tier, billing_currency")
              .eq("stripe_subscription_id", subscriptionId)
              .maybeSingle();

            if (subRecord?.business_id) {
              const { data: ownerMember } = await supabase
                .from("business_members")
                .select("user_id")
                .eq("business_id", subRecord.business_id)
                .eq("role", "owner")
                .maybeSingle();

              if (ownerMember?.user_id) {
                const { data: referral } = await supabase
                  .from("referrals")
                  .select("id, partner_id, commission_business_id, is_self_referral")
                  .eq("referred_user_id", ownerMember.user_id)
                  .maybeSingle();

                if (referral && !referral.is_self_referral) {
                  if (!referral.commission_business_id) {
                    await supabase
                      .from("referrals")
                      .update({ commission_business_id: subRecord.business_id })
                      .eq("id", referral.id);
                    referral.commission_business_id = subRecord.business_id;
                    console.log("Locked commission_business_id:", subRecord.business_id);
                  }

                  if (referral.commission_business_id === subRecord.business_id) {
                    const { data: partner } = await supabase
                      .from("referral_partners")
                      .select("id, commission_rate, status")
                      .eq("id", referral.partner_id)
                      .maybeSingle();

                    if (partner && partner.status === "active") {
                      const grossAmount = (invoice.amount_paid || 0) / 100;
                      const commissionRate = Number(partner.commission_rate);
                      const commissionAmount = Math.round(grossAmount * commissionRate * 100) / 100;
                      const currency = subRecord.billing_currency || invoice.currency?.toUpperCase() || "USD";

                      const { data: existingComm } = await supabase
                        .from("commissions")
                        .select("id")
                        .eq("billing_event_id", invoice.id)
                        .maybeSingle();

                      if (!existingComm) {
                        const { data: newComm } = await supabase.from("commissions").insert({
                          partner_id: partner.id,
                          referral_id: referral.id,
                          subscription_id: subRecord.id,
                          billing_event_id: invoice.id,
                          gross_amount: grossAmount,
                          commission_rate: commissionRate,
                          commission_amount: commissionAmount,
                          currency: currency,
                        }).select("id").single();

                        console.log("Commission created:", commissionAmount, currency, "for partner:", partner.id);

                        // Notify the partner about the new commission
                        const { data: partnerProfile } = await supabase
                          .from("referral_partners")
                          .select("user_id")
                          .eq("id", partner.id)
                          .single();

                        if (partnerProfile?.user_id) {
                          await supabase.from("notifications").insert({
                            user_id: partnerProfile.user_id,
                            type: "partner",
                            title: "Commission Earned!",
                            message: `You earned a commission of ${commissionAmount.toFixed(2)} ${currency} from a referral payment.`,
                            entity_type: "commission",
                            entity_id: newComm?.id || null,
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (commErr) {
            console.error("Commission processing error:", commErr);
            captureException(commErr, { function_name: 'stripe-webhook' })
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as any;
        console.log("Charge refunded:", charge.id);

        // Find subscription via the charge's invoice
        if (charge.invoice) {
          const stripeInvoice = await stripe.invoices.retrieve(
            typeof charge.invoice === "string" ? charge.invoice : charge.invoice.id
          );

          if (stripeInvoice.subscription) {
            const subId = typeof stripeInvoice.subscription === "string"
              ? stripeInvoice.subscription
              : stripeInvoice.subscription.id;

            const { data: subRecord } = await supabase
              .from("subscriptions")
              .select("id")
              .eq("stripe_subscription_id", subId)
              .maybeSingle();

            if (subRecord?.id) {
              // Void commissions linked to this billing event
              const { data: voidedComms, error: voidErr } = await supabase
                .from("commissions")
                .update({ status: "voided" as const })
                .eq("billing_event_id", stripeInvoice.id)
                .in("status", ["pending", "locked"])
                .select("id");

              if (voidErr) {
                console.error("Error voiding commissions on refund:", voidErr);
              } else {
                console.log(`Voided ${voidedComms?.length || 0} commissions for refunded charge`);
              }

              // Audit log
              await supabase.rpc("log_audit_event", {
                _event_type: "COMMISSION_VOIDED",
                _entity_type: "commission",
                _user_id: null,
                _metadata: {
                  reason: "charge_refunded",
                  charge_id: charge.id,
                  invoice_id: stripeInvoice.id,
                  voided_count: voidedComms?.length || 0,
                },
              });
            }
          }
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    captureException(error, { function_name: 'stripe-webhook' })
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

const TIER_ORDER: Record<string, number> = { starter: 0, starter_paid: 1, professional: 2, business: 3 };

async function doUpdateSubscription(
  supabase: any,
  subscription: Stripe.Subscription,
  userId: string
) {
  const metadataTier = subscription.metadata?.tier || "professional";

  // Check current DB tier to prevent downgrading manual upgrades
  const { data: currentSub } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();

  const dbTier = currentSub?.tier || "starter";
  const tier = (TIER_ORDER[dbTier] ?? 0) > (TIER_ORDER[metadataTier] ?? 0) ? dbTier : metadataTier;

  if (tier !== metadataTier) {
    console.log("Tier-downgrade protection: keeping DB tier", dbTier, "instead of metadata tier", metadataTier);
  }

  const status = subscription.status === "active" ? "active" 
    : subscription.status === "past_due" ? "past_due"
    : subscription.status === "canceled" ? "cancelled"
    : subscription.status === "trialing" ? "trialing"
    : "active";

  const updateData: Record<string, any> = { tier, status, updated_at: new Date().toISOString() };
  const periodStart = safeISODate(subscription.current_period_start);
  const periodEnd = safeISODate(subscription.current_period_end);
  if (periodStart) updateData.current_period_start = periodStart;
  if (periodEnd) updateData.current_period_end = periodEnd;

  await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("user_id", userId);

  console.log("Updated subscription for user:", userId, "tier:", tier, "status:", status);
}

async function doUpdateSubscriptionByBusiness(
  supabase: any,
  subscription: Stripe.Subscription,
  businessId: string
) {
  const metadataTier = subscription.metadata?.tier || "professional";

  // Check current DB tier to prevent downgrading manual upgrades
  const { data: currentSub } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("business_id", businessId)
    .maybeSingle();

  const dbTier = currentSub?.tier || "starter";
  const tier = (TIER_ORDER[dbTier] ?? 0) > (TIER_ORDER[metadataTier] ?? 0) ? dbTier : metadataTier;

  if (tier !== metadataTier) {
    console.log("Tier-downgrade protection: keeping DB tier", dbTier, "instead of metadata tier", metadataTier);
  }

  const status = subscription.status === "active" ? "active" 
    : subscription.status === "past_due" ? "past_due"
    : subscription.status === "canceled" ? "cancelled"
    : subscription.status === "trialing" ? "trialing"
    : "active";

  const updateData2: Record<string, any> = { tier, status, updated_at: new Date().toISOString() };
  const ps2 = safeISODate(subscription.current_period_start);
  const pe2 = safeISODate(subscription.current_period_end);
  if (ps2) updateData2.current_period_start = ps2;
  if (pe2) updateData2.current_period_end = pe2;

  await supabase
    .from("subscriptions")
    .update(updateData2)
    .eq("business_id", businessId);

  console.log("Updated subscription for business:", businessId, "tier:", tier, "status:", status);
}

async function updateSubscriptionByBusiness(
  supabase: any,
  subscription: Stripe.Subscription,
  businessId: string,
  tier: string,
  pricingRegion: string | undefined,
  billingCurrency: string | undefined,
  stripeCustomerId: string
) {
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existingSub) {
    const upd: Record<string, any> = {
      tier, status: "active", stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      pricing_region: pricingRegion, billing_currency: billingCurrency,
      updated_at: new Date().toISOString(),
    };
    const ps3 = safeISODate(subscription.current_period_start);
    const pe3 = safeISODate(subscription.current_period_end);
    if (ps3) upd.current_period_start = ps3;
    if (pe3) upd.current_period_end = pe3;

    await supabase.from("subscriptions").update(upd).eq("id", existingSub.id);
  } else {
    const ins: Record<string, any> = {
      business_id: businessId, tier, status: "active",
      stripe_customer_id: stripeCustomerId, stripe_subscription_id: subscription.id,
      pricing_region: pricingRegion, billing_currency: billingCurrency,
    };
    const ps4 = safeISODate(subscription.current_period_start);
    const pe4 = safeISODate(subscription.current_period_end);
    if (ps4) ins.current_period_start = ps4;
    if (pe4) ins.current_period_end = pe4;

    await supabase.from("subscriptions").insert(ins);
  }
  console.log("Updated subscription for business:", businessId);
}
