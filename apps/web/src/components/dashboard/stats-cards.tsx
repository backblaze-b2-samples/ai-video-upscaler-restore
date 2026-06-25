"use client";

import { Wand2, Database, Sparkles, TrendingUp, Smile } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useJobStats } from "@/lib/queries";

export function StatsCards() {
  const { data: stats, isLoading, error, refetch } = useJobStats();

  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const cards = [
    {
      title: "Restoration jobs",
      value: stats?.jobs_total ?? 0,
      icon: Wand2,
    },
    {
      title: "Sources archived",
      value: stats ? `${stats.sources_count} · ${stats.sources_bytes_human}` : "—",
      icon: Database,
    },
    {
      title: "Restored outputs",
      value: stats
        ? `${stats.restored_count} · ${stats.restored_bytes_human}`
        : "—",
      icon: Sparkles,
    },
    {
      // The headline metric: how much larger the restored archive is.
      title: "Output-footprint growth",
      value: stats ? `${stats.output_footprint_growth.toFixed(2)}×` : "—",
      icon: TrendingUp,
    },
    {
      title: "Faces restored",
      value: stats?.faces_restored ?? 0,
      icon: Smile,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card, i) => (
        <Card
          key={card.title}
          className={`card-hover animate-fade-in-up stagger-${i + 1}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pt-4 pb-2 px-4 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className="stat-icon-wrap">
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-5 px-4">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="stat-value text-lg">{card.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
