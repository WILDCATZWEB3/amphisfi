import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { getMyActivity, listMyWallets } from "@/lib/portfolio/portfolio.functions";
import { ROBINHOOD_EXPLORER } from "@/lib/chains/robinhood/config";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Amphis" },
      {
        name: "description",
        content: "Recent detected Robinhood Chain trades for your linked wallets.",
      },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const listFn = useServerFn(listMyWallets);
  const actFn = useServerFn(getMyActivity);
  const walletsQ = useQuery({ queryKey: ["my-wallets"], queryFn: () => listFn() });
  const [walletId, setWalletId] = useState<string>("");

  useEffect(() => {
    if (!walletId && walletsQ.data?.wallets?.length) {
      setWalletId(walletsQ.data.wallets[0].id);
    }
  }, [walletsQ.data, walletId]);

  const actQ = useQuery({
    queryKey: ["activity", walletId],
    enabled: Boolean(walletId),
    queryFn: () => actFn({ data: { walletId, limit: 40 } }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Activity"
        description="Detected swaps for one selected linked wallet. No fabricated feed."
      />

      {!walletsQ.data?.wallets?.length && !walletsQ.isLoading ? (
        <div className="mt-8">
          <EmptyState title="No linked wallets" description="Link a wallet on My Profile first." />
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
              <ul className="divide-y divide-border rounded-lg border border-border">
                {actQ.data.events.map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{e.direction ?? "SWAP"}</p>
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
                        ? e.tradeValueUsd.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                          })
                        : "Price unavailable"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
