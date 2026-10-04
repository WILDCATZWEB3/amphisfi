import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Runs one bounded batch of the signed-in user's Robinhood Chain wallet sync,
 * then detects trades, prices them and recalculates cost basis.
 * The wallet must belong to the caller; browser-supplied addresses are never trusted.
 */
export const syncMyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("id").eq("user_id", context.userId).maybeSingle();
    if (!profile) throw new Error("No Amphis profile.");
    const { data: wallet } = await context.supabase
      .from("wallets").select("id,address,address_normalized").eq("id", data.walletId).eq("profile_id", profile.id).eq("chain", "robinhood").maybeSingle();
    if (!wallet) throw new Error("This wallet is not linked to your account.");
    const { syncRobinhoodWallet } = await import("@/lib/chains/robinhood/sync.server");
    const result = await syncRobinhoodWallet(wallet.id);
    if (result.status === "failed") return { ...result, pendingValuations: 0 };
    try {
      const { detectTrades } = await import("@/lib/chains/robinhood/trades.server");
      const { valueTrades, recalcPnl } = await import("@/lib/pnl/fifo.server");
      await detectTrades(wallet.id, (wallet.address_normalized ?? wallet.address).toLowerCase());
      const pendingValuations = await valueTrades(wallet.id);
      await recalcPnl(wallet.id);
      return { ...result, pendingValuations };
    } catch (e) {
      console.log("[pnl] failed", e instanceof Error ? e.message : e);
      return { ...result, status: "failed" as const, error: "Trade pricing failed. Try again shortly.", pendingValuations: 0 };
    }
  });
