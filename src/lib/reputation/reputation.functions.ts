import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isEvmAddress, normalizeAddress } from "@/lib/evm/address";
import { computeReputationV1, REPUTATION_VERSION } from "./score";

export const getWalletReputation = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ address: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    if (!isEvmAddress(data.address)) {
      return {
        found: false as const,
        reason: "Invalid wallet address.",
      };
    }
    const addr = normalizeAddress(data.address);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("id,sync_status,address_normalized")
      .eq("chain", "robinhood")
      .eq("address_normalized", addr)
      .maybeSingle();
    if (!wallet) {
      return { found: false as const, reason: "Wallet not indexed." };
    }

    const { data: snap } = await supabaseAdmin
      .from("evm_performance_snapshots")
      .select(
        "performance_ready,data_completeness,trade_count,priced_trade_count,closed_trade_count,winning_trades,losing_trades,win_rate",
      )
      .eq("wallet_id", wallet.id)
      .eq("period", "all")
      .maybeSingle();

    const result = computeReputationV1({
      performanceReady: snap?.performance_ready ?? false,
      dataCompleteness: snap?.data_completeness ?? "insufficient",
      tradeCount: snap?.trade_count ?? 0,
      pricedTradeCount: snap?.priced_trade_count ?? 0,
      closedTradeCount: snap?.closed_trade_count ?? 0,
      winningTrades: snap?.winning_trades ?? 0,
      losingTrades: snap?.losing_trades ?? 0,
      winRate:
        snap?.win_rate === null || snap?.win_rate === undefined ? null : Number(snap.win_rate),
      syncStatus: wallet.sync_status,
    });

    // Persist snapshot (server write); ignore failures if migration not applied.
    try {
      await supabaseAdmin.from("reputation_snapshots").upsert(
        {
          wallet_id: wallet.id,
          score_version: REPUTATION_VERSION,
          score: result.score,
          status: result.status,
          breakdown: result.breakdown,
          methodology: result.methodology,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "wallet_id,score_version" },
      );
    } catch {
      // table may not exist yet in a given environment
    }

    return {
      found: true as const,
      address: wallet.address_normalized ?? addr,
      reputation: result,
    };
  });
