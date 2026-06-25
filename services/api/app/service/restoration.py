"""Restoration run orchestration.

Flow: read source from B2 -> (video) extract frames via the imageio-ffmpeg
bundled binary -> upscale each frame with Real-ESRGAN (+ optional GFPGAN) ->
reassemble -> write output to restored/<id>/ -> recompute growth multiplier
-> update the manifest (status done/failed).

The heavy engine is reached only through the repo/ adapters (upscaler,
video), which lazy-import the ML stack. Tests monkeypatch those adapter
functions, so this orchestration is exercised end-to-end with base deps.
"""

import logging
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from app.repo import (
    get_object_bytes,
    get_presigned_url,
    output_prefix,
    put_object_bytes,
    save_manifest,
)
from app.repo.upscaler import upscale_image
from app.repo.video import assemble_video, extract_frames, probe_fps
from app.types.jobs import RestorationJob

logger = logging.getLogger(__name__)


def _touch(job: RestorationJob, **changes) -> RestorationJob:
    """Apply changes + bump updated_at and persist the manifest."""
    updated = job.model_copy(
        update={**changes, "updated_at": datetime.now(UTC)}
    )
    save_manifest(updated)
    return updated


def _restore_image(job: RestorationJob, src: bytes) -> RestorationJob:
    png, width, height, faces = upscale_image(src, job.scale, job.face_restore)
    out_key = f"{output_prefix(job.id)}output.png"
    out_bytes = put_object_bytes(png, out_key, "image/png")
    growth = round(out_bytes / job.source_bytes, 2) if job.source_bytes else 0.0
    return _touch(
        job,
        status="done",
        output_key=out_key,
        output_bytes=out_bytes,
        output_width=width,
        output_height=height,
        growth_multiplier=growth,
        frames_total=1,
        frames_done=1,
        faces_restored=faces,
    )


def _restore_video(job: RestorationJob, src: bytes) -> RestorationJob:
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        src_path = tmp / "source"
        src_path.write_bytes(src)
        fps = probe_fps(src_path)
        frames = extract_frames(src_path, tmp / "in")
        out_dir = tmp / "out"
        out_dir.mkdir(parents=True, exist_ok=True)

        job = _touch(job, frames_total=len(frames), frames_done=0)
        faces = 0
        last_w = last_h = 0
        for i, frame in enumerate(frames):
            png, last_w, last_h, f = upscale_image(
                frame.read_bytes(), job.scale, job.face_restore
            )
            (out_dir / frame.name).write_bytes(png)
            faces += f
            if (i + 1) % 10 == 0 or i + 1 == len(frames):
                job = _touch(job, frames_done=i + 1)

        out_video = tmp / "output.mp4"
        assemble_video(out_dir, out_video, fps, "frame_*.png")
        data = out_video.read_bytes()

    out_key = f"{output_prefix(job.id)}output.mp4"
    out_bytes = put_object_bytes(data, out_key, "video/mp4")
    growth = round(out_bytes / job.source_bytes, 2) if job.source_bytes else 0.0
    return _touch(
        job,
        status="done",
        output_key=out_key,
        output_bytes=out_bytes,
        output_width=last_w,
        output_height=last_h,
        growth_multiplier=growth,
        faces_restored=faces,
    )


def run_restoration(job: RestorationJob) -> RestorationJob:
    """Process a job end-to-end, updating its manifest as it goes.

    Errors are caught and recorded on the manifest (status=failed) rather
    than propagated, because this runs in a FastAPI BackgroundTask with no
    request to return them to.
    """
    job = _touch(job, status="running", error=None)
    logger.info("Restoration run started: id=%s type=%s", job.id, job.source_type)
    try:
        src = get_object_bytes(job.source_key)
        job = (
            _restore_video(job, src)
            if job.source_type == "video"
            else _restore_image(job, src)
        )
        logger.info(
            "Restoration run done: id=%s growth=%.2fx output=%s",
            job.id,
            job.growth_multiplier,
            job.output_key,
        )
        return job
    except Exception as e:
        # Record any failure on the manifest — this runs in a BackgroundTask
        # with no request to surface the exception to.
        logger.warning("Restoration run failed: id=%s err=%s", job.id, e)
        return _touch(job, status="failed", error=str(e))


def get_output_url(job: RestorationJob) -> str | None:
    """Presigned URL for a job's restored output (None until it exists)."""
    if not job.output_key:
        return None
    return get_presigned_url(job.output_key, expires_in=600)


def get_source_url(job: RestorationJob) -> str:
    """Presigned URL for the job's source object (the 'before')."""
    return get_presigned_url(job.source_key, expires_in=600)
