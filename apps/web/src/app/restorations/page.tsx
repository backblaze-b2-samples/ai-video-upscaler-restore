import { RestorationsLibrary } from "@/components/jobs/restorations-library";

export default function RestorationsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Restorations Library</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          A before/after browser scoped to the{" "}
          <code className="text-xs">restored/</code> prefix on B2 — completed
          restorations with side-by-side originals, sizes, and the
          output-footprint growth multiplier.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <RestorationsLibrary />
      </div>
    </div>
  );
}
