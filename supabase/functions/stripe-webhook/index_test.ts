import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decideDeletionOutcome, type TrackedRow } from "./deletion-decision.ts";

const NOW = Date.parse("2026-09-01T00:00:00Z");

function row(overrides: Partial<TrackedRow> = {}): TrackedRow {
  return {
    id: "row-1",
    business_id: "biz-1",
    tier: "professional",
    status: "active",
    paid_through: null,
    stripe_customer_id: "cus_1",
    stripe_subscription_id: "sub_tracked",
    ...overrides,
  };
}

Deno.test("deletion of a stale duplicate is ignored", () => {
  const d = decideDeletionOutcome({
    incomingSubscriptionId: "sub_duplicate",
    trackedRow: null,
    customerHasOtherRows: true,
    now: NOW,
  });
  assertEquals(d.outcome, "ignored_duplicate");
  assertEquals(d.downgrade, false);
});

Deno.test("deletion of a fully untracked subscription is ignored", () => {
  const d = decideDeletionOutcome({
    incomingSubscriptionId: "sub_unknown",
    trackedRow: null,
    customerHasOtherRows: false,
    now: NOW,
  });
  assertEquals(d.outcome, "ignored_untracked");
  assertEquals(d.downgrade, false);
});

Deno.test("deletion while a live sibling exists repoints instead of downgrading", () => {
  const d = decideDeletionOutcome({
    incomingSubscriptionId: "sub_tracked",
    trackedRow: row(),
    siblings: [
      { id: "sub_tracked", status: "canceled" },
      { id: "sub_live", status: "active", current_period_end: 1_790_000_000 },
    ],
    now: NOW,
  });
  assertEquals(d.outcome, "repointed");
  assertEquals(d.repointTo?.id, "sub_live");
  assertEquals(d.downgrade, false);
});

Deno.test("deletion of the tracked terminal subscription downgrades and notifies admin", () => {
  const d = decideDeletionOutcome({
    incomingSubscriptionId: "sub_tracked",
    trackedRow: row(),
    siblings: [{ id: "sub_tracked", status: "canceled" }],
    now: NOW,
  });
  assertEquals(d.outcome, "downgraded_terminal");
  assertEquals(d.downgrade, true);
  assertEquals(d.notifyAdmin, true);
});

Deno.test("prepaid coverage blocks the downgrade", () => {
  const d = decideDeletionOutcome({
    incomingSubscriptionId: "sub_tracked",
    trackedRow: row({ paid_through: "2026-09-07T00:00:00Z" }),
    siblings: [],
    now: NOW,
  });
  assertEquals(d.outcome, "blocked_by_paid_through");
  assertEquals(d.downgrade, false);
});

Deno.test("credit window expiry with no failed charge still downgrades only when terminal", () => {
  // paid_through in the past: coverage no longer protects the row, but the
  // decision must still be driven by the tracked subscription being terminal.
  const expired = decideDeletionOutcome({
    incomingSubscriptionId: "sub_tracked",
    trackedRow: row({ paid_through: "2026-08-01T00:00:00Z" }),
    siblings: [{ id: "sub_live", status: "active" }],
    now: NOW,
  });
  assertEquals(expired.outcome, "repointed");
  assertEquals(expired.downgrade, false);
});

Deno.test("out-of-order delivery for an already-replaced subscription does not downgrade", () => {
  // The row has already been repointed to sub_new; a late deletion event for
  // the old sub_old arrives and must not touch the row.
  const d = decideDeletionOutcome({
    incomingSubscriptionId: "sub_old",
    trackedRow: null,
    customerHasOtherRows: true,
    now: NOW,
  });
  assertEquals(d.outcome, "ignored_duplicate");
  assertEquals(d.downgrade, false);
});

Deno.test("Stripe sibling lookup failure surfaces as an error and never downgrades", () => {
  const d = decideDeletionOutcome({
    incomingSubscriptionId: "sub_tracked",
    trackedRow: row(),
    siblings: null,
    siblingLookupFailed: true,
    now: NOW,
  });
  assertEquals(d.outcome, "error");
  assertEquals(d.reason, "sibling_lookup_failed");
  assertEquals(d.downgrade, false);
});
