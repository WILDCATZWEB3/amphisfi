import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Avatar } from "@/components/amphis/Avatar";
import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import { getExploreTraders } from "@/lib/discovery/discovery.functions";
import { DISCOVERY_PERIODS, PERIOD_LABELS, type DiscoveryPeriod } from "@/lib/discovery/periods";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore Traders — Amphis" },
      {
        name: "description",
        content:
          "Discover Robinhood Chain traders with verified, on-chain performance histories on Amphis.",
      },
      { property: "og:title", content: "Explore Traders — Amphis" },
      {
        property: "og:description",
        content:
          "Discover Robinhood Chain traders with verified, on-chain performance histories on Amphis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

const usd = (v: number | null) =>
  v === null
    ? "—"
    : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function ExplorePage() {
  const [period, setPeriod] = useState<DiscoveryPeriod>("7d");
  const q = useQuery({
    queryKey: ["explore", period],
    queryFn: () => getExploreTraders({ data: { period, limit: 24 } }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Explore"
        description="Trader discovery from indexed Robinhood Chain activity. No simulated traders."
      />

      <div className="mt-8 inline-flex rounded-md border border-border p-1">
        {DISCOVERY_PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={cn(
              "rounded px-3 py-1.5 text-sm transition-colors sm:px-4",
              period === p
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {q.isLoading ? (
          <LoadingState label="Loading eligible traders" />
        ) : q.isError ? (
          <ErrorState
            title="Could not load explore"
            description="The discovery service is unavailable right now."
            onRetry={() => void q.refetch()}
          />
        ) : !q.data?.traders.length ? (
          <EmptyState
            title="No eligible traders yet"
            description="Amphis only lists wallets after indexing and price coverage meet eligibility rules. Nothing here is simulated."
          />
        ) : (
          <>
            <p className="mb-4 text-xs text-muted-foreground">
              Last updated:{" "}
              {q.data.lastUpdated ? new Date(q.data.lastUpdated).toLocaleString() : "Unavailable"}.{" "}
              {q.data.methodology}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {q.data.traders.map((t) => (
                <li key={t.walletId} className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <Avatar path={t.avatarUrl} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t.username ? `@${t.username}` : "Unlinked wallet"}
                      </p>
                      <WalletAddress address={t.address} className="text-xs" />
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Volume</dt>
                      <dd>{usd(t.volumeUsd)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Realized P/L</dt>
                      <dd>{usd(t.realizedPnlUsd)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Win rate</dt>
                      <dd>{t.winRate === null ? "—" : `${Math.round(t.winRate * 100)}%`}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Priced trades</dt>
                      <dd>
                        {t.pricedTradeCount}/{t.tradeCount}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {t.ownershipVerified
                        ? "Ownership verified"
                        : "Connected (not ownership-verified)"}
                    </span>
                    <Link
                      to="/trader/$walletAddress"
                      params={{ walletAddress: t.address }}
                      className="text-accent hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
