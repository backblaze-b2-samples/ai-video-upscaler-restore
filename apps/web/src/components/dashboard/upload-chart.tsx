"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useJobStats } from "@/lib/queries";

const chartConfig = {
  megabytes: {
    label: "MB",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

// Source vs restored footprint, in MB — the headline "outputs balloon on B2"
// story rendered as two bars.
export function UploadChart() {
  const { data: stats, error, refetch } = useJobStats();

  const data = useMemo(() => {
    if (!stats) return [];
    const mb = (b: number) => Math.round((b / (1024 * 1024)) * 10) / 10;
    return [
      { label: "Sources", megabytes: mb(stats.sources_bytes) },
      { label: "Restored", megabytes: mb(stats.restored_bytes) },
    ];
  }, [stats]);

  const hasData = data.some((d) => d.megabytes > 0);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Footprint: source vs restored</CardTitle>
        <CardDescription className="text-xs">
          Total bytes on B2 (MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !hasData ? (
          <EmptyState
            icon={BarChart3}
            title="No footprint yet"
            description="Run a restoration to see how restored outputs grow vs sources."
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="mb-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-megabytes)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-megabytes)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                fontSize={11}
                width={36}
              />
              <ChartTooltip cursor={{ fill: "var(--accent-subtle)" }} content={<ChartTooltipContent />} />
              <Bar
                dataKey="megabytes"
                fill="url(#mb-fill)"
                radius={[4, 4, 0, 0]}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
