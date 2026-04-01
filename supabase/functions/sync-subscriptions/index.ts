import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Find subscriptions that are still 'active' but past their period end + 3-day grace
    const graceCutoff = new Date();
    graceCutoff.setDate(graceCutoff.getDate() - 3);

    const { data: staleSubscriptions, error: fetchError } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, business_id, tier, current_period_end")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .lt("current_period_end", graceCutoff.toISOString())
      .neq("tier", "starter"); // Don't touch free-tier subs

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
    const errors: string[] = [];

    for (const sub of staleSubscriptions) {
      try {
        if (!sub.stripe_subscription_id) {
          // No Stripe ID — downgrade directly
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              tier: "starter",
              status: "cancelled",
            })
            .eq("id", sub.id);

          if (updateError) {
            errors.push(`Failed to downgrade ${sub.id}: ${updateError.message}`);
          } else {
            downgraded++;
            synced++;
            console.log(`Downgraded sub ${sub.id} (no Stripe ID)`);
          }
          continue;
        }

        // Check Stripe for actual status
        const stripeResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`,
          {
            headers: {
              Authorization: `Bearer ${stripeSecretKey}`,
            },
          }
        );

        if (!stripeResponse.ok) {
          if (stripeResponse.status === 404) {
            // Subscription doesn't exist in Stripe — downgrade
            const { error: updateError } = await supabase
              .from("subscriptions")
              .update({
                tier: "starter",
                status: "cancelled",
              })
              .eq("id", sub.id);

            if (updateError) {
              errors.push(`Failed to downgrade ${sub.id}: ${updateError.message}`);
            } else {
              downgraded++;
              synced++;
              console.log(`Downgraded sub ${sub.id} (not found in Stripe)`);
            }
          } else {
            errors.push(`Stripe API error for ${sub.id}: ${stripeResponse.status}`);
          }
          continue;
        }

        const stripeSub = await stripeResponse.json();

        if (stripeSub.status === "active" || stripeSub.status === "trialing") {
          // Stripe says active — update period end
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
            console.log(`Renewed sub ${sub.id}, new period end: ${newPeriodEnd}`);
          }
        } else {
          // Stripe says cancelled/past_due/etc — downgrade
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              tier: "starter",
              status: stripeSub.status === "past_due" ? "past_due" : "cancelled",
            })
            .eq("id", sub.id);

          if (updateError) {
            errors.push(`Failed to downgrade ${sub.id}: ${updateError.message}`);
          } else {
            downgraded++;
            synced++;
            console.log(`Downgraded sub ${sub.id} (Stripe status: ${stripeSub.status})`);
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
