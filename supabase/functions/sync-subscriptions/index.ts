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

// Stripe timestamps can be missing or null (e.g. paused/incomplete subs).
// `new Date(undefined * 1000).toISOString()` throws "Invalid time value" and
// used to abort the whole run, which is how Rico's row silently never synced.
function safeISODate(epochSeconds: unknown): string | undefined {
  const n = typeof epochSeconds === "number" ? epochSeconds : Number(epochSeconds);
  if (!n || !isFinite(n)) return undefined;
  const d = new Date(n * 1000);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function hasPrepaidCoverage(sub: { paid_through?: string | null }): boolean {
  return !!sub.paid_through && new Date(sub.paid_through).getTime() > Date.now();
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
    // platform_admin. Otherwise (cron path) require the shared CRON_SECRET
    // header — without this, any caller with the public anon apikey could
    // trigger full Stripe reconciliation.
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
    } else {
      const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
      const incomingSecret = req.headers.get("x-cron-secret") ?? "";
      if (!cronSecret || incomingSecret !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    // Reconcile EVERY paid row against Stripe — not just stale ones. Otherwise
    // a sub whose payment was cancelled mid-period (period_end still in the
    // future, or NULL) is never caught and MRR stays inflated.
    const MAX_ROWS = 500;
    // Starter / starter_paid are retired free tiers — they have no Stripe
    // subscription to reconcile against, so skip them entirely.
    const { data: staleSubscriptions, error: fetchError } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, stripe_customer_id, business_id, tier, status, current_period_end, updated_at, paid_through")
      .in("status", ["active", "trialing", "past_due"])
      .not("tier", "in", "(starter,starter_paid)")
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
      console.log("No subscriptions to reconcile");
      await supabase.from("sync_subscription_runs").insert({
        triggered_by: triggeredBy,
        triggered_by_user: triggeredByUser,
        duration_ms: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({ synced: 0, downgraded: 0, renewed: 0, repointed: 0, message: "No subscriptions to reconcile" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${staleSubscriptions.length} stale subscription(s) to sync`);

    let synced = 0;
    let downgraded = 0;
    let renewed = 0;
    let repointed = 0;
    let skippedPaidThrough = 0;
    const errors: string[] = [];

    const logAudit = async (
      businessId: string | null,
      action: "renewed" | "downgraded" | "repointed" | "skipped_paid_through",

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
        const repointPatch: Record<string, unknown> = {
          stripe_subscription_id: liveSub.id,
          tier: newTier,
          status: "active",
          cancelled_at: null,
          updated_at: new Date().toISOString(),
        };
        const rps = safeISODate(liveSub.current_period_start);
        const rpe = safeISODate(liveSub.current_period_end);
        if (rps) repointPatch.current_period_start = rps;
        if (rpe) repointPatch.current_period_end = rpe;

        await supabase
          .from("subscriptions")
          .update(repointPatch)
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
        // HARD GUARD: prepaid coverage outranks every Stripe signal. A customer
        // who has paid ahead is never downgraded by reconciliation.
        if (hasPrepaidCoverage(sub)) {
          skippedPaidThrough++;
          await logAudit(sub.business_id, "skipped_paid_through", {
            subscription_row_id: sub.id,
            paid_through: sub.paid_through,
            tier: sub.tier,
          });
          console.log(`[paid-through] Skipping ${sub.id} — covered until ${sub.paid_through}`);
          continue;
        }

        if (!sub.stripe_subscription_id) {
          if (await tryRepointFromCustomer(sub)) {
            repointed++;
            synced++;
            continue;
          }
          // No Stripe subscription and no live sibling: mark the row cancelled
          // but KEEP the tier. Revoking paid features requires a real failed
          // charge, handled by the invoice.payment_failed webhook path.
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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
              .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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
          const newPeriodEnd = safeISODate(stripeSub.current_period_end);
          const newPeriodStart = safeISODate(stripeSub.current_period_start);
          const renewPatch: Record<string, unknown> = {};
          if (newPeriodEnd) renewPatch.current_period_end = newPeriodEnd;
          if (newPeriodStart) renewPatch.current_period_start = newPeriodStart;

          if (Object.keys(renewPatch).length === 0) {
            console.log(`[renew] ${sub.id}: Stripe returned no usable period timestamps, skipping`);
            continue;
          }

          const { error: updateError } = await supabase
            .from("subscriptions")
            .update(renewPatch)
            .eq("id", sub.id);

          if (updateError) {
            errors.push(`Failed to renew ${sub.id}: ${updateError.message}`);
          } else {
            renewed++;
            synced++;
            await logAudit(sub.business_id, "renewed", {
              stripe_subscription_id: sub.stripe_subscription_id,
              new_period_end: newPeriodEnd ?? null,
            });
            console.log(`Renewed sub ${sub.id}, new period end: ${newPeriodEnd}`);
          }
        } else if (stripeSub.status === "past_due") {

          // GUARD: before mirroring past_due, look for an active sibling on
          // the same customer. If one exists, our row is tracking a stale sub
          // (typical after a broken upgrade) — repoint instead of marking
          // the customer past_due. This is exactly Rico's July 2026 case.
          if (await tryRepointFromCustomer(sub)) {
            repointed++;
            synced++;
            continue;
          }
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

          // Revoking access on a non-voluntary status requires evidence of a
          // genuine failed charge on THIS subscription. Reaching the end of a
          // prepaid/credited window is never grounds for a downgrade.
          if (stripeSub.status !== "canceled") {
            let hadFailedCharge = false;
            try {
              const invResp = await fetch(
                `https://api.stripe.com/v1/invoices?subscription=${sub.stripe_subscription_id}&limit=10`,
                { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
              );
              if (invResp.ok) {
                const invList = await invResp.json();
                hadFailedCharge = (invList?.data || []).some(
                  (inv: any) =>
                    (inv.status === "open" || inv.status === "uncollectible") &&
                    (inv.attempted === true || (inv.attempt_count ?? 0) > 0),
                );
              } else {
                console.log(`[downgrade-guard] invoice lookup failed for ${sub.id}: ${invResp.status}`);
                errors.push(`Invoice lookup failed for ${sub.id}: ${invResp.status}`);
                continue;
              }
            } catch (invErr) {
              errors.push(`Invoice lookup error for ${sub.id}: ${(invErr as Error).message}`);
              continue;
            }
            if (!hadFailedCharge) {
              await logAudit(sub.business_id, "skipped_paid_through", {
                reason: "no_failed_charge_yet",
                stripe_status: stripeSub.status,
                stripe_subscription_id: sub.stripe_subscription_id,
              });
              console.log(`[downgrade-guard] ${sub.id}: status ${stripeSub.status} but no failed charge — keeping access`);
              continue;
            }
          }

          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
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

            if (sub.tier !== "starter" && sub.tier !== "starter_paid") {
              try {
                const { data: bizRow } = await supabase
                  .from("businesses").select("name").eq("id", sub.business_id).maybeSingle();
                await supabase.rpc("notify_admin_paid_downgrade", {
                  _subscription_id: sub.id,
                  _business_name: bizRow?.name ?? null,
                  _previous_tier: sub.tier,
                  _reason: `Reconciliation: Stripe status "${stripeSub.status}" with a failed charge and no live replacement`,
                });
              } catch (notifyErr) {
                console.error("[sync] admin notify failed:", (notifyErr as Error).message);
              }
            }
          }
        }
      } catch (err) {
        // Per-row isolation: one bad row must never abort the whole run.
        console.error(`[sync] row ${sub.id} failed:`, (err as Error).message);
        errors.push(`Exception processing ${sub.id}: ${(err as Error).message}`);
      }
    }


    const result = {
      synced,
      downgraded,
      renewed,
      repointed,
      skipped_paid_through: skippedPaidThrough,
      errors: errors.length > 0 ? errors : undefined,
    };


    console.log("Sync complete:", JSON.stringify(result));

    await supabase.from("sync_subscription_runs").insert({
      triggered_by: triggeredBy,
      triggered_by_user: triggeredByUser,
      synced,
      downgraded,
      renewed,
      repointed,
      errors: errors.length > 0 ? errors : null,
      duration_ms: Date.now() - startedAt,
    });

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
