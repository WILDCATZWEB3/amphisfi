/**
 * Leaderboard / explore eligibility.
 * Unavailable metrics are never treated as zero.
 * Incomplete indexing or insufficient price coverage excludes the wallet.
 */

export type EligibilityInput = {
  syncStatus: string;
  backfillComplete: boolean;
  performanceReady: boolean;
  dataCompleteness: string;
  tradeCount: number;
  pricedTradeCount: number;
  /** False when the ranking metric itself is null/undefined. */
  metricAvailable: boolean;
};

export type EligibilityResult = {
  eligible: boolean;
  reason: string | null;
};

export const MIN_PRICED_TRADES = 3;

export function isLeaderboardEligible(input: EligibilityInput): EligibilityResult {
  if (!input.metricAvailable) {
    return { eligible: false, reason: "Metric unavailable (not treated as zero)." };
  }
  if (input.syncStatus === "never_synced" || input.syncStatus === "failed") {
    return { eligible: false, reason: `Indexing incomplete (sync_status=${input.syncStatus}).` };
  }
  if (!input.backfillComplete && input.syncStatus !== "synced" && input.syncStatus !== "idle") {
    return { eligible: false, reason: "Indexing incomplete (backfill not complete)." };
  }
  if (input.dataCompleteness === "insufficient") {
    return { eligible: false, reason: "Insufficient price / trade coverage." };
  }
  if (input.pricedTradeCount < MIN_PRICED_TRADES) {
    return {
      eligible: false,
      reason: `Need at least ${MIN_PRICED_TRADES} priced trades (have ${input.pricedTradeCount}).`,
    };
  }
  if (!input.performanceReady && input.dataCompleteness !== "complete") {
    return { eligible: false, reason: "Performance not ready and data not complete." };
  }
  return { eligible: true, reason: null };
}

export type RankableRow = {
  walletId: string;
  metric: number | null;
};

/** Stable descending rank; null metrics excluded before calling. Ties keep relative order. */
export function rankByMetricDesc(rows: RankableRow[]): Array<RankableRow & { rank: number }> {
  const sorted = [...rows].sort((a, b) => {
    const am = a.metric ?? Number.NEGATIVE_INFINITY;
    const bm = b.metric ?? Number.NEGATIVE_INFINITY;
    if (bm !== am) return bm - am;
    return a.walletId.localeCompare(b.walletId);
  });
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

export const LEADERBOARD_METHODOLOGY =
  "Rankings use FIFO realized PnL / ROI / win rate / volume from indexed Robinhood Chain swaps only. " +
  `Wallets need complete-enough indexing, performance_ready or complete price coverage, and ≥${MIN_PRICED_TRADES} priced trades. ` +
  "Unavailable values are omitted, never ranked as zero. Prices: DefiLlama at trade time.";
