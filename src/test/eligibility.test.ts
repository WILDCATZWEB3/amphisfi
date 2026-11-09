import { describe, expect, test } from "bun:test";

import {
  isLeaderboardEligible,
  rankByMetricDesc,
  MIN_PRICED_TRADES,
} from "../lib/discovery/eligibility";

const base = {
  syncStatus: "synced",
  backfillComplete: true,
  performanceReady: true,
  dataCompleteness: "complete",
  tradeCount: 10,
  pricedTradeCount: MIN_PRICED_TRADES,
  metricAvailable: true,
};

describe("isLeaderboardEligible", () => {
  test("accepts ready wallet with priced trades and available metric", () => {
    expect(isLeaderboardEligible(base).eligible).toBe(true);
  });

  test("rejects unavailable metric", () => {
    const r = isLeaderboardEligible({ ...base, metricAvailable: false });
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("unavailable");
  });

  test("rejects insufficient priced trades", () => {
    const r = isLeaderboardEligible({ ...base, pricedTradeCount: 1 });
    expect(r.eligible).toBe(false);
  });

  test("rejects insufficient completeness", () => {
    const r = isLeaderboardEligible({
      ...base,
      dataCompleteness: "insufficient",
      performanceReady: false,
    });
    expect(r.eligible).toBe(false);
  });

  test("rejects never_synced", () => {
    const r = isLeaderboardEligible({ ...base, syncStatus: "never_synced" });
    expect(r.eligible).toBe(false);
  });
});

describe("rankByMetricDesc", () => {
  test("ranks higher metrics first with stable wallet tie-break", () => {
    const ranked = rankByMetricDesc([
      { walletId: "b", metric: 10 },
      { walletId: "a", metric: 20 },
      { walletId: "c", metric: 10 },
    ]);
    expect(ranked.map((r) => r.walletId)).toEqual(["a", "b", "c"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});
