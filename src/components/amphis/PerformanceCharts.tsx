import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardHeader } from "@/components/amphis/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getWalletChartData } from "@/lib/portfolio/chart-data.functions";
import { cn } from "@/lib/utils";

const WINDOWS = ["7d", "30d", "90d", "all"] as const;

const pnlConfig = {
  cumulativePnlUsd: { label: "Cumulative realized P/L", color: "hsl(var(--accent))" },
} satisfies ChartConfig;

const activityConfig = {
  tradeCount: { label: "Trades", color: "hsl(var(--muted-foreground))" },
} satisfies ChartConfig;

export function PerformanceCharts({ walletId }: { walletId: string }) {
  const [window, setWindow] = useState<(typeof WINDOWS)[number]>("30d");
  const fn = useServerFn(getWalletChartData);
  const q = useQuery({
    queryKey: ["wallet-charts", walletId, window],
    enabled: Boolean(walletId),
    queryFn: () => fn({ data: { walletId, window } }),
  });

  return (
    <Card>
      <CardHeader
        title="Performance charts"
        description="Built only from indexed realized PnL and detected trades."
        action={
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs",
                  window === w ? "bg-secondary text-foreground" : "text-muted-foreground",
                )}
              >
                {w.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />

      {q.isLoading ? (
        <LoadingState label="Loading chart data" />
      ) : q.isError ? (
        <ErrorState title="Could not load charts" onRetry={() => void q.refetch()} />
      ) : q.data?.insufficient ? (
        <EmptyState
          className="border-0 py-8"
          title="Not enough data to chart"
          description="Charts appear after this wallet has priced closed trades or detected swaps. Gaps are never filled with fake values."
        />
      ) : q.data ? (
        <div className="grid gap-6">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Cumulative realized P/L (USD)</p>
            {q.data.cumulativePnl.length < 2 ? (
              <EmptyState
                className="border-0 py-6"
                title="Need more closed trades"
                description="At least two dated realized PnL points are required for a line."
              />
            ) : (
              <ChartContainer config={pnlConfig} className="h-56 w-full">
                <LineChart data={q.data.cumulativePnl} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                  />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="cumulativePnlUsd"
                    stroke="var(--color-cumulativePnlUsd)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ChartContainer>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Days without closes keep the prior cumulative total; day PnL is marked empty in
              tooltips when hasData is false.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Trade activity (count / day)</p>
            {!q.data.activity.some((a) => a.tradeCount > 0) ? (
              <EmptyState className="border-0 py-6" title="No trades in this window" />
            ) : (
              <ChartContainer config={activityConfig} className="h-48 w-full">
                <BarChart data={q.data.activity} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="tradeCount" fill="var(--color-tradeCount)" radius={2} />
                </BarChart>
              </ChartContainer>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Win / loss (fully matched closed trades)
            </p>
            {q.data.winLoss.insufficient ? (
              <EmptyState className="border-0 py-6" title="No fully matched closed trades yet" />
            ) : (
              <ChartContainer
                config={{
                  wins: { label: "Wins", color: "hsl(160 60% 45%)" },
                  losses: { label: "Losses", color: "hsl(0 70% 50%)" },
                  breakeven: { label: "Breakeven", color: "hsl(0 0% 50%)" },
                }}
                className="h-40 w-full"
              >
                <BarChart
                  data={[
                    { name: "Wins", value: q.data.winLoss.wins, key: "wins" },
                    { name: "Losses", value: q.data.winLoss.losses, key: "losses" },
                    { name: "Breakeven", value: q.data.winLoss.breakeven, key: "breakeven" },
                  ]}
                  margin={{ left: 8, right: 8, top: 8 }}
                >
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={2}>
                    <Cell fill="var(--color-wins)" />
                    <Cell fill="var(--color-losses)" />
                    <Cell fill="var(--color-breakeven)" />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
