import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/amphis/Button";
import { Card, CardHeader } from "@/components/amphis/Card";
import { PageHeader } from "@/components/amphis/PageHeader";
import { ErrorState, LoadingState } from "@/components/amphis/States";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import {
  adminEnqueueWalletSync,
  adminRetryJob,
  getAdminOverview,
} from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Amphis" },
      { name: "description", content: "Admin indexing and job controls." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getAdminOverview);
  const retryFn = useServerFn(adminRetryJob);
  const enqueueFn = useServerFn(adminEnqueueWalletSync);

  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => overviewFn(), retry: false });

  const retry = useMutation({
    mutationFn: (jobId: string) => retryFn({ data: { jobId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const enqueue = useMutation({
    mutationFn: (walletId: string) => enqueueFn({ data: { walletId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-overview"] }),
  });

  if (q.isLoading) {
    return (
      <div className="container-page py-16">
        <LoadingState label="Loading admin" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Admin access denied or unavailable"
          description={(q.error as Error).message || "Server-side role check failed."}
          onRetry={() => void q.refetch()}
        />
      </div>
    );
  }

  const data = q.data!;
  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Admin"
        description="Wallet indexing status, worker jobs, data-quality overview, audit log. Gated server-side."
      />

      <div className="mt-8 grid gap-4">
        <Card>
          <CardHeader title="Data quality" />
          <pre className="overflow-auto text-xs">
            {JSON.stringify(
              { syncCounts: data.walletIndexing.syncCounts, alerts: data.dataQuality },
              null,
              2,
            )}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">{data.dataQuality.note}</p>
        </Card>

        <Card>
          <CardHeader title="Wallet indexing (sample)" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-2">Address</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Last synced</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.walletIndexing.sample.map(
                  (w: {
                    id: string;
                    address: string;
                    sync_status: string;
                    last_synced_at: string | null;
                    sync_error: string | null;
                  }) => (
                    <tr key={w.id} className="border-b border-border/60">
                      <td className="py-2 pr-2">
                        <WalletAddress address={w.address} />
                      </td>
                      <td className="py-2 pr-2">
                        {w.sync_status}
                        {w.sync_error ? (
                          <span className="block text-xs text-destructive">{w.sync_error}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">
                        {w.last_synced_at ?? "—"}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={enqueue.isPending}
                          onClick={() => enqueue.mutate(w.id)}
                        >
                          Enqueue sync
                        </Button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Worker jobs" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-2">Kind</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Attempts</th>
                  <th className="py-2 pr-2">Error</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map(
                  (j: {
                    id: string;
                    kind: string;
                    status: string;
                    attempts: number;
                    last_error: string | null;
                  }) => (
                    <tr key={j.id} className="border-b border-border/60">
                      <td className="py-2 pr-2">{j.kind}</td>
                      <td className="py-2 pr-2">{j.status}</td>
                      <td className="py-2 pr-2">{j.attempts}</td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">
                        {j.last_error ?? "—"}
                      </td>
                      <td className="py-2">
                        {(j.status === "failed" || j.status === "cancelled") && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={retry.isPending}
                            onClick={() => retry.mutate(j.id)}
                          >
                            Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Audit log" />
          <ul className="space-y-2 text-sm">
            {data.audit.map(
              (e: {
                id: string;
                action: string;
                actor_user_id: string | null;
                target_type: string | null;
                target_id: string | null;
                created_at: string;
              }) => (
                <li key={e.id} className="border-b border-border/50 py-2">
                  <span className="font-medium">{e.action}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {e.created_at} · actor {e.actor_user_id ?? "—"} · {e.target_type}/{e.target_id}
                  </span>
                </li>
              ),
            )}
            {!data.audit.length ? (
              <li className="text-muted-foreground">No audit events yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
