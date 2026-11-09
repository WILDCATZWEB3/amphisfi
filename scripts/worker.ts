/**
 * Amphis durable worker entrypoint.
 * Run as a separate Railway service: `bun run worker`
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ ROBINHOOD_RPC_URL recommended).
 * Does not expose secrets. Graceful shutdown on SIGINT/SIGTERM.
 */
import { randomUUID } from "node:crypto";

const WORKER_ID = process.env["WORKER_ID"] || `amphis-worker-${randomUUID().slice(0, 8)}`;
const LOOP_MS = Number(process.env["WORKER_LOOP_MS"] ?? 5_000);
const BUDGET_MS = Number(process.env["WORKER_BUDGET_MS"] ?? 25_000);

let stopping = false;

function log(msg: string, extra: Record<string, unknown> = {}) {
  console.log(`[worker ${WORKER_ID}] ${msg}`, JSON.stringify(extra));
}

async function tick() {
  const {
    enqueueDueWalletSyncs,
    enqueueJob,
    claimNextJob,
    completeJob,
    failJob,
    processWalletSyncJob,
    processPriceAlertJobs,
  } = await import("../src/lib/worker/jobs.server");

  const started = Date.now();
  const enqueued = await enqueueDueWalletSyncs(15);
  // Periodically queue a price-alerts sweep job
  if (Math.random() < 0.25) {
    await enqueueJob({ kind: "price_alerts", payload: { source: "worker_tick" } });
  }
  log("enqueued sync candidates", { enqueued });

  while (!stopping && Date.now() - started < BUDGET_MS) {
    const job = await claimNextJob(WORKER_ID);
    if (!job) break;

    try {
      if (job.kind === "wallet_sync") {
        if (!job.wallet_id) throw new Error("wallet_sync missing wallet_id");
        const result = await processWalletSyncJob(job.wallet_id);
        log("wallet_sync ok", { jobId: job.id, walletId: job.wallet_id, result });
      } else if (job.kind === "price_alerts") {
        const result = await processPriceAlertJobs();
        log("price_alerts", { jobId: job.id, result });
      } else {
        throw new Error(`Unknown job kind ${job.kind}`);
      }
      await completeJob(job.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log("job failed", { jobId: job.id, message });
      await failJob(job.id, job.attempts ?? 1, job.max_attempts ?? 5, message);
    }
  }
}

async function main() {
  log("starting", { loopMs: LOOP_MS, budgetMs: BUDGET_MS });
  const onStop = (sig: string) => {
    log("shutdown signal", { sig });
    stopping = true;
  };
  process.on("SIGINT", () => onStop("SIGINT"));
  process.on("SIGTERM", () => onStop("SIGTERM"));

  while (!stopping) {
    try {
      await tick();
    } catch (e) {
      log("tick error", { error: e instanceof Error ? e.message : String(e) });
    }
    if (stopping) break;
    await new Promise((r) => setTimeout(r, LOOP_MS));
  }
  log("stopped cleanly");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
