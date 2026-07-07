import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/validation.ts";
import { initSentry, captureException } from "../_shared/sentry.ts";
initSentry();

interface PaymentRow {
  id: string;
  number: string | null;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  currency: string;
  status: string;
  description: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  receipt_url: string | null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Collect Stripe customer IDs for this user
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const customerIds = new Set<string>();

    // 1. From subscriptions owned by user
    const { data: userSubs } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id);
    userSubs?.forEach((s: any) => s.stripe_customer_id && customerIds.add(s.stripe_customer_id));

    // 2. From subscriptions of businesses the user is a member of
    const { data: memberships } = await admin
      .from("business_members")
      .select("business_id")
      .eq("user_id", user.id);
    const businessIds = (memberships ?? []).map((m: any) => m.business_id).filter(Boolean);
    if (businessIds.length > 0) {
      const { data: bizSubs } = await admin
        .from("subscriptions")
        .select("stripe_customer_id")
        .in("business_id", businessIds);
      bizSubs?.forEach((s: any) => s.stripe_customer_id && customerIds.add(s.stripe_customer_id));
    }

    // 3. Fallback: Stripe customers matching auth email
    if (user.email) {
      try {
        const found = await stripe.customers.list({ email: user.email, limit: 5 });
        found.data.forEach((c) => customerIds.add(c.id));
      } catch (e) {
        console.warn("Stripe customer email lookup failed:", (e as Error).message);
      }
    }

    if (customerIds.size === 0) {
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const rows: PaymentRow[] = [];
    for (const customerId of customerIds) {
      try {
        const invoices = await stripe.invoices.list({
          customer: customerId,
          limit: 100,
          expand: ["data.charge"],
        });
        for (const inv of invoices.data) {
          const charge: any = (inv as any).charge;
          const line = inv.lines?.data?.[0];
          const description =
            inv.description ||
            line?.description ||
            (line?.price as any)?.nickname ||
            "Subscription";
          rows.push({
            id: inv.id,
            number: inv.number,
            created_at: new Date(inv.created * 1000).toISOString(),
            period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
            period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
            amount: (inv.amount_paid || inv.amount_due || 0) / 100,
            currency: (inv.currency || "usd").toUpperCase(),
            status: inv.status || "unknown",
            description,
            hosted_invoice_url: inv.hosted_invoice_url ?? null,
            invoice_pdf: inv.invoice_pdf ?? null,
            receipt_url: charge && typeof charge === "object" ? charge.receipt_url ?? null : null,
          });
        }
      } catch (e) {
        console.error(`Failed to list invoices for ${customerId}:`, (e as Error).message);
        captureException(e, { function_name: "list-stripe-payments", customerId });
      }
    }

    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({ payments: rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("list-stripe-payments error:", msg);
    captureException(error, { function_name: "list-stripe-payments" });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
