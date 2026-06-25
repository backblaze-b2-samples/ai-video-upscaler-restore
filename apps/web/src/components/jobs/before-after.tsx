"use client";

import { humanizeBytes } from "@/lib/utils";

interface BeforeAfterProps {
  sourceUrl: string;
  outputUrl: string | null;
  sourceBytes: number;
  outputBytes: number;
  sourceType?: "image" | "video";
  growthMultiplier: number;
}

function Media({
  url,
  isVideo,
  alt,
}: {
  url: string;
  isVideo: boolean;
  alt: string;
}) {
  if (isVideo) {
    return (
      <video
        src={url}
        controls
        className="h-full w-full rounded-md object-contain bg-black"
      />
    );
  }
  // Presigned B2 URLs carry their own short expiry; Next's optimizer would
  // cache them past it, so we use a plain <img>.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="h-full w-full rounded-md object-contain" />
  );
}

export function BeforeAfter({
  sourceUrl,
  outputUrl,
  sourceBytes,
  outputBytes,
  sourceType = "image",
  growthMultiplier,
}: BeforeAfterProps) {
  const isVideo = sourceType === "video";
  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Before (source)
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {humanizeBytes(sourceBytes)}
            </span>
          </div>
          <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-border bg-muted/30 p-2">
            <Media url={sourceUrl} isVideo={isVideo} alt="Source" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              After (restored)
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {outputBytes ? humanizeBytes(outputBytes) : "—"}
            </span>
          </div>
          <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-border bg-muted/30 p-2">
            {outputUrl ? (
              <Media url={outputUrl} isVideo={isVideo} alt="Restored" />
            ) : (
              <p className="text-sm text-muted-foreground">
                Not restored yet — run this job.
              </p>
            )}
          </div>
        </div>
      </div>

      {outputBytes > 0 && (
        <div className="rounded-lg border border-border bg-accent/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Output-footprint growth:</span>{" "}
          <span className="font-semibold tabular-nums">
            {growthMultiplier.toFixed(2)}×
          </span>{" "}
          <span className="text-muted-foreground">
            ({humanizeBytes(sourceBytes)} → {humanizeBytes(outputBytes)} on B2)
          </span>
        </div>
      )}
    </div>
  );
}
