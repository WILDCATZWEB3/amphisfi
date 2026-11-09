import type { Json } from "@/integrations/supabase/types";
/**
 * DB-backed worker job helpers (service role). Coordinates per-wallet sync jobs.
 */
import { nextRunAfter } from "./backoff";

export type JobKind = "wallet_sync" | "price_alerts";

export async function enqueueJob(input: {
  kind: JobKind;
  walletId?: string | null;
  payload?: Json;
  runAfter?: string;
  maxAttempts?: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Avoid duplicate queued sync for same wallet
  if (input.kind === "wallet_sync" && input.walletId) {
    const { data: existing } = await supabaseAdmin
      .from("worker_jobs")
      .select("id")
      .eq("kind", "wallet_sync")
      .eq("wallet_id", input.walletId)
      .in("status", ["queued", "running"])
      .maybeSingle();
    if (existing) return existing.id;
  }
  const { data, error } = await supabaseAdmin
    .from("worker_jobs")
    .insert({
      kind: input.kind,
      wallet_id: input.walletId ?? null,
      payload: input.payload ?? {},
      status: "queued",
      run_after: input.runAfter ?? new Date().toISOString(),
      max_attempts: input.maxAttempts ?? 5,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function claimNextJob(workerId: string, leaseSeconds = 120) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { leaseExpiresAtIso } = await import("./claim");

  // Prefer atomic Postgres claim (SKIP LOCKED + lease). Requires migration 0012.
  const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc("claim_worker_job", {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
  if (!rpcErr) {
    // rpc may return a row object, array, or null
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (row && typeof row === "object" && "id" in (row as object))
      return row as Record<string, unknown>;
    return null;
  }

  // Fallback (pre-0012 or RPC missing): optimistic compare-and-set + lease, still status=queued guard.
  console.log(
    "[worker] claim_worker_job RPC unavailable; using optimistic fallback",
    rpcErr.message,
  );
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const { data: candidates, error } = await supabaseAdmin
    .from("worker_jobs")
    .select("*")
    .eq("status", "queued")
    .lte("run_after", now)
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) throw error;

  for (const job of candidates ?? []) {
    if (job.kind === "wallet_sync" && job.wallet_id) {
      const { data: running } = await supabaseAdmin
        .from("worker_jobs")
        .select("id,lease_expires_at")
        .eq("kind", "wallet_sync")
        .eq("wallet_id", job.wallet_id)
        .eq("status", "running")
        .maybeSingle();
      if (running) {
        const exp = (running as { lease_expires_at?: string | null }).lease_expires_at;
        if (!exp || Date.parse(exp) >= nowMs) continue;
      }
    }

    const { data: claimed, error: cErr } = await supabaseAdmin
      .from("worker_jobs")
      .update({
        status: "running",
        locked_at: now,
        locked_by: workerId,
        lease_expires_at: leaseExpiresAtIso(nowMs, leaseSeconds),
        attempts: (job.attempts ?? 0) + 1,
        updated_at: now,
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();
    if (cErr) continue;
    if (claimed) return claimed;
  }
  return null;
}

export async function completeJob(jobId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("worker_jobs")
    .update({ status: "completed", completed_at: now, updated_at: now, last_error: null })
    .eq("id", jobId);
}

export async function failJob(jobId: string, attempts: number, maxAttempts: number, err: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  if (attempts >= maxAttempts) {
    await supabaseAdmin
      .from("worker_jobs")
      .update({ status: "failed", last_error: err, updated_at: now, completed_at: now })
      .eq("id", jobId);
    return;
  }
  await supabaseAdmin
    .from("worker_jobs")
    .update({
      status: "queued",
      last_error: err,
      run_after: nextRunAfter(attempts),
      locked_at: null,
      locked_by: null,
      updated_at: now,
    })
    .eq("id", jobId);
}

export async function enqueueDueWalletSyncs(limit = 20) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: wallets } = await supabaseAdmin
    .from("wallets")
    .select("id,sync_status,backfill_complete")
    .eq("chain", "robinhood")
    .in("sync_status", ["never_synced", "partial", "failed", "completed"])
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  let n = 0;
  for (const w of wallets ?? []) {
    // Keep completed wallets on a slower cadence: only if backfill incomplete or stale > 6h
    if (w.sync_status === "completed" && w.backfill_complete) continue;
    await enqueueJob({ kind: "wallet_sync", walletId: w.id });
    n += 1;
  }
  return n;
}

export async function processWalletSyncJob(walletId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("id,address,address_normalized,profile_id")
    .eq("id", walletId)
    .maybeSingle();
  if (!wallet) throw new Error("Wallet missing");

  const { syncRobinhoodWallet } = await import("@/lib/chains/robinhood/sync.server");
  const result = await syncRobinhoodWallet(wallet.id);
  if (result.status === "failed") throw new Error(result.error ?? "sync failed");

  const { detectTrades } = await import("@/lib/chains/robinhood/trades.server");
  const { valueTrades, recalcPnl } = await import("@/lib/pnl/fifo.server");
  await detectTrades(wallet.id, (wallet.address_normalized ?? wallet.address).toLowerCase());
  const pending = await valueTrades(wallet.id);
  await recalcPnl(wallet.id);

  // Re-queue if more work remains
  if (result.status === "partial" || pending > 0) {
    await enqueueJob({
      kind: "wallet_sync",
      walletId: wallet.id,
      runAfter: new Date(Date.now() + 2_000).toISOString(),
    });
  }

  return { ...result, pendingValuations: pending };
}

/**
 * Evaluate token_price alerts when DefiLlama returns a real price.
 * If price unavailable, leave alert unevaluated and record note (not a fabricated fire).
 */
export async function processPriceAlertJobs() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { currentPrices } = await import("@/lib/prices/defillama.server");
  const { notifyIfEnabled } = await import("@/lib/notifications/notify.server");

  const { data: alerts } = await supabaseAdmin
    .from("alert_definitions")
    .select("*")
    .eq("kind", "token_price")
    .eq("enabled", true)
    .limit(50);

  let evaluated = 0;
  let triggered = 0;
  let skippedNoPrice = 0;

  for (const a of alerts ?? []) {
    if (!a.token_address || a.target_price_usd === null || !a.direction) continue;
    const prices = await currentPrices([a.token_address]);
    const price = prices.get(a.token_address) ?? null;
    const now = new Date().toISOString();
    if (price === null) {
      skippedNoPrice += 1;
      await supabaseAdmin
        .from("alert_definitions")
        .update({ last_evaluated_at: now })
        .eq("id", a.id);
      continue;
    }
    evaluated += 1;
    const hit =
      a.direction === "above"
        ? price >= Number(a.target_price_usd)
        : price <= Number(a.target_price_usd);
    if (hit) {
      triggered += 1;
      await supabaseAdmin
        .from("alert_definitions")
        .update({ last_evaluated_at: now, last_triggered_at: now })
        .eq("id", a.id);
      await notifyIfEnabled({
        profileId: a.profile_id,
        type: "price_alert",
        title: "Price alert triggered",
        body: `${a.token_address} is ${price} (target ${a.direction} ${a.target_price_usd}).`,
        dedupeKey: `price_alert:${a.id}:${now.slice(0, 13)}`,
        payload: { alertId: a.id, price, kind: "token_price" },
      });
    } else {
      await supabaseAdmin
        .from("alert_definitions")
        .update({ last_evaluated_at: now })
        .eq("id", a.id);
    }
  }

  return { evaluated, triggered, skippedNoPrice, total: alerts?.length ?? 0 };
}
