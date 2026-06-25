"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  createJob,
  deleteFile,
  deleteJob,
  getFiles,
  getFileStats,
  getJob,
  getJobs,
  getJobStats,
  getPreviewUrl,
  getRestorations,
  getUploadActivity,
  runJob,
  updateJob,
} from "@/lib/api-client";
import type {
  FileMetadata,
  JobCreate,
  JobUpdate,
  RestorationJob,
} from "@ai-video-upscaler-restore/shared";

// Single source of truth for query keys. Keep these tightly scoped so that
// invalidating "files" doesn't blow away unrelated caches, and so an IDE
// "find usages" of `qk.files` reveals every consumer.
export const qk = {
  all: ["b2"] as const,
  files: (prefix?: string, limit?: number) =>
    [...qk.all, "files", prefix ?? "", limit ?? 100] as const,
  stats: () => [...qk.all, "stats"] as const,
  uploadActivity: (days: number) =>
    [...qk.all, "stats", "activity", days] as const,
  preview: (key: string) => [...qk.all, "preview", key] as const,
  jobs: () => [...qk.all, "jobs"] as const,
  job: (id: string) => [...qk.all, "jobs", id] as const,
  jobStats: () => [...qk.all, "jobs", "stats"] as const,
  restorations: () => [...qk.all, "jobs", "restorations"] as const,
};

// While a job is running we poll its detail every 2s so the UI tracks
// frame progress and flips to the before/after view when it finishes.
function jobRefetchInterval(job?: RestorationJob): number | false {
  return job?.status === "running" ? 2000 : false;
}

export function useFiles(prefix = "", limit = 100) {
  return useQuery<FileMetadata[], ApiError>({
    queryKey: qk.files(prefix, limit),
    queryFn: () => getFiles(prefix, limit),
  });
}

export function useFileStats() {
  return useQuery({
    queryKey: qk.stats(),
    queryFn: getFileStats,
  });
}

export function useUploadActivity(days = 7) {
  return useQuery({
    queryKey: qk.uploadActivity(days),
    queryFn: () => getUploadActivity(days),
  });
}

// Presigned preview URL — only fetched when `enabled` is true (e.g., when
// the dialog opens for a specific file). Kept short-lived (60s) because
// the URL itself has a presigned expiry and is cheap to regenerate.
export function usePreviewUrl(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.preview(key ?? ""),
    queryFn: () => getPreviewUrl(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileKey: string) => deleteFile(fileKey),
    // After delete, blow away every cached file list + stats. Cheap and
    // correct — the dashboard re-fetches lazily as components remount.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.all });
    },
  });
}

// --- Restoration Jobs ---

export function useJobs() {
  return useQuery<RestorationJob[], ApiError>({
    queryKey: qk.jobs(),
    queryFn: getJobs,
    // Light polling so a running job's status updates the list view too.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((j) => j.status === "running") ? 2500 : false,
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: qk.job(id ?? ""),
    queryFn: () => getJob(id as string),
    enabled: !!id,
    refetchInterval: (q) => jobRefetchInterval(q.state.data?.job),
  });
}

export function useJobStats() {
  return useQuery({
    queryKey: qk.jobStats(),
    queryFn: getJobStats,
  });
}

export function useRestorations() {
  return useQuery({
    queryKey: qk.restorations(),
    queryFn: getRestorations,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: JobCreate) => createJob(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: JobUpdate }) =>
      updateJob(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobs() }),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  });
}

export function useRunJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => runJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobs() }),
  });
}
