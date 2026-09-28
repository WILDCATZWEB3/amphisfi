/**
 * Deterministic FIFO cost-basis and PnL engine. Pure — no network, no database.
 *
 * Method (documented):
 *  - Trades are replayed in chronological order (block time, then signature).
 *  - SOL, USDC and USDT are quote assets and are not tracked as positions.
 *  - Every non-quote token received opens a lot whose cost basis is the trade's
 *    historical USD value. Every non-quote token sent consumes the oldest lots
 *    first (FIFO). Token-to-token swaps dispose one token and acquire the other
 *    at the same USD value.
 *  - Realized PnL = proceeds of the matched quantity - FIFO cost of that quantity.
 *    Quantity sold without a known acquisition (bought before indexed history or
 *    received by transfer) produces no PnL and marks the data as partial.
 *  - Unpriced trades still move quantities (so holdings stay correct) but carry
 *    unknown cost/proceeds; anything touching them is excluded and flagged.
 *  - Network fees are reported separately and are NOT subtracted from PnL.
 */
import { QUOTE_MINTS } from "@/lib/solana/protocols";

export type EngineTrade = {
  id: string;
  signature: string;
  time: number | null; // unix seconds
  inputMint: string;
  inputQty: number;
  outputMint: string;
  outputQty: number;
  valueUsd: number | null;
  feeUsd: number | null;
  priceSource: string | null;
};

export type Lot = {
  mint: string; tradeId: string; acquiredAt: number | null;
  quantity: number; remaining: number; costUsd: number | null; remainingCostUsd: number | null;
};

export type RealizedEvent = {
  tradeId: string; mint: string; time: number | null; quantity: number; matchedQuantity: number;
  costUsd: number; proceedsUsd: number; pnlUsd: number; fullyMatched: boolean; priceSource: string | null;
};

export type Period = "7d" | "30d" | "all_time";
export type Completeness = "verified" | "partial" | "insufficient";

export type PeriodMetrics = {
  period: Period;
  realizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  totalPnlUsd: number | null;
  volumeUsd: number | null;
  networkFeesUsd: number | null;
  tradeCount: number;
  pricedTradeCount: number;
  closedTradeCount: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  averageTradePnlUsd: number | null;
  largestWinUsd: number | null;
  largestLossUsd: number | null;
  completeness: Completeness;
  notes: string[];
};

export type EngineResult = { lots: Lot[]; events: RealizedEvent[]; unrealizable: { tradeId: string; time: number | null }[]; metrics: PeriodMetrics[] };

const EPS = 1e-9;
const isQuote = (m: string) => QUOTE_MINTS.has(m);

export function sortTrades(trades: EngineTrade[]): EngineTrade[] {
  return [...trades].sort((a, b) => (a.time ?? 0) - (b.time ?? 0) || (a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0));
}

export function runEngine(input: EngineTrade[], currentPrices: Map<string, number | null>, now: number): EngineResult {
  const trades = sortTrades(input);
  const lots: Lot[] = [];
  const events: RealizedEvent[] = [];
  const unrealizable: { tradeId: string; time: number | null }[] = [];

  for (const t of trades) {
    if (!isQuote(t.inputMint) && t.inputQty > 0) {
      let need = t.inputQty;
      let matched = 0;
      let cost = 0;
      let unknownCost = false;
      for (const lot of lots) {
        if (need <= EPS) break;
        if (lot.mint !== t.inputMint || lot.remaining <= EPS) continue;
        const take = Math.min(lot.remaining, need);
        if (lot.costUsd === null || lot.remainingCostUsd === null) unknownCost = true;
        else {
          const c = lot.remainingCostUsd * (take / lot.remaining);
          cost += c;
          lot.remainingCostUsd -= c;
        }
        lot.remaining -= take;
        if (lot.remaining <= EPS) { lot.remaining = 0; if (lot.remainingCostUsd !== null) lot.remainingCostUsd = 0; }
        matched += take;
        need -= take;
      }
      if (t.valueUsd !== null && matched > EPS && !unknownCost) {
        const proceeds = t.valueUsd * (matched / t.inputQty);
        events.push({
          tradeId: t.id, mint: t.inputMint, time: t.time, quantity: t.inputQty, matchedQuantity: matched,
          costUsd: cost, proceedsUsd: proceeds, pnlUsd: proceeds - cost,
          fullyMatched: matched >= t.inputQty * (1 - 1e-6), priceSource: t.priceSource,
        });
        if (matched < t.inputQty * (1 - 1e-6)) unrealizable.push({ tradeId: t.id, time: t.time });
      } else {
        unrealizable.push({ tradeId: t.id, time: t.time });
      }
    }
    if (!isQuote(t.outputMint) && t.outputQty > 0) {
      lots.push({
        mint: t.outputMint, tradeId: t.id, acquiredAt: t.time, quantity: t.outputQty, remaining: t.outputQty,
        costUsd: t.valueUsd, remainingCostUsd: t.valueUsd,
      });
    }
  }

  // Unrealized: per mint, only when every open lot has a known cost and a current price exists.
  const open = new Map<string, Lot[]>();
  for (const l of lots) if (l.remaining > EPS) open.set(l.mint, [...(open.get(l.mint) ?? []), l]);
  let unrealized = 0;
  let valued = 0;
  let unvalued = 0;
  for (const [mint, ls] of open) {
    const price = currentPrices.get(mint) ?? null;
    if (price === null || ls.some((l) => l.remainingCostUsd === null)) { unvalued++; continue; }
    const qty = ls.reduce((s, l) => s + l.remaining, 0);
    const cost = ls.reduce((s, l) => s + (l.remainingCostUsd ?? 0), 0);
    unrealized += qty * price - cost;
    valued++;
  }
  const hadPositions = lots.length > 0;

  const windows: [Period, number | null][] = [["7d", 7 * 86400], ["30d", 30 * 86400], ["all_time", null]];
  const metrics = windows.map(([period, span]) => {
    const inWin = (time: number | null) => span === null || (time !== null && time >= now - span);
    const ts = trades.filter((t) => inWin(t.time));
    const ev = events.filter((e) => inWin(e.time));
    const priced = ts.filter((t) => t.valueUsd !== null);
    const unr = unrealizable.filter((u) => inWin(u.time));
    const notes: string[] = [];
    if (priced.length < ts.length) notes.push(`${ts.length - priced.length} trade(s) without reliable historical price`);
    if (unr.length) notes.push(`${unr.length} sale(s) without a known cost basis`);

    const wins = ev.filter((e) => e.pnlUsd > 0);
    const losses = ev.filter((e) => e.pnlUsd < 0);
    const realized = ev.length ? ev.reduce((s, e) => s + e.pnlUsd, 0) : null;
    let unrealizedPnl: number | null = null;
    if (period === "all_time") {
      if (unvalued) notes.push(`${unvalued} open position(s) without a reliable current price`);
      unrealizedPnl = valued > 0 ? unrealized : hadPositions && open.size === 0 ? 0 : null;
    }
    const total = realized === null && unrealizedPnl === null ? null : (realized ?? 0) + (unrealizedPnl ?? 0);
    const fees = priced.filter((t) => t.feeUsd !== null);
    const completeness: Completeness = priced.length === 0 ? "insufficient" : notes.length ? "partial" : "verified";
    return {
      period,
      realizedPnlUsd: realized,
      unrealizedPnlUsd: unrealizedPnl,
      totalPnlUsd: total,
      volumeUsd: priced.length ? priced.reduce((s, t) => s + (t.valueUsd ?? 0), 0) : null,
      networkFeesUsd: fees.length ? fees.reduce((s, t) => s + (t.feeUsd ?? 0), 0) : null,
      tradeCount: ts.length,
      pricedTradeCount: priced.length,
      closedTradeCount: ev.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: ev.length ? wins.length / ev.length : null,
      averageTradePnlUsd: ev.length ? (realized ?? 0) / ev.length : null,
      largestWinUsd: wins.length ? Math.max(...wins.map((e) => e.pnlUsd)) : null,
      largestLossUsd: losses.length ? Math.min(...losses.map((e) => e.pnlUsd)) : null,
      completeness,
      notes,
    } satisfies PeriodMetrics;
  });

  return { lots, events, unrealizable, metrics };
}
