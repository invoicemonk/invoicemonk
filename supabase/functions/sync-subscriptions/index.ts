import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIER_ORDER: Record<string, number> = { starter: 0, starter_paid: 1, professional: 2, business: 3 };

function tierFromStripeSub(stripeSub: any): string {
  const t = stripeSub?.metadata?.tier;
  if (typeof t === "string" && TIER_ORDER[t] !== undefined) return t;
  return "professional";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // If invoked with a user JWT (admin "Reconcile now" button), require
    // platform_admin. Cron invokes this with apikey only (no Bearer), which
    // remains allowed.
    const authHeader = req.headers.get("Authorization");
    let triggeredBy: "cron" | "admin" = "cron";
    let triggeredByUser: string | null = null;
    const startedAt = Date.now();
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id, _role: "platform_admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      triggeredBy = "admin";
      triggeredByUser = user.id;
    }

    // Reconcile EVERY paid row against Stripe — not just stale ones. Otherwise
    // a sub whose payment was cancelled mid-period (period_end still in the
    // future, or NULL) is never caught and MRR stays inflated.
    const MAX_ROWS = 500;
    const { data: staleSubscriptions, error: fetchError } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, stripe_customer_id, business_id, tier, status, current_period_end, updated_at")
      .in("status", ["active", "past_due"])
      .neq("tier", "starter")
      .order("updated_at", { ascending: true })
      .limit(MAX_ROWS);

    if (fetchError) {
      console.error("Error fetching stale subscriptions:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!staleSubscriptions || staleSubscriptions.length === 0) {
      console.log("No stale subscriptions found");
      return new Response(
        JSON.stringify({ synced: 0, message: "No stale subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${staleSubscriptions.length} stale subscription(s) to sync`);

    let synced = 0;
    let downgraded = 0;
    let renewed = 0;
    let repointed = 0;
    const errors: string[] = [];

    const logAudit = async (
      businessId: string | null,
      action: "renewed" | "downgraded" | "repointed",
      meta: Record<string, unknown>,
    ) => {
      try {
        await supabase.rpc("log_audit_event", {
          _event_type: "SUBSCRIPTION_CHANGED",
          _entity_type: "subscription",
          _business_id: businessId,
          _metadata: { source: "sync-subscriptions", action, ...meta },
        });
      } catch (e) {
        console.error("Failed to write audit log:", (e as Error).message);
      }
    };

    // SAFETY NET: before downgrading, look up sibling subs on the same Stripe
    // customer and repoint to a live one if found. This protects against the
    // class of incidents where a stale checkout webhook has caused the DB to
    // track a long-cancelled sub even though the customer has a live one.
    const tryRepointFromCustomer = async (
      sub: { id: string; business_id: string | null; stripe_customer_id: string | null; stripe_subscription_id: string | null },
    ): Promise<boolean> => {
      if (!sub.stripe_customer_id) return false;
      try {
        const listResp = await fetch(
          `https://api.stripe.com/v1/subscriptions?customer=${sub.stripe_customer_id}&status=all&limit=20`,
          { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
        );
        if (!listResp.ok) {
          console.log(`[repoint] List subs failed for ${sub.stripe_customer_id}: ${listResp.status}`);
          return false;
        }
        const list = await listResp.json();
        const liveSub = (list?.data || []).find(
          (s: any) =>
            (s.status === "active" || s.status === "trialing") &&
            s.id !== sub.stripe_subscription_id,
        );
        if (!liveSub) return false;

        const newTier = tierFromStripeSub(liveSub);
        await supabase
          .from("subscriptions")
          .update({
            stripe_subscription_id: liveSub.id,
            tier: newTier,
            status: "active",
            current_period_start: new Date(liveSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(liveSub.current_period_end * 1000).toISOString(),
            cancelled_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);

        await logAudit(sub.business_id, "repointed", {
          old_stripe_subscription_id: sub.stripe_subscription_id,
          new_stripe_subscription_id: liveSub.id,
          tier: newTier,
        });

        console.log(
          `[repoint] sub row ${sub.id}: ${sub.stripe_subscription_id} -> ${liveSub.id} (tier ${newTier})`,
        );
        return true;
      } catch (e) {
        console.error(`[repoint] error for ${sub.id}:`, (e as Error).message);
        return false;
      }
    };

    for (const sub of staleSubscriptions) {
      try {
        if (!sub.stripe_subscription_id) {
          if (await tryRepointFromCustomer(sub)) {
            repointed++;
            synced++;
            continue;
          }
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({ tier: "starter", status: "cancelled" })
            .eq("id", sub.id);
          if (updateError) {
            errors.push(`Failed to downgrade ${sub.id}: ${updateError.message}`);
          } else {
            downgraded++;
            synced++;
            await logAudit(sub.business_id, "downgraded", {
              reason: "no_stripe_subscription_id_and_no_sibling",
              previous_tier: sub.tier,
            });
            console.log(`Downgraded sub ${sub.id} (no Stripe ID, no sibling)`);
          }
          continue;
        }

        const stripeResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`,
          { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
        );

        if (!stripeResponse.ok) {
          if (stripeResponse.status === 404) {
            if (await tryRepointFromCustomer(sub)) {
              repointed++;
              synced++;
              continue;
            }
            const { error: updateError } = await supabase
              .from("subscriptions")
              .update({ tier: "starter", status: "cancelled" })
              .eq("id", sub.id);
            if (updateError) {
              errors.push(`Failed to downgrade ${sub.id}: ${updateError.message}`);
            } else {
              downgraded++;
              synced++;
              await logAudit(sub.business_id, "downgraded", {
                reason: "stripe_404",
                stripe_subscription_id: sub.stripe_subscription_id,
                previous_tier: sub.tier,
              });
              console.log(`Downgraded sub ${sub.id} (not found in Stripe, no sibling)`);
            }
          } else {
            errors.push(`Stripe API error for ${sub.id}: ${stripeResponse.status}`);
          }
          continue;
        }

        const stripeSub = await stripeResponse.json();

        if (stripeSub.status === "active" || stripeSub.status === "trialing") {
          const newPeriodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              current_period_end: newPeriodEnd,
              current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            })
            .eq("id", sub.id);

          if (updateError) {
            errors.push(`Failed to renew ${sub.id}: ${updateError.message}`);
          } else {
            renewed++;
            synced++;
            await logAudit(sub.business_id, "renewed", {
              stripe_subscription_id: sub.stripe_subscription_id,
              new_period_end: newPeriodEnd,
            });
            console.log(`Renewed sub ${sub.id}, new period end: ${newPeriodEnd}`);
          }
        } else if (stripeSub.status === "past_due") {
          // Keep tier during Stripe's retry grace window; just mirror status.
          if (sub.status !== "past_due") {
            await supabase
              .from("subscriptions")
              .update({ status: "past_due", updated_at: new Date().toISOString() })
              .eq("id", sub.id);
            synced++;
            console.log(`Marked sub ${sub.id} past_due (kept tier ${sub.tier})`);
          }
        } else {
          // canceled | incomplete | incomplete_expired | unpaid | paused
          // For 'incomplete', give Stripe 24h to settle the first payment
          // before downgrading (covers SCA / async confirmations).
          if (stripeSub.status === "incomplete") {
            const createdMs = (stripeSub.created ?? 0) * 1000;
            if (createdMs && Date.now() - createdMs < 24 * 60 * 60 * 1000) {
              continue;
            }
          }

          if (await tryRepointFromCustomer(sub)) {
            repointed++;
            synced++;
            continue;
          }

          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              tier: "starter",
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          if (updateError) {
            errors.push(`Failed to downgrade ${sub.id}: ${updateError.message}`);
          } else {
            downgraded++;
            synced++;

            // Void any pending/locked commissions tied to this subscription.
            const { data: voidedComms } = await supabase
              .from("commissions")
              .update({ status: "voided" as const })
              .eq("subscription_id", sub.id)
              .in("status", ["pending", "locked"])
              .select("id");

            await logAudit(sub.business_id, "downgraded", {
              reason: `stripe_status_${stripeSub.status}`,
              stripe_subscription_id: sub.stripe_subscription_id,
              previous_tier: sub.tier,
              voided_commissions: voidedComms?.length ?? 0,
            });
            console.log(`Downgraded sub ${sub.id} (Stripe status: ${stripeSub.status}, no sibling)`);
          }
        }
      } catch (err) {
        errors.push(`Exception processing ${sub.id}: ${(err as Error).message}`);
      }
    }

    const result = {
      synced,
      downgraded,
      renewed,
      repointed,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Sync complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    captureException(err, { function_name: 'sync-subscriptions' })
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
