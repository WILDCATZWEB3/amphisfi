import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Card, CardHeader } from "@/components/amphis/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { getIndexedToken } from "@/lib/tokens/tokens.functions";

export const Route = createFileRoute("/tokens/$chainId/$contractAddress")({
  head: ({ params }) => ({
    meta: [
      { title: `Token ${params.contractAddress} — Amphis` },
      { name: "description", content: `Indexed Robinhood Chain token ${params.contractAddress}.` },
    ],
  }),
  component: TokenDetailPage,
});

function TokenDetailPage() {
  const { chainId, contractAddress } = Route.useParams();
  const q = useQuery({
    queryKey: ["token", chainId, contractAddress],
    queryFn: () =>
      getIndexedToken({
        data: { chainId: Number(chainId), contractAddress },
      }),
  });

  if (q.isLoading) {
    return (
      <div className="container-page py-16">
        <LoadingState label="Loading token" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="container-page py-16">
        <ErrorState title="Could not load token" onRetry={() => void q.refetch()} />
      </div>
    );
  }
  if (!q.data?.found) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Token not found"
          description={q.data && "reason" in q.data ? q.data.reason : "Token not in indexed registry yet."}
        />
      </div>
    );
  }

  const t = q.data.token;
  return (
    <div className="container-page py-12 sm:py-16">
      <h1 className="text-2xl font-semibold">{t.symbol ?? "Unknown token"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.name ?? "Name unavailable"}</p>
      <Card className="mt-8">
        <CardHeader title="On-chain identity" />
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Chain</dt>
            <dd>Robinhood Chain ({t.chainId})</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Contract</dt>
            <dd className="break-all text-right">{t.address}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Decimals</dt>
            <dd>{t.decimals ?? "Unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Indexed transfers</dt>
            <dd>{t.transferCount ?? "Unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Price</dt>
            <dd>{t.priceAvailable && t.priceUsd !== null ? `$${t.priceUsd}` : "Unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Explorer</dt>
            <dd>
              <a
                className="text-accent underline"
                href={t.explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
