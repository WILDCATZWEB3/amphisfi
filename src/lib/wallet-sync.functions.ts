import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Robinhood Chain history sync is not built yet. This returns an honest
 * "not available" result instead of fabricating any activity.
 */
export const syncMyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid() }).parse(d))
  .handler(async () => ({
    status: "failed" as const,
    processed: 0,
    error: "Robinhood Chain history sync is not available yet.",
  }));

export const reprocessMyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid() }).parse(d))
  .handler(async () => ({ reprocessed: 0, remaining: 0 }));
