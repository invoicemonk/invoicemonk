// Admin-only reusable Stripe subscription repair tool.
// Actions supported per request (all optional):
//   void_invoice_ids: string[]                          -> stripe.invoices.voidInvoice
//   cancel_subscription_ids: { id: string; reason?: string; metadata?: Record<string,string> }[]
//   extend_subscription: { id: string; trial_end_unix: number; metadata?: Record<string,string> }
//   credit_customer_balance: { customer_id: string; amount_cents: number; currency: string; description: string }
//   update_db_subscription: {
//     id: string;                          // public.subscriptions.id (uuid)
//     stripe_subscription_id?: string;
//     status?: string;
//     tier?: string;
//     current_period_end?: string;         // ISO
//     paid_through?: string;               // ISO — durable "do not downgrade before" date
//     paid_through_reason?: string;        // required whenever paid_through is set
//   }
//   audit: { business_id?: string; user_id?: string; note: string; metadata?: Record<string,unknown> }
//
// Always set paid_through when a repair grants prepaid coverage: Stripe
// trial_end alone is not durable — reconciliation and webhooks only respect
// paid_through, which is what protects the customer from being downgraded.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RepairRequest {
  preset?: string;
  void_invoice_ids?: string[];
  cancel_subscription_ids?: Array<{ id: string; reason?: string; metadata?: Record<string, string> }>;
  extend_subscription?: { id: string; trial_end_unix: number; metadata?: Record<string, string> };
  credit_customer_balance?: { customer_id: string; amount_cents: number; currency: string; description: string };
  update_db_subscription?: {
    id: string;
    stripe_subscription_id?: string;
    status?: string;
    tier?: string;
    current_period_end?: string;
    paid_through?: string;
    paid_through_reason?: string;
  };

  audit?: { business_id?: string; user_id?: string; note: string; metadata?: Record<string, unknown> };
}

// NOTE: the historical "rico_2026_07" preset was removed. It hardcoded a
// one-off July 2026 repair (cancelling specific Stripe subs and voiding an
// invoice) that must never run again, and it granted coverage only through
// Stripe trial_end — which is not durable. Pass explicit actions instead, and
// always include paid_through when granting prepaid coverage.


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

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
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "platform_admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: platform_admin only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
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

    let body: RepairRequest = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    if (body.preset) {
      errors.push(
        `preset "${body.preset}" is no longer supported — pass explicit actions (and paid_through) instead`,
      );
      body = { ...body, preset: undefined };
    }


    // 1. Void invoices
    if (body.void_invoice_ids?.length) {
      const voided: Record<string, string> = {};
      for (const invId of body.void_invoice_ids) {
        try {
          const v = await stripe.invoices.voidInvoice(invId);
          voided[invId] = v.status ?? "voided";
        } catch (e) {
          errors.push(`void ${invId}: ${(e as Error).message}`);
        }
      }
      results.voided_invoices = voided;
    }

    // 2. Cancel subscriptions
    if (body.cancel_subscription_ids?.length) {
      const cancelled: Record<string, string> = {};
      for (const c of body.cancel_subscription_ids) {
        try {
          if (c.metadata && Object.keys(c.metadata).length) {
            await stripe.subscriptions.update(c.id, { metadata: c.metadata });
          }
          const s = await stripe.subscriptions.cancel(c.id, {
            invoice_now: false,
            prorate: false,
          });
          cancelled[c.id] = s.status;
        } catch (e) {
          errors.push(`cancel ${c.id}: ${(e as Error).message}`);
        }
      }
      results.cancelled_subscriptions = cancelled;
    }

    // 3. Extend surviving subscription via trial_end
    if (body.extend_subscription) {
      const ex = body.extend_subscription;
      try {
        const updated = await stripe.subscriptions.update(ex.id, {
          trial_end: ex.trial_end_unix,
          proration_behavior: "none",
          ...(ex.metadata ? { metadata: ex.metadata } : {}),
        });
        results.extended_subscription = {
          id: updated.id,
          status: updated.status,
          trial_end: updated.trial_end,
          current_period_end: updated.current_period_end,
        };
      } catch (e) {
        const msg = (e as Error).message;
        errors.push(`extend ${ex.id}: ${msg}`);
        // Fallback: negative balance transaction
        if (body.credit_customer_balance) {
          try {
            const cb = body.credit_customer_balance;
            const tx = await stripe.customers.createBalanceTransaction(cb.customer_id, {
              amount: cb.amount_cents,
              currency: cb.currency,
              description: cb.description,
            });
            results.credit_balance_transaction = tx.id;
          } catch (e2) {
            errors.push(`credit_balance fallback: ${(e2 as Error).message}`);
          }
        }
      }
    } else if (body.credit_customer_balance) {
      try {
        const cb = body.credit_customer_balance;
        const tx = await stripe.customers.createBalanceTransaction(cb.customer_id, {
          amount: cb.amount_cents,
          currency: cb.currency,
          description: cb.description,
        });
        results.credit_balance_transaction = tx.id;
      } catch (e) {
        errors.push(`credit_balance: ${(e as Error).message}`);
      }
    }

    // 4. Update DB subscription row
    if (body.update_db_subscription) {
      const u = body.update_db_subscription;
      if (u.paid_through && !u.paid_through_reason) {
        errors.push("db update: paid_through requires paid_through_reason");
      } else {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (u.stripe_subscription_id) patch.stripe_subscription_id = u.stripe_subscription_id;
        if (u.status) patch.status = u.status;
        if (u.tier) patch.tier = u.tier;
        if (u.current_period_end) patch.current_period_end = u.current_period_end;
        if (u.paid_through) {
          // Durable credit: this is what actually stops future downgrades.
          patch.paid_through = u.paid_through;
          patch.paid_through_reason = u.paid_through_reason;
          patch.paid_through_granted_by = user.id;
          patch.paid_through_granted_at = new Date().toISOString();
          patch.cancelled_at = null;
        }
        const { data, error } = await admin
          .from("subscriptions")
          .update(patch)
          .eq("id", u.id)
          .select(
            "id, tier, status, stripe_subscription_id, current_period_end, paid_through, paid_through_reason, business_id, user_id",
          )
          .maybeSingle();
        if (error) errors.push(`db update: ${error.message}`);
        else results.db_subscription = data;
      }
    }


    // 5. Audit log
    const auditMeta = {
      action: "manual_repair",
      operator: user.id,
      preset: body.preset ?? null,
      note: body.audit?.note ?? "Stripe subscription repair via admin-repair-stripe-subscription",
      results,
      errors,
      ...(body.audit?.metadata ?? {}),
    };
    try {
      await admin.rpc("log_audit_event", {
        _event_type: "SUBSCRIPTION_CHANGED",
        _entity_type: "subscription",
        _business_id: body.audit?.business_id ?? null,
        _user_id: body.audit?.user_id ?? null,
        _metadata: auditMeta,
      });
    } catch (e) {
      // Fall back to direct insert if the RPC signature doesn't match
      await admin.from("audit_logs").insert({
        user_id: user.id,
        action: "subscription.manual_repair",
        resource_type: "subscription",
        resource_id: body.update_db_subscription?.id ?? null,
        metadata: auditMeta,
      });
    }

    return new Response(JSON.stringify({ ok: errors.length === 0, results, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: errors.length === 0 ? 200 : 207,
    });
  } catch (error) {
    console.error("admin-repair-stripe-subscription error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, results, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
