from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# B2 object layout (no database — manifests in B2 are the system of record).
UPLOADS_PREFIX = "uploads/"
JOBS_PREFIX = "jobs/"
RESTORED_PREFIX = "restored/"

SourceType = Literal["image", "video"]
JobStatus = Literal["queued", "running", "done", "failed"]
Scale = Literal[4, 8]


class RestorationJob(BaseModel):
    """A Restoration Job manifest — the primary entity, persisted as
    jobs/<id>.json in B2."""

    id: str
    name: str
    source_key: str
    source_type: SourceType
    scale: Scale = 4
    face_restore: bool = False
    status: JobStatus = "queued"
    created_at: datetime
    updated_at: datetime
    source_bytes: int = 0
    source_width: int = 0
    source_height: int = 0
    output_key: str | None = None
    output_bytes: int = 0
    output_width: int = 0
    output_height: int = 0
    growth_multiplier: float = 0.0
    frames_total: int = 0
    frames_done: int = 0
    faces_restored: int = 0
    error: str | None = None


class JobCreate(BaseModel):
    """Create payload — validated at the API boundary."""

    name: str = Field(min_length=1, max_length=200)
    source_key: str = Field(min_length=1)
    scale: Scale = 4
    face_restore: bool = False


class JobUpdate(BaseModel):
    """Edit payload for a queued/failed job. All fields optional (partial)."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    source_key: str | None = Field(default=None, min_length=1)
    scale: Scale | None = None
    face_restore: bool | None = None


class JobStats(BaseModel):
    """Dashboard aggregations — the restoration headline metrics."""

    jobs_total: int
    jobs_by_status: dict[str, int]
    sources_count: int
    sources_bytes: int
    sources_bytes_human: str
    restored_count: int
    restored_bytes: int
    restored_bytes_human: str
    # The headline: how much the restored archive has grown vs the sources.
    output_footprint_growth: float
    faces_restored: int
