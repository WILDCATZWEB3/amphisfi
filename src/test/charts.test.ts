import { describe, expect, test } from "bun:test";

import {
  buildCumulativePnlSeries,
  buildTradeActivitySeries,
  buildWinLossSummary,
  windowBounds,
} from "../lib/charts/series";

describe("buildCumulativePnlSeries", () => {
  test("returns empty when no points", () => {
    expect(buildCumulativePnlSeries([])).toEqual([]);
  });

  test("accumulates day pnl and marks empty days", () => {
    const series = buildCumulativePnlSeries(
      [
        { disposedAt: "2026-01-01T12:00:00.000Z", pnlUsd: 10, fullyMatched: true },
        { disposedAt: "2026-01-03T12:00:00.000Z", pnlUsd: -4, fullyMatched: true },
      ],
      { fromDay: "2026-01-01", toDay: "2026-01-03" },
    );
    expect(series).toHaveLength(3);
    expect(series[0]).toMatchObject({ cumulativePnlUsd: 10, hasData: true, dayPnlUsd: 10 });
    expect(series[1]).toMatchObject({ cumulativePnlUsd: 10, hasData: false, dayPnlUsd: null });
    expect(series[2]).toMatchObject({ cumulativePnlUsd: 6, hasData: true, dayPnlUsd: -4 });
  });
});

describe("buildTradeActivitySeries", () => {
  test("counts trades per day including zeros", () => {
    const s = buildTradeActivitySeries(
      [
        { blockTime: "2026-02-01T01:00:00.000Z" },
        { blockTime: "2026-02-01T05:00:00.000Z" },
        { blockTime: "2026-02-02T05:00:00.000Z" },
      ],
      { fromDay: "2026-02-01", toDay: "2026-02-02" },
    );
    expect(s.map((x) => x.tradeCount)).toEqual([2, 1]);
  });
});

describe("buildWinLossSummary", () => {
  test("insufficient when empty", () => {
    expect(buildWinLossSummary([]).insufficient).toBe(true);
  });
  test("counts wins and losses", () => {
    const s = buildWinLossSummary([
      { disposedAt: "2026-01-01T00:00:00.000Z", pnlUsd: 1, fullyMatched: true },
      { disposedAt: "2026-01-02T00:00:00.000Z", pnlUsd: -1, fullyMatched: true },
      { disposedAt: "2026-01-03T00:00:00.000Z", pnlUsd: 2, fullyMatched: false },
    ]);
    expect(s).toEqual({ wins: 1, losses: 1, breakeven: 0, insufficient: false });
  });
});

describe("windowBounds", () => {
  test("all has no fromDay", () => {
    expect(windowBounds("all", Date.parse("2026-06-15T00:00:00.000Z")).fromDay).toBeUndefined();
  });
});
