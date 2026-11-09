export const DISCOVERY_PERIODS = ["7d", "30d", "all"] as const;
export type DiscoveryPeriod = (typeof DISCOVERY_PERIODS)[number];

export const PERIOD_LABELS: Record<DiscoveryPeriod, string> = {
  "7d": "7D",
  "30d": "30D",
  all: "All Time",
};

export function parsePeriod(raw: string | undefined | null): DiscoveryPeriod {
  if (raw === "7d" || raw === "30d" || raw === "all") return raw;
  return "7d";
}

export const LEADERBOARD_CATEGORIES = ["pnl", "roi", "win_rate", "volume"] as const;
export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number];

export function parseCategory(raw: string | undefined | null): LeaderboardCategory {
  if (raw === "pnl" || raw === "roi" || raw === "win_rate" || raw === "volume") return raw;
  return "pnl";
}
