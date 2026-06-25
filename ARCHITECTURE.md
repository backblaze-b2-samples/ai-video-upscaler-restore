<!-- last_verified: 2026-06-24 -->
# Architecture

`ai-video-upscaler-restore` runs a Real-ESRGAN restoration pipeline with Backblaze B2 as the storage layer. Sources, restored outputs, and the job manifests that tie them together all live in one B2 bucket — there is no database.

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Dashboard with restoration metrics (jobs by status, source-vs-restored footprint, growth multiplier)
  - Restorations (`/jobs`) — primary-entity CRUD + run; detail at `/jobs/[id]` with before/after
  - Restorations Library (`/restorations`) — `restored/`-scoped before/after browser
  - File upload (Ingest) with drag-and-drop; full-bucket file browser
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - REST API for Restoration Jobs (create/read/edit/delete/run), files, upload
  - B2 S3 integration via boto3 (single client in `repo/b2_client.py`)
  - Real-ESRGAN / GFPGAN engine adapter (`repo/upscaler.py`) + imageio-ffmpeg video helpers (`repo/video.py`) — heavy ML deps lazy-imported, kept in `requirements-restore.txt`
  - Health, structured JSON logging, Prometheus-format metrics
- **packages/shared/** — TypeScript type definitions mirroring the Pydantic models

## B2 object layout (system of record — no database)

```
uploads/<filename>              source archive (degraded/low-res images + short clips)
jobs/<job_id>.json              Restoration Job manifest — read/written via repo/manifests.py
restored/<job_id>/output.<ext>  restored image or reassembled video
data/download_count.json        local download counter
```

Each job's full state lives in its `jobs/<id>.json` manifest. There is no shared mutable application state across layers — the bucket is the truth.

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Each file stays under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (FileMetadata, UploadStats, etc.)
    config/                Settings loaded from environment
    repo/                  B2 S3 client (data access layer)
    service/               Business logic (upload, files, metadata)
    runtime/               FastAPI route handlers
  tests/                   pytest tests (structural + integration)
```

## Boundary Invariants

- **No external SDK leakage**: `boto3` is only imported in `app/repo/`. All other layers interact with B2 through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed Pydantic models.
- **No mutable globals**: Configuration is read-only after init. No module-level mutable state shared between layers.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. All file keys validated against prefix allowlist.

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — two services from the same repo
  - See `infra/railway/README.md` for configuration

## Data Stores

- **Backblaze B2** — object storage (S3-compatible API)
  - All uploaded files stored in a single bucket
  - File listing and metadata via S3 `list_objects_v2` / `head_object`
  - No application database — B2 is the sole data store

## External Services

- **Backblaze B2 S3 API** — file storage, retrieval, deletion, presigned URLs

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

- **Ingest (Upload)**: Browser -> `POST /upload` (multipart) -> validate -> repo writes to `uploads/` on B2 -> metadata extracted -> response
- **Create job**: Browser -> `POST /jobs` -> `service/jobs.py` validates the source exists under `uploads/` -> writes `jobs/<id>.json` manifest (`status=queued`)
- **Run (restoration)**: Browser -> `POST /jobs/{id}/run` -> the handler schedules a **FastAPI BackgroundTask** and returns immediately. The task (`service/restoration.py`) sets `status=running`, reads the source from B2, and:
  - *image*: upscales the single frame via `repo/upscaler.py` (Real-ESRGAN, + GFPGAN if face-restore is on)
  - *video*: extracts frames with the bundled `imageio-ffmpeg` binary (`repo/video.py`), upscales each frame, reassembles to mp4
  - writes the output to `restored/<id>/`, recomputes `growth_multiplier = output_bytes / source_bytes`, and updates the manifest to `done` (or `failed`, recording the error). The UI polls the job detail (`refetchInterval` while running) and shows the generating loader.
- **Read**: Browser -> `GET /jobs` / `GET /jobs/{id}` -> `service/jobs.py` loads manifests from B2; detail attaches presigned before/after URLs
- **Edit**: Browser -> `PUT /jobs/{id}` -> allowed only while `queued`/`failed` (a finished render is locked; re-render = new job)
- **Delete**: Browser -> `DELETE /jobs/{id}` -> deletes the manifest **and** every object under `restored/<id>/` — scoped strictly to the job's own prefix, never touching others
- **Stats**: Browser -> `GET /jobs/stats` -> aggregates jobs by status, source vs restored bytes, the output-footprint growth multiplier, and faces restored
- **File browser / download / delete** (full bucket): unchanged from the B2 scaffolding — `GET /files`, `GET /files/{key}/download`, `DELETE /files/{key}`

## Engine adapter at the repo boundary

The external model is reached only through `repo/` adapters, exactly like the B2 client:

- `repo/upscaler.py` wraps `RealESRGANer` (RealESRGAN_x4plus weights, auto-downloaded) and `GFPGANer`. torch/realesrgan/gfpgan/opencv are **lazy-imported inside functions**, so importing the module — and therefore `from main import app`, the test suite, lint, and `pnpm build` — never requires the heavy stack. `engine_available()` reports presence without raising; `upscale_image()` raises a clear `EngineUnavailableError` pointing at `requirements-restore.txt` when the stack is missing.
- `repo/video.py` uses the ffmpeg binary bundled *inside* `imageio-ffmpeg` (`get_ffmpeg_exe()`), never a system ffmpeg, to extract and reassemble frames.
- Tests **mock these adapters**, so `service/restoration.py` orchestration is verified end-to-end with base deps only.

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request)
- `/metrics` endpoint (Prometheus format: request count, latency, upload count)
- `/health` endpoint (B2 connectivity check)

## Canonical Files

- Restoration router (CRUD + run): `services/api/app/runtime/jobs.py`
- Manifest CRUD + stats: `services/api/app/service/jobs.py`
- Run orchestration: `services/api/app/service/restoration.py`
- Engine adapter (Real-ESRGAN/GFPGAN, lazy): `services/api/app/repo/upscaler.py`
- Video helpers (imageio-ffmpeg, lazy): `services/api/app/repo/video.py`
- Manifest persistence in B2: `services/api/app/repo/manifests.py`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`
- Job models: `services/api/app/types/jobs.py`
- Config (pydantic-settings, endpoint derived from `B2_REGION`): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [Restoration Jobs](docs/features/restoration-jobs.md)
- [Before/After Browser](docs/features/before-after-browser.md)
- [Dashboard](docs/features/dashboard.md)
- [File Upload](docs/features/file-upload.md)
- [File Browser](docs/features/file-browser.md)
- [Metadata Extraction](docs/features/metadata-extraction.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
