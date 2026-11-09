import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isEvmAddress, normalizeAddress } from "@/lib/evm/address";
import { publicRateLimit } from "@/lib/rate-limit/public-middleware";

const QuerySchema = z.object({
  q: z.string().trim().min(1).max(128),
  page: z.number().int().min(1).max(100).optional(),
  pageSize: z.number().int().min(1).max(25).optional(),
});

export type SearchHit =
  | {
      type: "profile";
      username: string;
      avatarUrl: string | null;
      walletAddress: string | null;
    }
  | {
      type: "wallet";
      address: string;
      username: string | null;
      syncStatus: string;
    }
  | {
      type: "token";
      chain: string;
      address: string;
      symbol: string | null;
      name: string | null;
    };

export const searchAmphis = createServerFn({ method: "GET" })
  .middleware([publicRateLimit])
  .inputValidator((d: unknown) => QuerySchema.parse(d))
  .handler(async ({ data }) => {
    const page = data.page ?? 1;
    const pageSize = data.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const q = data.q.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const hits: SearchHit[] = [];

    if (isEvmAddress(q)) {
      const addr = normalizeAddress(q);
      const { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("address,address_normalized,sync_status,profiles(username,visibility)")
        .eq("chain", "robinhood")
        .eq("address_normalized", addr)
        .maybeSingle();
      if (wallet) {
        const profile = wallet.profiles as {
          username: string | null;
          visibility: string | null;
        } | null;
        hits.push({
          type: "wallet",
          address: wallet.address_normalized ?? wallet.address,
          username: profile?.visibility === "private" ? null : (profile?.username ?? null),
          syncStatus: wallet.sync_status,
        });
      }
      const { data: token } = await supabaseAdmin
        .from("evm_tokens")
        .select("chain,address,symbol,name")
        .eq("chain", "robinhood")
        .eq("address", addr)
        .maybeSingle();
      if (token) {
        hits.push({
          type: "token",
          chain: token.chain,
          address: token.address,
          symbol: token.symbol,
          name: token.name,
        });
      }
    } else {
      const like = q.replace(/[%_]/g, "").slice(0, 64);
      if (like.length >= 2) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("username,avatar_url,wallet_address,visibility")
          .eq("visibility", "public")
          .ilike("username", `%${like}%`)
          .order("username")
          .limit(pageSize);
        for (const p of profiles ?? []) {
          if (!p.username) continue;
          hits.push({
            type: "profile",
            username: p.username,
            avatarUrl: p.avatar_url,
            walletAddress: p.wallet_address,
          });
        }

        const { data: tokens } = await supabaseAdmin
          .from("evm_tokens")
          .select("chain,address,symbol,name")
          .eq("chain", "robinhood")
          .or(`symbol.ilike.%${like}%,name.ilike.%${like}%`)
          .limit(pageSize);
        for (const t of tokens ?? []) {
          hits.push({
            type: "token",
            chain: t.chain,
            address: t.address,
            symbol: t.symbol,
            name: t.name,
          });
        }
      }
    }

    const total = hits.length;
    const pageHits = hits.slice(offset, offset + pageSize);
    return {
      q,
      page,
      pageSize,
      total,
      hasMore: offset + pageSize < total,
      hits: pageHits,
    };
  });
