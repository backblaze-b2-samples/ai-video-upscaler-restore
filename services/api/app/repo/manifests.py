"""Restoration-job manifest persistence — JSON objects in B2.

There is no database: each job is a `jobs/<id>.json` object in the bucket
and the manifest *is* the system of record. This module is the only place
that knows the manifest key layout; everything above it works with the
`RestorationJob` Pydantic model.
"""

from app.repo.b2_client import (
    delete_file,
    delete_prefix,
    get_object_bytes,
    list_object_keys,
    put_object_bytes,
)
from app.types.jobs import JOBS_PREFIX, RESTORED_PREFIX, RestorationJob


def _manifest_key(job_id: str) -> str:
    return f"{JOBS_PREFIX}{job_id}.json"


def save_manifest(job: RestorationJob) -> None:
    """Write (create or overwrite) a job manifest to B2."""
    body = job.model_dump_json(indent=2).encode("utf-8")
    put_object_bytes(body, _manifest_key(job.id), "application/json")


def load_manifest(job_id: str) -> RestorationJob | None:
    """Read a single manifest. Returns None if it doesn't exist."""
    try:
        raw = get_object_bytes(_manifest_key(job_id))
    except RuntimeError:
        return None
    try:
        return RestorationJob.model_validate_json(raw)
    except ValueError:
        return None


def list_manifests() -> list[RestorationJob]:
    """Load every job manifest under jobs/. Skips unparseable objects."""
    jobs: list[RestorationJob] = []
    for obj in list_object_keys(JOBS_PREFIX):
        key = obj["key"]
        if not key.endswith(".json"):
            continue
        try:
            raw = get_object_bytes(key)
            jobs.append(RestorationJob.model_validate_json(raw))
        except (RuntimeError, ValueError):
            continue
    jobs.sort(key=lambda j: j.created_at, reverse=True)
    return jobs


def delete_manifest_and_outputs(job_id: str) -> None:
    """Delete a job's manifest and every object under its restored/ prefix.

    Scoped strictly to this job's own keys — never touches other prefixes.
    """
    delete_prefix(f"{RESTORED_PREFIX}{job_id}/")
    delete_file(_manifest_key(job_id))


def output_prefix(job_id: str) -> str:
    return f"{RESTORED_PREFIX}{job_id}/"
