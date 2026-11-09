import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeAddress } from "@/lib/evm/address";

const NATIVE = "0x0000000000000000000000000000000000000000";

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

export const listMyWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("wallets")
      .select(
        "id,address,address_normalized,is_primary,sync_status,backfill_complete,ownership_verified,last_synced_at",
      )
      .eq("profile_id", profileId)
      .eq("chain", "robinhood")
      .order("is_primary", { ascending: false });
    if (error) throw error;
    return { wallets: data ?? [] };
  });

export const getWalletPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const { data: wallet, error: wErr } = await context.supabase
      .from("wallets")
      .select(
        "id,address,address_normalized,sync_status,backfill_complete,ownership_verified,last_synced_at,profile_id",
      )
      .eq("id", data.walletId)
      .eq("profile_id", profileId)
      .eq("chain", "robinhood")
      .maybeSingle();
    if (wErr) throw wErr;
    if (!wallet) throw new Error("Wallet not found on your account.");

    const [{ data: lots }, { data: snap }, { data: recentTrades }] = await Promise.all([
      context.supabase
        .from("evm_position_lots")
        .select("id,token,remaining_quantity,remaining_cost_basis_usd,acquired_at,source_trade_id")
        .eq("wallet_id", wallet.id),
      context.supabase
        .from("evm_performance_snapshots")
        .select("*")
        .eq("wallet_id", wallet.id)
        .eq("period", "all")
        .maybeSingle(),
      context.supabase
        .from("evm_trades")
        .select(
          "id,block_time,sold_token,bought_token,sold_amount_raw,bought_amount_raw,sold_decimals,bought_decimals,trade_value_usd,valuation_status,direction,transaction_hash",
        )
        .eq("wallet_id", wallet.id)
        .order("block_time", { ascending: false })
        .limit(25),
    ]);

    const tokenAddrs = [...new Set((lots ?? []).map((l) => l.token).filter((t) => t !== NATIVE))];
    const { data: meta } = tokenAddrs.length
      ? await context.supabase
          .from("evm_tokens")
          .select("address,symbol,name,decimals")
          .eq("chain", "robinhood")
          .in("address", tokenAddrs)
      : {
          data: [] as Array<{
            address: string;
            symbol: string | null;
            name: string | null;
            decimals: number | null;
          }>,
        };

    const symbols = new Map((meta ?? []).map((m) => [m.address, m]));

    // Aggregate open lots by token (cost basis is real; market value only when snapshot has it).
    const byToken = new Map<string, { quantity: number; costBasisUsd: number }>();
    for (const lot of lots ?? []) {
      const q = Number(lot.remaining_quantity);
      const c = Number(lot.remaining_cost_basis_usd);
      const prev = byToken.get(lot.token) ?? { quantity: 0, costBasisUsd: 0 };
      byToken.set(lot.token, {
        quantity: prev.quantity + (Number.isFinite(q) ? q : 0),
        costBasisUsd: prev.costBasisUsd + (Number.isFinite(c) ? c : 0),
      });
    }

    const positions = [...byToken.entries()].map(([token, v]) => {
      const m = symbols.get(token);
      return {
        token,
        symbol: token === NATIVE ? "ETH" : (m?.symbol ?? null),
        name: token === NATIVE ? "Ether" : (m?.name ?? null),
        quantity: v.quantity,
        costBasisUsd: v.costBasisUsd,
        // Never invent mark-to-market per position without verified prices.
        marketValueUsd: null as number | null,
        unrealizedPnlUsd: null as number | null,
        valuationAvailable: false,
      };
    });

    const openCost =
      snap?.open_cost_basis_usd === null || snap?.open_cost_basis_usd === undefined
        ? positions.reduce((s, p) => s + p.costBasisUsd, 0)
        : Number(snap.open_cost_basis_usd);

    return {
      wallet: {
        id: wallet.id,
        address: wallet.address_normalized ?? normalizeAddress(wallet.address),
        syncStatus: wallet.sync_status,
        backfillComplete: wallet.backfill_complete,
        ownershipVerified: wallet.ownership_verified,
        lastSyncedAt: wallet.last_synced_at,
      },
      // Live ETH balance is not stored; show unavailable rather than guessing.
      ethBalance: null as number | null,
      ethBalanceAvailable: false,
      positions,
      summary: {
        openCostBasisUsd: Number.isFinite(openCost) ? openCost : null,
        openMarketValueUsd:
          snap?.open_market_value_usd === null || snap?.open_market_value_usd === undefined
            ? null
            : Number(snap.open_market_value_usd),
        unrealizedPnlUsd:
          snap?.unrealized_pnl_usd === null || snap?.unrealized_pnl_usd === undefined
            ? null
            : Number(snap.unrealized_pnl_usd),
        realizedPnlUsd:
          snap?.realized_pnl_usd === null || snap?.realized_pnl_usd === undefined
            ? null
            : Number(snap.realized_pnl_usd),
        totalPnlUsd:
          snap?.total_pnl_usd === null || snap?.total_pnl_usd === undefined
            ? null
            : Number(snap.total_pnl_usd),
        dataCompleteness: snap?.data_completeness ?? "insufficient",
        performanceReady: snap?.performance_ready ?? false,
        calculatedAt: snap?.calculated_at ?? null,
      },
      recentTrades: recentTrades ?? [],
      tokenMeta: Object.fromEntries(symbols),
    };
  });

export const getMyActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        walletId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const limit = data?.limit ?? 30;

    let walletQuery = context.supabase
      .from("wallets")
      .select("id,address,address_normalized")
      .eq("profile_id", profileId)
      .eq("chain", "robinhood");
    if (data?.walletId) walletQuery = walletQuery.eq("id", data.walletId);
    const { data: wallets, error: wErr } = await walletQuery;
    if (wErr) throw wErr;
    if (!wallets?.length) return { events: [], walletIds: [] as string[] };

    const walletIds = wallets.map((w) => w.id);
    const addrById = new Map(wallets.map((w) => [w.id, w.address_normalized ?? w.address]));

    const { data: trades, error } = await context.supabase
      .from("evm_trades")
      .select(
        "id,wallet_id,block_time,sold_token,bought_token,trade_value_usd,valuation_status,direction,transaction_hash",
      )
      .in("wallet_id", walletIds)
      .order("block_time", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return {
      walletIds,
      events: (trades ?? []).map((t) => ({
        id: t.id,
        type: "trade" as const,
        walletId: t.wallet_id,
        address: addrById.get(t.wallet_id) ?? null,
        blockTime: t.block_time,
        direction: t.direction,
        soldToken: t.sold_token,
        boughtToken: t.bought_token,
        tradeValueUsd: t.trade_value_usd === null ? null : Number(t.trade_value_usd),
        valuationStatus: t.valuation_status,
        transactionHash: t.transaction_hash,
      })),
    };
  });
