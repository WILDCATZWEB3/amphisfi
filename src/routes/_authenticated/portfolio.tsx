import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Card, CardHeader } from "@/components/amphis/Card";
import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { PerformanceCharts } from "@/components/amphis/PerformanceCharts";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import { getWalletPortfolio, listMyWallets } from "@/lib/portfolio/portfolio.functions";
import { ROBINHOOD_EXPLORER } from "@/lib/chains/robinhood/config";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Amphis" },
      {
        name: "description",
        content:
          "Wallet-level Robinhood Chain portfolio from indexed FIFO lots. No invented balances.",
      },
    ],
  }),
  component: PortfolioPage,
});

const usd = (v: number | null) =>
  v === null
    ? "Unavailable"
    : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function PortfolioPage() {
  const listFn = useServerFn(listMyWallets);
  const portFn = useServerFn(getWalletPortfolio);
  const walletsQ = useQuery({
    queryKey: ["my-wallets"],
    queryFn: () => listFn(),
  });
  const [walletId, setWalletId] = useState<string>("");

  useEffect(() => {
    if (!walletId && walletsQ.data?.wallets?.length) {
      const primary = walletsQ.data.wallets.find((w) => w.is_primary) ?? walletsQ.data.wallets[0];
      if (primary) setWalletId(primary.id);
    }
  }, [walletsQ.data, walletId]);

  const portQ = useQuery({
    queryKey: ["portfolio", walletId],
    enabled: Boolean(walletId),
    queryFn: () => portFn({ data: { walletId } }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Portfolio"
        description="One wallet at a time. Cost basis from FIFO lots; mark-to-market only when prices exist."
      />

      {walletsQ.isLoading ? (
        <div className="mt-8">
          <LoadingState label="Loading wallets" />
        </div>
      ) : walletsQ.isError ? (
        <div className="mt-8">
          <ErrorState title="Could not load wallets" onRetry={() => void walletsQ.refetch()} />
        </div>
      ) : !walletsQ.data?.wallets.length ? (
        <div className="mt-8">
          <EmptyState
            title="No linked wallets"
            description="Link a Robinhood Chain wallet on My Profile, then sync to build portfolio lots."
          />
        </div>
      ) : (
        <>
          <label className="mt-8 block text-sm">
            <span className="text-muted-foreground">Wallet</span>
            <select
              className="mt-1 block h-10 w-full max-w-xl rounded-md border border-border bg-background px-3 text-sm"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              {walletsQ.data.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {(w.address_normalized ?? w.address).slice(0, 10)}…{" "}
                  {w.is_primary ? "(primary)" : ""} · {w.sync_status}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-6">
            {portQ.isLoading ? (
              <LoadingState label="Loading portfolio" />
            ) : portQ.isError ? (
              <ErrorState
                title="Could not load portfolio"
                description={(portQ.error as Error).message}
                onRetry={() => void portQ.refetch()}
              />
            ) : portQ.data ? (
              <div className="grid gap-4">
                <Card>
                  <CardHeader title="Selected wallet" />
                  <WalletAddress address={portQ.data.wallet.address} full />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sync: {portQ.data.wallet.syncStatus}
                    {portQ.data.wallet.ownershipVerified
                      ? " · Ownership verified"
                      : " · Connected (not ownership-verified)"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ETH balance:{" "}
                    {portQ.data.ethBalanceAvailable && portQ.data.ethBalance !== null
                      ? `${portQ.data.ethBalance} ETH`
                      : `Unavailable${portQ.data.ethBalanceReason ? ` (${portQ.data.ethBalanceReason})` : ""}`}
                    {portQ.data.ethBalanceProvider ? ` · via ${portQ.data.ethBalanceProvider}` : ""}
                  </p>
                </Card>

                <Card>
                  <CardHeader title="Summary (all-time FIFO)" />
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">Open cost basis</dt>
                      <dd>{usd(portQ.data.summary.openCostBasisUsd)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Open market value</dt>
                      <dd>{usd(portQ.data.summary.openMarketValueUsd)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Unrealized P/L</dt>
                      <dd>{usd(portQ.data.summary.unrealizedPnlUsd)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Realized P/L</dt>
                      <dd>{usd(portQ.data.summary.realizedPnlUsd)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Total P/L</dt>
                      <dd>{usd(portQ.data.summary.totalPnlUsd)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Coverage</dt>
                      <dd>{portQ.data.summary.dataCompleteness}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Unavailable means missing prices or incomplete analysis — never treated as zero.
                    Last calculated:{" "}
                    {portQ.data.summary.calculatedAt
                      ? new Date(portQ.data.summary.calculatedAt).toLocaleString()
                      : "—"}
                  </p>
                </Card>

                <PerformanceCharts walletId={walletId} />

                <Card>
                  <CardHeader title="Open positions (from lots)" />
                  {!portQ.data.positions.length ? (
                    <EmptyState
                      className="border-0 py-8"
                      title="No open lots"
                      description="Positions appear after priced buys remain unmatched by sells."
                    />
                  ) : (
                    <ul className="divide-y divide-border">
                      {portQ.data.positions.map((p) => (
                        <li
                          key={p.token}
                          className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">{p.symbol ?? p.token.slice(0, 10)}</p>
                            <p className="text-xs text-muted-foreground">Qty {p.quantity}</p>
                          </div>
                          <div className="text-right text-xs">
                            <p>Cost {usd(p.costBasisUsd)}</p>
                            <p className="text-muted-foreground">
                              MTM {p.valuationAvailable ? usd(p.marketValueUsd) : "Unavailable"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card>
                  <CardHeader title="Recent trades" />
                  {!portQ.data.recentTrades.length ? (
                    <EmptyState className="border-0 py-8" title="No detected trades yet." />
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {portQ.data.recentTrades.map((t) => (
                        <li key={t.id} className="flex justify-between gap-2 py-3">
                          <div>
                            <p>{t.direction ?? "SWAP"}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.block_time
                                ? new Date(t.block_time).toLocaleString()
                                : "Unknown time"}{" "}
                              ·{" "}
                              <a
                                className="underline"
                                href={`${ROBINHOOD_EXPLORER}/tx/${t.transaction_hash}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                tx
                              </a>
                            </p>
                          </div>
                          <p className="text-xs">
                            {t.valuation_status === "priced"
                              ? usd(t.trade_value_usd === null ? null : Number(t.trade_value_usd))
                              : "Price unavailable"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
