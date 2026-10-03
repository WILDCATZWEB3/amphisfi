import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Runs one bounded batch of the signed-in user's Robinhood Chain wallet sync.
 * The wallet must belong to the caller; browser-supplied addresses are never trusted.
 */
export const syncMyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("id").eq("user_id", context.userId).maybeSingle();
    if (!profile) throw new Error("No Amphis profile.");
    const { data: wallet } = await context.supabase
      .from("wallets").select("id").eq("id", data.walletId).eq("profile_id", profile.id).eq("chain", "robinhood").maybeSingle();
    if (!wallet) throw new Error("This wallet is not linked to your account.");
    const { syncRobinhoodWallet } = await import("@/lib/chains/robinhood/sync.server");
    return syncRobinhoodWallet(wallet.id);
  });
