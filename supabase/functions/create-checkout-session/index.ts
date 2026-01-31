import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Validation utilities
const VALID_TIERS = ['starter_paid', 'professional', 'business'] as const;
const VALID_BILLING_PERIODS = ['monthly', 'yearly'] as const;

function validateEnum<T extends string>(value: unknown, fieldName: string, allowedValues: readonly T[]): string | null {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (!allowedValues.includes(value as T)) {
    return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
  }
  return null;
}

function validateString(value: unknown, fieldName: string, maxLength = 100): string | null {
  if (value === null || value === undefined || value === '') {
    return null; // Optional field
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (value.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`;
  }
  return null;
}

// CORS configuration
const ALLOWED_ORIGINS = [
  'https://id-preview--7df4a13e-b3ac-46ce-9c9d-c2c7e2d1e664.lovable.app',
  'https://id-preview--dbde34c4-8152-4610-a259-5ddd5a28472b.lovable.app',
  'https://app.invoicemonk.com',
  'https://invoicemonk.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
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

    const { tier, billingPeriod = "monthly", countryCode } = await req.json();

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

    // Validate countryCode if provided (ISO 3166-1 alpha-2)
    if (countryCode) {
      const countryError = validateString(countryCode, 'countryCode', 3);
      if (countryError) {
        return new Response(
          JSON.stringify({ error: countryError }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      // Additional validation: must be 2 uppercase letters
      if (!/^[A-Z]{2}$/.test(countryCode.toUpperCase())) {
        return new Response(
          JSON.stringify({ error: "countryCode must be a valid 2-letter country code" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
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
    const region = countryCode?.toUpperCase() || businessData?.jurisdiction || "US";

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
    const appUrl = Deno.env.get("APP_URL") || "https://id-preview--d2127126-79b5-4329-9bbf-46c900eb564d.lovable.app";

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