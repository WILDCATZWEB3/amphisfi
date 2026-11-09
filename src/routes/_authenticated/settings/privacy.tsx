import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/amphis/Button";
import { Card, CardHeader } from "@/components/amphis/Card";
import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import {
  exportMyAccountData,
  getPrivacySettings,
  requestAccountDeletion,
  updatePrivacySettings,
} from "@/lib/settings/privacy.functions";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy settings — Amphis" },
      {
        name: "description",
        content: "Control profile visibility, public wallet contribution, export, and deletion.",
      },
    ],
  }),
  component: PrivacySettingsPage,
});

type WalletRow = {
  id: string;
  address: string;
  public_contribute: boolean;
  sync_status: string;
};

function PrivacySettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getFn = useServerFn(getPrivacySettings);
  const updateFn = useServerFn(updatePrivacySettings);
  const exportFn = useServerFn(exportMyAccountData);
  const deleteFn = useServerFn(requestAccountDeletion);

  const q = useQuery({ queryKey: ["privacy-settings"], queryFn: () => getFn() });
  const [visibility, setVisibility] = useState<"public" | "private" | null>(null);
  const [contribute, setContribute] = useState<Record<string, boolean>>({});
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const data = q.data;
      if (!data) return;
      const wallets = (data.wallets ?? []) as WalletRow[];
      await updateFn({
        data: {
          visibility: visibility ?? data.visibility,
          walletContribute: wallets.map((w) => ({
            walletId: w.id,
            publicContribute: contribute[w.id] ?? w.public_contribute !== false,
          })),
        },
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["privacy-settings"] }),
  });

  const doExport = useMutation({
    mutationFn: () => exportFn(),
    onSuccess: (payload) => setExportJson(JSON.stringify(payload, null, 2)),
  });

  const doDelete = useMutation({
    mutationFn: () => deleteFn({ data: { confirm: "DELETE" } }),
    onSuccess: (r) => {
      setDeleteMsg(r.message);
      if (r.authDeleted) void navigate({ to: "/" });
    },
  });

  if (q.isLoading) {
    return (
      <div className="container-page py-16">
        <LoadingState label="Loading privacy settings" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Could not load privacy settings"
          description="Please try again."
          onRetry={() => void q.refetch()}
        />
      </div>
    );
  }

  const vis = visibility ?? q.data.visibility;
  const wallets = (q.data.wallets ?? []) as WalletRow[];

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Privacy"
        description="Profile visibility, which linked wallets contribute publicly, export, and deletion."
      />
      <p className="mt-2 text-sm text-muted-foreground">
        <Link to="/me" className="text-accent">
          ← My Profile
        </Link>
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile visibility" />
          <p className="mb-3 text-sm text-muted-foreground">
            Private profiles hide your username and avatar from Explore/Leaderboard. Wallet pages
            remain address-based.
          </p>
          <div className="flex gap-3">
            {(["public", "private"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`rounded-md border px-3 py-2 text-sm capitalize ${
                  vis === v ? "border-accent bg-secondary" : "border-border"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Public wallet contribution" />
          {!wallets.length ? (
            <EmptyState
              title="No linked wallets"
              description="Link a Robinhood Chain wallet on My Profile first."
            />
          ) : (
            <ul className="space-y-3">
              {wallets.map((w) => {
                const on = contribute[w.id] ?? w.public_contribute !== false;
                return (
                  <li key={w.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <WalletAddress address={w.address} />
                      <p className="text-xs text-muted-foreground">sync: {w.sync_status}</p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => setContribute((c) => ({ ...c, [w.id]: e.target.checked }))}
                      />
                      Contribute
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4">
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save privacy settings"}
            </Button>
            {save.isSuccess ? <p className="mt-2 text-xs text-muted-foreground">Saved.</p> : null}
            {save.isError ? (
              <p className="mt-2 text-xs text-destructive">{(save.error as Error).message}</p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Export my data" />
          <p className="mb-3 text-sm text-muted-foreground">
            Download a JSON export of your profile, wallets, follows, watchlists, notifications, and
            alerts.
          </p>
          <Button type="button" onClick={() => doExport.mutate()} disabled={doExport.isPending}>
            {doExport.isPending ? "Preparing…" : "Export JSON"}
          </Button>
          {exportJson ? (
            <div className="mt-3">
              <a
                className="text-sm text-accent underline"
                href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson)}`}
                download={`amphis-export-${new Date().toISOString().slice(0, 10)}.json`}
              >
                Download export file
              </a>
              <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-secondary/40 p-2 text-xs">
                {exportJson.slice(0, 4000)}
                {exportJson.length > 4000 ? "\n…" : ""}
              </pre>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Delete account" />
          <p className="mb-3 text-sm text-muted-foreground">
            Scrubs your public profile, opts wallets out of contribution, disables alerts, and
            attempts auth-user deletion. Confirm in the dialog — irreversible product scrub.
          </p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (window.confirm("Permanently scrub your Amphis account data?")) doDelete.mutate();
            }}
            disabled={doDelete.isPending}
          >
            {doDelete.isPending ? "Deleting…" : "Request account deletion"}
          </Button>
          {deleteMsg ? <p className="mt-2 text-sm text-muted-foreground">{deleteMsg}</p> : null}
          {doDelete.isError ? (
            <p className="mt-2 text-xs text-destructive">{(doDelete.error as Error).message}</p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
