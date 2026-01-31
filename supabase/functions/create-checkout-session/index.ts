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

    const { tier, billingPeriod = "monthly", countryCode } = await req.json();

    if (!tier || tier === "starter") {
      throw new Error("Cannot create checkout for starter tier");
    }

    // Get user's profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();

    // Get user's business for country detection
    const { data: businessMember } = await supabaseClient
      .from("business_members")
      .select("business_id, businesses(jurisdiction)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    // Extract jurisdiction safely
    const businessData = businessMember?.businesses as { jurisdiction?: string } | null;
    
    // Determine region: use provided countryCode, business jurisdiction, or default
    const region = countryCode || businessData?.jurisdiction || "US";

    // Get pricing for this region and tier
    const { data: pricing, error: pricingError } = await supabaseClient
      .from("pricing_regions")
      .select("*")
      .eq("country_code", region)
      .eq("tier", tier)
      .maybeSingle();

    // Fallback to default pricing if region not found
    let finalPricing = pricing;
    if (!finalPricing) {
      const { data: defaultPricing } = await supabaseClient
        .from("pricing_regions")
        .select("*")
        .eq("tier", tier)
        .eq("is_default", true)
        .maybeSingle();
      finalPricing = defaultPricing;
    }

    if (!finalPricing) {
      throw new Error(`Pricing not found for tier: ${tier}`);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Check if customer exists in Stripe
    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = subscription?.stripe_customer_id;

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
      
      // Search for existing product
      const products = await stripe.products.search({
        query: `name:'Invoicemonk ${tier.charAt(0).toUpperCase() + tier.slice(1)}'`,
      });

      let productId: string;
      if (products.data.length > 0) {
        productId = products.data[0].id;
      } else {
        const product = await stripe.products.create({
          name: `Invoicemonk ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
          description: tier === "professional" 
            ? "For growing businesses - Unlimited invoices, full compliance suite" 
            : "For enterprises - Unlimited everything with dedicated support",
        });
        productId = product.id;
      }

      // Create the price
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

      // Update the pricing_regions table with the new price ID (using service role)
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseAdmin
        .from("pricing_regions")
        .update({ [priceField]: priceId })
        .eq("id", finalPricing.id);
    }

    // Get the app URL for redirects
    const appUrl = Deno.env.get("APP_URL") || "https://id-preview--0f48e9a6-b42f-4f54-83c7-22ababefed5e.lovable.app";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
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
          tier,
          pricing_region: finalPricing.country_code,
          billing_currency: finalPricing.currency,
        },
      },
      metadata: {
        user_id: user.id,
        tier,
      },
    });

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
