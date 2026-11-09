import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildCumulativePnlSeries,
  buildTradeActivitySeries,
  buildWinLossSummary,
  windowBounds,
  type ChartWindow,
} from "@/lib/charts/series";

async function myProfileId(supabase: { from: Function }, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No Amphis profile.");
  return data.id as string;
}

export const getWalletChartData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        walletId: z.string().uuid(),
        window: z.enum(["7d", "30d", "90d", "all"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const { data: wallet } = await context.supabase
      .from("wallets")
      .select("id")
      .eq("id", data.walletId)
      .eq("profile_id", profileId)
      .eq("chain", "robinhood")
      .maybeSingle();
    if (!wallet) throw new Error("Wallet not found on your account.");

    const window = (data.window ?? "30d") as ChartWindow;
    const bounds = windowBounds(window);

    const [{ data: pnl }, { data: trades }] = await Promise.all([
      context.supabase
        .from("evm_realized_pnl")
        .select("disposed_at,pnl_usd,fully_matched")
        .eq("wallet_id", wallet.id)
        .order("disposed_at", { ascending: true }),
      context.supabase
        .from("evm_trades")
        .select("block_time")
        .eq("wallet_id", wallet.id)
        .order("block_time", { ascending: true }),
    ]);

    const realized = (pnl ?? []).map((r) => ({
      disposedAt: r.disposed_at,
      pnlUsd: Number(r.pnl_usd),
      fullyMatched: r.fully_matched,
    }));
    const tradePts = (trades ?? []).map((t) => ({ blockTime: t.block_time }));

    const cumulativePnl = buildCumulativePnlSeries(realized, bounds);
    const activity = buildTradeActivitySeries(tradePts, bounds);
    const winLoss = buildWinLossSummary(realized);

    return {
      window,
      cumulativePnl,
      activity,
      winLoss,
      insufficient:
        cumulativePnl.length === 0 &&
        activity.every((a) => a.tradeCount === 0) &&
        winLoss.insufficient,
    };
  });
