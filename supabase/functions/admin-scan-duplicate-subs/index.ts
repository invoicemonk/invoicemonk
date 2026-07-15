// Admin-only, READ-ONLY scan for potential duplicate Stripe subscriptions.
// Surfaces:
//   1) Customers with >1 non-canceled Stripe subscription
//   2) Pairs of paid invoices with identical amount+currency on the same
//      customer within 10 minutes, over the last N days (default 90)
// Does NOT mutate anything.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id, _role: "platform_admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2023-10-16" });
    const body = await req.json().catch(() => ({}));
    const daysBack: number = Math.min(365, Math.max(1, Number(body?.days_back) || 90));

    // Collect customer ids from our DB
    const { data: subs } = await admin
      .from("subscriptions")
      .select("stripe_customer_id, business_id, user_id")
      .not("stripe_customer_id", "is", null);
    const customerMap = new Map<string, { business_id: string | null; user_id: string | null }>();
    for (const s of subs ?? []) {
      const cid = s.stripe_customer_id as string;
      if (!customerMap.has(cid)) customerMap.set(cid, { business_id: s.business_id, user_id: s.user_id });
    }

    const multipleActive: unknown[] = [];
    const duplicatePayments: unknown[] = [];
    const since = Math.floor(Date.now() / 1000) - daysBack * 86400;

    for (const [customerId, meta] of customerMap.entries()) {
      // 1) Multiple non-canceled subs
      try {
        const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
        const live = list.data.filter((s) => s.status === "active" || s.status === "trialing" || s.status === "past_due");
        if (live.length > 1) {
          multipleActive.push({
            customer_id: customerId,
            ...meta,
            subs: live.map((s) => ({ id: s.id, status: s.status, price: s.items.data[0]?.price?.id, amount: s.items.data[0]?.price?.unit_amount })),
          });
        }
      } catch (_) { /* ignore per-customer errors */ }

      // 2) Duplicate paid invoices within 10 min
      try {
        const inv = await stripe.invoices.list({ customer: customerId, limit: 50, created: { gte: since } });
        const paid = inv.data
          .filter((i) => i.status === "paid" && (i.amount_paid ?? 0) > 0)
          .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
        for (let i = 0; i < paid.length - 1; i++) {
          for (let j = i + 1; j < paid.length; j++) {
            const a = paid[i], b = paid[j];
            if ((b.created ?? 0) - (a.created ?? 0) > 600) break;
            if (a.amount_paid === b.amount_paid && a.currency === b.currency) {
              duplicatePayments.push({
                customer_id: customerId,
                ...meta,
                amount: a.amount_paid,
                currency: a.currency,
                invoices: [
                  { id: a.id, number: a.number, created: a.created, sub: a.subscription },
                  { id: b.id, number: b.number, created: b.created, sub: b.subscription },
                ],
              });
            }
          }
        }
      } catch (_) { /* ignore */ }
    }

    return new Response(
      JSON.stringify({
        scanned_customers: customerMap.size,
        days_back: daysBack,
        multiple_active_subscriptions: multipleActive,
        duplicate_payments_within_10min: duplicatePayments,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
