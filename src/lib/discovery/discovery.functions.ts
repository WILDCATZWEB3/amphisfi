import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildExplore, buildLeaderboard } from "./discovery.server";
import { parseCategory, parsePeriod } from "./periods";

export const getExploreTraders = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        period: z.enum(["7d", "30d", "all"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    const period = parsePeriod(data?.period);
    return buildExplore(period, data?.limit ?? 24);
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        period: z.enum(["7d", "30d", "all"]).optional(),
        category: z.enum(["pnl", "roi", "win_rate", "volume"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    const period = parsePeriod(data?.period);
    const category = parseCategory(data?.category);
    return buildLeaderboard(period, category, data?.limit ?? 50);
  });
