# Build plan — `ai-video-upscaler-restore`

Source of truth for the starter tree: `.claude/scratch/vcsk-278eb98e-84fa-4de8-9f55-88f88bea0526/`
(cloned fresh in Phase 0). All keep/trim/add deltas below are computed against that tree.

---

## 1. Purpose

`ai-video-upscaler-restore` is a B2 sample for **archivists, content studios, and ML data
teams** who want a permanent, self-hosted archive of both *degraded originals* and *AI-restored
outputs* on Backblaze B2. A user uploads low-resolution or degraded footage/images (the source
archive), creates a **Restoration Job** that runs **Real-ESRGAN** 4×/8× super-resolution with
optional **GFPGAN** face restoration, and the larger restored output is written back to B2
alongside the original. A before/after browser reads both source and restored objects straight
from B2 for side-by-side comparison and download.

The teaching point is **B2 as the storage layer for an AI restoration pipeline**: every restored
clip writes back at 4×–8× the source resolution, so a 10 GB archive of SD footage can balloon to
40–80 GB of restored outputs — the app surfaces this *output-footprint growth* as its headline
metric. All B2 access is via the **S3-compatible API** with a custom user-agent and the
standardized `B2_*` env vars. Runs on **local OSS only** — no second API key, B2 credentials only.

---

## 2. Architecture delta from vibe-coding-starter-kit

The starter kit is the ceiling. Strip what this app doesn't need; keep the reusable B2-backed
scaffolding; add the restoration domain.

### KEEP (as-is — do not strip, rename internals, or replace)
- **UI kit / design system**: `apps/web/src/components/ui/**`, `globals.css` design tokens, the
  `/design` reference page (`app/design/`, `components/design/**`). Reference only; never edit
  generated `components/ui/` files.
- **Bucket explorer (NON-NEGOTIABLE KEEP)**: `/files` route (`app/files/`,
  `components/files/**`), full-bucket browse with preview/download/delete. Stays in the sidebar.
  This is the program-mandated full-bucket explorer and is never removable.
- **Upload**: `/upload` route (`app/upload/`, `components/upload/**`). This *is* the "Ingest"
  step — uploads land the source archive in B2. Keep the page + sidebar entry; only adapt copy
  ("Upload" → still labeled Upload; the page describes ingesting source footage/images).
- **Layout / nav shell**: `app-sidebar.tsx`, `header.tsx`, `command-palette.tsx`,
  `health-banner.tsx`, `theme-provider.tsx`. (`header.tsx` already derives titles from
  `app-config.ts` + pathname — no branding leak to fix in this clone.)
- **Settings page** (`/settings`, `components/settings/**`) including the danger-zone pattern.
- **Backend layered architecture** (`types → config → repo → service → runtime`), structural
  tests, JSON logging, `/health`, `/metrics`, request-id middleware, TanStack Query data layer,
  inline ErrorState/EmptyState, single-source `.env`, `scripts/doctor.mjs` preflight.
- **Metadata extraction** (`service/metadata.py`) — still useful for source assets (image dims,
  checksums). Keep; extend types only if needed.

### TRIM (remove from the starter)
- `CODE_REVIEW.md` — a code review of the starter kit itself; not relevant to this app. Delete.
- `docs/exec-plans/completed/2026-02-*.md` — starter-kit history. Delete the four dated entries
  (this sample gets its own completed plan from Phase 5). Keep the `docs/exec-plans/` dir,
  `tech-debt-tracker.md`, and `completed/` folder.
- `docs/images/b2-starterkit-*.png` — starter screenshots. Delete (screenshots are a later
  pipeline step; do NOT create replacements — no binary assets in this step).
- Default dashboard content (stats/chart/table *content*) is adapted, not kept verbatim — see ADD.

### ADD (new for `ai-video-upscaler-restore`)
- **Primary entity — Restoration Job** (full lifecycle, §4). Backend: `types/jobs.py`,
  `service/jobs.py` (manifest CRUD + stats), `service/restoration.py` (orchestration: extract →
  upscale → reassemble → store → update manifest), `repo/upscaler.py` (Real-ESRGAN/GFPGAN engine
  adapter, **lazy imports**), `repo/manifests.py` *or* reuse `repo/b2_client.py` helpers for
  JSON manifest get/put/list/delete, `runtime/jobs.py` (router). Frontend: `/jobs` (list +
  create), `/jobs/[id]` (detail + before/after), `components/jobs/**`, hooks in `queries.ts`,
  client fns in `api-client.ts`, shared types in `packages/shared/src/types.ts`.
- **Sample-specific asset explorer (MANDATORY ADD)** — a **Restorations Library** /
  before-after browser scoped to the app's own `restored/` prefix, distinct from the keep'd
  full-bucket `/files` explorer. It lists completed restorations with side-by-side
  original-vs-restored thumbnails + sizes + growth multiplier, with download. May live as its own
  `/restorations` route OR be the body of the `/jobs/[id]` detail's before/after panel reused in a
  library grid — builder's choice, but it MUST be a folder-scoped view of `restored/`, separate
  from `/files`.
- **Adapted Dashboard** (`/`) — replace the upload-centric stats with restoration metrics
  (see §2 "Dashboard adaptation" below). New aggregations flow `runtime → service → repo` and are
  exposed via TanStack Query hooks (no bare `useEffect + fetch`).
- **`requirements-restore.txt`** — the heavy ML stack (torch, torchvision, realesrgan, gfpgan,
  basicsr, imageio-ffmpeg, opencv-python-headless, numpy), kept OUT of base `requirements.txt`.

**Dashboard adaptation (the headline):** stats cards = `{ jobs total / by status, sources
archived (count + bytes), restored outputs (count + bytes), OUTPUT-FOOTPRINT GROWTH multiplier =
restored_bytes / source_bytes, faces restored }`. Chart = source-vs-restored bytes (bar) or
restorations-over-time. Table = recent restorations (replaces recent uploads). Update
`docs/features/dashboard.md` in the same change.

---

## 3. B2 surface (S3-compatible only — no b2-native)

Single `boto3` S3 client in `repo/b2_client.py` with `user_agent_extra="b2ai-video-upscaler-restore"`.
Operations exercised:
- **PutObject** — ingest sources (`uploads/`), write job manifests (`jobs/<id>.json`), write
  restored outputs (`restored/<id>/...`).
- **GetObject** — read source bytes for processing, read manifests.
- **HeadObject** — object metadata.
- **ListObjectsV2** (paginated) — file browser, jobs list, restorations library, dashboard stats.
- **DeleteObject** — delete files; delete a job's manifest + its `restored/<id>/` outputs.
- **generate_presigned_url** — preview/download + before/after image/video serving.

No b2-native API anywhere. No second/external API key (Real-ESRGAN is local OSS). **No Genblaze**
(the description does not mention Genblaze / `genblaze-*` / a suggested Genblaze stack).
**No external API provider** (so `api-provider-selection.md` does not apply — nothing to cost out).

**B2 object layout**
```
uploads/<filename>            source archive (degraded/low-res images + short clips)
jobs/<job_id>.json            Restoration Job manifest (system of record — no DB)
restored/<job_id>/output.<ext>   restored image or reassembled video
restored/<job_id>/...            (optional) before/after preview frames
data/download_count.json      (kept from starter — local counter)
```
Jobs are persisted as JSON manifests in B2 — no database dependency, and it doubles down on the
"B2 as the storage layer" story. Manifest state lives only in B2 (satisfies "no shared mutable
state across layers").

---

## 4. Primary entity — Restoration Job (full CRUD + run, all in the UI)

DEFAULT is that the UI exposes **all** lifecycle verbs and Phase 2 builds them. Manifest schema:

```json
{
  "id": "uuid", "name": "string",
  "source_key": "uploads/clip.mp4", "source_type": "image|video",
  "scale": 4, "face_restore": true,
  "status": "queued|running|done|failed",
  "created_at": "iso", "updated_at": "iso",
  "source_bytes": 0, "source_width": 0, "source_height": 0,
  "output_key": "restored/<id>/output.mp4",
  "output_bytes": 0, "output_width": 0, "output_height": 0,
  "growth_multiplier": 0.0, "frames_total": 0, "frames_done": 0,
  "faces_restored": 0, "error": null
}
```

| Verb | UI surface | API | Notes |
|------|-----------|-----|-------|
| **Create** | `/jobs` "New restoration" dialog/form — pick source (dropdown of `uploads/` files), name, scale (4×/8×), face-restore toggle | `POST /jobs` | writes manifest `status=queued` |
| **Read** | `/jobs` list + `/jobs/[id]` detail (status, before/after, footprint metrics) | `GET /jobs`, `GET /jobs/{id}` | |
| **Edit** | edit form on a **queued/failed** job (name, scale, face-restore, source) | `PUT /jobs/{id}` | params lock once `running`/`done` — that's a UX constraint (editing a finished render is "create a new job"), NOT an omission |
| **Delete** | delete action on list + detail | `DELETE /jobs/{id}` | deletes manifest **and** `restored/<id>/` outputs — scoped to the job's own prefix per the safety rule; never touches other prefixes |
| **Run** | "Run restoration" button on detail/list | `POST /jobs/{id}/run` | FastAPI BackgroundTask: `status→running`, process, write output, update manifest `→done/failed`; UI polls (TanStack `refetchInterval` while running) and uses the existing generating-loader |

All five verbs are built and user-accessible ⇒ **`omitted_ui_verbs` is empty**. Stay scoped to this
one entity and these verbs only.

**Engine / execution details (for the builder):**
- `repo/upscaler.py` wraps Real-ESRGAN (`RealESRGANer` + `RealESRGAN_x4plus` weights, lazy
  auto-download) and GFPGAN. **Lazy-import** torch/realesrgan/gfpgan *inside* functions (mirrors
  how `service/metadata.py` lazy-imports PIL/PyPDF2) so `from main import app`, tests, lint, and
  `pnpm build` all work WITHOUT the heavy stack installed. If the restore stack is missing, raise
  a clear, actionable error ("Install services/api/requirements-restore.txt to run restorations").
- `service/restoration.py` orchestrates: read source from B2 → if video, extract frames via the
  **imageio-ffmpeg bundled binary** (do NOT depend on a system `ffmpeg`; see homebrew-libass
  gotcha) → upscale each frame (image = 1 frame) → optional GFPGAN face restore → reassemble
  (image → single image; video → mp4) → PutObject to `restored/<id>/` → recompute
  `growth_multiplier` → update manifest. 8× = run the engine with `outscale=8` (or 4× then 2×).
- **Real-ESRGAN is the only engine — no classical fallback** (vendor fidelity: a Real-ESRGAN
  sample must use Real-ESRGAN). The storage/UI/B2 features work without the stack; only an actual
  *run* requires it.
- Known install gotcha to document + guard: `basicsr` imports
  `torchvision.transforms.functional_tensor`, removed in torchvision ≥0.17. In `requirements-restore.txt`
  either pin a compatible torch/torchvision pair, or have `repo/upscaler.py` install a tiny
  `functional_tensor` shim (alias to `torchvision.transforms.functional`) before importing
  realesrgan/gfpgan. Document the chosen approach in the README + the restoration feature doc.

**Build/test discipline (critical — do NOT stall the build):**
- Heavy ML deps go ONLY in `requirements-restore.txt`. Do NOT `pip install` them during the build.
- Base `requirements.txt` keeps the existing deps (+ nothing heavy). Tests must pass with base
  deps only — **mock the `repo/upscaler` engine** in restoration tests (assert the orchestration:
  reads source, writes manifest + output to B2, computes multiplier, updates status). Generate
  any test image bytes in-memory with PIL; commit **no binary fixtures**.
- Keep every Python file < 300 lines (split orchestration vs engine vs manifests if needed),
  boto3 only in `repo/`, structured logging (no `print`), Pydantic models at boundaries, new
  endpoints touch exactly `runtime/jobs.py` + `lib/api-client.ts` + `lib/queries.ts`.

---

## 5. Doc transforms

| Doc | Action |
|-----|--------|
| `README.md` | Rewrite for this app: purpose, the 5-step workflow (Ingest→Extract→Upscale→Store→Serve), quick start, **two-step install** (base `requirements.txt`, then `requirements-restore.txt` for real runs), Standard-#3 `.env` setup, features, tech stack (+ Real-ESRGAN, GFPGAN, imageio-ffmpeg). Update clone URL to `backblaze-b2-samples/ai-video-upscaler-restore`. |
| `AGENTS.md` | Update §1 repo map (add restoration modules + B2 layout), replace §2 "Building on This Starter Kit" with this app's structure (keep the invariants in §3–5), update §10 doc map. It's now an app, not a template. |
| `ARCHITECTURE.md` | Add the restoration data flow, the B2 object layout, the background-run model, and the upscaler engine adapter at the repo boundary. |
| `docs/features/dashboard.md` | Rewrite for restoration metrics (footprint growth, jobs by status, restored outputs). |
| `docs/features/file-upload.md` | Adapt: framing = "Ingest source archive". |
| `docs/features/file-browser.md` | Keep (full-bucket explorer). Minor copy adapt. |
| `docs/features/metadata-extraction.md` | Keep. |
| `docs/features/restoration-jobs.md` | **ADD** (stub from `_template.md`): the primary entity, CRUD+run, manifest schema, engine. |
| `docs/features/before-after-browser.md` | **ADD** (stub): the `restored/`-scoped library + side-by-side compare. |
| `docs/SECURITY.md` | Update env var names to Standard #3; note Real-ESRGAN/GFPGAN weights download source. |
| `docs/app-workflows.md` | Add the archivist journey: ingest → create job → run → compare → download. |
| `docs/dev-workflows.md` | Note the two-step install + that tests mock the engine. |
| `infra/railway/README.md` | Env var table → Standard #3 names; note longer build (ML deps) + that restorations need a worker with the restore stack. |
| `CODE_REVIEW.md`, `docs/exec-plans/completed/2026-02-*.md`, `docs/images/*.png` | Delete (see TRIM). |

---

## 6. Rename / standardization table

| Kind | From (starter) | To (this sample) |
|------|----------------|------------------|
| repo / root pkg | `vibe-coding-starter-kit` | `ai-video-upscaler-restore` |
| web pkg | `@vibe-coding-starter-kit/web` | `@ai-video-upscaler-restore/web` |
| shared pkg | `@vibe-coding-starter-kit/shared` | `@ai-video-upscaler-restore/shared` |
| all `@vibe-coding-starter-kit/shared` imports | (8 files) | new scope |
| `next.config.ts` transpilePackages | `@vibe-coding-starter-kit/shared` | new scope |
| `APP_NAME` (app-config.ts) | `"OSS Starter Kit"` | `"AI Video Upscaler & Restore"` |
| `APP_DESCRIPTION` | `"File management dashboard…"` | `"Upscale & restore degraded footage with Real-ESRGAN, archived on Backblaze B2"` |
| FastAPI title (main.py) | `"OSS Starter Kit API"` | `"AI Video Upscaler & Restore API"` |
| user_agent_extra (b2_client.py) | `b2ai-oss-start` | `b2ai-video-upscaler-restore` |
| UTM `utm_content=` (sidebar, README, doctor.mjs) | `b2ai-oss-start` | `b2ai-video-upscaler-restore` |
| README H1 | `Vibe Coding Starter Kit` | `AI Video Upscaler & Restore` |
| **ENV — B2_ENDPOINT** | `B2_ENDPOINT` | **remove**; derive endpoint `https://s3.{B2_REGION}.backblazeb2.com` |
| **ENV — key id** | `B2_KEY_ID` | `B2_APPLICATION_KEY_ID` |
| **ENV — region** | *(absent)* | **add `B2_REGION`** |
| **ENV — public url** | `B2_PUBLIC_URL` | `B2_PUBLIC_URL_BASE` |
| **ENV — key / bucket** | `B2_APPLICATION_KEY`, `B2_BUCKET_NAME` | unchanged (already Standard #3) |

**Env-rename touches** (Standard #3 compliance — a `/b2-doctor` gate): `.env.example`,
`config/settings.py` (rename fields, add `b2_region`, derive `b2_endpoint` as a computed property
from region), `main.py` (`REQUIRED_B2_SETTINGS` + `PLACEHOLDER_VALUES`), `scripts/doctor.mjs`
(`REQUIRED_B2_VARS` + `PLACEHOLDERS`), `repo/b2_client.py` (use renamed settings + derived
endpoint + `b2_public_url_base`), `README.md`, `docs/SECURITY.md`, `infra/railway/README.md`.

---

## 7. Acceptance checklist (what Phase 3 review must confirm)
- `pnpm lint`, `pnpm lint:api`, `pnpm test:api`, `pnpm check:structure`, `pnpm build` all green
  with base deps only (engine mocked; heavy stack NOT installed).
- Three B2 standards: S3 API only (no b2-native); custom UA `b2ai-video-upscaler-restore` on the
  single client; Standard-#3 env var names everywhere (no stray `B2_ENDPOINT`/`B2_KEY_ID`).
- Bucket explorer `/files` kept; sample-specific `restored/`-scoped before/after browser added.
- Restoration Job entity has create/read/edit/delete/run all wired in the UI → `omitted_ui_verbs` empty.
- No leftover `vibe-coding-starter-kit` / `OSS Starter Kit` / `b2ai-oss-start` strings.
- No committed binaries; no Genblaze; docs updated alongside code.
