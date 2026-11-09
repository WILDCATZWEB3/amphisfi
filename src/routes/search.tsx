import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { searchAmphis } from "@/lib/search/search.functions";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  head: () => ({
    meta: [
      { title: "Search — Amphis" },
      {
        name: "description",
        content: "Search Amphis usernames, wallets, and indexed Robinhood Chain tokens.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initial } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState(initial);
  const q = useQuery({
    queryKey: ["search", initial],
    enabled: initial.trim().length >= 1,
    queryFn: () => searchAmphis({ data: { q: initial.trim(), page: 1, pageSize: 25 } }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Search"
        description="Usernames, wallets, and indexed tokens. Results are bounded and server-validated."
      />
      <form
        className="mt-8 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ search: { q: draft.trim() } });
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={128}
          placeholder="Username, 0x wallet, or token"
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="h-10 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-secondary"
        >
          Search
        </button>
      </form>

      <div className="mt-8">
        {!initial.trim() ? (
          <EmptyState
            title="Enter a query"
            description="Search is server-side, paginated, and capped to protect the database."
          />
        ) : q.isLoading ? (
          <LoadingState label="Searching" />
        ) : q.isError ? (
          <ErrorState
            title="Search failed"
            description="Try again shortly."
            onRetry={() => void q.refetch()}
          />
        ) : !q.data?.hits.length ? (
          <EmptyState title="No matches" description={`Nothing public matched “${initial}”.`} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {q.data.hits.map((hit, i) => (
              <li key={`${hit.type}-${i}`} className="px-4 py-3 text-sm">
                {hit.type === "profile" ? (
                  <Link
                    to="/u/$username"
                    params={{ username: hit.username }}
                    className="hover:underline"
                  >
                    Profile @{hit.username}
                  </Link>
                ) : null}
                {hit.type === "wallet" ? (
                  <Link
                    to="/trader/$walletAddress"
                    params={{ walletAddress: hit.address }}
                    className="hover:underline"
                  >
                    Wallet {hit.address}
                    {hit.username ? ` (@${hit.username})` : ""}
                  </Link>
                ) : null}
                {hit.type === "token" ? (
                  <Link
                    to="/tokens/$chainId/$contractAddress"
                    params={{ chainId: "4663", contractAddress: hit.address }}
                    className="hover:underline"
                  >
                    Token {hit.symbol ?? "Unknown"} · {hit.address}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
