import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { getFollowingActivity } from "@/lib/portfolio/following-activity.functions";
import { getMyActivity, listMyWallets } from "@/lib/portfolio/portfolio.functions";
import { ROBINHOOD_EXPLORER } from "@/lib/chains/robinhood/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Amphis" },
      {
        name: "description",
        content: "Your linked-wallet trades and real activity from traders you follow.",
      },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const [tab, setTab] = useState<"mine" | "following">("mine");
  const listFn = useServerFn(listMyWallets);
  const actFn = useServerFn(getMyActivity);
  const followFn = useServerFn(getFollowingActivity);
  const walletsQ = useQuery({ queryKey: ["my-wallets"], queryFn: () => listFn() });
  const [walletId, setWalletId] = useState<string>("");

  useEffect(() => {
    if (!walletId && walletsQ.data?.wallets?.length) {
      const first = walletsQ.data.wallets[0];
      if (first) setWalletId(first.id);
    }
  }, [walletsQ.data, walletId]);

  const actQ = useQuery({
    queryKey: ["activity", walletId],
    enabled: tab === "mine" && Boolean(walletId),
    queryFn: () => actFn({ data: { walletId, limit: 40 } }),
  });

  const followQ = useQuery({
    queryKey: ["following-activity"],
    enabled: tab === "following",
    queryFn: () => followFn({ data: { limit: 40 } }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Activity"
        description="Real indexed swaps only. Following feed respects public profiles."
      />

      <div className="mt-8 inline-flex rounded-md border border-border p-1">
        {(
          [
            ["mine", "My wallet"],
            ["following", "Following"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded px-3 py-1.5 text-sm",
              tab === id ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        <>
          {!walletsQ.data?.wallets?.length && !walletsQ.isLoading ? (
            <div className="mt-8">
              <EmptyState
                title="No linked wallets"
                description="Link a wallet on My Profile first."
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
                  {(walletsQ.data?.wallets ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {(w.address_normalized ?? w.address).slice(0, 12)}…
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-6">
                {actQ.isLoading ? (
                  <LoadingState label="Loading activity" />
                ) : actQ.isError ? (
                  <ErrorState title="Could not load activity" onRetry={() => void actQ.refetch()} />
                ) : !actQ.data?.events.length ? (
                  <EmptyState
                    title="No activity yet"
                    description="Trades appear after sync detects real swaps for this wallet."
                  />
                ) : (
                  <EventList events={actQ.data.events} />
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="mt-8">
          {followQ.isLoading ? (
            <LoadingState label="Loading following feed" />
          ) : followQ.isError ? (
            <ErrorState
              title="Could not load following feed"
              description="Apply migration 0008 if follows table is missing."
              onRetry={() => void followQ.refetch()}
            />
          ) : !followQ.data?.followingCount ? (
            <EmptyState
              title="Not following anyone yet"
              description="Follow public traders from their profile, then their indexed trades appear here."
            />
          ) : !followQ.data.events.length ? (
            <EmptyState
              title="No followed-trader trades yet"
              description={`You follow ${followQ.data.followingCount} profile(s), but none have indexed public trades visible right now.`}
            />
          ) : (
            <EventList events={followQ.data.events} showTrader />
          )}
        </div>
      )}
    </div>
  );
}

type Ev = {
  id: string;
  address: string | null;
  username?: string | null;
  blockTime: string | null;
  direction: string | null;
  tradeValueUsd: number | null;
  valuationStatus: string;
  transactionHash: string;
};

function EventList({ events, showTrader }: { events: Ev[]; showTrader?: boolean }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {events.map((e) => (
        <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
          <div>
            <p className="font-medium">
              {e.direction ?? "SWAP"}
              {showTrader ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {e.username ? `@${e.username}` : e.address?.slice(0, 10)}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {e.blockTime ? new Date(e.blockTime).toLocaleString() : "Unknown time"}
              {e.address ? (
                <>
                  {" · "}
                  <Link
                    to="/trader/$walletAddress"
                    params={{ walletAddress: e.address }}
                    className="underline"
                  >
                    wallet
                  </Link>
                </>
              ) : null}
              {" · "}
              <a
                className="underline"
                href={`${ROBINHOOD_EXPLORER}/tx/${e.transactionHash}`}
                target="_blank"
                rel="noreferrer"
              >
                tx
              </a>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {e.valuationStatus === "priced" && e.tradeValueUsd !== null
              ? e.tradeValueUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })
              : "Price unavailable"}
          </p>
        </li>
      ))}
    </ul>
  );
}
