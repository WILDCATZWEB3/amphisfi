import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card, CardHeader } from "@/components/amphis/Card";
import { EmptyState, LoadingState } from "@/components/amphis/States";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAddress, shortenAddress } from "@/lib/evm/address";
import { cn } from "@/lib/utils";
import { ROBINHOOD_EXPLORER } from "@/lib/chains/robinhood/config";

const NATIVE = "0x0000000000000000000000000000000000000000";
const usd = (v: unknown) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const signed = (v: unknown) => (v === null || v === undefined ? "—" : `${Number(v) > 0 ? "+" : ""}${usd(v)}`);
const amount = (raw: unknown, dec: number | null) =>
  dec === null ? "Unknown amount" : (Number(String(raw)) / 10 ** dec).toLocaleString("en-US", { maximumSignificantDigits: 6 });

const PERIODS = [["7d", "7D"], ["30d", "30D"], ["all", "All Time"]] as const;
const COMPLETENESS: Record<string, string> = {
  complete: "All trades priced",
  partial: "Partial — some trades lack prices or purchase history",
  insufficient: "Not enough priced trades",
};

/** Real trades, values at trade time and FIFO gains/losses for one Robinhood Chain wallet. */
export function TradePerformance({ address }: { address: string }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("all");
  const q = useQuery({
    queryKey: ["trade-performance", normalizeAddress(address)],
    queryFn: async () => {
      const { data: w } = await supabase.from("wallets").select("id")
        .eq("chain", "robinhood").eq("address_normalized", normalizeAddress(address)).maybeSingle();
      if (!w) return null;
      const [{ data: snaps }, { data: trades }, { data: pnl }] = await Promise.all([
        supabase.from("evm_performance_snapshots").select("*").eq("wallet_id", w.id),
        supabase.from("evm_trades").select("*").eq("wallet_id", w.id).order("block_time", { ascending: false }).limit(50),
        supabase.from("evm_realized_pnl").select("trade_id,pnl_usd,fully_matched").eq("wallet_id", w.id),
      ]);
      const tokens = [...new Set((trades ?? []).flatMap((t) => [t.sold_token, t.bought_token]))].filter((t) => t !== NATIVE);
      const { data: meta } = tokens.length
        ? await supabase.from("evm_tokens").select("address,symbol").eq("chain", "robinhood").in("address", tokens)
        : { data: [] };
      return {
        snaps: snaps ?? [], trades: trades ?? [],
        pnl: new Map((pnl ?? []).map((p) => [p.trade_id, p])),
        symbols: new Map((meta ?? []).map((m) => [m.address, m.symbol])),
      };
    },
  });

  if (q.isLoading) return <LoadingState label="Loading trades" />;
  const d = q.data;
  if (!d || !d.trades.length) {
    return (
      <Card>
        <CardHeader title="Performance" />
        <EmptyState className="border-0 py-8" title="No verified trading data yet." description="Trades appear here after the wallet is synced." />
      </Card>
    );
  }
  const sym = (t: string) => (t === NATIVE ? "ETH" : d.symbols.get(t) ?? shortenAddress(t, 4));
  const s = d.snaps.find((x) => x.period === period);
  const stat = "rounded-md border border-border p-3";

  return (
    <>
      <Card>
        <CardHeader
          title="Performance"
          action={
            <div className="flex gap-1">
              {PERIODS.map(([k, label]) => (
                <button key={k} onClick={() => setPeriod(k)}
                  className={cn("rounded-md px-2.5 py-1 text-xs", period === k ? "bg-secondary text-foreground" : "text-muted-foreground")}>
                  {label}
                </button>
              ))}
            </div>
          }
        />
        {s ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className={stat}><p className="text-xs text-muted-foreground">Realized P/L</p>
                <p className={cn("mt-1 font-medium", Number(s.realized_pnl_usd) > 0 && "text-accent", Number(s.realized_pnl_usd) < 0 && "text-destructive")}>{signed(s.realized_pnl_usd)}</p></div>
              <div className={stat}><p className="text-xs text-muted-foreground">Volume</p><p className="mt-1 font-medium">{usd(s.volume_usd)}</p></div>
              <div className={stat}><p className="text-xs text-muted-foreground">Win rate</p>
                <p className="mt-1 font-medium">{s.win_rate === null ? "—" : `${Math.round(Number(s.win_rate) * 100)}%`}</p></div>
              <div className={stat}><p className="text-xs text-muted-foreground">Trades priced</p><p className="mt-1 font-medium">{s.priced_trade_count} / {s.trade_count}</p></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {([
                ["Unrealized P/L", period === "all" ? (s.open_cost_basis_usd === null ? "No open positions" : s.unrealized_pnl_usd === null ? "Valuation unavailable" : signed(s.unrealized_pnl_usd)) : null],
                ["Total P/L", s.total_pnl_usd === null ? "Incomplete data" : signed(s.total_pnl_usd)],
                ["ROI", s.roi === null ? "—" : `${(Number(s.roi) * 100).toFixed(1)}%`],
                ["Open cost basis", period === "all" ? usd(s.open_cost_basis_usd) : null],
                ["Capital deployed", usd(s.capital_deployed_usd)],
                ["Avg trade", usd(s.average_trade_usd)],
                ["Best trade", signed(s.best_trade_pnl_usd)],
                ["Worst trade", signed(s.worst_trade_pnl_usd)],
                ["Unclassified txs", period === "all" ? String(s.unclassified_tx_count ?? 0) : null],
              ] as const).filter(([, v]) => v !== null).map(([k, v]) => (
                <p key={k} className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span>{v}</span></p>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {s.performance_ready ? "Performance ready." : COMPLETENESS[s.data_completeness] ?? s.data_completeness}
              {(s.unclassified_tx_count ?? 0) > 0 ? " Some transactions could not be classified (e.g. sales paid out in ETH by a contract), so results may be incomplete." : ""}
              {" "}Prices: DefiLlama at trade time. Cost basis: first in, first out.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Performance has not been calculated yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Trades" description="Most recent 50 detected swaps" />
        <ul className="divide-y divide-border">
          {d.trades.map((t) => {
            const r = d.pnl.get(t.id);
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    {amount(t.sold_amount_raw, t.sold_decimals)} {sym(t.sold_token)} → {amount(t.bought_amount_raw, t.bought_decimals)} {sym(t.bought_token)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.direction ?? "SWAP"} · {t.block_time ? new Date(t.block_time).toLocaleString() : "Unknown time"}
                    {" · "}<a className="underline" href={`${ROBINHOOD_EXPLORER}/tx/${t.transaction_hash}`} target="_blank" rel="noreferrer">tx</a>
                  </p>
                </div>
                <div className="text-right">
                  <p>{t.valuation_status === "priced" ? usd(t.trade_value_usd) : t.valuation_status === "pending" ? "Pricing…" : "Price unavailable"}</p>
                  {r ? (
                    <p className={cn("text-xs", Number(r.pnl_usd) > 0 ? "text-accent" : Number(r.pnl_usd) < 0 ? "text-destructive" : "text-muted-foreground")}>
                      {signed(r.pnl_usd)}{r.fully_matched ? "" : " (partial)"}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
