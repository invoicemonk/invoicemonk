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
    const { referral_code, user_id } = await req.json();

    if (!referral_code || !user_id) {
      return new Response(
        JSON.stringify({ error: "referral_code and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Look up the referral link
    const { data: link, error: linkError } = await supabase
      .from("referral_links")
      .select("id, partner_id, is_active")
      .eq("code", referral_code)
      .single();

    if (linkError || !link) {
      console.error("Referral link not found:", referral_code);
      return new Response(
        JSON.stringify({ error: "Invalid referral code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!link.is_active) {
      return new Response(
        JSON.stringify({ error: "Referral link is inactive" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check partner is active
    const { data: partner, error: partnerError } = await supabase
      .from("referral_partners")
      .select("id, user_id, status")
      .eq("id", link.partner_id)
      .single();

    if (partnerError || !partner || partner.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Partner is not active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check if user already has a referral (one per user)
    const { data: existingRef } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_user_id", user_id)
      .maybeSingle();

    if (existingRef) {
      console.log("User already referred:", user_id);
      return new Response(
        JSON.stringify({ success: true, already_referred: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Attribution window check: find first click from this link's partner
    // Get all clicks for this partner's links
    const { data: partnerLinks } = await supabase
      .from("referral_links")
      .select("id")
      .eq("partner_id", partner.id);

    const linkIds = partnerLinks?.map((l) => l.id) || [];

    let firstClickAt = new Date().toISOString();

    if (linkIds.length > 0) {
      const { data: clicks } = await supabase
        .from("referral_clicks")
        .select("created_at")
        .in("link_id", linkIds)
        .order("created_at", { ascending: true })
        .limit(1);

      if (clicks && clicks.length > 0) {
        firstClickAt = clicks[0].created_at;

        // Check 60-day attribution window from first click
        const firstClick = new Date(firstClickAt);
        const now = new Date();
        const daysDiff = (now.getTime() - firstClick.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > 60) {
          console.log("Attribution window expired. First click:", firstClickAt, "Days:", daysDiff);
          return new Response(
            JSON.stringify({ error: "Attribution window expired" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 5. Generate customer_ref from sequence
    const { data: seqData, error: seqError } = await supabase.rpc("nextval", {
      seq_name: "referral_customer_ref_seq",
    }).maybeSingle();

    // Fallback if RPC doesn't work - use timestamp-based ref
    let customerRef: string;
    if (seqError || !seqData) {
      customerRef = `IM-${Date.now().toString().slice(-5)}`;
    } else {
      customerRef = `IM-${seqData}`;
    }

    // 6. Create the referral record
    // Self-referral detection is handled by the DB trigger
    const { data: referral, error: refError } = await supabase
      .from("referrals")
      .insert({
        partner_id: partner.id,
        link_id: link.id,
        referred_user_id: user_id,
        customer_ref: customerRef,
        first_click_at: firstClickAt,
        attributed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (refError) {
      console.error("Error creating referral:", refError);
      return new Response(
        JSON.stringify({ error: refError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Referral attributed:", referral.id, "customer_ref:", customerRef);

    // 7. Log audit event
    await supabase.rpc("log_audit_event", {
      _event_type: "REFERRAL_ATTRIBUTED",
      _entity_type: "referral",
      _entity_id: referral.id,
      _user_id: user_id,
      _metadata: {
        partner_id: partner.id,
        referral_code: referral_code,
        customer_ref: customerRef,
        is_self_referral: referral.is_self_referral,
      },
    });

    return new Response(
      JSON.stringify({ success: true, referral_id: referral.id, customer_ref: customerRef }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Attribute referral error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
