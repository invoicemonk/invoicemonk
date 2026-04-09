import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/validation.ts";
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()

function welcomeEmailTemplate(userName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: #ffffff; padding: 20px 30px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 1px solid #e5e7eb;">
    <img src="https://app.invoicemonk.com/invoicemonk-logo.png" alt="InvoiceMonk" style="height: 36px;" />
  </div>
  <div style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); color: white; padding: 24px 30px; text-align: center;">
    <h1 style="margin: 0; font-size: 22px;">Welcome to InvoiceMonk! 🎉</h1>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>Hi ${userName},</p>
    <p>I'm Ayo, the founder of InvoiceMonk. Welcome aboard!</p>
    <p>InvoiceMonk helps you create compliant invoices, track payments, and manage your business finances — all while staying aligned with tax regulations in your jurisdiction (IRS, HMRC, FIRS, CRA, ATO, and more).</p>

    <h2 style="font-size: 18px; color: #1d6b5a; margin: 25px 0 15px;">🚀 Get Started in 4 Steps</h2>

    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 15px 0;">
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0; vertical-align: top; width: 30px; font-size: 18px;">1️⃣</td>
          <td style="padding: 8px 0;">
            <strong>Complete your business profile</strong><br>
            <span style="color: #666; font-size: 13px;">Add your business name, address, tax ID, and jurisdiction</span><br>
            <a href="https://app.invoicemonk.com/settings" style="color: #1d6b5a; font-size: 13px;">Go to Settings →</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; vertical-align: top; font-size: 18px;">2️⃣</td>
          <td style="padding: 8px 0;">
            <strong>Add your first client</strong><br>
            <span style="color: #666; font-size: 13px;">Save client details for quick invoicing later</span><br>
            <a href="https://app.invoicemonk.com/clients" style="color: #1d6b5a; font-size: 13px;">Add a Client →</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; vertical-align: top; font-size: 18px;">3️⃣</td>
          <td style="padding: 8px 0;">
            <strong>Create your first invoice</strong><br>
            <span style="color: #666; font-size: 13px;">Generate a professional, compliance-ready invoice in under 2 minutes</span><br>
            <a href="https://app.invoicemonk.com/invoices/new" style="color: #1d6b5a; font-size: 13px;">Create Invoice →</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; vertical-align: top; font-size: 18px;">4️⃣</td>
          <td style="padding: 8px 0;">
            <strong>Set up payment methods</strong><br>
            <span style="color: #666; font-size: 13px;">Add your bank details so clients know where to pay</span><br>
            <a href="https://app.invoicemonk.com/settings" style="color: #1d6b5a; font-size: 13px;">Payment Settings →</a>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin-top: 20px;">💡 <strong>Tip:</strong> Check the <strong>Quick Setup Checklist</strong> on your dashboard — it tracks your progress and guides you through the essentials.</p>

    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/dashboard" style="display: inline-block; background: #1d6b5a; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Dashboard →</a>
    </div>

    <p>If you ever need help, just reply to this email or use the chat widget on the platform — we're here for you.</p>

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

async function sendWelcomeEmail(
  brevoApiKey: string,
  email: string,
  fullName: string
): Promise<void> {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Ayo from InvoiceMonk", email: "hello@invoicemonk.com" },
        to: [{ email, name: fullName }],
        subject: `Welcome to InvoiceMonk, ${fullName || "there"}! Here's how to get started`,
        htmlContent: welcomeEmailTemplate(fullName || "there"),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Welcome email Brevo error (${response.status}):`, errorText);
    } else {
      console.log("Welcome email sent to:", email);
    }
  } catch (err) {
    console.error("Failed to send welcome email:", err);
    captureException(err, { function_name: "track-auth-event" });
  }
}

async function syncBrevoContact(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  attributes: Record<string, unknown>,
): Promise<void> {
  try {
    const url = `${supabaseUrl}/functions/v1/sync-brevo-contact`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ email, attributes }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`sync-brevo-contact error (${response.status}):`, text);
    } else {
      await response.text();
      console.log("Brevo contact synced for:", email);
    }
  } catch (err) {
    console.error("Failed to sync Brevo contact:", err);
  }
}

// Detect login from a new country and create a fraud flag
async function detectGeoAnomaly(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  userId: string,
  ip: string | null
): Promise<void> {
  if (!ip) return;

  try {
    // Look up country from IP using a free service
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    let country: string | null = null;

    try {
      const geoRes = await fetch(`https://ipapi.co/${ip}/country/`, { signal: controller.signal });
      clearTimeout(timeout);
      if (geoRes.ok) {
        country = (await geoRes.text()).trim();
        if (country.length > 5) country = null; // invalid response
      }
    } catch {
      clearTimeout(timeout);
      return; // Can't determine country, skip
    }

    if (!country) return;

    // Get previous login countries for this user (last 30 events)
    const { data: previousEvents } = await serviceClient
      .from('user_login_events')
      .select('metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    const previousCountries = new Set<string>();
    if (previousEvents) {
      for (const evt of previousEvents) {
        const c = (evt.metadata as any)?.country;
        if (c) previousCountries.add(c);
      }
    }

    // If there are previous countries and this one is new, flag it
    if (previousCountries.size > 0 && !previousCountries.has(country)) {
      // Find a business for this user to attach the flag
      const { data: membership } = await serviceClient
        .from('business_members')
        .select('business_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (membership?.business_id) {
        await serviceClient.from('fraud_flags').insert({
          business_id: membership.business_id,
          user_id: userId,
          reason: 'NEW_LOGIN_COUNTRY',
          severity: 'low',
          metadata: {
            new_country: country,
            previous_countries: Array.from(previousCountries),
            ip_address: ip,
          },
        });
        console.log(`Geo anomaly flag created: user ${userId} logged in from new country ${country}`);
      }
    }

    // Store country in the login event metadata (update the just-inserted row)
    await serviceClient
      .from('user_login_events')
      .update({ metadata: { country } })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

  } catch (err) {
    console.error('Geo anomaly detection error:', err);
    // Non-critical — don't fail the request
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode JWT directly to extract user_id
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string;
    try {
      const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(payloadB64));
      userId = payload.sub;
      if (!userId) throw new Error("Missing sub");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token payload" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { event_type } = await req.json();
    if (!event_type || !["sign_in", "sign_up", "plan_selected"].includes(event_type)) {
      return new Response(JSON.stringify({ error: "Invalid event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract IP from headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") ||
      null;

    const userAgent = req.headers.get("user-agent")?.substring(0, 500) || null;

    // Use service role client to insert (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Only log login events for sign_in/sign_up (not plan_selected)
    if (event_type === "sign_in" || event_type === "sign_up") {
      const { error: insertError } = await serviceClient
        .from("user_login_events")
        .insert({
          user_id: userId,
          event_type,
          ip_address: ip,
          user_agent: userAgent,
        });

      if (insertError) {
        console.error("Failed to insert login event:", insertError);
        return new Response(JSON.stringify({ error: "Failed to log event" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Geo anomaly detection (non-blocking)
      if (event_type === "sign_in") {
        detectGeoAnomaly(serviceClient, userId, ip).catch((err) =>
          console.error("Geo anomaly bg error:", err)
        );
      }
    }

    // Fetch profile data for Brevo sync
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("email, full_name, created_at, has_selected_plan")
      .eq("id", userId)
      .maybeSingle();

    // Fetch the user's default business for extra attributes
    const { data: membership } = await serviceClient
      .from("business_members")
      .select("business_id, businesses(name, jurisdiction, default_currency)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const businessArr = membership?.businesses as
      | { name: string; jurisdiction: string | null; default_currency: string | null }[]
      | undefined;
    const businessData = businessArr?.[0] ?? null;

    // Fetch current subscription tier
    const { data: subscription } = membership?.business_id
      ? await serviceClient
          .from("subscriptions")
          .select("tier")
          .eq("business_id", membership.business_id)
          .eq("status", "active")
          .maybeSingle()
      : { data: null };

    // --- Brevo contact sync (non-blocking) ---
    if (profile?.email) {
      const nameParts = (profile.full_name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      if (event_type === "sign_up") {
        syncBrevoContact(supabaseUrl, serviceRoleKey, profile.email, {
          FIRSTNAME: firstName,
          LASTNAME: lastName,
          PLAN: subscription?.tier || "starter",
          SIGNUP_DATE: profile.created_at
            ? new Date(profile.created_at).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          COUNTRY: businessData?.jurisdiction || "",
          BUSINESS_NAME: businessData?.name || "",
          HAS_SELECTED_PLAN: profile.has_selected_plan ?? false,
        }).catch((err) => console.error("Brevo sync bg error:", err));
      }

      if (event_type === "sign_in") {
        syncBrevoContact(supabaseUrl, serviceRoleKey, profile.email, {
          LAST_LOGIN: new Date().toISOString().split("T")[0],
          PLAN: subscription?.tier || "starter",
        }).catch((err) => console.error("Brevo sync bg error:", err));
      }

      if (event_type === "plan_selected") {
        syncBrevoContact(supabaseUrl, serviceRoleKey, profile.email, {
          FIRSTNAME: firstName,
          LASTNAME: lastName,
          PLAN: subscription?.tier || "starter",
          HAS_SELECTED_PLAN: true,
          COUNTRY: businessData?.jurisdiction || "",
          BUSINESS_NAME: businessData?.name || "",
        }).catch((err) => console.error("Brevo sync bg error:", err));
      }
    }

    // Send welcome email when user selects their plan (non-blocking)
    if (event_type === "plan_selected") {
      const brevoApiKey = Deno.env.get("BREVO_API_KEY");
      if (brevoApiKey && profile?.email) {
        sendWelcomeEmail(brevoApiKey, profile.email, profile.full_name || "there")
          .catch((err) => console.error("Welcome email background error:", err));
      } else if (!brevoApiKey) {
        console.log("BREVO_API_KEY not configured, skipping welcome email");
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("track-auth-event error:", error);
    captureException(error, { function_name: 'track-auth-event' })
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
