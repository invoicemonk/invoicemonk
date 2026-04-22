import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, captureException } from "../_shared/sentry.ts";

initSentry();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZERO_DECIMAL = new Set([
  "JPY","KRW","VND","IDR","CLP","PYG","UGX","RWF","KMF","XOF","XAF","GNF","BIF","DJF","MGA","VUV","XPF",
]);
const THREE_DECIMAL = new Set(["BHD","KWD","OMR","JOD"]);

// Stripe statuses we treat as "live / counts toward revenue"
const STRIPE_LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
// Stripe statuses we treat as definitively dead (never count)
const STRIPE_DEAD_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired", "incomplete"]);

// Fetch FX rate currency -> USD (cached in module scope per warm instance).
const fxCache = new Map<string, number>();
async function fxToUsd(currency: string): Promise<number> {
  const cur = currency.toUpperCase();
  if (cur === "USD") return 1;
  if (fxCache.has(cur)) return fxCache.get(cur)!;
  try {
    const res = await fetch(`https://api.exchangerate.host/latest?base=${cur}&symbols=USD`);
    const json = await res.json();
    const rate = json?.rates?.USD;
    if (typeof rate === "number" && rate > 0) {
      fxCache.set(cur, rate);
      return rate;
    }
  } catch (e) {
    console.warn(`FX lookup failed for ${cur}:`, e);
  }
  const fallback: Record<string, number> = { EUR: 1.08, GBP: 1.27, NGN: 0.00065, CAD: 0.73 };
  const r = fallback[cur] ?? 1;
  fxCache.set(cur, r);
  return r;
}

function normalizeToUsdCents(amountMinor: number, currency: string, rate: number): number {
  const cur = currency.toUpperCase();
  let major: number;
  if (ZERO_DECIMAL.has(cur)) major = amountMinor;
  else if (THREE_DECIMAL.has(cur)) major = amountMinor / 1000;
  else major = amountMinor / 100;
  const usd = major * rate;
  return Math.round(usd * 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "platform_admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const startIso: string = body.startIso;
    const requestedEndIso: string = body.endIso;
    if (!startIso || !requestedEndIso) {
      return new Response(JSON.stringify({ error: "startIso and endIso required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clamp end to "now" so future-dated presets (e.g. endOfMonth) don't include the future.
    const nowIso = new Date().toISOString();
    const effectiveEndIso = requestedEndIso > nowIso ? nowIso : requestedEndIso;

    // Treat the snapshot as "current" if effective end is within ~5 minutes of now.
    const isCurrentSnapshot =
      Math.abs(new Date(effectiveEndIso).getTime() - Date.now()) < 5 * 60 * 1000;

    // Snapshot-as-of-date: subscriptions that existed and were not yet cancelled
    // by `effectiveEndIso`. We include statuses that historically counted as paying
    // (active / past_due / trialing / cancelled — the latter only if cancelled_at
    // is AFTER effectiveEndIso, meaning at snapshot time it was still live).
    const { data: snapshotSubs, error: subsErr } = await admin
      .from("subscriptions")
      .select("id, tier, status, billing_currency, pricing_region, stripe_subscription_id, created_at, cancelled_at")
      .neq("tier", "starter")
      .lte("created_at", effectiveEndIso)
      .in("status", ["active", "past_due", "trialing", "cancelled"])
      .or(`cancelled_at.is.null,cancelled_at.gt.${effectiveEndIso}`);

    if (subsErr) throw subsErr;

    // Pricing fallback table
    const { data: pricingRows } = await admin
      .from("pricing_regions")
      .select("country_code, tier, currency, monthly_price, stripe_price_id_monthly, stripe_price_id_yearly");
    const priceLookup = new Map<string, { monthly: number; currency: string }>();
    (pricingRows || []).forEach((p: any) => {
      priceLookup.set(`${p.country_code}|${p.tier}`, { monthly: p.monthly_price || 0, currency: p.currency });
    });

    type SubResolved = {
      id: string;
      tier: string;
      monthlyUsdCents: number;
      sourceCurrency: string;
      sourceMonthlyMinor: number;
      source: "stripe" | "pricing_regions" | "unresolved";
      stripe_price_id?: string | null;
      stripe_status?: string | null;
    };

    const resolved: SubResolved[] = [];

    // Helper: query Stripe subscription
    async function stripeFetch(sub: any): Promise<{ unit: number; currency: string; interval: string; priceId: string; status: string } | null> {
      if (!stripeSecretKey || !sub.stripe_subscription_id) return null;
      try {
        const r = await fetch(
          `https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}?expand[]=items.data.price`,
          { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
        );
        if (!r.ok) {
          console.warn(`Stripe fetch failed for ${sub.stripe_subscription_id}: ${r.status}`);
          return null;
        }
        const j = await r.json();
        const item = j?.items?.data?.[0];
        const price = item?.price;
        if (!price) return null;
        return {
          unit: price.unit_amount ?? 0,
          currency: (price.currency || "usd").toUpperCase(),
          interval: price.recurring?.interval || "month",
          priceId: price.id,
          status: j?.status || "unknown",
        };
      } catch (e) {
        console.warn("Stripe error:", e);
        return null;
      }
    }

    let excludedAsStaleCount = 0;

    for (const sub of snapshotSubs || []) {
      const stripeData = await stripeFetch(sub);

      // For CURRENT snapshots only, use Stripe as the authority for live state.
      // If Stripe says the sub is dead (canceled/unpaid/etc.), exclude it even if
      // the local DB still has it as 'active' (handles refund/cancellation lag).
      // For HISTORICAL snapshots, do NOT use today's Stripe status to rewrite
      // the past — rely on DB lifecycle (created_at / cancelled_at) instead.
      if (isCurrentSnapshot && stripeData) {
        if (STRIPE_DEAD_STATUSES.has(stripeData.status)) {
          excludedAsStaleCount += 1;
          continue;
        }
        if (!STRIPE_LIVE_STATUSES.has(stripeData.status)) {
          // Unknown/odd status — skip from current revenue to be safe.
          excludedAsStaleCount += 1;
          continue;
        }
      }

      let monthlyMinor = 0;
      let sourceCurrency = (sub.billing_currency || "USD").toUpperCase();
      let source: SubResolved["source"] = "unresolved";
      let priceId: string | null = null;

      if (stripeData) {
        sourceCurrency = stripeData.currency;
        priceId = stripeData.priceId;
        if (stripeData.interval === "year") monthlyMinor = Math.round(stripeData.unit / 12);
        else if (stripeData.interval === "week") monthlyMinor = stripeData.unit * 4;
        else if (stripeData.interval === "day") monthlyMinor = stripeData.unit * 30;
        else monthlyMinor = stripeData.unit;
        source = "stripe";
      } else {
        const key = `${sub.pricing_region || "US"}|${sub.tier}`;
        const fallback = priceLookup.get(key) || priceLookup.get(`US|${sub.tier}`);
        if (fallback) {
          monthlyMinor = fallback.monthly;
          sourceCurrency = (fallback.currency || sourceCurrency).toUpperCase();
          source = "pricing_regions";
        }
      }

      const rate = await fxToUsd(sourceCurrency);
      const usdCents = monthlyMinor > 0 ? normalizeToUsdCents(monthlyMinor, sourceCurrency, rate) : 0;

      resolved.push({
        id: sub.id,
        tier: sub.tier,
        monthlyUsdCents: usdCents,
        sourceCurrency,
        sourceMonthlyMinor: monthlyMinor,
        source,
        stripe_price_id: priceId,
        stripe_status: stripeData?.status ?? null,
      });
    }

    // Aggregate
    let mrrCents = 0;
    const tierAgg: Record<string, { count: number; mrrCents: number }> = {
      professional: { count: 0, mrrCents: 0 },
      business: { count: 0, mrrCents: 0 },
    };
    const priceBuckets = new Map<string, { tier: string; count: number; sourceMonthlyMinor: number; sourceCurrency: string; mrrUsdCents: number }>();

    for (const r of resolved) {
      mrrCents += r.monthlyUsdCents;
      if (tierAgg[r.tier]) {
        tierAgg[r.tier].count += 1;
        tierAgg[r.tier].mrrCents += r.monthlyUsdCents;
      }
      const key = `${r.tier}|${r.sourceMonthlyMinor}|${r.sourceCurrency}`;
      const existing = priceBuckets.get(key);
      if (existing) {
        existing.count += 1;
        existing.mrrUsdCents += r.monthlyUsdCents;
      } else {
        priceBuckets.set(key, {
          tier: r.tier,
          count: 1,
          sourceMonthlyMinor: r.sourceMonthlyMinor,
          sourceCurrency: r.sourceCurrency,
          mrrUsdCents: r.monthlyUsdCents,
        });
      }
    }

    // Movement metrics: range-based counts using effective end.
    const { count: newCount } = await admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startIso)
      .lte("created_at", effectiveEndIso);

    const { count: churnedCount } = await admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .gte("cancelled_at", startIso)
      .lte("cancelled_at", effectiveEndIso);

    const newInPeriod = newCount || 0;
    const churnedInPeriod = churnedCount || 0;

    return new Response(
      JSON.stringify({
        mrrCents,
        arrCents: mrrCents * 12,
        payingCount: resolved.length,
        newInPeriod,
        churnedInPeriod,
        netNew: newInPeriod - churnedInPeriod,
        breakdown: {
          professional: { count: tierAgg.professional.count, mrrCents: tierAgg.professional.mrrCents },
          business: { count: tierAgg.business.count, mrrCents: tierAgg.business.mrrCents },
        },
        priceBuckets: Array.from(priceBuckets.values()).sort((a, b) => b.mrrUsdCents - a.mrrUsdCents),
        currency: "USD",
        snapshotAt: effectiveEndIso,
        isCurrentSnapshot,
        excludedAsStaleCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    captureException(e);
    console.error("admin-revenue-stats error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
