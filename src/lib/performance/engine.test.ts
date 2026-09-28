import { describe, expect, it } from "vitest";

import { runEngine, type EngineTrade } from "./engine";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOK = "TokA";
const TOK2 = "TokB";
let n = 0;
const t = (p: Partial<EngineTrade>): EngineTrade => ({
  id: `t${++n}`, signature: `s${n}`, time: 1000 + n, inputMint: SOL, inputQty: 1, outputMint: TOK, outputQty: 100,
  valueUsd: 100, feeUsd: 0.001, priceSource: "test", ...p,
});
const NOW = 10_000;
const all = (r: ReturnType<typeof runEngine>) => r.metrics.find((m) => m.period === "all_time")!;

describe("FIFO engine", () => {
  it("no trades -> insufficient, no fabricated zeros", () => {
    const m = all(runEngine([], new Map(), NOW));
    expect(m.completeness).toBe("insufficient");
    expect(m.realizedPnlUsd).toBeNull();
    expect(m.winRate).toBeNull();
    expect(m.volumeUsd).toBeNull();
  });

  it("multiple buys + partial sell uses FIFO", () => {
    const r = runEngine([
      t({ outputQty: 100, valueUsd: 100 }), // 1.00/token
      t({ outputQty: 100, valueUsd: 200 }), // 2.00/token
      t({ inputMint: TOK, inputQty: 150, outputMint: SOL, outputQty: 3, valueUsd: 300 }),
    ], new Map([[TOK, 3]]), NOW);
    // cost of 150 = 100*1 + 50*2 = 200; proceeds 300 -> +100
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.pnlUsd).toBeCloseTo(100);
    const m = all(r);
    expect(m.realizedPnlUsd).toBeCloseTo(100);
    // remaining 50 @ cost 100, price 3 -> +50
    expect(m.unrealizedPnlUsd).toBeCloseTo(50);
    expect(m.winRate).toBe(1);
    expect(m.completeness).toBe("verified");
  });

  it("sell without prior buy -> partial, no PnL", () => {
    const m = all(runEngine([t({ inputMint: TOK, inputQty: 10, outputMint: USDC, outputQty: 5, valueUsd: 5 })], new Map(), NOW));
    expect(m.realizedPnlUsd).toBeNull();
    expect(m.completeness).toBe("partial");
  });

  it("unpriced buy blocks PnL on later sell", () => {
    const m = all(runEngine([
      t({ valueUsd: null }),
      t({ inputMint: TOK, inputQty: 100, outputMint: SOL, outputQty: 2, valueUsd: 200 }),
    ], new Map(), NOW));
    expect(m.realizedPnlUsd).toBeNull();
    expect(m.completeness).toBe("partial");
  });

  it("token-to-token swap disposes one and acquires the other", () => {
    const r = runEngine([
      t({ outputMint: TOK, outputQty: 10, valueUsd: 50 }),
      t({ inputMint: TOK, inputQty: 10, outputMint: TOK2, outputQty: 1, valueUsd: 40 }),
    ], new Map([[TOK2, 60]]), NOW);
    const m = all(r);
    expect(m.realizedPnlUsd).toBeCloseTo(-10);
    expect(m.losingTrades).toBe(1);
    expect(m.unrealizedPnlUsd).toBeCloseTo(20);
  });

  it("open position without current price -> unrealized unavailable", () => {
    const m = all(runEngine([t({})], new Map(), NOW));
    expect(m.unrealizedPnlUsd).toBeNull();
    expect(m.completeness).toBe("partial");
  });

  it("periods use trade timestamps", () => {
    const r = runEngine([
      t({ time: NOW - 40 * 86400 }),
      t({ time: NOW - 1 * 86400, inputMint: TOK, inputQty: 100, outputMint: SOL, outputQty: 2, valueUsd: 150 }),
    ], new Map(), NOW);
    const d7 = r.metrics.find((m) => m.period === "7d")!;
    expect(d7.tradeCount).toBe(1);
    expect(d7.realizedPnlUsd).toBeCloseTo(50);
  });

  it("is deterministic regardless of input order", () => {
    const a = [t({}), t({ inputMint: TOK, inputQty: 50, outputMint: SOL, outputQty: 1, valueUsd: 80 })];
    const r1 = runEngine(a, new Map(), NOW);
    const r2 = runEngine([...a].reverse(), new Map(), NOW);
    expect(r1.metrics).toEqual(r2.metrics);
  });
});
