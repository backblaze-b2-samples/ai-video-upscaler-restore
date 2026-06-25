"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Play, Pencil, Trash2, Wand2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { JobStatusBadge } from "./job-status-badge";
import { JobForm } from "./job-form";
import { ApiError } from "@/lib/api-client";
import { useDeleteJob, useJobs, useRunJob } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import type { RestorationJob } from "@ai-video-upscaler-restore/shared";

const EDITABLE = new Set(["queued", "failed"]);

export function JobsList() {
  const { data: jobs = [], isLoading, error, refetch } = useJobs();
  const runJob = useRunJob();
  const deleteJob = useDeleteJob();

  const [createOpen, setCreateOpen] = useState(false);
  const [editJob, setEditJob] = useState<RestorationJob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RestorationJob | null>(null);

  const handleRun = (job: RestorationJob) => {
    runJob.mutate(job.id, {
      onSuccess: () => toast.success(`Restoration started: ${job.name}`),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to start"),
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteJob.mutate(target.id, {
      onSuccess: () => toast.success(`${target.name} deleted`),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to delete"),
      onSettled: () => setDeleteTarget(null),
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border py-4 px-5 space-y-0">
          <CardTitle className="card-title">Restoration jobs</CardTitle>
          <Button size="sm" className="h-8" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New restoration
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={Wand2}
              title="No restorations yet"
              description="Create your first restoration job to upscale a source from your B2 archive."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Scale
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Growth
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Updated
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} className="table-row-hover">
                    <TableCell className="font-medium">
                      <Link href={`/jobs/${job.id}`} className="hover:underline">
                        {job.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {job.source_type}
                    </TableCell>
                    <TableCell className="tabular-nums">{job.scale}×</TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {job.output_bytes > 0
                        ? `${job.growth_multiplier.toFixed(2)}×`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(job.updated_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleRun(job)}
                            disabled={job.status === "running"}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Run restoration
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditJob(job)}
                            disabled={!EDITABLE.has(job.status)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(job)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <JobForm open={createOpen} onOpenChange={setCreateOpen} />
      {editJob && (
        <JobForm
          key={editJob.id}
          open={!!editJob}
          onOpenChange={(open) => !open && setEditJob(null)}
          job={editJob}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete restoration?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteTarget?.name}</strong> and
              its restored outputs under{" "}
              <code className="text-xs">restored/{deleteTarget?.id}/</code> on
              B2. The original source upload is left untouched. This cannot be
              undone.
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
    </>
  );
}
