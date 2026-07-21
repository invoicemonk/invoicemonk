// revenuecat-webhook — receives RevenueCat purchase/renewal events from the
// mobile app (iOS / Android in-app purchases) and reconciles them with the
// public.subscriptions table.
//
// Contract:
//   POST /functions/v1/revenuecat-webhook
//   Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>  (RevenueCat "Authorization header")
//   Body: RevenueCat webhook payload (see https://www.revenuecat.com/docs/webhooks)
//
// verify_jwt is false — RevenueCat authenticates via the shared secret header.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Map a RevenueCat product identifier to an Invoicemonk tier.
// Add SKUs here as the mobile app registers them in the App Store / Play Store.
function tierFromProduct(productId: string | null | undefined): string {
  if (!productId) return 'starter_paid';
  const p = productId.toLowerCase();
  if (p.includes('business')) return 'business';
  if (p.includes('professional') || p.includes('pro')) return 'professional';
  return 'starter_paid';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // Shared-secret auth (RevenueCat "Authorization header")
  const auth = req.headers.get('Authorization') ?? '';
  const provided = auth.replace(/^Bearer\s+/i, '');
  if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
    return json(401, { error: 'Invalid webhook secret' });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const event = payload?.event;
  if (!event) return json(400, { error: 'Missing event' });

  const type: string = event.type ?? '';
  const appUserId: string | null = event.app_user_id ?? null;
  const productId: string | null = event.product_id ?? null;
  const store: string | null = (event.store ?? '').toString().toLowerCase() || null; // "app_store" | "play_store"
  const expirationMs: number | null =
    typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null;
  const periodType: string | null = event.period_type ?? null; // NORMAL, TRIAL, INTRO

  if (!appUserId) return json(400, { error: 'Missing app_user_id' });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // app_user_id from RN is the Supabase auth user id. Resolve to their oldest
  // owned business — mobile assumption in BACKEND_CONTRACT.md.
  const { data: userRow } = await admin.auth.admin.getUserById(appUserId).catch(() => ({ data: null }));
  if (!userRow?.user) return json(404, { error: 'User not found' });
  const userId = userRow.user.id;

  // Strict owner-scoping: only businesses the buyer OWNS may be upgraded by
  // their in-app purchase. Staff/members must never flip a tier on a business
  // they don't own. Tiebreak: oldest owned business by created_at.
  const { data: ownedMemberships } = await admin
    .from('business_members')
    .select('business_id, created_at')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .order('created_at', { ascending: true });

  const ownedCount = ownedMemberships?.length ?? 0;
  const businessId = ownedCount > 0 ? ownedMemberships![0].business_id : null;

  if (ownedCount === 0) {
    // No owned business — do not attach the subscription to a membership-only
    // business. Log and return 202 so RevenueCat doesn't retry forever.
    console.warn(
      `revenuecat-webhook SUBSCRIPTION_UNASSIGNED user=${userId} type=${type} product=${productId} — no owned business`
    );
    return json(202, { ok: true, unassigned: true, reason: 'no_owned_business' });
  }

  if (ownedCount > 1) {
    console.warn(
      `revenuecat-webhook SUBSCRIPTION_AMBIGUOUS user=${userId} owned=${ownedCount} chosen=${businessId} — using oldest owned business`
    );
  }

  const tier = tierFromProduct(productId);
  const currentPeriodEnd = expirationMs ? new Date(expirationMs).toISOString() : null;

  // CANCELLATION / EXPIRATION events → mark past_due / cancelled but preserve
  // paid access until expiration.
  const isCancel = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'].includes(type);
  const isActive = [
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
    'NON_RENEWING_PURCHASE',
    'TRIAL_STARTED',
    'TRIAL_CONVERTED',
  ].includes(type);

  const status = isCancel
    ? (type === 'BILLING_ISSUE' ? 'past_due' : 'canceled')
    : isActive
      ? (periodType === 'TRIAL' ? 'trialing' : 'active')
      : 'active';

  // Upsert by (user_id, revenuecat_app_user_id) — one mobile subscription per user.
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('revenuecat_app_user_id', appUserId)
    .maybeSingle();

  const row = {
    user_id: userId,
    business_id: businessId,
    tier,
    status,
    revenuecat_app_user_id: appUserId,
    revenuecat_product_id: productId,
    store,
    current_period_end: currentPeriodEnd,
  };

  if (existing?.id) {
    await admin.from('subscriptions').update(row).eq('id', existing.id);
  } else {
    await admin.from('subscriptions').insert(row);
  }

  console.log(`revenuecat-webhook ${type} user=${userId} tier=${tier} status=${status}`);
  return json(200, { ok: true });
});
