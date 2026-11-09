import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { listIndexedTokens } from "@/lib/tokens/tokens.functions";

export const Route = createFileRoute("/tokens/")({
  head: () => ({
    meta: [
      { title: "Tokens — Amphis" },
      {
        name: "description",
        content: "Robinhood Chain tokens discovered from real indexed transfers.",
      },
    ],
  }),
  component: TokensPage,
});

function TokensPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const query = useQuery({
    queryKey: ["tokens", submitted],
    queryFn: () =>
      listIndexedTokens({ data: { page: 1, pageSize: 40, q: submitted || undefined } }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Tokens"
        description="Only assets seen in indexed Robinhood Chain activity. Missing price is shown as unavailable, never zero."
      />
      <form
        className="mt-8 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Symbol, name, or contract"
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="h-10 rounded-md border border-border-strong px-4 text-sm hover:bg-secondary"
        >
          Filter
        </button>
      </form>

      <div className="mt-8">
        {query.isLoading ? (
          <LoadingState label="Loading indexed tokens" />
        ) : query.isError ? (
          <ErrorState title="Could not load tokens" onRetry={() => void query.refetch()} />
        ) : !query.data?.tokens.length ? (
          <EmptyState
            title="No indexed tokens yet"
            description="Tokens appear after wallets sync real ERC-20 transfers on Robinhood Chain."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {query.data.tokens.map((t) => (
              <li
                key={t.address}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <Link
                    to="/tokens/$chainId/$contractAddress"
                    params={{ chainId: String(t.chainId), contractAddress: t.address }}
                    className="font-medium hover:underline"
                  >
                    {t.symbol ?? "Unknown"} {t.name ? `· ${t.name}` : ""}
                  </Link>
                  <p className="text-xs text-muted-foreground">{t.address}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Price:{" "}
                  {t.priceAvailable && t.priceUsd !== null ? `$${t.priceUsd}` : "Unavailable"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
