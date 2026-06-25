"""Restoration Job lifecycle (create / read / edit / delete) + dashboard stats.

The manifest in B2 is the system of record; this layer wraps the repo
manifest helpers with validation and the status rules. The actual
processing run lives in service/restoration.py.
"""

import logging
import uuid
from datetime import UTC, datetime

from app.repo import (
    delete_manifest_and_outputs,
    get_file_metadata,
    list_manifests,
    list_object_keys,
    load_manifest,
    save_manifest,
)
from app.types.formatting import humanize_bytes
from app.types.jobs import (
    RESTORED_PREFIX,
    UPLOADS_PREFIX,
    JobCreate,
    JobStats,
    JobUpdate,
    RestorationJob,
)

logger = logging.getLogger(__name__)

_VIDEO_EXTS = {"mp4", "mov", "mkv", "avi", "webm", "m4v"}
# Once a job has started or finished, its parameters are locked — editing a
# finished render means "create a new job", not mutate this one.
_EDITABLE_STATUSES = {"queued", "failed"}


class JobError(Exception):
    """Raised on invalid job operations (bad source, locked job, etc.)."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class JobNotFoundError(Exception):
    def __init__(self, detail: str = "Restoration job not found"):
        self.detail = detail
        super().__init__(detail)


def _infer_source_type(key: str) -> str:
    ext = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    return "video" if ext in _VIDEO_EXTS else "image"


def _require_source(source_key: str) -> int:
    """Validate the source lives under uploads/ and exists. Returns its size."""
    if not source_key.startswith(UPLOADS_PREFIX):
        raise JobError("Source must be an uploaded file under 'uploads/'")
    meta = get_file_metadata(source_key)
    if meta is None:
        raise JobError(f"Source '{source_key}' not found in bucket", 404)
    return meta.size_bytes


def list_jobs() -> list[RestorationJob]:
    return list_manifests()


def get_job(job_id: str) -> RestorationJob:
    job = load_manifest(job_id)
    if job is None:
        raise JobNotFoundError()
    return job


def create_job(payload: JobCreate) -> RestorationJob:
    source_bytes = _require_source(payload.source_key)
    now = datetime.now(UTC)
    job = RestorationJob(
        id=str(uuid.uuid4()),
        name=payload.name,
        source_key=payload.source_key,
        source_type=_infer_source_type(payload.source_key),
        scale=payload.scale,
        face_restore=payload.face_restore,
        status="queued",
        created_at=now,
        updated_at=now,
        source_bytes=source_bytes,
    )
    save_manifest(job)
    logger.info("Restoration job created: id=%s source=%s", job.id, job.source_key)
    return job


def update_job(job_id: str, payload: JobUpdate) -> RestorationJob:
    job = get_job(job_id)
    if job.status not in _EDITABLE_STATUSES:
        raise JobError(
            f"Job is '{job.status}' and can no longer be edited. "
            "Create a new job to re-render with different parameters.",
            409,
        )
    data = payload.model_dump(exclude_unset=True)
    if "source_key" in data:
        job.source_bytes = _require_source(data["source_key"])
        job.source_type = _infer_source_type(data["source_key"])
    updated = job.model_copy(update={**data, "updated_at": datetime.now(UTC)})
    save_manifest(updated)
    logger.info("Restoration job updated: id=%s", job_id)
    return updated


def delete_job(job_id: str) -> None:
    # Ensure it exists first so we 404 rather than silently no-op.
    get_job(job_id)
    delete_manifest_and_outputs(job_id)
    logger.info("Restoration job deleted: id=%s (manifest + outputs)", job_id)


def get_job_stats() -> JobStats:
    """Aggregate the restoration headline metrics for the dashboard."""
    jobs = list_manifests()
    by_status: dict[str, int] = {}
    faces = 0
    for j in jobs:
        by_status[j.status] = by_status.get(j.status, 0) + 1
        faces += j.faces_restored

    sources = list_object_keys(UPLOADS_PREFIX)
    sources_bytes = sum(o["size"] for o in sources)

    restored = [
        o for o in list_object_keys(RESTORED_PREFIX) if not o["key"].endswith("/")
    ]
    restored_bytes = sum(o["size"] for o in restored)

    growth = round(restored_bytes / sources_bytes, 2) if sources_bytes else 0.0

    return JobStats(
        jobs_total=len(jobs),
        jobs_by_status=by_status,
        sources_count=len(sources),
        sources_bytes=sources_bytes,
        sources_bytes_human=humanize_bytes(sources_bytes),
        restored_count=len(restored),
        restored_bytes=restored_bytes,
        restored_bytes_human=humanize_bytes(restored_bytes),
        output_footprint_growth=growth,
        faces_restored=faces,
    )
