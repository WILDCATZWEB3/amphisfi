import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/amphis/Button";
import { supabase } from "@/integrations/supabase/client";
import { reprocessMyWallet, syncMyWallet } from "@/lib/wallet-sync.functions";

/** Sync status + count of verified (high/medium confidence) detected trades. No PnL, volume or rank. */
export function WalletActivity({ profileId }: { profileId: string }) {
  const qc = useQueryClient();
  const sync = useServerFn(syncMyWallet);
  const reprocess = useServerFn(reprocessMyWallet);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["wallet-activity", profileId],
    queryFn: async () => {
      const { data: w } = await supabase
        .from("wallets").select("id,sync_status,last_synced_at,backfill_complete,sync_error")
        .eq("profile_id", profileId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!w) return null;
      const { count } = await supabase.from("trades").select("id", { count: "exact", head: true })
        .eq("wallet_id", w.id).in("confidence", ["high", "medium"]);
      const { count: txCount } = await supabase.from("transactions").select("id", { count: "exact", head: true })
        .eq("wallet_id", w.id);
      return { wallet: w, trades: count ?? 0, txCount: txCount ?? 0 };
    },
  });

  if (!q.data) return null;
  const { wallet, trades, txCount } = q.data;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      for (let i = 0; i < 20; i++) {
        const r = await sync({ data: { walletId: wallet.id } });
        if (r.status === "failed") throw new Error(r.error ?? "Sync failed");
        await qc.invalidateQueries({ queryKey: ["wallet-activity", profileId] });
        if (r.status === "completed" || r.processed === 0) break;
      }
      for (let i = 0; i < 20; i++) {
        const r = await reprocess({ data: { walletId: wallet.id } });
        if (r.remaining === 0 || r.reprocessed === 0) break;
      }
      await qc.invalidateQueries({ queryKey: ["wallet-activity", profileId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const label: Record<string, string> = {
    never_synced: "Not synced yet", syncing: "Syncing", partial: "Partially synced", completed: "Up to date", failed: "Sync failed",
  };

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Sync status</span>
        <span>{label[wallet.sync_status] ?? wallet.sync_status}</span>
      </div>
      {wallet.sync_error ? <p className="text-xs text-destructive">{wallet.sync_error}</p> : null}
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Transactions indexed</span>
        <span>{wallet.sync_status === "completed" && txCount === 0 ? "No wallet activity found." : txCount}</span>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Trading activity</p>
        <p className="mt-1 text-sm">
          {trades > 0 ? `${trades} verified ${trades === 1 ? "trade" : "trades"} detected` : "No verified trades detected yet."}
        </p>
      </div>
      <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void run()}>
        {busy ? "Syncing…" : "Sync wallet history"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
