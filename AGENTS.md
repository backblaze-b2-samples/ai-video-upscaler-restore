<!-- last_verified: 2026-05-01 -->
# AGENTS.md

This is the authoritative control surface for all coding agents. Read this first.

## 1. Repository Map

```
apps/web/          Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  src/app/jobs/          Restorations: list+create (/jobs) and detail (/jobs/[id])
  src/app/restorations/  restored/-scoped before/after Library
  src/components/jobs/   Job form, list, status badge, before/after, library
services/api/      FastAPI backend (layered: types/config/repo/service/runtime)
  app/types/jobs.py        RestorationJob manifest schema + request models
  app/repo/manifests.py    Job manifest get/put/list/delete in B2 (JSON, no DB)
  app/repo/upscaler.py     Real-ESRGAN / GFPGAN engine adapter (LAZY imports)
  app/repo/video.py        imageio-ffmpeg frame extract/reassemble (LAZY imports)
  app/service/jobs.py      Manifest CRUD + dashboard stats
  app/service/restoration.py  Run orchestration (extract→upscale→store→update)
  app/runtime/jobs.py      /jobs router (create/read/edit/delete/run + stats)
  requirements-restore.txt heavy ML stack — installed only to RUN restorations
packages/shared/   Shared TypeScript types
docs/              System of record (features, workflows, security, reliability)
docs/exec-plans/   Execution plans and tech debt tracker
infra/railway/     Deployment config
```

**B2 object layout** (the bucket is the system of record — no database):

```
uploads/<filename>              source archive
jobs/<job_id>.json              Restoration Job manifest
restored/<job_id>/output.<ext>  restored image / reassembled video
```

## 2. Repository Structure

This is `ai-video-upscaler-restore` — a Real-ESRGAN restoration app built on the Backblaze B2 vibe-coding scaffolding. The reusable B2-backed pieces are kept; the restoration domain is the new surface.

**Reusable B2 scaffolding (kept)**
- **UI kit / design system.** `apps/web/src/components/ui/` (shadcn primitives), design tokens in `apps/web/src/app/globals.css`, and the `/design` reference page. Build new screens with these primitives; never edit the generated `components/ui/` files directly.
- **File Explorer.** `/files` route — the **full-bucket** explorer (list, preview, download, delete). This is distinct from the `restored/`-scoped Library at `/restorations`; both exist on purpose.
- **Upload.** `/upload` route — this *is* the Ingest step; uploads land the source archive in `uploads/`.
- **Sidebar nav.** Dashboard, Upload, Restorations, Library, Files, Settings, plus the Design System utility link.

**Restoration domain (this app)**
- **Restoration Job** is the primary entity (full CRUD + run from the UI). Backend lives in `types/jobs.py`, `service/jobs.py`, `service/restoration.py`, `repo/manifests.py`, `repo/upscaler.py`, `repo/video.py`, `runtime/jobs.py`. Frontend in `app/jobs/**`, `app/restorations/**`, `components/jobs/**`.
- **Dashboard** (`/`) shows restoration metrics — jobs by status, source-vs-restored footprint, and the headline output-footprint growth multiplier. New aggregations flow `runtime -> service -> repo` and are exposed via TanStack Query hooks in `apps/web/src/lib/queries.ts` — no bare `useEffect + fetch`. Update `docs/features/dashboard.md` in the same PR as any dashboard change (see §9).

**Engine discipline (critical)**
- The heavy ML stack (torch, realesrgan, gfpgan, basicsr, opencv, imageio-ffmpeg) lives ONLY in `services/api/requirements-restore.txt`. It is **lazy-imported inside functions** in `repo/upscaler.py` and `repo/video.py` (mirroring how `service/metadata.py` imports PIL/PyPDF2), so the server, the test suite, lint, and `pnpm build` all work without it installed. Tests **mock the engine**. Real-ESRGAN is the only engine — there is no classical fallback.

## 3. Architectural Invariants

**Backend layering**: `types` -> `config` -> `repo` -> `service` -> `runtime`

- No backward imports across layers
- No `boto3` outside `repo/`
- No business logic in route handlers (`runtime/`)
- All external APIs wrapped in `repo/` adapters
- All request/response data validated at boundary (Pydantic models)
- No shared mutable state across layers

**Frontend**: shadcn/ui components in `src/components/ui/` are generated — never modify them.

**Data fetching**: every API call flows through TanStack Query hooks in `apps/web/src/lib/queries.ts`. No bare `useEffect + fetch` patterns. New endpoints touch three files: `runtime/<router>.py`, `lib/api-client.ts`, `lib/queries.ts`.

## 4. Quality Expectations

- **DRY** — do not duplicate logic, types, or constants. Extract shared code only when used in 2+ places.
- Structured JSON logging only — no `print()` statements
- No raw SDK calls outside `repo/` layer
- Files stay under 300 lines
- Tests added or updated for every behavior change
- Docs updated in same PR as code changes
- Lint clean before merge
- Prefer boring, composable libraries over clever abstractions
- No implicit type assumptions — use typed models

## 5. Mechanical Enforcement

| Rule | Enforced by |
|------|-------------|
| No backward imports | `tests/test_structure.py::test_no_backward_imports` |
| No boto3 outside repo/ | `tests/test_structure.py::test_boto3_only_in_repo` |
| File size < 300 lines | `tests/test_structure.py::test_file_size_limits` |
| All layers exist | `tests/test_structure.py::test_all_layers_exist` |
| No bare print() | `ruff` rule T20 |
| Import ordering | `ruff` rule I001 |
| Frontend strict equality | `eslint` rule eqeqeq |
| No unused vars | `eslint` + `ruff` rules |

## 6. Commands

```bash
# Run
pnpm dev               # start both frontend and backend
pnpm dev:web           # frontend only
pnpm dev:api           # backend only

# Test & Lint
pnpm lint              # frontend lint (eslint)
pnpm build             # frontend type check + build
pnpm lint:api          # backend lint (ruff)
pnpm test:api          # backend tests (pytest)
pnpm check:structure   # structural boundary tests
pnpm test:e2e          # Playwright e2e tests
```

## 7. Agent Workflow

1. Read this file first.
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) before structural changes.
3. For non-trivial changes, create a plan in `docs/exec-plans/active/`.
4. Implement the smallest coherent change.
5. Run: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
6. Update docs in the same PR (see §9).
7. Move completed plans to `docs/exec-plans/completed/`.
8. Only change files relevant to the task. No drive-by improvements.

## 8. Frontend Conventions

See [docs/dev-workflows.md](docs/dev-workflows.md) for full details.

## 9. Doc Update Mapping

| Change Type | Update Location |
|-------------|-----------------|
| Feature logic, inputs, outputs, tests | `docs/features/<feature>.md` |
| User journeys | `docs/app-workflows.md` |
| System layout, deployments | `ARCHITECTURE.md` |
| Dev or testing process | `docs/dev-workflows.md` |
| Setup or scope changes | `README.md` |
| Security changes | `docs/SECURITY.md` |
| Reliability changes | `docs/RELIABILITY.md` |
| Active work plans | `docs/exec-plans/active/` |
| Known tech debt | `docs/exec-plans/tech-debt-tracker.md` |

If documentation and implementation conflict, update docs in the same PR. Documentation rot destroys agent reliability.

## 10. Doc Map

| Topic | Location |
|-------|----------|
| System layout, data flows, boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Feature docs | [docs/features/](docs/features/) |
| Restoration Jobs (primary entity) | [docs/features/restoration-jobs.md](docs/features/restoration-jobs.md) |
| Before/after browser | [docs/features/before-after-browser.md](docs/features/before-after-browser.md) |
| User journeys | [docs/app-workflows.md](docs/app-workflows.md) |
| Engineering workflows and testing | [docs/dev-workflows.md](docs/dev-workflows.md) |
| Security principles | [docs/SECURITY.md](docs/SECURITY.md) |
| Reliability expectations | [docs/RELIABILITY.md](docs/RELIABILITY.md) |
| Execution plans | [docs/exec-plans/](docs/exec-plans/) |
| Tech debt | [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) |

## 11. When Unsure

- Prefer boring, stable libraries
- Prefer small PRs over large changes
- Add tests with every change
- Never bypass lint rules without explicit instruction
- Ask before making destructive or irreversible changes
