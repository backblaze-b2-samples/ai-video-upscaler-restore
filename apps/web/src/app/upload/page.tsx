import { UploadForm } from "@/components/upload/upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Ingest source archive</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Upload the degraded or low-resolution footage and images you want to
          restore. They land in <code className="text-xs">uploads/</code> on
          Backblaze B2 and become selectable sources when you create a
          restoration job.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <UploadForm />
      </div>
    </div>
  );
}
