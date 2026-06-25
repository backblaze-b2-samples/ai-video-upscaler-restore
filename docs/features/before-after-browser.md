<!-- last_verified: 2026-06-24 -->
# Feature: Before/After Browser (Restorations Library)

## Purpose
A `restored/`-scoped browser that lists completed restorations with side-by-side original-vs-restored thumbnails, sizes, and the output-footprint growth multiplier — distinct from the full-bucket `/files` explorer.

## Used By
- UI: `/restorations` (Library grid) and the before/after panel on `/jobs/[id]`
- API: `GET /jobs/restorations`, `GET /jobs/{id}` (detail includes `source_url` + `output_url`)

## Core Functions
- `apps/web/src/components/jobs/restorations-library.tsx` — the `restored/`-scoped grid
- `apps/web/src/components/jobs/before-after.tsx` — side-by-side source vs restored (image or video) + growth line
- `apps/web/src/lib/queries.ts` — `useRestorations()`
- `services/api/app/runtime/jobs.py` — `GET /jobs/restorations` (only `status=done` jobs)
- `services/api/app/service/restoration.py` — `get_source_url()`, `get_output_url()` (presigned)

## Canonical Files
- Library grid: `apps/web/src/components/jobs/restorations-library.tsx`
- Comparison component: `apps/web/src/components/jobs/before-after.tsx`

## Inputs
- None (reads completed jobs automatically)

## Outputs
- `GET /jobs/restorations` → `RestorationItem[]`: `id`, `name`, `source_url`, `output_url`, `source_bytes`, `output_bytes`, `growth_multiplier`
- Presigned URLs (10-min expiry) for both the source (`uploads/...`) and restored (`restored/<id>/...`) objects

## Flow
- `/restorations` calls `useRestorations()` → backend lists job manifests, keeps only `done` jobs with an `output_key`, and attaches presigned before/after URLs
- Each card shows source vs restored thumbnails, both byte sizes, the growth multiplier, and a Download button for the restored output
- The same `BeforeAfter` component is reused on the job detail page

## Distinction from `/files`
- `/files` is the **full-bucket** explorer (every prefix). `/restorations` is **scoped to `restored/`** and pairs each output with its source. Both are intentional and kept.

## Edge Cases
- No completed restorations → empty state ("No restored outputs yet")
- A job deleted mid-view → its `restored/<id>/` objects are gone; the library simply omits it on next fetch
- Presigned URL expiry → images use a plain `<img>` (not the Next optimizer) so nothing is cached past the URL's short life

## UX States
- Loading: skeleton cards
- Empty: scoped empty state
- Loaded: before/after cards with growth + download

## Verification
- Test files: `services/api/tests/test_jobs_crud.py` (detail before/after URLs), `services/api/tests/test_restoration.py` (outputs written under `restored/<id>/`)
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure && pnpm build`
- Pass criteria: tests green; `/restorations` renders only completed jobs scoped to `restored/`

## Related Docs
- [Restoration Jobs](restoration-jobs.md)
- [File Browser](file-browser.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
