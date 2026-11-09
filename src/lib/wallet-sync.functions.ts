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
    const { notifyIfEnabled } = await import("@/lib/notifications/notify.server");
    if (result.status === "failed") {
      await notifyIfEnabled({
        profileId: profile.id,
        type: "wallet_sync_failure",
        title: "Wallet sync failed",
        body: result.error ?? "Robinhood Chain sync failed. Try again shortly.",
        dedupeKey: `sync_fail:${wallet.id}:${result.error ?? "unknown"}`,
        payload: { walletId: wallet.id },
      });
      return { ...result, pendingValuations: 0 };
    }
    try {
      const { detectTrades } = await import("@/lib/chains/robinhood/trades.server");
      const { valueTrades, recalcPnl } = await import("@/lib/pnl/fifo.server");
      await detectTrades(wallet.id, (wallet.address_normalized ?? wallet.address).toLowerCase());
      const pendingValuations = await valueTrades(wallet.id);
      await recalcPnl(wallet.id);
      await notifyIfEnabled({
        profileId: profile.id,
        type: "wallet_sync_complete",
        title: "Wallet sync complete",
        body: "Your Robinhood Chain wallet finished this sync batch.",
        dedupeKey: `sync_ok:${wallet.id}:${result.status}:${pendingValuations}`,
        payload: { walletId: wallet.id, status: result.status, pendingValuations },
      });
      return { ...result, pendingValuations };
    } catch (e) {
      console.log("[pnl] failed", e instanceof Error ? e.message : e);
      await notifyIfEnabled({
        profileId: profile.id,
        type: "wallet_sync_failure",
        title: "Trade pricing failed",
        body: "Sync stored chain data but pricing/PnL failed. Try again shortly.",
        dedupeKey: `pnl_fail:${wallet.id}`,
        payload: { walletId: wallet.id },
      });
      return { ...result, status: "failed" as const, error: "Trade pricing failed. Try again shortly.", pendingValuations: 0 };
    }
  });
