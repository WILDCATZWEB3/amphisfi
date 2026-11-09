import { useQuery } from "@tanstack/react-query";

import { Card, CardHeader } from "@/components/amphis/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { getWalletReputation } from "@/lib/reputation/reputation.functions";

export function ReputationCard({ address }: { address: string }) {
  const q = useQuery({
    queryKey: ["reputation", address],
    queryFn: () => getWalletReputation({ data: { address } }),
  });

  return (
    <Card>
      <CardHeader title="Reputation" description="Amphis v1 · explainable · not advice" />
      {q.isLoading ? (
        <LoadingState label="Calculating reputation" />
      ) : q.isError ? (
        <ErrorState title="Could not load reputation" onRetry={() => void q.refetch()} />
      ) : !q.data?.found ? (
        <EmptyState
          className="border-0 py-8"
          title="No reputation yet"
          description={q.data && "reason" in q.data ? q.data.reason : "Wallet not indexed."}
        />
      ) : q.data.reputation.status === "insufficient_data" ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">Insufficient data</p>
          <p className="text-muted-foreground">
            {q.data.reputation.breakdown.notes[0] ??
              "Not enough priced closed trades or coverage to score."}
          </p>
          <p className="text-xs text-muted-foreground">{q.data.reputation.methodology}</p>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-3xl font-semibold tabular-nums">{q.data.reputation.score}</p>
          <p className="text-xs text-muted-foreground">
            Version {q.data.reputation.version} · max {q.data.reputation.breakdown.maxPoints}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Data completeness</dt>
              <dd>{q.data.reputation.breakdown.dataCompletenessPoints}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Experience</dt>
              <dd>{q.data.reputation.breakdown.experiencePoints}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Win rate</dt>
              <dd>{q.data.reputation.breakdown.winRatePoints}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Consistency</dt>
              <dd>{q.data.reputation.breakdown.consistencyPoints}</dd>
            </div>
          </dl>
          {q.data.reputation.breakdown.notes.length ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {q.data.reputation.breakdown.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">{q.data.reputation.methodology}</p>
        </div>
      )}
    </Card>
  );
}
