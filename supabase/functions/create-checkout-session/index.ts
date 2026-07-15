import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateEnumStr as validateEnum, validateStringStr as validateString, getCorsHeaders, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


const VALID_TIERS = ['professional', 'business'] as const;
const VALID_BILLING_PERIODS = ['monthly', 'yearly'] as const;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { tier, billingPeriod = "monthly", businessId, idempotency_key: clientIdempotencyKey } = await req.json();

    // Validate tier
    const tierError = validateEnum(tier, 'tier', VALID_TIERS);
    if (tierError) {
      return new Response(
        JSON.stringify({ error: tierError }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate billingPeriod
    const billingError = validateEnum(billingPeriod, 'billingPeriod', VALID_BILLING_PERIODS);
    if (billingError) {
      return new Response(
        JSON.stringify({ error: billingError }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (tier === "starter") {
      return new Response(
        JSON.stringify({ error: "Cannot create checkout for starter tier" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get user's profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();

    // Always use default USD pricing — no more country-based lookup
    const { data: finalPricing } = await supabaseClient
      .from("pricing_regions")
      .select("*")
      .eq("tier", tier)
      .eq("is_default", true)
      .maybeSingle();

    if (!finalPricing) {
      return new Response(
        JSON.stringify({ error: `Pricing not found for tier: ${tier}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe secret key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Determine the business to bill (use provided businessId or user's default)
    let targetBusinessId = businessId;
    if (targetBusinessId) {
      // SECURITY: Verify caller is a member of the provided business_id.
      // Without this check, any user could attach a subscription to another
      // business's record and later control it via their own Stripe account.
      const { data: membership, error: membershipError } = await supabaseClient
        .from("business_members")
        .select("business_id")
        .eq("user_id", user.id)
        .eq("business_id", targetBusinessId)
        .maybeSingle();

      if (membershipError || !membership) {
        return new Response(
          JSON.stringify({ error: "You are not a member of the specified business." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
    } else {
      const { data: businessMemberData } = await supabaseClient
        .from("business_members")
        .select("business_id, businesses(is_default)")
        .eq("user_id", user.id)
        .limit(10);

      const defaultBusiness = businessMemberData?.find(
        (m: any) => m.businesses?.is_default
      ) || businessMemberData?.[0];
      
      targetBusinessId = defaultBusiness?.business_id;
    }

    if (!targetBusinessId) {
      return new Response(
        JSON.stringify({ error: "No business found. Please create a business first." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }


    // Check if business has existing subscription with stripe customer
    const { data: existingSubscription } = await supabaseClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("business_id", targetBusinessId)
      .maybeSingle();

    let customerId = existingSubscription?.stripe_customer_id;

    // If no customer, create one
    if (!customerId) {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: profile?.full_name || undefined,
          metadata: {
            user_id: user.id,
          },
        });
        customerId = customer.id;
      }
    }

    // Get or create the price ID
    const priceField = billingPeriod === "yearly" ? "stripe_price_id_yearly" : "stripe_price_id_monthly";
    let priceId = finalPricing[priceField];

    // If no price ID exists, create the product and price in Stripe
    if (!priceId) {
      const priceAmount = billingPeriod === "yearly" ? finalPricing.yearly_price : finalPricing.monthly_price;
      
      const tierDisplayName = tier === "professional" ? "Pro" : "SME";
      
      const products = await stripe.products.search({
        query: `name:'Invoicemonk ${tierDisplayName}'`,
      });

      let productId: string;
      if (products.data.length > 0) {
        productId = products.data[0].id;
      } else {
        const product = await stripe.products.create({
          name: `Invoicemonk ${tierDisplayName}`,
          description: tier === "professional" 
            ? "For growing businesses - Unlimited invoices, full compliance suite" 
            : "For scaling companies - Unlimited everything with dedicated support",
        });
        productId = product.id;
      }

      const price = await stripe.prices.create({
        product: productId,
        unit_amount: priceAmount,
        currency: finalPricing.currency.toLowerCase(),
        recurring: {
          interval: billingPeriod === "yearly" ? "year" : "month",
        },
        metadata: {
          tier,
          country_code: finalPricing.country_code,
        },
      });

      priceId = price.id;

      // Update the pricing_regions table with the new price ID
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseAdmin
        .from("pricing_regions")
        .update({ [priceField]: priceId })
        .eq("id", finalPricing.id);
    }

    const appUrl = Deno.env.get("APP_URL") || "https://app.invoicemonk.com";

    // UPGRADE-IN-PLACE: if this customer already has a live paid subscription
    // (active/past_due/trialing) that is NOT already on the target price,
    // update it in place instead of creating a second subscription via
    // Checkout. This is the Stripe-recommended pattern for plan changes and
    // eliminates the class of duplicate-subscription bugs where an upgrade
    // silently leaves the old sub live alongside the new one.
    try {
      const existing = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 20,
      });
      const livePaid = existing.data.find(
        (s) => s.status === "active" || s.status === "trialing" || s.status === "past_due",
      );
      if (livePaid) {
        const currentItem = livePaid.items?.data?.[0];
        if (currentItem && currentItem.price?.id !== priceId) {
          const updated = await stripe.subscriptions.update(
            livePaid.id,
            {
              items: [{ id: currentItem.id, price: priceId }],
              proration_behavior: "always_invoice",
              metadata: {
                ...(livePaid.metadata || {}),
                user_id: user.id,
                business_id: targetBusinessId,
                tier,
                billing_period: billingPeriod,
                pricing_region: finalPricing.country_code,
                billing_currency: finalPricing.currency,
                last_plan_change_at: new Date().toISOString(),
              },
            },
            { idempotencyKey: `plan-change:${livePaid.id}:${priceId}` },
          );
          console.log(`[upgrade-in-place] sub ${livePaid.id} -> price ${priceId}`);
          return new Response(
            JSON.stringify({
              changed_in_place: true,
              subscription_id: updated.id,
              tier,
              redirect_url: `${appUrl}/billing?upgraded=1`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }
        if (currentItem?.price?.id === priceId) {
          return new Response(
            JSON.stringify({
              changed_in_place: true,
              subscription_id: livePaid.id,
              tier,
              redirect_url: `${appUrl}/billing`,
              message: "Already on this plan",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }
      }
    } catch (e) {
      console.error("[upgrade-in-place] lookup/update failed, falling through to Checkout:", (e as Error).message);
      // Fall through to normal Checkout so we never block a legit new purchase.
    }

    // Defence-in-depth: stamp the paid intent server-side too, so a failed
    // checkout can always be recovered even if the client missed the write.
    try {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await supabaseAdmin
        .from("profiles")
        .update({
          intended_tier: tier,
          intended_billing_period: billingPeriod,
          intended_tier_set_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    } catch (e) {
      console.error("Failed to stamp paid intent:", e);
    }

    // IDEMPOTENCY: a stable key over (user, tier, billing_period, minute)
    // suppresses rapid double-submits (double click, retry after network hiccup)
    // by making Stripe return the same session for repeated calls in the same
    // minute. Client-supplied idempotency_key wins if provided.
    const bodyForKey = { user: user.id, tier, billing_period: billingPeriod, business: targetBusinessId };
    const minuteBucket = Math.floor(Date.now() / 60000);
    const idempotencyKey =
      (typeof clientIdempotencyKey === "string" && clientIdempotencyKey.length > 0)
        ? `checkout-client:${clientIdempotencyKey}`
        : `checkout:${bodyForKey.user}:${bodyForKey.business}:${tier}:${billingPeriod}:${minuteBucket}`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      client_reference_id: user.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel`,
      subscription_data: {
        metadata: {
          user_id: user.id,
          business_id: targetBusinessId,
          tier,
          billing_period: billingPeriod,
          pricing_region: finalPricing.country_code,
          billing_currency: finalPricing.currency,
        },
      },
      metadata: {
        user_id: user.id,
        business_id: targetBusinessId,
        tier,
        billing_period: billingPeriod,
      },
    }, { idempotencyKey });

    console.log("Checkout session created:", session.id);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    captureException(error, { function_name: 'create-checkout-session' })
    const message = error instanceof Error ? error.message : "Unknown error";
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
