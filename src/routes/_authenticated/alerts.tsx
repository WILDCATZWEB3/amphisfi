import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { createAlert, deleteAlert, listMyAlerts } from "@/lib/alerts/alerts.functions";
import { listMyWallets } from "@/lib/portfolio/portfolio.functions";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — Amphis" },
      {
        name: "description",
        content:
          "Wallet activity alerts from indexed trades. Price alerts are saved but not continuously evaluated yet.",
      },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyAlerts);
  const createFn = useServerFn(createAlert);
  const deleteFn = useServerFn(deleteAlert);
  const walletsFn = useServerFn(listMyWallets);

  const alertsQ = useQuery({ queryKey: ["alerts"], queryFn: () => listFn() });
  const walletsQ = useQuery({ queryKey: ["my-wallets"], queryFn: () => walletsFn() });
  const [walletId, setWalletId] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      setNote(null);
      if (!walletId) throw new Error("Select a wallet.");
      return createFn({ data: { kind: "wallet_activity", walletId } });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["alerts"] }),
    onError: (e) => setNote((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (alertId: string) => deleteFn({ data: { alertId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Alerts"
        description="Wallet-activity alerts evaluate against real indexed trades on load. Token price alerts are stored but continuous evaluation is blocked until a worker and RH price coverage exist. No browser timers."
      />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm">
          <span className="text-muted-foreground">Wallet activity alert</span>
          <select
            className="mt-1 block h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
          >
            <option value="">Select linked wallet…</option>
            {(walletsQ.data?.wallets ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {(w.address_normalized ?? w.address).slice(0, 14)}…
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="h-10 rounded-md border border-border-strong px-4 text-sm hover:bg-secondary disabled:opacity-50"
          disabled={!walletId || create.isPending}
          onClick={() => create.mutate()}
        >
          Add alert
        </button>
      </div>
      {note ? <p className="mt-2 text-sm text-destructive">{note}</p> : null}

      <div className="mt-8">
        {alertsQ.isLoading ? (
          <LoadingState label="Loading alerts" />
        ) : alertsQ.isError ? (
          <ErrorState
            title="Could not load alerts"
            description="Apply migration 0010 if alert_definitions is missing."
            onRetry={() => void alertsQ.refetch()}
          />
        ) : !alertsQ.data?.alerts.length ? (
          <EmptyState
            title="No alerts yet"
            description="Create a wallet-activity alert for one of your linked wallets."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {alertsQ.data.alerts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {a.label ?? a.kind}{" "}
                    <span className="text-xs font-normal text-muted-foreground">({a.kind})</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.evaluationNote}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Status: {a.evaluationStatus}
                    {a.triggered ? " · triggered" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(a.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
