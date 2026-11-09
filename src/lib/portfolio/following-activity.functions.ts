import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/**
 * Real trades from public profiles the user follows.
 * Private profiles are excluded. Empty when not following anyone with indexed trades.
 */
export const getFollowingActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ limit: z.number().int().min(1).max(50).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const limit = data?.limit ?? 40;

    const { data: follows, error: fErr } = await context.supabase
      .from("follows")
      .select("following_profile_id")
      .eq("follower_profile_id", profileId);
    if (fErr) throw fErr;
    const followingIds = (follows ?? []).map((f) => f.following_profile_id);
    if (!followingIds.length) {
      return { events: [], followingCount: 0 };
    }

    const { data: profiles, error: pErr } = await context.supabase
      .from("profiles")
      .select("id,username,visibility,wallet_address")
      .in("id", followingIds)
      .eq("visibility", "public");
    if (pErr) throw pErr;
    const publicProfiles = profiles ?? [];
    if (!publicProfiles.length) {
      return { events: [], followingCount: followingIds.length };
    }

    const profileIds = publicProfiles.map((p) => p.id);
    const { data: wallets, error: wErr } = await context.supabase
      .from("wallets")
      .select("id,profile_id,address,address_normalized")
      .eq("chain", "robinhood")
      .in("profile_id", profileIds);
    if (wErr) throw wErr;
    if (!wallets?.length) {
      return { events: [], followingCount: followingIds.length };
    }

    const walletIds = wallets.map((w) => w.id);
    const walletMeta = new Map(
      wallets.map((w) => [
        w.id,
        {
          address: w.address_normalized ?? w.address,
          profileId: w.profile_id,
          username: publicProfiles.find((p) => p.id === w.profile_id)?.username ?? null,
        },
      ]),
    );

    const { data: trades, error: tErr } = await context.supabase
      .from("evm_trades")
      .select(
        "id,wallet_id,block_time,sold_token,bought_token,trade_value_usd,valuation_status,direction,transaction_hash",
      )
      .in("wallet_id", walletIds)
      .order("block_time", { ascending: false })
      .limit(limit);
    if (tErr) throw tErr;

    return {
      followingCount: followingIds.length,
      events: (trades ?? []).map((t) => {
        const meta = walletMeta.get(t.wallet_id);
        return {
          id: t.id,
          type: "followed_trade" as const,
          walletId: t.wallet_id,
          address: meta?.address ?? null,
          username: meta?.username ?? null,
          profileId: meta?.profileId ?? null,
          blockTime: t.block_time,
          direction: t.direction,
          soldToken: t.sold_token,
          boughtToken: t.bought_token,
          tradeValueUsd: t.trade_value_usd === null ? null : Number(t.trade_value_usd),
          valuationStatus: t.valuation_status,
          transactionHash: t.transaction_hash,
        };
      }),
    };
  });
