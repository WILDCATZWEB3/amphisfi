import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Rewrites a signed-in user's draft bio. Returns a suggestion only; nothing is saved. */
export const polishBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ draft: z.string().trim().min(3).max(600) }).parse(d))
  .handler(async ({ data }) => {
    const { rewriteBio } = await import("./bio.server");
    try {
      return { bio: await rewriteBio(data.draft), error: null as string | null };
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      console.error("[polishBio]", status, err instanceof Error ? err.message : err);
      const msg =
        status === 429 ? "Too many requests right now. Please try again in a minute."
        : status === 402 ? "AI credits are used up for this workspace."
        : "Couldn't polish the bio right now.";
      return { bio: null, error: msg };
    }
  });
