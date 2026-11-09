/**
 * Build chart series from real realized PnL and trades.
 * Missing days are marked; values are never invented.
 */

export type RealizedPoint = {
  disposedAt: string | null;
  pnlUsd: number;
  fullyMatched: boolean;
};

export type TradePoint = {
  blockTime: string | null;
};

export type CumulativePnlPoint = {
  date: string; // YYYY-MM-DD UTC
  cumulativePnlUsd: number | null;
  dayPnlUsd: number | null;
  hasData: boolean;
};

export type ActivityPoint = {
  date: string;
  tradeCount: number;
};

export type WinLossSummary = {
  wins: number;
  losses: number;
  breakeven: number;
  insufficient: boolean;
};

function utcDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Cumulative realized PnL by UTC day. Days with no closes keep prior cumulative; dayPnl null. */
export function buildCumulativePnlSeries(
  points: RealizedPoint[],
  opts?: { fromDay?: string; toDay?: string },
): CumulativePnlPoint[] {
  const usable = points
    .filter((p) => p.disposedAt && Number.isFinite(p.pnlUsd))
    .map((p) => ({ day: utcDay(p.disposedAt!), pnl: p.pnlUsd }))
    .filter((p) => p.day)
    .sort((a, b) => a.day.localeCompare(b.day));

  if (!usable.length) return [];

  const first = opts?.fromDay ?? usable[0]!.day;
  const last = opts?.toDay ?? usable[usable.length - 1]!.day;
  const byDay = new Map<string, number>();
  for (const u of usable) {
    byDay.set(u.day, (byDay.get(u.day) ?? 0) + u.pnl);
  }

  let cum = 0;
  // Seed cumulative with PnL before window
  for (const u of usable) {
    if (u.day < first) cum += u.pnl;
  }

  return eachDay(first, last).map((date) => {
    const dayPnl = byDay.has(date) ? byDay.get(date)! : null;
    if (dayPnl !== null) cum += dayPnl;
    return {
      date,
      cumulativePnlUsd: cum,
      dayPnlUsd: dayPnl,
      hasData: dayPnl !== null,
    };
  });
}

export function buildTradeActivitySeries(
  trades: TradePoint[],
  opts?: { fromDay?: string; toDay?: string },
): ActivityPoint[] {
  const days = trades
    .map((t) => (t.blockTime ? utcDay(t.blockTime) : ""))
    .filter(Boolean)
    .sort();
  if (!days.length) return [];
  const first = opts?.fromDay ?? days[0]!;
  const last = opts?.toDay ?? days[days.length - 1]!;
  const counts = new Map<string, number>();
  for (const d of days) {
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return eachDay(first, last).map((date) => ({
    date,
    tradeCount: counts.get(date) ?? 0,
  }));
}

export function buildWinLossSummary(points: RealizedPoint[]): WinLossSummary {
  const closed = points.filter((p) => p.fullyMatched && Number.isFinite(p.pnlUsd));
  if (closed.length < 1) {
    return { wins: 0, losses: 0, breakeven: 0, insufficient: true };
  }
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  for (const p of closed) {
    if (p.pnlUsd > 0) wins += 1;
    else if (p.pnlUsd < 0) losses += 1;
    else breakeven += 1;
  }
  return { wins, losses, breakeven, insufficient: false };
}

export type ChartWindow = "7d" | "30d" | "90d" | "all";

export function windowBounds(
  window: ChartWindow,
  now = Date.now(),
): { fromDay?: string; toDay: string } {
  const toDay = new Date(now).toISOString().slice(0, 10);
  if (window === "all") return { toDay };
  const days = window === "7d" ? 7 : window === "30d" ? 30 : 90;
  const from = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  return { fromDay: from, toDay };
}
