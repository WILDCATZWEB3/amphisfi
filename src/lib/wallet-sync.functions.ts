import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Runs one batch of the signed-in user's wallet sync. The wallet is looked up
 * from the authenticated account — a browser-supplied address is never trusted.
 */
export const syncMyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("No Amphis profile.");
    const { data: wallet } = await context.supabase
      .from("wallets")
      .select("id")
      .eq("id", data.walletId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!wallet) throw new Error("This wallet is not linked to your account.");

    const { syncWalletBatch } = await import("@/lib/solana/sync.server");
    return syncWalletBatch(wallet.id);
  });

/** Re-runs the current trade parser over the signed-in user's already-indexed transactions. */
export const reprocessMyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("id").eq("user_id", context.userId).maybeSingle();
    if (!profile) throw new Error("No Amphis profile.");
    const { data: wallet } = await context.supabase
      .from("wallets").select("id").eq("id", data.walletId).eq("profile_id", profile.id).maybeSingle();
    if (!wallet) throw new Error("This wallet is not linked to your account.");
    const { reprocessWalletBatch } = await import("@/lib/solana/sync.server");
    return reprocessWalletBatch(wallet.id);
  });
