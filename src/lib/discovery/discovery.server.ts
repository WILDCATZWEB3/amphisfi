import { isLeaderboardEligible, LEADERBOARD_METHODOLOGY, rankByMetricDesc } from "./eligibility";
import type { DiscoveryPeriod, LeaderboardCategory } from "./periods";

export type TraderCard = {
  walletId: string;
  address: string;
  username: string | null;
  avatarUrl: string | null;
  profileId: string | null;
  period: DiscoveryPeriod;
  realizedPnlUsd: number | null;
  roi: number | null;
  winRate: number | null;
  volumeUsd: number | null;
  tradeCount: number;
  pricedTradeCount: number;
  dataCompleteness: string;
  performanceReady: boolean;
  calculatedAt: string | null;
  ownershipVerified: boolean;
};

export type LeaderboardResult = {
  period: DiscoveryPeriod;
  category: LeaderboardCategory;
  methodology: string;
  lastUpdated: string | null;
  entries: Array<
    TraderCard & { rank: number; metricValue: number | null; metricAvailable: boolean }
  >;
};

type SnapshotRow = {
  wallet_id: string;
  period: string;
  realized_pnl_usd: number | string | null;
  unrealized_pnl_usd: number | string | null;
  total_pnl_usd: number | string | null;
  roi: number | string | null;
  win_rate: number | string | null;
  volume_usd: number | string | null;
  trade_count: number;
  priced_trade_count: number;
  data_completeness: string;
  performance_ready: boolean;
  calculated_at: string;
};

type WalletRow = {
  id: string;
  address: string;
  address_normalized: string | null;
  sync_status: string;
  backfill_complete: boolean;
  ownership_verified: boolean;
  public_contribute: boolean;
  profile_id: string;
  profiles: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    visibility: string | null;
  } | null;
};

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function metricFor(category: LeaderboardCategory, snap: SnapshotRow): number | null {
  switch (category) {
    case "pnl":
      return num(snap.realized_pnl_usd);
    case "roi":
      return num(snap.roi);
    case "win_rate":
      return num(snap.win_rate);
    case "volume":
      return num(snap.volume_usd);
  }
}

function toCard(wallet: WalletRow, snap: SnapshotRow, period: DiscoveryPeriod): TraderCard {
  const profile = wallet.profiles;
  return {
    walletId: wallet.id,
    address: wallet.address_normalized ?? wallet.address,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    profileId: profile?.id ?? wallet.profile_id,
    period,
    realizedPnlUsd: num(snap.realized_pnl_usd),
    roi: num(snap.roi),
    winRate: num(snap.win_rate),
    volumeUsd: num(snap.volume_usd),
    tradeCount: snap.trade_count,
    pricedTradeCount: snap.priced_trade_count,
    dataCompleteness: snap.data_completeness,
    performanceReady: snap.performance_ready,
    calculatedAt: snap.calculated_at,
    ownershipVerified: wallet.ownership_verified === true,
  };
}

/** Load real performance snapshots + public wallets for a period. */
export async function loadPeriodTraders(period: DiscoveryPeriod): Promise<{
  cards: TraderCard[];
  walletsById: Map<string, WalletRow>;
  snapsByWallet: Map<string, SnapshotRow>;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: snaps, error: snapErr } = await supabaseAdmin
    .from("evm_performance_snapshots")
    .select(
      "wallet_id,period,realized_pnl_usd,unrealized_pnl_usd,total_pnl_usd,roi,win_rate,volume_usd,trade_count,priced_trade_count,data_completeness,performance_ready,calculated_at",
    )
    .eq("period", period)
    .gt("trade_count", 0);
  if (snapErr) throw snapErr;

  const snapshotRows = (snaps ?? []) as SnapshotRow[];
  if (!snapshotRows.length) {
    return { cards: [], walletsById: new Map(), snapsByWallet: new Map() };
  }

  const walletIds = [...new Set(snapshotRows.map((s) => s.wallet_id))];
  const { data: wallets, error: wErr } = await supabaseAdmin
    .from("wallets")
    .select(
      "id,address,address_normalized,sync_status,backfill_complete,ownership_verified,public_contribute,profile_id,profiles(id,username,avatar_url,visibility)",
    )
    .eq("chain", "robinhood")
    .in("id", walletIds);
  if (wErr) throw wErr;

  const walletsById = new Map<string, WalletRow>();
  for (const w of (wallets ?? []) as unknown as WalletRow[]) {
    // Opt-out of public contribution: exclude from explore/leaderboard.
    if (w.public_contribute === false) continue;
    // Private profiles: still allow wallet pages, but hide username/avatar in discovery.
    if (w.profiles && w.profiles.visibility === "private") {
      w.profiles = { ...w.profiles, username: null, avatar_url: null };
    }
    walletsById.set(w.id, w);
  }

  const snapsByWallet = new Map<string, SnapshotRow>();
  const cards: TraderCard[] = [];
  for (const snap of snapshotRows) {
    const wallet = walletsById.get(snap.wallet_id);
    if (!wallet) continue;
    snapsByWallet.set(snap.wallet_id, snap);
    cards.push(toCard(wallet, snap, period));
  }
  return { cards, walletsById, snapsByWallet };
}

export async function buildLeaderboard(
  period: DiscoveryPeriod,
  category: LeaderboardCategory,
  limit = 50,
): Promise<LeaderboardResult> {
  const { cards, walletsById, snapsByWallet } = await loadPeriodTraders(period);
  const eligible: Array<TraderCard & { metricValue: number; metricAvailable: true }> = [];

  for (const card of cards) {
    const wallet = walletsById.get(card.walletId);
    const snap = snapsByWallet.get(card.walletId);
    if (!wallet || !snap) continue;
    const metricValue = metricFor(category, snap);
    const check = isLeaderboardEligible({
      syncStatus: wallet.sync_status,
      backfillComplete: wallet.backfill_complete,
      performanceReady: snap.performance_ready,
      dataCompleteness: snap.data_completeness,
      tradeCount: snap.trade_count,
      pricedTradeCount: snap.priced_trade_count,
      metricAvailable: metricValue !== null,
    });
    if (!check.eligible || metricValue === null) continue;
    eligible.push({ ...card, metricValue, metricAvailable: true });
  }

  const ranked = rankByMetricDesc(
    eligible.map((e) => ({ walletId: e.walletId, metric: e.metricValue })),
  ).slice(0, Math.min(Math.max(limit, 1), 100));

  const byId = new Map(eligible.map((e) => [e.walletId, e]));
  const entries = ranked.map((r) => {
    const card = byId.get(r.walletId)!;
    return { ...card, rank: r.rank, metricValue: r.metric, metricAvailable: true as const };
  });

  const lastUpdated =
    entries
      .map((e) => e.calculatedAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;

  return {
    period,
    category,
    methodology: LEADERBOARD_METHODOLOGY,
    lastUpdated,
    entries,
  };
}

export async function buildExplore(
  period: DiscoveryPeriod,
  limit = 24,
): Promise<{
  period: DiscoveryPeriod;
  methodology: string;
  lastUpdated: string | null;
  traders: TraderCard[];
}> {
  // Explore shows performance-ready / eligible traders sorted by recent calculated_at then volume.
  const board = await buildLeaderboard(period, "volume", limit);
  return {
    period,
    methodology: board.methodology,
    lastUpdated: board.lastUpdated,
    traders: board.entries,
  };
}

/** Refresh trader_metrics from live performance snapshots (server/admin). */
export async function refreshTraderMetrics(period: DiscoveryPeriod): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { cards, walletsById, snapsByWallet } = await loadPeriodTraders(period);
  let upserted = 0;
  for (const card of cards) {
    const wallet = walletsById.get(card.walletId);
    const snap = snapsByWallet.get(card.walletId);
    if (!wallet || !snap) continue;
    const metricAvailable = num(snap.realized_pnl_usd) !== null;
    const check = isLeaderboardEligible({
      syncStatus: wallet.sync_status,
      backfillComplete: wallet.backfill_complete,
      performanceReady: snap.performance_ready,
      dataCompleteness: snap.data_completeness,
      tradeCount: snap.trade_count,
      pricedTradeCount: snap.priced_trade_count,
      metricAvailable,
    });
    type MetricsUpsert = {
      from: (table: string) => {
        upsert: (
          row: Record<string, unknown>,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
    const metricsClient = supabaseAdmin as unknown as MetricsUpsert;
    const { error } = await metricsClient.from("trader_metrics").upsert(
      {
        wallet_id: card.walletId,
        period,
        realized_pnl_usd: num(snap.realized_pnl_usd),
        unrealized_pnl_usd: num(snap.unrealized_pnl_usd),
        total_pnl_usd: num(snap.total_pnl_usd),
        roi: num(snap.roi),
        win_rate: num(snap.win_rate),
        volume_usd: num(snap.volume_usd),
        trade_count: snap.trade_count,
        priced_trade_count: snap.priced_trade_count,
        data_completeness: snap.data_completeness,
        performance_ready: snap.performance_ready,
        leaderboard_eligible: check.eligible,
        eligibility_notes: check.reason,
        calculated_at: snap.calculated_at,
      },
      { onConflict: "wallet_id,period" },
    );
    if (!error) upserted += 1;
  }
  return upserted;
}
