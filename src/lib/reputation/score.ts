/**
 * Amphis reputation v1 — explainable, versioned, not user-editable.
 * Not investment advice. Insufficient history → no numeric score.
 */

export const REPUTATION_VERSION = "v1";

export const REPUTATION_METHODOLOGY =
  "Amphis Reputation v1 weights data completeness, experience (priced closed trades), " +
  "win rate among fully matched FIFO sells, and consistency (priced trade ratio). " +
  "Requires a minimum history. Incomplete indexing or missing prices yield insufficient data. " +
  "Scores are analytics only — not financial advice and not a guarantee of future results.";

export const MIN_CLOSED_PRICED_TRADES = 5;

export type ReputationInput = {
  performanceReady: boolean;
  dataCompleteness: string;
  tradeCount: number;
  pricedTradeCount: number;
  closedTradeCount: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  syncStatus: string;
};

export type ReputationBreakdown = {
  dataCompletenessPoints: number;
  experiencePoints: number;
  winRatePoints: number;
  consistencyPoints: number;
  maxPoints: number;
  notes: string[];
};

export type ReputationResult = {
  version: typeof REPUTATION_VERSION;
  status: "ready" | "insufficient_data";
  score: number | null;
  breakdown: ReputationBreakdown;
  methodology: string;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function computeReputationV1(input: ReputationInput): ReputationResult {
  const notes: string[] = [];
  const maxPoints = 100;

  if (
    input.syncStatus === "never_synced" ||
    input.syncStatus === "failed" ||
    input.dataCompleteness === "insufficient" ||
    input.closedTradeCount < MIN_CLOSED_PRICED_TRADES ||
    input.winRate === null
  ) {
    notes.push(
      input.closedTradeCount < MIN_CLOSED_PRICED_TRADES
        ? `Need at least ${MIN_CLOSED_PRICED_TRADES} fully matched priced closed trades.`
        : "Indexing or price coverage is incomplete, or win rate unavailable.",
    );
    return {
      version: REPUTATION_VERSION,
      status: "insufficient_data",
      score: null,
      breakdown: {
        dataCompletenessPoints: 0,
        experiencePoints: 0,
        winRatePoints: 0,
        consistencyPoints: 0,
        maxPoints,
        notes,
      },
      methodology: REPUTATION_METHODOLOGY,
    };
  }

  const dataCompletenessPoints =
    input.dataCompleteness === "complete" && input.performanceReady
      ? 25
      : input.dataCompleteness === "partial"
        ? 12
        : 0;

  const experiencePoints = clamp(Math.floor((input.closedTradeCount / 40) * 25), 0, 25);

  const winRatePoints = clamp(Math.round((input.winRate ?? 0) * 30), 0, 30);

  const pricedRatio = input.tradeCount > 0 ? input.pricedTradeCount / input.tradeCount : 0;
  const consistencyPoints = clamp(Math.round(pricedRatio * 20), 0, 20);

  if (dataCompletenessPoints < 25) notes.push("Partial data completeness reduces score.");
  if (experiencePoints < 25) notes.push("More closed trades increase the experience component.");
  if (pricedRatio < 1) notes.push("Unpriced trades reduce consistency.");

  const score = dataCompletenessPoints + experiencePoints + winRatePoints + consistencyPoints;

  return {
    version: REPUTATION_VERSION,
    status: "ready",
    score,
    breakdown: {
      dataCompletenessPoints,
      experiencePoints,
      winRatePoints,
      consistencyPoints,
      maxPoints,
      notes,
    },
    methodology: REPUTATION_METHODOLOGY,
  };
}
