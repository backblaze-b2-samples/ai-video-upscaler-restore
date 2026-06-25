"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { useCreateJob, useFiles, useUpdateJob } from "@/lib/queries";
import type {
  JobScale,
  RestorationJob,
} from "@ai-video-upscaler-restore/shared";

interface JobFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When editing an existing (queued/failed) job, prefill from it.
  job?: RestorationJob;
}

export function JobForm({ open, onOpenChange, job }: JobFormProps) {
  const isEdit = !!job;
  // Source archive lives under uploads/ — list only that prefix.
  const { data: sources = [] } = useFiles("uploads/", 1000);
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();

  const [name, setName] = useState(job?.name ?? "");
  const [sourceKey, setSourceKey] = useState(job?.source_key ?? "");
  const [scale, setScale] = useState<JobScale>(job?.scale ?? 4);
  const [faceRestore, setFaceRestore] = useState(job?.face_restore ?? false);

  const pending = createJob.isPending || updateJob.isPending;

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give the restoration a name");
      return;
    }
    if (!sourceKey) {
      toast.error("Pick a source file to restore");
      return;
    }
    try {
      if (isEdit && job) {
        await updateJob.mutateAsync({
          id: job.id,
          payload: { name, source_key: sourceKey, scale, face_restore: faceRestore },
        });
        toast.success("Restoration updated");
      } else {
        await createJob.mutateAsync({
          name,
          source_key: sourceKey,
          scale,
          face_restore: faceRestore,
        });
        toast.success("Restoration job created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit restoration" : "New restoration"}
          </DialogTitle>
          <DialogDescription>
            Run Real-ESRGAN super-resolution on a source from your B2 archive.
            The restored output is written back alongside the original.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="job-name">Name</Label>
            <Input
              id="job-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Family reel 1987"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job-source">Source</Label>
            <Select value={sourceKey} onValueChange={setSourceKey}>
              <SelectTrigger id="job-source">
                <SelectValue placeholder="Pick an uploaded file" />
              </SelectTrigger>
              <SelectContent>
                {sources.length === 0 ? (
                  <div className="px-2 py-4 text-xs text-muted-foreground">
                    No sources yet — ingest some on the Upload page first.
                  </div>
                ) : (
                  sources.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.filename}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job-scale">Upscale factor</Label>
            <Select
              value={String(scale)}
              onValueChange={(v) => setScale(Number(v) as JobScale)}
            >
              <SelectTrigger id="job-scale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4× (Real-ESRGAN x4plus)</SelectItem>
                <SelectItem value="8">8× (x4plus, run twice)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="job-faces" className="text-sm">
                Face restoration (GFPGAN)
              </Label>
              <p className="text-xs text-muted-foreground">
                Enhance faces in portraits and footage of people.
              </p>
            </div>
            <Switch
              id="job-faces"
              checked={faceRestore}
              onCheckedChange={setFaceRestore}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending
              ? "Saving..."
              : isEdit
                ? "Save changes"
                : "Create restoration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
