import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Stripe webhook needs permissive CORS for Stripe's servers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

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

    // SECURITY: Enforce signature verification
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
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
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

          if (!businessId) {
            console.error("No business_id in metadata - falling back to user_id lookup");
            // Fallback: try to find business by user_id
            if (userId) {
              const { data: userBusiness } = await supabase
                .from("business_members")
                .select("business_id, businesses(is_default)")
                .eq("user_id", userId)
                .limit(10);
              
              const defaultBusiness = userBusiness?.find((m: any) => m.businesses?.is_default) || userBusiness?.[0];
              if (defaultBusiness) {
                await updateSubscriptionByBusiness(supabase, subscription, defaultBusiness.business_id, tier, pricingRegion, billingCurrency, session.customer as string);
              }
            }
            break;
          }

          // Check if business has existing subscription
          const { data: existingSub } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("business_id", businessId)
            .maybeSingle();

          if (existingSub) {
            // Update existing subscription
            await supabase
              .from("subscriptions")
              .update({
                tier,
                status: "active",
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                pricing_region: pricingRegion,
                billing_currency: billingCurrency,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingSub.id);

            console.log("Updated subscription for business:", businessId);
          } else {
            // Create new subscription for business
            await supabase
              .from("subscriptions")
              .insert({
                business_id: businessId,
                tier,
                status: "active",
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                pricing_region: pricingRegion,
                billing_currency: billingCurrency,
              });

            console.log("Created subscription for business:", businessId);
          }

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
          // Fallback: find business by user_id
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("business_id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();

          if (sub?.business_id) {
            await doUpdateSubscriptionByBusiness(supabase, subscription, sub.business_id);
          } else {
            // Legacy: update by user_id
            await doUpdateSubscription(supabase, subscription, userId);
          }
        } else {
          // Find by stripe_subscription_id
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

        // Mark subscription as cancelled and revert to starter
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
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Payment failed for invoice:", invoice.id);

        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

          // Get subscription details for admin notification
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

          // Create admin notification for payment failure
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

          // Ensure subscription is active
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);
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

async function doUpdateSubscription(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  subscription: Stripe.Subscription,
  userId: string
) {
  const tier = subscription.metadata?.tier || "professional";
  const status = subscription.status === "active" ? "active" 
    : subscription.status === "past_due" ? "past_due"
    : subscription.status === "canceled" ? "cancelled"
    : subscription.status === "trialing" ? "trialing"
    : "active";

  await supabase
    .from("subscriptions")
    .update({
      tier,
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  console.log("Updated subscription for user:", userId, "tier:", tier, "status:", status);
}

async function doUpdateSubscriptionByBusiness(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  subscription: Stripe.Subscription,
  businessId: string
) {
  const tier = subscription.metadata?.tier || "professional";
  const status = subscription.status === "active" ? "active" 
    : subscription.status === "past_due" ? "past_due"
    : subscription.status === "canceled" ? "cancelled"
    : subscription.status === "trialing" ? "trialing"
    : "active";

  await supabase
    .from("subscriptions")
    .update({
      tier,
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  console.log("Updated subscription for business:", businessId, "tier:", tier, "status:", status);
}

async function updateSubscriptionByBusiness(
  // deno-lint-ignore no-explicit-any
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
    await supabase
      .from("subscriptions")
      .update({
        tier,
        status: "active",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        pricing_region: pricingRegion,
        billing_currency: billingCurrency,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSub.id);
  } else {
    await supabase
      .from("subscriptions")
      .insert({
        business_id: businessId,
        tier,
        status: "active",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        pricing_region: pricingRegion,
        billing_currency: billingCurrency,
      });
  }
  console.log("Updated subscription for business:", businessId);
}