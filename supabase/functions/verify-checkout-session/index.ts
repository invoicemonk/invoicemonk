import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/validation.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }

    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id || typeof session_id !== "string") {
      return new Response(JSON.stringify({ paid: false, error: "Missing session_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (e) {
      console.error("Stripe session retrieve failed:", e);
      return new Response(JSON.stringify({ paid: false, error: "Invalid session" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Require both Stripe ownership markers; never accept an unbound session.
    if (
      session.client_reference_id !== user.id ||
      session.metadata?.user_id !== user.id
    ) {
      return new Response(JSON.stringify({ paid: false, error: "Session does not belong to user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    if (
      session.mode !== "subscription" ||
      session.status !== "complete" ||
      session.payment_status !== "paid" ||
      typeof session.subscription !== "string"
    ) {
      return new Response(JSON.stringify({
        paid: false,
        payment_status: session.payment_status,
        status: session.status,
        error: "A completed paid subscription is required.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription, {
      expand: ["latest_invoice.payment_intent"],
    });
    const latestInvoice: any = (subscription as any).latest_invoice;
    const invoicePaid = latestInvoice?.status === "paid" ||
      latestInvoice?.payment_intent?.status === "succeeded";

    if (subscription.status !== "active" || !invoicePaid) {
      return new Response(JSON.stringify({
        paid: false,
        subscription_status: subscription.status,
        invoice_status: latestInvoice?.status ?? null,
        error: "Stripe has not confirmed an active, paid subscription.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Confirmed paid: mark the user as having selected a plan.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        has_selected_plan: true,
        intended_tier: null,
        intended_billing_period: null,
        intended_tier_set_at: null,
        failed_checkout_attempts: 0,
      })
      .eq("id", user.id);

    if (profileUpdateError) throw profileUpdateError;

    return new Response(JSON.stringify({
      paid: true,
      tier: subscription.metadata?.tier ?? session.metadata?.tier ?? null,
      businessId: (session.metadata as any)?.business_id ?? null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    console.error("verify-checkout-session error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 500,
    });
  }
});
