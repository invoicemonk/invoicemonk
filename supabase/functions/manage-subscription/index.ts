import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { action } = await req.json();

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Get user's subscription with Stripe customer ID
    const { data: subscription, error: subError } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (subError) {
      throw new Error("Failed to fetch subscription");
    }

    const appUrl = Deno.env.get("APP_URL") || "https://id-preview--0f48e9a6-b42f-4f54-83c7-22ababefed5e.lovable.app";

    switch (action) {
      case "portal": {
        // Create customer portal session
        if (!subscription?.stripe_customer_id) {
          throw new Error("No Stripe customer found. Please subscribe to a paid plan first.");
        }

        const portalSession = await stripe.billingPortal.sessions.create({
          customer: subscription.stripe_customer_id,
          return_url: `${appUrl}/billing`,
        });

        console.log("Portal session created for user:", user.id);

        return new Response(
          JSON.stringify({ url: portalSession.url }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case "cancel": {
        // Cancel subscription at period end
        if (!subscription?.stripe_subscription_id) {
          throw new Error("No active subscription to cancel");
        }

        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });

        console.log("Subscription set to cancel at period end:", subscription.stripe_subscription_id);

        return new Response(
          JSON.stringify({ success: true, message: "Subscription will cancel at end of billing period" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case "reactivate": {
        // Reactivate a cancelled subscription (if still in period)
        if (!subscription?.stripe_subscription_id) {
          throw new Error("No subscription to reactivate");
        }

        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: false,
        });

        console.log("Subscription reactivated:", subscription.stripe_subscription_id);

        return new Response(
          JSON.stringify({ success: true, message: "Subscription reactivated" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Error managing subscription:", error);
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
