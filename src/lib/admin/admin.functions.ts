import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, writeAudit } from "./admin.server";
import { enqueueJob } from "@/lib/worker/jobs.server";

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [wallets, jobs, alerts, audit] = await Promise.all([
      supabaseAdmin
        .from("wallets")
        .select("id,address,sync_status,sync_error,last_synced_at,backfill_complete,chain")
        .eq("chain", "robinhood")
        .order("last_synced_at", { ascending: true, nullsFirst: true })
        .limit(100),
      supabaseAdmin
        .from("worker_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("alert_definitions").select("id,kind,enabled").limit(500),
      supabaseAdmin
        .from("audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const syncCounts: Record<string, number> = {};
    for (const w of wallets.data ?? []) {
      syncCounts[w.sync_status] = (syncCounts[w.sync_status] ?? 0) + 1;
    }
    const alertCounts = { total: 0, token_price: 0, wallet_activity: 0, enabled: 0 };
    for (const a of alerts.data ?? []) {
      alertCounts.total += 1;
      if (a.enabled) alertCounts.enabled += 1;
      if (a.kind === "token_price") alertCounts.token_price += 1;
      if (a.kind === "wallet_activity") alertCounts.wallet_activity += 1;
    }

    return {
      walletIndexing: { sample: wallets.data ?? [], syncCounts },
      jobs: jobs.data ?? [],
      dataQuality: {
        alertCounts,
        note: "Token price alerts evaluate only when DefiLlama returns a real robinhood:price; missing prices skip trigger (never invented).",
      },
      audit: audit.data ?? [],
    };
  });

export const adminRetryJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("worker_jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("worker_jobs")
      .update({
        status: "queued",
        run_after: now,
        last_error: null,
        locked_at: null,
        locked_by: null,
        updated_at: now,
        attempts: 0,
      })
      .eq("id", data.jobId);
    await writeAudit({
      actorUserId: context.userId,
      action: "admin_retry_job",
      targetType: "worker_job",
      targetId: data.jobId,
    });
    return { ok: true as const };
  });

export const adminEnqueueWalletSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const id = await enqueueJob({ kind: "wallet_sync", walletId: data.walletId });
    await writeAudit({
      actorUserId: context.userId,
      action: "admin_enqueue_wallet_sync",
      targetType: "wallet",
      targetId: data.walletId,
      meta: { jobId: id },
    });
    return { ok: true as const, jobId: id };
  });
