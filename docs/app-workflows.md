<!-- last_verified: 2026-06-24 -->
# App Workflows

User journeys inside the application.

## Archivist journey (the headline)

The end-to-end flow this app is built around: **ingest → create job → run → compare → download.**

1. **Ingest** — on `/upload`, drop the degraded source footage/images. They land in `uploads/` on B2.
2. **Create a job** — on `/jobs`, click **New restoration**, pick a source from the `uploads/` dropdown, name it, choose 4× or 8×, and toggle GFPGAN face restoration. A manifest is written to `jobs/<id>.json` with `status=queued`.
3. **Run** — open the job (`/jobs/[id]`) and hit **Run restoration** (also available from the list). The job goes `running`; the UI polls and shows the generating loader (with `frames_done/frames_total` for video). The restored output is written to `restored/<id>/` and the manifest flips to `done`.
4. **Compare** — the job detail shows source vs restored side by side, with the dimensions and the output-footprint growth multiplier. The `/restorations` Library collects every completed restoration the same way.
5. **Download** — grab the restored output via its presigned URL from the detail page or the Library card.

See: [Restoration Jobs](features/restoration-jobs.md), [Before/After Browser](features/before-after-browser.md).

## Ingest source archive (Upload)

- User navigates to `/upload` ("Ingest source archive")
- Drops or selects files in the dropzone
- Client validates file size (max 500MB) and type
- Progress bar shows per-file upload status
- On success: toast + green checkmark; on failure: red status icon with reason
- Uploads land in `uploads/` and become selectable job sources
- See: [File Upload](features/file-upload.md)

## Edit or delete a job

- **Edit** is available while a job is `queued` or `failed` (name, source, scale, face-restore). Once a job is `running`/`done` its parameters are locked — re-rendering with different settings means creating a new job.
- **Delete** (from the list or detail) removes the manifest and only the objects under that job's `restored/<id>/` prefix. The original source upload is left untouched.

## Browse the full bucket (Files)

- User navigates to `/files` — the full-bucket explorer (every prefix, including `uploads/`, `jobs/`, `restored/`)
- Tree view with type icons; hover a row for preview / download / delete
- Distinct from the `restored/`-scoped Library at `/restorations`
- See: [File Browser](features/file-browser.md)

## View Dashboard

- User navigates to `/` (home)
- `useJobStats()` + `useJobs()` load in parallel
- Stat cards: jobs total, sources archived (count + bytes), restored outputs (count + bytes), output-footprint growth multiplier, faces restored
- Bar chart compares total source vs restored footprint (MB)
- Recent restorations table shows the latest jobs with scale, growth, and status
- See: [Dashboard](features/dashboard.md)
