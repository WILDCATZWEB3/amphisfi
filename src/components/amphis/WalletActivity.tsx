import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { Button } from "@/components/amphis/Button";
import { supabase } from "@/integrations/supabase/client";
import { syncMyWallet } from "@/lib/wallet-sync.functions";

/** Robinhood Chain sync status and real indexed counts. No PnL, volume or rank. */
export function WalletActivity({ profileId }: { profileId: string }) {
  const qc = useQueryClient();
  const sync = useServerFn(syncMyWallet);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  const q = useQuery({
    queryKey: ["wallet-activity", profileId],
    queryFn: async () => {
      const { data: w } = await supabase
        .from("wallets")
        .select("id,sync_status,last_synced_at,backfill_complete,sync_error,blocks_processed,last_indexed_block")
        .eq("profile_id", profileId).eq("chain", "robinhood").eq("is_primary", true).maybeSingle();
      if (!w) return null;
      const [{ count: txCount }, { data: rows }] = await Promise.all([
        supabase.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("wallet_id", w.id),
        supabase.from("wallet_transactions").select("transaction_id").eq("wallet_id", w.id).limit(1000),
      ]);
      const ids = (rows ?? []).map((r) => r.transaction_id);
      const { count: transfers } = ids.length
        ? await supabase.from("token_transfers").select("id", { count: "exact", head: true }).in("transaction_id", ids)
        : { count: 0 };
      return { wallet: w, txCount: txCount ?? 0, transfers: transfers ?? 0 };
    },
  });

  if (!q.data) return null;
  const { wallet, txCount, transfers } = q.data;

  const run = async () => {
    setBusy(true);
    setError(null);
    stop.current = false;
    try {
      for (let i = 0; i < 300 && !stop.current; i++) {
        const r = await sync({ data: { walletId: wallet.id } });
        await qc.invalidateQueries({ queryKey: ["wallet-activity", profileId] });
        if (r.status === "failed") throw new Error(r.error ?? "Sync failed");
        if (r.status === "completed") break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const label: Record<string, string> = {
    never_synced: "Not synced yet", syncing: "Syncing", partial: "Partially synced", completed: "Up to date", failed: "Sync failed",
  };
  const row = "flex items-center justify-between gap-3 text-sm";

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className={row}>
        <span className="text-muted-foreground">Sync status</span>
        <span>{label[wallet.sync_status] ?? wallet.sync_status}</span>
      </div>
      {wallet.sync_error ? <p className="text-xs text-destructive">{wallet.sync_error}</p> : null}
      <div className={row}>
        <span className="text-muted-foreground">Transactions indexed</span>
        <span>{wallet.sync_status === "completed" && txCount === 0 ? "No activity found" : txCount}</span>
      </div>
      <div className={row}>
        <span className="text-muted-foreground">Token transfers</span>
        <span>{transfers}</span>
      </div>
      <div className={row}>
        <span className="text-muted-foreground">Blocks scanned</span>
        <span>{Number(wallet.blocks_processed ?? 0).toLocaleString()}</span>
      </div>
      <p className="text-xs text-muted-foreground">Trading analysis will appear once trade detection for Robinhood Chain is built.</p>
      {busy ? (
        <Button variant="secondary" className="w-full" onClick={() => { stop.current = true; }}>
          Syncing… tap to pause
        </Button>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => void run()}>
          {wallet.sync_status === "partial" ? "Resume sync" : "Sync wallet history"}
        </Button>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
