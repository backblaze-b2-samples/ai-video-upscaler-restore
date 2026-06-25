<!-- last_verified: 2026-06-25 -->
# Feature: Restoration Jobs

## Purpose
The primary entity: a Restoration Job runs Real-ESRGAN 4×/8× super-resolution (with optional GFPGAN face restoration) on a source from the B2 archive and writes the upscaled output back to B2. Full create / read / edit / delete / run lifecycle, all from the UI.

## Used By
- UI: `/jobs` (list + create), `/jobs/[id]` (detail + before/after + run/edit/delete)
- API: `GET /jobs`, `GET /jobs/{id}`, `POST /jobs`, `PUT /jobs/{id}`, `DELETE /jobs/{id}`, `POST /jobs/{id}/run`, `GET /jobs/stats`
- Job: FastAPI BackgroundTask invokes `run_restoration`

## Core Functions
- `services/api/app/types/jobs.py` — `RestorationJob` manifest schema, `JobCreate`, `JobUpdate`, `JobStats`
- `services/api/app/service/jobs.py` — manifest CRUD + validation + `get_job_stats`
- `services/api/app/service/restoration.py` — run orchestration
- `services/api/app/repo/manifests.py` — manifest get/put/list/delete in B2 (no DB)
- `services/api/app/repo/upscaler.py` — Real-ESRGAN / GFPGAN engine adapter (lazy imports)
- `services/api/app/repo/video.py` — imageio-ffmpeg frame extract/reassemble (lazy imports)
- `services/api/app/runtime/jobs.py` — router
- `apps/web/src/components/jobs/**` — form, list, status badge, before/after, detail
- `apps/web/src/lib/queries.ts` — `useJobs`, `useJob`, `useCreateJob`, `useUpdateJob`, `useDeleteJob`, `useRunJob`

## Manifest schema (`jobs/<id>.json`)
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

## Lifecycle (all in the UI)
| Verb | UI | API | Notes |
|------|----|-----|-------|
| Create | `/jobs` "New restoration" dialog (pick `uploads/` source, name, scale, face-restore) | `POST /jobs` | writes manifest `status=queued` |
| Read | `/jobs` list + `/jobs/[id]` detail | `GET /jobs`, `GET /jobs/{id}` | detail attaches presigned before/after URLs |
| Edit | edit dialog on a **queued/failed** job | `PUT /jobs/{id}` | params lock once `running`/`done` (re-render = new job) — a UX rule, not an omission |
| Delete | list + detail | `DELETE /jobs/{id}` | deletes manifest **and** `restored/<id>/` outputs, scoped to the job's own prefix |
| Run | "Run restoration" button | `POST /jobs/{id}/run` | BackgroundTask; UI polls while `running` and shows the generating loader |

## Flow (run)
- `status → running`; read source bytes from B2
- *image*: `upscale_image()` once. *video*: extract frames (bundled `imageio-ffmpeg`) → upscale each (manifest `frames_done` persisted after **every** frame, so the polling UI tracks progress frame-by-frame) → reassemble mp4
- write output to `restored/<id>/output.<ext>`; recompute `growth_multiplier = output_bytes / source_bytes`
- update manifest `→ done` (or `→ failed`, recording `error`)

## Engine notes
- **Real-ESRGAN is the only engine** (RealESRGAN_x4plus weights, auto-downloaded). No classical fallback. 8× runs the x4plus model with `outscale=8`. GFPGAN handles faces when `face_restore` is on.
- The heavy stack is in `requirements-restore.txt` and **lazy-imported**, so storage/UI/tests work without it. Running without it raises a clear error pointing at that file.
- **basicsr gotcha:** it imports `torchvision.transforms.functional_tensor`, removed in torchvision ≥ 0.17. We pin a compatible pair in `requirements-restore.txt` and install a shim (alias to `torchvision.transforms.functional`) in `repo/upscaler.py` before importing the engine.
- **Device selection:** `repo/upscaler.py` auto-detects the compute device in order **CUDA → Apple MPS → CPU** (`_select_device`); fp16 is enabled only on CUDA. Set `RESTORATION_DEVICE` (e.g. `cpu`, `cuda`, `cuda:0`, `mps`) to force one. When MPS is chosen we set `PYTORCH_ENABLE_MPS_FALLBACK=1` so any op MPS lacks falls back to CPU instead of erroring. The pure `_choose_device_name` helper is unit-tested under base deps (no torch).

## Edge Cases
- Source not under `uploads/` or missing → `400`/`404` on create
- Edit a `running`/`done` job → `409` (locked)
- Run a `running` job again → `409`
- Engine missing at run time → manifest `status=failed` with an actionable error message

## UX States
- Loading: skeletons (list) / skeleton (detail)
- Empty: "No restorations yet"
- Running: generating loader with frame progress (`frames_done/frames_total` for video)
- Error: failed badge + the recorded error message on detail

## Verification
- Test files: `services/api/tests/test_jobs_crud.py`, `services/api/tests/test_restoration.py`, `services/api/tests/test_upscaler_guard.py`, `services/api/tests/test_job_stats.py`
- Required cases: full CRUD; image + video run (engine mocked); failure path; lazy-import guard; stats growth
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure && pnpm build`
- Pass criteria: all pytest green with base deps only (engine mocked, ML stack NOT installed)

## Related Docs
- [Before/After Browser](before-after-browser.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
