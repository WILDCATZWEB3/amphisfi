import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import {
  addWatchlistItem,
  getMyWatchlist,
  removeWatchlistItem,
} from "@/lib/watchlist/watchlist.functions";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — Amphis" },
      {
        name: "description",
        content: "Save indexed Robinhood Chain wallets, traders, and tokens on Amphis.",
      },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const qc = useQueryClient();
  const getWl = useServerFn(getMyWatchlist);
  const addFn = useServerFn(addWatchlistItem);
  const removeFn = useServerFn(removeWatchlistItem);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"wallet" | "token">("wallet");
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWl(),
  });

  const add = useMutation({
    mutationFn: async () => {
      setErr(null);
      if (mode === "wallet") await addFn({ data: { itemType: "wallet", address: draft.trim() } });
      else await addFn({ data: { itemType: "token", contractAddress: draft.trim() } });
    },
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (e) => setErr((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => removeFn({ data: { itemId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Watchlist"
        description="Only indexed wallets and tokens can be saved. Nothing here is simulated."
      />

      <form
        className="mt-8 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "wallet" | "token")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="wallet">Wallet</option>
          <option value="token">Token</option>
        </select>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={mode === "wallet" ? "0x wallet address" : "0x token contract"}
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={add.isPending || !draft.trim()}
          className="h-10 rounded-md border border-border-strong px-4 text-sm hover:bg-secondary disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        To save a trader profile, open their public page and use Follow, or add their linked wallet
        address here once indexed.
      </p>

      <div className="mt-8">
        {q.isLoading ? (
          <LoadingState label="Loading watchlist" />
        ) : q.isError ? (
          <ErrorState
            title="Could not load watchlist"
            description="Apply migration 0008 if this table is missing."
            onRetry={() => void q.refetch()}
          />
        ) : !q.data?.items.length ? (
          <EmptyState
            title="Watchlist empty"
            description="Add an indexed wallet or token contract to start tracking real on-chain entities."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {q.data.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.itemType}
                  </p>
                  {item.itemType === "wallet" && item.wallet ? (
                    <Link
                      to="/trader/$walletAddress"
                      params={{
                        walletAddress: item.wallet.address_normalized ?? item.wallet.address,
                      }}
                      className="hover:underline"
                    >
                      <WalletAddress
                        address={item.wallet.address_normalized ?? item.wallet.address}
                      />
                    </Link>
                  ) : null}
                  {item.itemType === "trader" && item.trader?.username ? (
                    <Link
                      to="/u/$username"
                      params={{ username: item.trader.username }}
                      className="hover:underline"
                    >
                      @{item.trader.username}
                    </Link>
                  ) : null}
                  {item.itemType === "token" && item.token ? (
                    <Link
                      to="/tokens/$chainId/$contractAddress"
                      params={{ chainId: "4663", contractAddress: item.token.address }}
                      className="hover:underline"
                    >
                      {item.token.symbol ?? "Unknown"} · {item.token.address}
                    </Link>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(item.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
