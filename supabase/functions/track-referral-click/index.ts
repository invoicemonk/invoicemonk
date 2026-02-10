import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response("Missing referral code", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up the referral link
    const { data: link, error: linkError } = await supabase
      .from("referral_links")
      .select("id, partner_id, is_active, landing_page")
      .eq("code", code)
      .single();

    if (linkError || !link) {
      console.error("Referral link not found:", code);
      // Still redirect to signup, just without tracking
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, "Location": "/signup" },
      });
    }

    if (!link.is_active) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, "Location": "/signup" },
      });
    }

    // Generate visitor_id from IP + user-agent hash
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const referrerUrl = req.headers.get("referer") || null;

    // Simple hash for visitor fingerprint
    const encoder = new TextEncoder();
    const data = encoder.encode(ip + userAgent);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const visitorId = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 32);

    // Hash IP for storage
    const ipData = encoder.encode(ip);
    const ipHashBuffer = await crypto.subtle.digest("SHA-256", ipData);
    const ipHashArray = Array.from(new Uint8Array(ipHashBuffer));
    const ipHash = ipHashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 32);

    // Record the click
    await supabase.from("referral_clicks").insert({
      link_id: link.id,
      visitor_id: visitorId,
      ip_hash: ipHash,
      user_agent: userAgent?.substring(0, 500),
      referrer_url: referrerUrl?.substring(0, 1000),
    });

    console.log("Referral click recorded for code:", code, "visitor:", visitorId);

    // Redirect to signup with ref param
    // Set cookie for 60-day attribution window
    const redirectUrl = link.landing_page || `/signup?ref=${code}`;
    const cookieMaxAge = 60 * 24 * 60 * 60; // 60 days in seconds

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": redirectUrl,
        "Set-Cookie": `im_ref=${code}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`,
      },
    });
  } catch (error) {
    console.error("Track referral click error:", error);
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, "Location": "/signup" },
    });
  }
});
