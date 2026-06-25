<!-- last_verified: 2026-06-24 -->
# Feature: Dashboard

## Purpose
Show restoration activity at a glance, with the headline **output-footprint growth** metric — how much larger the restored archive is than the sources on B2.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /jobs/stats`, `GET /jobs`

## Core Functions
- `apps/web/src/components/dashboard/stats-cards.tsx` — 5 stat cards (jobs total, sources archived, restored outputs, footprint growth, faces restored)
- `apps/web/src/components/dashboard/upload-chart.tsx` — source-vs-restored footprint bar chart (MB)
- `apps/web/src/components/dashboard/recent-uploads-table.tsx` — recent restorations table
- `apps/web/src/lib/queries.ts` — `useJobStats()`, `useJobs()`
- `services/api/app/runtime/jobs.py` — `GET /jobs/stats` handler
- `services/api/app/service/jobs.py` — `get_job_stats()` aggregation
- `services/api/app/repo/b2_client.py` / `repo/manifests.py` — list manifests + prefix sizes

## Canonical Files
- Stats aggregation: `services/api/app/service/jobs.py` (`get_job_stats`)
- Stat cards: `apps/web/src/components/dashboard/stats-cards.tsx`

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /jobs/stats` → `JobStats`: `jobs_total`, `jobs_by_status`, `sources_count`, `sources_bytes(+human)`, `restored_count`, `restored_bytes(+human)`, `output_footprint_growth` (= `restored_bytes / sources_bytes`), `faces_restored`
- `GET /jobs` → `RestorationJob[]` for the recent-restorations table

## Flow
- Page loads → `useJobStats()` and `useJobs()` fetch in parallel
- Stat cards show jobs total, sources archived (count + bytes), restored outputs (count + bytes), the footprint-growth multiplier, and faces restored
- Bar chart compares total source bytes vs total restored bytes (MB)
- Recent restorations table lists the latest jobs with scale, growth, and status badge; while any job is `running` the list polls every 2.5 s

## Edge Cases
- No sources yet → `output_footprint_growth` is `0.0` (no divide-by-zero)
- API unavailable → inline `ErrorState` with Retry, not fake zeros
- Large bucket → source/restored byte sums paginate via `ContinuationToken`

## UX States
- Loading: skeleton placeholders for cards and table
- Empty: "No restorations yet" / "No footprint yet"
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/test_job_stats.py`
- Required cases: growth + status breakdown with data; zero growth with no sources
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure && pnpm build`
- Pass criteria: all pytest tests green, no ruff violations, build clean

## Related Docs
- [Restoration Jobs](restoration-jobs.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
