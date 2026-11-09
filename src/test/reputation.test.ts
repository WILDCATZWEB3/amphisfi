import { describe, expect, test } from "bun:test";

import { computeReputationV1, MIN_CLOSED_PRICED_TRADES } from "../lib/reputation/score";

const ready = {
  performanceReady: true,
  dataCompleteness: "complete",
  tradeCount: 20,
  pricedTradeCount: 20,
  closedTradeCount: MIN_CLOSED_PRICED_TRADES,
  winningTrades: 3,
  losingTrades: 2,
  winRate: 0.6,
  syncStatus: "completed",
};

describe("computeReputationV1", () => {
  test("returns insufficient_data below minimum closed trades", () => {
    const r = computeReputationV1({ ...ready, closedTradeCount: 2, winRate: 0.5 });
    expect(r.status).toBe("insufficient_data");
    expect(r.score).toBeNull();
  });

  test("returns null score when win rate unavailable", () => {
    const r = computeReputationV1({ ...ready, winRate: null });
    expect(r.status).toBe("insufficient_data");
    expect(r.score).toBeNull();
  });

  test("scores ready wallet within 0-100", () => {
    const r = computeReputationV1(ready);
    expect(r.status).toBe("ready");
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThanOrEqual(0);
    expect(r.score!).toBeLessThanOrEqual(100);
    expect(r.version).toBe("v1");
  });
});
