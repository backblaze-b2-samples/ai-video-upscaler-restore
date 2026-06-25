import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.service.jobs import (
    JobError,
    JobNotFoundError,
    create_job,
    delete_job,
    get_job,
    get_job_stats,
    list_jobs,
    update_job,
)
from app.service.restoration import (
    get_output_url,
    get_source_url,
    run_restoration,
)
from app.types import JobCreate, JobStats, JobUpdate, RestorationJob

logger = logging.getLogger(__name__)

router = APIRouter()


class JobDetail(BaseModel):
    """A job plus presigned before/after URLs for the comparison view."""

    job: RestorationJob
    source_url: str
    output_url: str | None = None


class RestorationItem(BaseModel):
    """One completed restoration in the restored/-scoped library."""

    id: str
    name: str
    source_url: str
    output_url: str
    source_bytes: int
    output_bytes: int
    growth_multiplier: float


def _run_job_task(job_id: str) -> None:
    """BackgroundTask entrypoint — reload the manifest and process it."""
    try:
        job = get_job(job_id)
    except JobNotFoundError:
        logger.warning("Run task: job vanished before start id=%s", job_id)
        return
    run_restoration(job)


@router.get("/jobs", response_model=list[RestorationJob])
async def list_jobs_endpoint():
    return list_jobs()


@router.get("/jobs/stats", response_model=JobStats)
async def job_stats_endpoint():
    return get_job_stats()


@router.get("/jobs/restorations", response_model=list[RestorationItem])
async def restorations_library_endpoint():
    """Restored/-scoped before/after library — only completed jobs."""
    items: list[RestorationItem] = []
    for job in list_jobs():
        if job.status != "done" or not job.output_key:
            continue
        items.append(
            RestorationItem(
                id=job.id,
                name=job.name,
                source_url=get_source_url(job),
                output_url=get_output_url(job) or "",
                source_bytes=job.source_bytes,
                output_bytes=job.output_bytes,
                growth_multiplier=job.growth_multiplier,
            )
        )
    return items


@router.get("/jobs/{job_id}", response_model=JobDetail)
async def get_job_endpoint(job_id: str):
    try:
        job = get_job(job_id)
    except JobNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    return JobDetail(
        job=job,
        source_url=get_source_url(job),
        output_url=get_output_url(job),
    )


@router.post("/jobs", response_model=RestorationJob, status_code=201)
async def create_job_endpoint(payload: JobCreate):
    try:
        return create_job(payload)
    except JobError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None


@router.put("/jobs/{job_id}", response_model=RestorationJob)
async def update_job_endpoint(job_id: str, payload: JobUpdate):
    try:
        return update_job(job_id, payload)
    except JobNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except JobError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None


@router.delete("/jobs/{job_id}")
async def delete_job_endpoint(job_id: str):
    try:
        delete_job(job_id)
    except JobNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Failed to delete job") from None
    return {"deleted": True, "id": job_id}


@router.post("/jobs/{job_id}/run", response_model=RestorationJob)
async def run_job_endpoint(job_id: str, background_tasks: BackgroundTasks):
    try:
        job = get_job(job_id)
    except JobNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    if job.status == "running":
        raise HTTPException(status_code=409, detail="Job is already running")
    background_tasks.add_task(_run_job_task, job_id)
    return job
