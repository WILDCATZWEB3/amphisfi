/**
 * Resumable, incremental wallet sync. Each call processes one bounded batch
 * and saves its cursors, so an interrupted sync continues where it stopped.
 *
 *  - Forward: signatures newer than wallets.newest_signature (incremental).
 *  - Backfill: signatures older than wallets.oldest_signature until history ends.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSignaturesForAddress, getTransactions, type SignatureInfo } from "./rpc.server";
import { normalizeTransaction, SOL_MINT } from "./parser";

const BATCH = 25;
const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(`[wallet-sync] ${msg}`, JSON.stringify(extra));

type WalletRow = {
  id: string; address: string; newest_signature: string | null; oldest_signature: string | null;
  backfill_complete: boolean;
};

export type SyncResult = {
  status: "completed" | "partial" | "failed";
  processed: number;
  inserted: number;
  swaps: number;
  error?: string;
};

const iso = (t: number | null) => (t ? new Date(t * 1000).toISOString() : null);

export async function syncWalletBatch(walletId: string): Promise<SyncResult> {
  const db = supabaseAdmin;
  const { data: w, error } = await db
    .from("wallets")
    .select("id,address,newest_signature,oldest_signature,backfill_complete")
    .eq("id", walletId)
    .single();
  if (error || !w) throw new Error("Wallet not found");
  const wallet = w as WalletRow;

  await db.from("wallets").update({ sync_status: "syncing", sync_error: null, sync_started_at: new Date().toISOString() }).eq("id", walletId);
  log("sync started", { walletId });

  try {
    let sigs: SignatureInfo[] = [];
    let mode: "forward" | "backfill" = "backfill";

    if (wallet.newest_signature) {
      // Find the oldest unseen signatures newer than our newest cursor.
      let page = await getSignaturesForAddress(wallet.address, { until: wallet.newest_signature, limit: 1000 });
      let all = page;
      let guard = 0;
      while (page.length === 1000 && guard++ < 10) {
        page = await getSignaturesForAddress(wallet.address, { until: wallet.newest_signature, before: page[page.length - 1]!.signature, limit: 1000 });
        all = all.concat(page);
      }
      if (all.length > 0) {
        mode = "forward";
        sigs = all.slice(-BATCH); // oldest-first chunk, newest-first order
      }
    }
    if (mode === "backfill" && !wallet.backfill_complete) {
      sigs = await getSignaturesForAddress(wallet.address, { before: wallet.oldest_signature ?? undefined, limit: BATCH });
    }

    // Skip signatures already stored (idempotency).
    const { data: existing } = sigs.length
      ? await db.from("transactions").select("signature").eq("wallet_id", walletId).in("signature", sigs.map((s) => s.signature))
      : { data: [] as { signature: string }[] };
    const have = new Set((existing ?? []).map((e) => e.signature));
    const todo = sigs.filter((s) => !have.has(s.signature));

    const txs = await getTransactions(todo.map((s) => s.signature));
    let inserted = 0;
    let swaps = 0;
    const mintRows = new Map<string, number>();

    for (let i = 0; i < todo.length; i++) {
      const s = todo[i]!;
      const tx = txs[i];
      if (!tx) throw new Error(`Transaction details unavailable for ${s.signature.slice(0, 8)}…`);
      const n = normalizeTransaction(tx, wallet.address);
      for (const m of n.mints) mintRows.set(m.mint, m.decimals);

      const { data: row, error: insErr } = await db
        .from("transactions")
        .upsert(
          {
            wallet_id: walletId, signature: s.signature, slot: tx.slot, block_time: iso(tx.blockTime ?? s.blockTime),
            status: n.status, fee_lamports: n.feeLamports, source: n.source, parsed_type: n.parsedType,
            programs: n.programs, raw_transaction_reference: `solana:mainnet:${s.signature}`,
          },
          { onConflict: "wallet_id,signature", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();
      if (insErr) throw new Error(`Store failed: ${insErr.message}`);
      if (!row) continue;
      inserted++;

      if (n.swap) {
        const { error: tErr } = await db.from("trades").upsert(
          {
            wallet_id: walletId, transaction_id: row.id, signature: s.signature, block_time: iso(tx.blockTime),
            input_mint: n.swap.inputMint, input_amount: n.swap.inputAmount, input_decimals: n.swap.inputDecimals,
            output_mint: n.swap.outputMint, output_amount: n.swap.outputAmount, output_decimals: n.swap.outputDecimals,
            source: n.swap.source, confidence: n.swap.confidence,
          },
          { onConflict: "transaction_id", ignoreDuplicates: true },
        );
        if (tErr) throw new Error(`Trade store failed: ${tErr.message}`);
        swaps++;
      }
    }

    if (swaps > 0) mintRows.set(SOL_MINT, 9);
    if (mintRows.size) {
      // Only decimals are verified from chain data; symbol/name stay null.
      await db.from("token_assets").upsert(
        [...mintRows].map(([mint, decimals]) => ({ mint, decimals })),
        { onConflict: "mint", ignoreDuplicates: true },
      );
    }

    // Advance cursors only after the whole batch is stored.
    const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
    if (sigs.length) {
      const newest = sigs[0]!;
      const oldest = sigs[sigs.length - 1]!;
      patch["last_signature"] = oldest.signature;
      if (mode === "forward") {
        patch["newest_signature"] = newest.signature;
        patch["newest_block_time"] = iso(newest.blockTime);
      } else {
        patch["oldest_signature"] = oldest.signature;
        patch["oldest_block_time"] = iso(oldest.blockTime);
        if (!wallet.newest_signature) {
          patch["newest_signature"] = newest.signature;
          patch["newest_block_time"] = iso(newest.blockTime);
        }
      }
    }
    const backfillDone = wallet.backfill_complete || (mode === "backfill" && sigs.length < BATCH);
    patch["backfill_complete"] = backfillDone;
    const done = backfillDone && (mode === "backfill" || sigs.length < BATCH);
    patch["sync_status"] = done ? "completed" : "partial";
    await db.from("wallets").update(patch).eq("id", walletId);

    log(done ? "sync completed" : "sync progress", { walletId, mode, processed: sigs.length, inserted, swaps });
    return { status: done ? "completed" : "partial", processed: sigs.length, inserted, swaps };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await db.from("wallets").update({ sync_status: "failed", sync_error: message.slice(0, 300) }).eq("id", walletId);
    log("sync failed", { walletId, message });
    return { status: "failed", processed: 0, inserted: 0, swaps: 0, error: message };
  }
}
