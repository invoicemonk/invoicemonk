import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  hasPrepaidCoverage,
  pickLiveSibling,
  safeISODate,
  tierFromStripeSub,
} from "./coverage.ts";

const NOW = Date.parse("2026-09-01T00:00:00Z");

Deno.test("prepaid coverage in the future protects the row from reconciliation", () => {
  assertEquals(hasPrepaidCoverage({ paid_through: "2026-09-30T00:00:00Z" }, NOW), true);
});

Deno.test("prepaid coverage in the past no longer protects the row", () => {
  assertEquals(hasPrepaidCoverage({ paid_through: "2026-08-01T00:00:00Z" }, NOW), false);
});

Deno.test("missing or malformed paid_through never protects the row", () => {
  assertEquals(hasPrepaidCoverage({ paid_through: null }, NOW), false);
  assertEquals(hasPrepaidCoverage({}, NOW), false);
  assertEquals(hasPrepaidCoverage({ paid_through: "not-a-date" }, NOW), false);
});

Deno.test("past_due row repoints to a live sibling instead of downgrading", () => {
  const sibling = pickLiveSibling(
    [
      { id: "sub_old", status: "canceled" },
      { id: "sub_new", status: "active" },
    ],
    "sub_old",
  );
  assertEquals(sibling?.id, "sub_new");
});

Deno.test("a past_due sibling still counts as live (Stripe retry grace)", () => {
  const sibling = pickLiveSibling([{ id: "sub_b", status: "past_due" }], "sub_a");
  assertEquals(sibling?.id, "sub_b");
});

Deno.test("no live sibling means no repoint target", () => {
  assertEquals(
    pickLiveSibling([{ id: "sub_b", status: "canceled" }], "sub_a"),
    undefined,
  );
});

Deno.test("missing Stripe period timestamps never throw Invalid time value", () => {
  assertEquals(safeISODate(undefined), undefined);
  assertEquals(safeISODate(null), undefined);
  assertEquals(safeISODate(0), undefined);
  assertEquals(safeISODate("nonsense"), undefined);
  assertEquals(safeISODate(1_790_000_000), new Date(1_790_000_000 * 1000).toISOString());
});

Deno.test("tier falls back to professional when Stripe metadata is absent or bogus", () => {
  assertEquals(tierFromStripeSub({ metadata: { tier: "business" } }), "business");
  assertEquals(tierFromStripeSub({ metadata: {} }), "professional");
  assertEquals(tierFromStripeSub({ metadata: { tier: "gold" } }), "professional");
  assertEquals(tierFromStripeSub(null), "professional");
});
