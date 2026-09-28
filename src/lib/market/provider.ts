/**
 * Market-data abstraction. Implementations must return `null` for any price
 * they cannot reliably supply — callers never substitute a guess.
 */
export type PricePoint = { priceUsd: number; observedAt: number /* unix seconds */; source: string };

export interface MarketDataProvider {
  readonly name: string;
  /** Historical USD prices at (or very near) `timestamp` (unix seconds). */
  getHistoricalPrices(mints: string[], timestamp: number): Promise<Map<string, PricePoint | null>>;
  /** Current USD prices. */
  getCurrentPrices(mints: string[]): Promise<Map<string, PricePoint | null>>;
}
