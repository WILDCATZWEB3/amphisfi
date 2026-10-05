import { useQuery } from "@tanstack/react-query";

import { Card, CardHeader } from "@/components/amphis/Card";
import { LoadingState } from "@/components/amphis/States";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAddress } from "@/lib/evm/address";

const LABEL: Record<string, string> = {
  never_synced: "Not synced", syncing: "Syncing", partial: "Partially synced", completed: "Synced", failed: "Sync failed",
};

/** Read-only, real indexing state for any Robinhood Chain wallet. */
export function IndexingStatus({ address }: { address: string }) {
  const q = useQuery({
    queryKey: ["indexing-status", normalizeAddress(address)],
    queryFn: async () => {
      const { data: w } = await supabase.from("wallets")
        .select("id,sync_status,last_synced_at,last_indexed_block,oldest_indexed_block")
        .eq("chain", "robinhood").eq("address_normalized", normalizeAddress(address)).maybeSingle();
      if (!w) return null;
      const { count } = await supabase.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("wallet_id", w.id);
      return { w, txs: count ?? 0 };
    },
  });
  const row = "flex items-center justify-between gap-3 text-sm";
  return (
    <Card>
      <CardHeader title="Indexing" />
      {q.isLoading ? <LoadingState label="Loading" /> : !q.data ? (
        <p className="text-sm text-muted-foreground">This wallet has not been indexed by Amphis yet.</p>
      ) : (
        <div className="space-y-2">
          <div className={row}><span className="text-muted-foreground">Status</span><span>{LABEL[q.data.w.sync_status] ?? q.data.w.sync_status}</span></div>
          <div className={row}><span className="text-muted-foreground">Transactions indexed</span><span>{q.data.txs}</span></div>
          <div className={row}><span className="text-muted-foreground">Coverage</span><span className="text-right">
            {q.data.w.last_indexed_block === null ? "—" : `Block ${Number(q.data.w.oldest_indexed_block ?? 0).toLocaleString()} → ${Number(q.data.w.last_indexed_block).toLocaleString()}`}
          </span></div>
          <div className={row}><span className="text-muted-foreground">Last synced</span><span>{q.data.w.last_synced_at ? new Date(q.data.w.last_synced_at).toLocaleString() : "Never"}</span></div>
          {q.data.txs === 0 ? <p className="text-xs text-muted-foreground">Not enough indexed data yet.</p> : null}
        </div>
      )}
    </Card>
  );
}
