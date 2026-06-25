"use client";

import Link from "next/link";
import { Images, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useRestorations } from "@/lib/queries";
import { humanizeBytes } from "@/lib/utils";

// A `restored/`-scoped before/after browser, distinct from the full-bucket
// /files explorer. It reads only completed restorations and shows source vs
// restored side by side with the footprint-growth multiplier.
export function RestorationsLibrary() {
  const { data: items = [], isLoading, error, refetch } = useRestorations();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={Images}
            title="No restored outputs yet"
            description="Completed restorations appear here, scoped to the restored/ prefix on B2."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3 px-4 space-y-0">
            <CardTitle className="card-title">
              <Link href={`/jobs/${item.id}`} className="hover:underline">
                {item.name}
              </Link>
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7" asChild>
              <a href={item.output_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Thumb url={item.source_url} label="Source" bytes={item.source_bytes} />
              <Thumb url={item.output_url} label="Restored" bytes={item.output_bytes} />
            </div>
            <div className="text-xs text-muted-foreground">
              Footprint growth{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {item.growth_multiplier.toFixed(2)}×
              </span>{" "}
              · {humanizeBytes(item.source_bytes)} →{" "}
              {humanizeBytes(item.output_bytes)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Thumb({
  url,
  label,
  bytes,
}: {
  url: string;
  label: string;
  bytes: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {humanizeBytes(bytes)}
        </span>
      </div>
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element -- presigned B2
            URLs expire; the Next optimizer would cache them past that. */}
        <img src={url} alt={label} className="h-full w-full object-cover" />
      </div>
    </div>
  );
}
