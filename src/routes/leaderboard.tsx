import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState } from "@/components/amphis/States";
import { cn } from "@/lib/utils";

const RANGES = ["7D", "30D", "All Time"] as const;
type Range = (typeof RANGES)[number];

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Amphis" },
      {
        name: "description",
        content:
          "Verified Solana trader rankings across 7 day, 30 day and all-time windows.",
      },
      { property: "og:title", content: "Leaderboard — Amphis" },
      {
        property: "og:description",
        content:
          "Verified Solana trader rankings across 7 day, 30 day and all-time windows.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const [range, setRange] = useState<Range>("7D");

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Leaderboard"
        description="Rankings derived exclusively from verified on-chain trading data."
      />

      <div className="mt-8 inline-flex rounded-md border border-border p-1">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            aria-pressed={range === r}
            className={cn(
              "rounded px-3 py-1.5 text-sm transition-colors sm:px-4",
              range === r
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[3rem_1fr_9rem_9rem] gap-4 border-b border-border px-5 py-3 text-xs tracking-wide text-muted-foreground uppercase sm:grid">
          <span>#</span>
          <span>Trader</span>
          <span>Performance</span>
          <span>Verified</span>
        </div>
        <EmptyState
          className="border-0"
          title="Verified rankings will appear once Amphis has indexed real trading data."
          description={`No ${range} rankings are available yet. Amphis will never display estimated or placeholder results.`}
        />
      </div>
    </div>
  );
}
