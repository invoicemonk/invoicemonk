// Pure helpers shared by the reconciliation loop and its regression tests.

export const TIER_ORDER: Record<string, number> = {
  starter: 0,
  starter_paid: 1,
  professional: 2,
  business: 3,
};

export function tierFromStripeSub(stripeSub: any): string {
  const t = stripeSub?.metadata?.tier;
  if (typeof t === "string" && TIER_ORDER[t] !== undefined) return t;
  return "professional";
}

// Stripe timestamps can be missing or null (e.g. paused/incomplete subs).
// `new Date(undefined * 1000).toISOString()` throws "Invalid time value" and
// used to abort the whole run, which is how Rico's row silently never synced.
export function safeISODate(epochSeconds: unknown): string | undefined {
  const n = typeof epochSeconds === "number" ? epochSeconds : Number(epochSeconds);
  if (!n || !isFinite(n)) return undefined;
  const d = new Date(n * 1000);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function hasPrepaidCoverage(
  sub: { paid_through?: string | null },
  now: number = Date.now(),
): boolean {
  if (!sub.paid_through) return false;
  const t = new Date(sub.paid_through).getTime();
  return !isNaN(t) && t > now;
}

const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function pickLiveSibling<T extends { id: string; status: string }>(
  siblings: T[],
  excludeId?: string | null,
): T | undefined {
  return siblings.find((s) => s.id !== excludeId && LIVE_STATUSES.has(s.status));
}
