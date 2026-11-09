import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isEvmAddress, normalizeAddress } from "@/lib/evm/address";

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

async function ensureDefaultWatchlist(
  supabase: { from: Function },
  profileId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("watchlists")
    .select("id")
    .eq("profile_id", profileId)
    .eq("name", "Default")
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await supabase
    .from("watchlists")
    .insert({ profile_id: profileId, name: "Default" })
    .select("id")
    .single();
  if (error) throw error;
  return created.id as string;
}

export const getMyWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const watchlistId = await ensureDefaultWatchlist(context.supabase, profileId);
    const { data: items, error } = await context.supabase
      .from("watchlist_items")
      .select("id,item_type,wallet_id,profile_id,chain,token_address,created_at")
      .eq("watchlist_id", watchlistId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const walletIds = (items ?? []).map((i) => i.wallet_id).filter(Boolean) as string[];
    const profileIds = (items ?? []).map((i) => i.profile_id).filter(Boolean) as string[];
    const tokenAddrs = (items ?? [])
      .filter((i) => i.item_type === "token" && i.token_address)
      .map((i) => i.token_address as string);

    const [{ data: wallets }, { data: profiles }, { data: tokens }] = await Promise.all([
      walletIds.length
        ? context.supabase
            .from("wallets")
            .select("id,address,address_normalized,sync_status")
            .in("id", walletIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              address: string;
              address_normalized: string | null;
              sync_status: string;
            }>,
          }),
      profileIds.length
        ? context.supabase
            .from("profiles")
            .select("id,username,avatar_url,wallet_address,visibility")
            .in("id", profileIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              username: string | null;
              avatar_url: string | null;
              wallet_address: string | null;
              visibility: string;
            }>,
          }),
      tokenAddrs.length
        ? context.supabase
            .from("evm_tokens")
            .select("address,symbol,name")
            .eq("chain", "robinhood")
            .in("address", tokenAddrs)
        : Promise.resolve({
            data: [] as Array<{ address: string; symbol: string | null; name: string | null }>,
          }),
    ]);

    const wMap = new Map((wallets ?? []).map((w) => [w.id, w]));
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const tMap = new Map((tokens ?? []).map((t) => [t.address, t]));

    return {
      watchlistId,
      items: (items ?? []).map((i) => ({
        id: i.id,
        itemType: i.item_type as "wallet" | "trader" | "token" | "protocol",
        createdAt: i.created_at,
        wallet: i.wallet_id ? (wMap.get(i.wallet_id) ?? null) : null,
        trader: i.profile_id
          ? (() => {
              const p = pMap.get(i.profile_id!);
              if (!p || p.visibility === "private") return null;
              return p;
            })()
          : null,
        token: i.token_address
          ? {
              chain: i.chain ?? "robinhood",
              address: i.token_address,
              symbol: tMap.get(i.token_address)?.symbol ?? null,
              name: tMap.get(i.token_address)?.name ?? null,
            }
          : null,
      })),
    };
  });

export const addWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .discriminatedUnion("itemType", [
        z.object({ itemType: z.literal("wallet"), address: z.string().min(1) }),
        z.object({ itemType: z.literal("trader"), profileId: z.string().uuid() }),
        z.object({ itemType: z.literal("token"), contractAddress: z.string().min(1) }),
      ])
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const watchlistId = await ensureDefaultWatchlist(context.supabase, profileId);

    if (data.itemType === "wallet") {
      if (!isEvmAddress(data.address)) throw new Error("Invalid wallet address.");
      const addr = normalizeAddress(data.address);
      const { data: wallet } = await context.supabase
        .from("wallets")
        .select("id")
        .eq("chain", "robinhood")
        .eq("address_normalized", addr)
        .maybeSingle();
      if (!wallet) throw new Error("Wallet is not indexed on Amphis yet.");
      const { error } = await context.supabase.from("watchlist_items").insert({
        watchlist_id: watchlistId,
        item_type: "wallet",
        wallet_id: wallet.id,
      });
      if (error && error.code !== "23505") throw error;
      return { ok: true as const };
    }

    if (data.itemType === "trader") {
      const { data: target } = await context.supabase
        .from("profiles")
        .select("id,visibility")
        .eq("id", data.profileId)
        .maybeSingle();
      if (!target || target.visibility === "private")
        throw new Error("Trader profile not available.");
      const { error } = await context.supabase.from("watchlist_items").insert({
        watchlist_id: watchlistId,
        item_type: "trader",
        profile_id: target.id,
      });
      if (error && error.code !== "23505") throw error;
      return { ok: true as const };
    }

    if (!isEvmAddress(data.contractAddress)) throw new Error("Invalid token address.");
    const token = normalizeAddress(data.contractAddress);
    const { data: tok } = await context.supabase
      .from("evm_tokens")
      .select("address")
      .eq("chain", "robinhood")
      .eq("address", token)
      .maybeSingle();
    if (!tok) throw new Error("Token is not in the indexed registry yet.");
    const { error } = await context.supabase.from("watchlist_items").insert({
      watchlist_id: watchlistId,
      item_type: "token",
      chain: "robinhood",
      token_address: tok.address,
    });
    if (error && error.code !== "23505") throw error;
    return { ok: true as const };
  });

export const removeWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const { data: wl } = await context.supabase
      .from("watchlists")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (!wl) return { ok: true as const };
    const { error } = await context.supabase
      .from("watchlist_items")
      .delete()
      .eq("id", data.itemId)
      .eq("watchlist_id", wl.id);
    if (error) throw error;
    return { ok: true as const };
  });
