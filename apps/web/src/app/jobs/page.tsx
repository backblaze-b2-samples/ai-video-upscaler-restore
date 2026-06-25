import { JobsList } from "@/components/jobs/jobs-list";

export default function JobsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Restorations</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Create, run, edit, and delete Real-ESRGAN restoration jobs. Each job
          reads a source from your B2 archive and writes the upscaled output
          back alongside it.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <JobsList />
      </div>
    </div>
  );
}
