/**
 * Trade valuation + FIFO cost basis (server-only). Recomputes a wallet's lots,
 * realized PnL and 7D/30D/All Time snapshots from priced trades only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { currentPrices, historicalPrices } from "@/lib/prices/defillama.server";

const units = (raw: unknown, dec: number | null) => (dec === null ? null : Number(String(raw)) / 10 ** dec);

/** Prices up to `limit` pending trades. Returns how many are still pending. */
export async function valueTrades(walletId: string, limit = 25) {
  const db = supabaseAdmin;
  const { data: trades } = await db.from("evm_trades").select("*").eq("wallet_id", walletId).eq("valuation_status", "pending").limit(limit);
  for (const t of trades ?? []) {
    if (!t.block_time) { await db.from("evm_trades").update({ valuation_status: "unavailable" }).eq("id", t.id); continue; }
    const prices = await historicalPrices([t.sold_token, t.bought_token], Math.floor(new Date(t.block_time).getTime() / 1000));
    const sp = prices.get(t.sold_token)?.price ?? null;
    const bp = prices.get(t.bought_token)?.price ?? null;
    const sq = units(t.sold_amount_raw, t.sold_decimals);
    const bq = units(t.bought_amount_raw, t.bought_decimals);
    const value = sp !== null && sq !== null ? sp * sq : bp !== null && bq !== null ? bp * bq : null;
    await db.from("evm_trades").update({
      sold_price_usd: sp, bought_price_usd: bp, trade_value_usd: value,
      valuation_status: value === null ? "unavailable" : "priced", price_source: "defillama", valued_at: new Date().toISOString(),
    }).eq("id", t.id);
  }
  const { count } = await db.from("evm_trades").select("id", { count: "exact", head: true }).eq("wallet_id", walletId).eq("valuation_status", "pending");
  return count ?? 0;
}

type Lot = { token: string; source_trade_id: string; acquired_at: string | null; quantity: number; remaining: number; cost: number; remainingCost: number };

export async function recalcPnl(walletId: string) {
  const db = supabaseAdmin;
  const { data: trades } = await db.from("evm_trades").select("*").eq("wallet_id", walletId).order("block_time", { ascending: true });
  const all = trades ?? [];
  const lots: Lot[] = [];
  const realized: Array<{ wallet_id: string; trade_id: string; token: string; disposed_at: string | null; quantity: number; matched_quantity: number; cost_basis_usd: number; proceeds_usd: number; pnl_usd: number; fully_matched: boolean }> = [];

  for (const t of all) {
    const value = t.trade_value_usd === null ? null : Number(t.trade_value_usd);
    const sq = units(t.sold_amount_raw, t.sold_decimals);
    const bq = units(t.bought_amount_raw, t.bought_decimals);
    if (value === null) continue;
    if (sq !== null && sq > 0) {
      let left = sq, cost = 0;
      for (const l of lots) {
        if (left <= 0) break;
        if (l.token !== t.sold_token || l.remaining <= 0) continue;
        const take = Math.min(left, l.remaining);
        const c = l.remainingCost * (take / l.remaining);
        l.remaining -= take; l.remainingCost -= c; left -= take; cost += c;
      }
      const matched = sq - left;
      if (matched > 0) {
        const proceeds = value * (matched / sq);
        realized.push({
          wallet_id: walletId, trade_id: t.id, token: t.sold_token, disposed_at: t.block_time, quantity: sq,
          matched_quantity: matched, cost_basis_usd: cost, proceeds_usd: proceeds, pnl_usd: proceeds - cost,
          fully_matched: left <= sq * 1e-9,
        });
      }
    }
    if (bq !== null && bq > 0) {
      lots.push({ token: t.bought_token, source_trade_id: t.id, acquired_at: t.block_time, quantity: bq, remaining: bq, cost: value, remainingCost: value });
    }
  }

  await db.from("evm_realized_pnl").delete().eq("wallet_id", walletId);
  await db.from("evm_position_lots").delete().eq("wallet_id", walletId);
  if (realized.length) await db.from("evm_realized_pnl").insert(realized as never);
  const open = lots.filter((l) => l.remaining > l.quantity * 1e-9);
  if (open.length) {
    await db.from("evm_position_lots").insert(open.map((l) => ({
      wallet_id: walletId, token: l.token, source_trade_id: l.source_trade_id, acquired_at: l.acquired_at,
      quantity: l.quantity, remaining_quantity: l.remaining, cost_basis_usd: l.cost, remaining_cost_basis_usd: l.remainingCost,
    })));
  }

  // Unrealized: only when every open token has a reliable current price.
  const openTokens = [...new Set(open.map((l) => l.token))];
  const cur = await currentPrices(openTokens);
  const allPriced = openTokens.every((t) => cur.get(t) !== null);
  const marketValue = open.length && allPriced ? open.reduce((s, l) => s + l.remaining * (cur.get(l.token) as number), 0) : null;
  const openCost = open.reduce((s, l) => s + l.remainingCost, 0);
  const unrealized = marketValue === null ? null : marketValue - openCost;
  const { count: unclassified } = await db.from("wallet_transactions").select("id", { count: "exact", head: true })
    .eq("wallet_id", walletId).eq("classification", "unclassified");
  const { data: w } = await db.from("wallets").select("sync_status").eq("id", walletId).single();

  const now = Date.now();
  const periods: Array<[string, number | null]> = [["7d", 7], ["30d", 30], ["all", null]];
  const snaps = periods.map(([period, days]) => {
    const since = days === null ? 0 : now - days * 86_400_000;
    const inP = (d: unknown) => d !== null && new Date(String(d)).getTime() >= since;
    const ts = all.filter((t) => days === null || inP(t.block_time));
    const priced = ts.filter((t) => t.valuation_status === "priced");
    const rs = realized.filter((r) => days === null || inP(r.disposed_at));
    const closed = rs.filter((r) => r.fully_matched);
    const wins = closed.filter((r) => Number(r.pnl_usd) > 0).length;
    const losses = closed.filter((r) => Number(r.pnl_usd) < 0).length;
    const completeness = !priced.length ? "insufficient"
      : priced.length === ts.length && closed.length === rs.length && !(unclassified ?? 0) ? "complete" : "partial";
    return {
      wallet_id: walletId, period,
      realized_pnl_usd: rs.length ? rs.reduce((s, r) => s + Number(r.pnl_usd), 0) : null,
      volume_usd: priced.length ? priced.reduce((s, t) => s + Number(t.trade_value_usd), 0) : null,
      trade_count: ts.length, priced_trade_count: priced.length, closed_trade_count: closed.length,
      winning_trades: wins, losing_trades: losses, win_rate: closed.length ? wins / closed.length : null,
      open_cost_basis_usd: days === null && open.length ? open.reduce((s, l) => s + l.remainingCost, 0) : null,
      ...(() => {
        const realizedSum = rs.length ? rs.reduce((s, r) => s + Number(r.pnl_usd), 0) : null;
        const allTime = days === null;
        const unr = allTime ? (open.length ? unrealized : 0) : null;
        const total = realizedSum !== null && unr !== null && completeness === "complete" ? realizedSum + unr : null;
        const deployed = priced.filter((t) => t.direction === "BUY").reduce((s, t) => s + Number(t.trade_value_usd), 0);
        const pnls = closed.map((r) => Number(r.pnl_usd));
        return {
          unrealized_pnl_usd: allTime ? unrealized : null,
          open_market_value_usd: allTime ? marketValue : null,
          total_pnl_usd: total,
          capital_deployed_usd: deployed > 0 ? deployed : null,
          roi: total !== null && deployed > 0 ? total / deployed : null,
          average_trade_usd: priced.length ? priced.reduce((s, t) => s + Number(t.trade_value_usd), 0) / priced.length : null,
          best_trade_pnl_usd: pnls.length ? Math.max(...pnls) : null,
          worst_trade_pnl_usd: pnls.length ? Math.min(...pnls) : null,
          unclassified_tx_count: unclassified ?? 0,
          performance_ready: w?.sync_status === "completed" && completeness === "complete",
        };
      })(),
      data_completeness: completeness, calculated_at: new Date().toISOString(),
    };
  });
  await db.from("evm_performance_snapshots").upsert(snaps, { onConflict: "wallet_id,period" });
}
