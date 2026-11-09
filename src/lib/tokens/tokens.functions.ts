import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isEvmAddress, normalizeAddress } from "@/lib/evm/address";
import { publicRateLimit } from "@/lib/rate-limit/public-middleware";

export const listIndexedTokens = createServerFn({ method: "GET" })
  .middleware([publicRateLimit])
  .inputValidator((d: unknown) =>
    z
      .object({
        page: z.number().int().min(1).max(100).optional(),
        pageSize: z.number().int().min(1).max(50).optional(),
        q: z.string().trim().max(64).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    const page = data?.page ?? 1;
    const pageSize = data?.pageSize ?? 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("evm_tokens")
      .select("chain,address,symbol,name,decimals,created_at", { count: "exact" })
      .eq("chain", "robinhood")
      .order("symbol", { ascending: true, nullsFirst: false })
      .range(from, to);

    const q = data?.q?.trim();
    if (q) {
      const like = q.replace(/[%_]/g, "").slice(0, 64);
      if (isEvmAddress(like)) {
        query = query.eq("address", normalizeAddress(like));
      } else if (like.length >= 1) {
        query = query.or(`symbol.ilike.%${like}%,name.ilike.%${like}%`);
      }
    }

    const { data: rows, error, count } = await query;
    if (error) throw error;
    return {
      page,
      pageSize,
      total: count ?? 0,
      tokens: (rows ?? []).map((t) => ({
        chainId: 4663,
        chain: t.chain,
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        // Price/liquidity omitted unless a verified source exists for this asset.
        priceUsd: null as number | null,
        priceAvailable: false,
      })),
    };
  });

export const getIndexedToken = createServerFn({ method: "GET" })
  .middleware([publicRateLimit])
  .inputValidator((d: unknown) =>
    z
      .object({
        chainId: z.coerce.number().int(),
        contractAddress: z.string().min(1).max(66),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.chainId !== 4663) {
      return { found: false as const, reason: "Only Robinhood Chain (4663) is indexed." };
    }
    if (!isEvmAddress(data.contractAddress)) {
      return { found: false as const, reason: "Invalid contract address." };
    }
    const address = normalizeAddress(data.contractAddress);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: token, error } = await supabaseAdmin
      .from("evm_tokens")
      .select("chain,address,symbol,name,decimals,created_at")
      .eq("chain", "robinhood")
      .eq("address", address)
      .maybeSingle();
    if (error) throw error;
    if (!token) return { found: false as const, reason: "Token not in indexed registry yet." };

    const { count: transferCount } = await supabaseAdmin
      .from("token_transfers")
      .select("id", { count: "exact", head: true })
      .eq("chain", "robinhood")
      .eq("token_address", address);

    return {
      found: true as const,
      token: {
        chainId: 4663,
        chain: token.chain,
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        totalSupply: null,
        transferCount: transferCount ?? null,
        priceUsd: null as number | null,
        priceAvailable: false,
        explorerUrl: `https://robinhoodchain.blockscout.com/token/${token.address}`,
      },
    };
  });
