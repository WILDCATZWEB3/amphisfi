import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import { getLeaderboard } from "@/lib/discovery/discovery.functions";
import {
  DISCOVERY_PERIODS,
  LEADERBOARD_CATEGORIES,
  PERIOD_LABELS,
  type DiscoveryPeriod,
  type LeaderboardCategory,
} from "@/lib/discovery/periods";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Amphis" },
      {
        name: "description",
        content:
          "Verified Robinhood Chain trader rankings across 7 day, 30 day and all-time windows.",
      },
      { property: "og:title", content: "Leaderboard — Amphis" },
      {
        property: "og:description",
        content:
          "Verified Robinhood Chain trader rankings across 7 day, 30 day and all-time windows.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  pnl: "PnL",
  roi: "ROI",
  win_rate: "Win rate",
  volume: "Volume",
};

function formatMetric(category: LeaderboardCategory, value: number | null) {
  if (value === null) return "—";
  if (category === "win_rate" || category === "roi") return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function LeaderboardPage() {
  const [period, setPeriod] = useState<DiscoveryPeriod>("7d");
  const [category, setCategory] = useState<LeaderboardCategory>("pnl");
  const q = useQuery({
    queryKey: ["leaderboard", period, category],
    queryFn: () => getLeaderboard({ data: { period, category, limit: 50 } }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Leaderboard"
        description="Rankings derived exclusively from verified on-chain trading data."
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <div className="inline-flex rounded-md border border-border p-1">
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
        <div className="inline-flex rounded-md border border-border p-1">
          {LEADERBOARD_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors sm:px-4",
                category === c
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[3rem_1fr_9rem_9rem] gap-4 border-b border-border px-5 py-3 text-xs tracking-wide text-muted-foreground uppercase sm:grid">
          <span>#</span>
          <span>Trader</span>
          <span>{CATEGORY_LABELS[category]}</span>
          <span>Coverage</span>
        </div>

        {q.isLoading ? (
          <LoadingState label="Loading rankings" />
        ) : q.isError ? (
          <ErrorState
            title="Could not load leaderboard"
            description="Rankings are unavailable right now."
            onRetry={() => void q.refetch()}
          />
        ) : !q.data?.entries.length ? (
          <EmptyState
            className="border-0"
            title="No eligible rankings yet"
            description={`No ${PERIOD_LABELS[period]} ${CATEGORY_LABELS[category]} rankings pass eligibility. Amphis never displays estimated or placeholder results.`}
          />
        ) : (
          <>
            <p className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
              Last updated:{" "}
              {q.data.lastUpdated ? new Date(q.data.lastUpdated).toLocaleString() : "Unavailable"}.{" "}
              {q.data.methodology}
            </p>
            <ul className="divide-y divide-border">
              {q.data.entries.map((e) => (
                <li
                  key={e.walletId}
                  className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[3rem_1fr_9rem_9rem] sm:items-center sm:gap-4"
                >
                  <span className="text-sm text-muted-foreground">#{e.rank}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {e.username ? `@${e.username}` : "Unlinked wallet"}
                    </p>
                    <Link to="/trader/$walletAddress" params={{ walletAddress: e.address }}>
                      <WalletAddress address={e.address} className="text-xs" />
                    </Link>
                  </div>
                  <span className="text-sm">{formatMetric(category, e.metricValue)}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.pricedTradeCount}/{e.tradeCount} priced · {e.dataCompleteness}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
