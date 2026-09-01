// Pure decision logic for `customer.subscription.deleted`.
//
// Kept side-effect free so it can be unit tested: index.ts feeds it what it
// read (the tracked row, the sibling list or the lookup failure) and performs
// the writes for the outcome it returns.

export type DeletionOutcome =
  | "ignored_untracked"
  | "ignored_duplicate"
  | "repointed"
  | "blocked_by_paid_through"
  | "downgraded_terminal"
  | "error";

export interface TrackedRow {
  id: string;
  business_id: string | null;
  tier: string;
  status: string;
  paid_through: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface SiblingSub {
  id: string;
  status: string;
  current_period_start?: number | null;
  current_period_end?: number | null;
}

export interface DeletionInput {
  incomingSubscriptionId: string;
  /** The local row whose stripe_subscription_id === incomingSubscriptionId, if any. */
  trackedRow: TrackedRow | null;
  /** Whether any local row exists for the same Stripe customer (only used when untracked). */
  customerHasOtherRows?: boolean;
  /** Stripe siblings for the same customer, or null when the lookup failed. */
  siblings?: SiblingSub[] | null;
  siblingLookupFailed?: boolean;
  now?: number;
}

export interface DeletionDecision {
  outcome: DeletionOutcome;
  reason: string;
  /** Set for `repointed`. */
  repointTo?: SiblingSub;
  /** True only when the caller should cancel + downgrade the tracked row. */
  downgrade: boolean;
  notifyAdmin: boolean;
}

const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function decideDeletionOutcome(input: DeletionInput): DeletionDecision {
  const now = input.now ?? Date.now();

  if (!input.trackedRow) {
    return {
      outcome: input.customerHasOtherRows ? "ignored_duplicate" : "ignored_untracked",
      reason: "no_local_row_tracks_this_subscription",
      downgrade: false,
      notifyAdmin: false,
    };
  }

  const row = input.trackedRow;

  if (row.paid_through && new Date(row.paid_through).getTime() > now) {
    return {
      outcome: "blocked_by_paid_through",
      reason: "prepaid_coverage_active",
      downgrade: false,
      notifyAdmin: false,
    };
  }

  if (input.siblingLookupFailed) {
    // Never downgrade on an inconclusive Stripe lookup.
    return {
      outcome: "error",
      reason: "sibling_lookup_failed",
      downgrade: false,
      notifyAdmin: false,
    };
  }

  const liveSibling = (input.siblings ?? []).find(
    (s) => s.id !== input.incomingSubscriptionId && LIVE_STATUSES.has(s.status),
  );
  if (liveSibling) {
    return {
      outcome: "repointed",
      reason: "live_sibling_subscription_found",
      repointTo: liveSibling,
      downgrade: false,
      notifyAdmin: false,
    };
  }

  return {
    outcome: "downgraded_terminal",
    reason: "tracked_subscription_ended_no_replacement",
    downgrade: true,
    notifyAdmin: row.tier !== "starter" && row.tier !== "starter_paid",
  };
}
