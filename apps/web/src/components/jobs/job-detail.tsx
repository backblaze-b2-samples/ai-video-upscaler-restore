"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Play, Pencil, Trash2, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { GeneratingLoader } from "@/components/ui/generating-loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { JobStatusBadge } from "./job-status-badge";
import { JobForm } from "./job-form";
import { BeforeAfter } from "./before-after";
import { ApiError } from "@/lib/api-client";
import { useDeleteJob, useJob, useRunJob } from "@/lib/queries";

const EDITABLE = new Set(["queued", "failed"]);

export function JobDetail({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useJob(jobId);
  const runJob = useRunJob();
  const deleteJob = useDeleteJob();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  const { job, source_url, output_url } = data;
  const running = job.status === "running";

  const handleRun = () =>
    runJob.mutate(job.id, {
      onSuccess: () => toast.success("Restoration started"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to start"),
    });

  const confirmDelete = () =>
    deleteJob.mutate(job.id, {
      onSuccess: () => {
        toast.success(`${job.name} deleted`);
        router.push("/jobs");
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to delete"),
      onSettled: () => setDeleteOpen(false),
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="space-y-1.5">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Restorations
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{job.name}</h1>
            <JobStatusBadge status={job.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleRun} disabled={running}>
            <Play className="h-3.5 w-3.5" />
            {job.status === "done" ? "Re-run" : "Run restoration"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditOpen(true)}
            disabled={!EDITABLE.has(job.status)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          {output_url && (
            <Button size="sm" variant="outline" asChild>
              <a href={output_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Source" value={`${job.source_width || "?"}×${job.source_height || "?"}`} />
        <Metric label="Scale" value={`${job.scale}×`} />
        <Metric
          label="Restored"
          value={job.output_width ? `${job.output_width}×${job.output_height}` : "—"}
        />
        <Metric
          label="Footprint growth"
          value={job.output_bytes ? `${job.growth_multiplier.toFixed(2)}×` : "—"}
        />
      </div>

      {job.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {job.error}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Before / after</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {running ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <GeneratingLoader
                size="lg"
                label={
                  job.frames_total > 1
                    ? `Restoring frames ${job.frames_done}/${job.frames_total}…`
                    : "Restoring…"
                }
              />
            </div>
          ) : (
            <BeforeAfter
              sourceUrl={source_url}
              outputUrl={output_url}
              sourceBytes={job.source_bytes}
              outputBytes={job.output_bytes}
              sourceType={job.source_type}
              growthMultiplier={job.growth_multiplier}
            />
          )}
        </CardContent>
      </Card>

      {EDITABLE.has(job.status) && (
        <JobForm key={job.updated_at} open={editOpen} onOpenChange={setEditOpen} job={job} />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete restoration?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{job.name}</strong> and its
              restored outputs under{" "}
              <code className="text-xs">restored/{job.id}/</code> on B2. The
              original source upload is left untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteJob.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteJob.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="stat-value mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
