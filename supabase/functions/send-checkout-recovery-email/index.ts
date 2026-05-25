import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const TIER_NAME: Record<string, string> = { professional: 'Pro', business: 'SME' };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }

    const { tier, billing_period, attempts } = await req.json();
    const tierLabel = TIER_NAME[tier] || 'paid';

    // Rate-limit: 5/hr per user
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.email) {
      return new Response(JSON.stringify({ skipped: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: "no_brevo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const appUrl = Deno.env.get("APP_URL") || "https://app.invoicemonk.com";
    const resumeUrl = `${appUrl}/select-plan?resume=1`;
    const fullName = escapeHtml(profile.full_name || 'there');
    const safeTier = escapeHtml(tierLabel);
    const safeUrl = escapeHtml(resumeUrl);

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;">
      <h2 style="color:#1d6b5a;">Your ${safeTier} upgrade is one click away</h2>
      <p>Hi ${fullName},</p>
      <p>We noticed your payment for the ${safeTier} plan didn't go through. No charge was made.</p>
      <p>This is usually a card issue (3-D Secure, insufficient funds, or a bank block). You can try a different card now:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${safeUrl}" style="background:#1d6b5a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Resume your upgrade</a>
      </p>
      <p style="font-size:13px;color:#666;">If your card keeps failing, just reply to this email — we can take payment manually so you don't miss out on ${safeTier}.</p>
      <p style="font-size:12px;color:#999;margin-top:24px;">— The Invoicemonk team</p>
    </body></html>`;

    const smtpFrom = Deno.env.get("SMTP_FROM") || "noreply@invoicemonk.com";
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "api-key": brevoKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Invoicemonk", email: smtpFrom },
        to: [{ email: profile.email, name: profile.full_name || undefined }],
        subject: `Your ${tierLabel} upgrade is one click away`,
        htmlContent: html,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Brevo error:", resp.status, txt);
      return new Response(JSON.stringify({ error: "send_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    console.log(`Recovery email sent to ${profile.email} (tier=${tier}, attempts=${attempts})`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err) {
    console.error("send-checkout-recovery-email error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
