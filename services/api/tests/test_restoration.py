"""Restoration orchestration — engine fully MOCKED.

These tests assert the orchestration contract without the heavy ML stack:
the run reads the source from B2, calls the (mocked) upscaler, writes the
restored output + updated manifest back to B2, recomputes the growth
multiplier, and flips status to done (or failed on error). Test image bytes
are generated in-memory with PIL — no binary fixtures are committed.
"""

import io
from datetime import UTC, datetime

from app.service import restoration
from app.types.jobs import RestorationJob


def _png_bytes(w: int = 16, h: int = 16) -> bytes:
    """Generate a tiny PNG in-memory (no committed fixture)."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (w, h), (128, 64, 32)).save(buf, format="PNG")
    return buf.getvalue()


def _job(source_type: str = "image", source_key: str = "uploads/a.png"):
    now = datetime.now(UTC)
    return RestorationJob(
        id="job-1",
        name="test",
        source_key=source_key,
        source_type=source_type,
        scale=4,
        face_restore=True,
        status="queued",
        created_at=now,
        updated_at=now,
        source_bytes=100,
    )


def test_image_run_writes_output_and_computes_growth(monkeypatch):
    saved: list[RestorationJob] = []
    puts: dict[str, bytes] = {}

    src = _png_bytes()
    big = _png_bytes(64, 64)  # stand-in "restored" output, 4x larger area

    monkeypatch.setattr(restoration, "get_object_bytes", lambda key: src)
    monkeypatch.setattr(
        restoration, "save_manifest", lambda job: saved.append(job)
    )

    def _put(data, key, content_type):
        puts[key] = data
        return len(data)

    monkeypatch.setattr(restoration, "put_object_bytes", _put)
    # Engine is mocked: return (png, w, h, faces) without torch/realesrgan.
    monkeypatch.setattr(
        restoration,
        "upscale_image",
        lambda b, scale, face: (big, 64, 64, 2),
    )

    result = restoration.run_restoration(_job())

    assert result.status == "done"
    # Source was read, output was written under restored/<id>/
    assert "restored/job-1/output.png" in puts
    assert result.output_key == "restored/job-1/output.png"
    assert result.output_bytes == len(big)
    assert result.output_width == 64
    assert result.faces_restored == 2
    # growth = output_bytes / source_bytes (source_bytes=100)
    assert result.growth_multiplier == round(len(big) / 100, 2)
    # Manifest was persisted multiple times (running -> done)
    assert any(j.status == "running" for j in saved)
    assert saved[-1].status == "done"


def test_run_records_failure_on_engine_error(monkeypatch):
    saved: list[RestorationJob] = []
    monkeypatch.setattr(restoration, "get_object_bytes", lambda key: _png_bytes())
    monkeypatch.setattr(
        restoration, "save_manifest", lambda job: saved.append(job)
    )
    monkeypatch.setattr(
        restoration, "put_object_bytes", lambda d, k, c: len(d)
    )

    def _boom(*a, **k):
        raise RuntimeError("engine exploded")

    monkeypatch.setattr(restoration, "upscale_image", _boom)

    result = restoration.run_restoration(_job())
    assert result.status == "failed"
    assert "engine exploded" in (result.error or "")


def test_video_run_extracts_upscales_and_assembles(monkeypatch):
    saved: list[RestorationJob] = []
    puts: dict[str, bytes] = {}

    monkeypatch.setattr(
        restoration, "get_object_bytes", lambda key: b"fakevideo"
    )
    monkeypatch.setattr(
        restoration, "save_manifest", lambda job: saved.append(job)
    )

    def _put(data, key, content_type):
        puts[key] = data
        return len(data)

    monkeypatch.setattr(restoration, "put_object_bytes", _put)
    monkeypatch.setattr(restoration, "probe_fps", lambda p: 24.0)

    def _extract(src_path, frames_dir):
        frames_dir.mkdir(parents=True, exist_ok=True)
        paths = []
        for i in range(3):
            p = frames_dir / f"frame_{i:06d}.png"
            p.write_bytes(_png_bytes())
            paths.append(p)
        return paths

    monkeypatch.setattr(restoration, "extract_frames", _extract)
    monkeypatch.setattr(
        restoration, "upscale_image", lambda b, s, f: (_png_bytes(64, 64), 64, 64, 1)
    )

    def _assemble(frames_dir, output_path, fps, glob):
        output_path.write_bytes(b"x" * 4096)

    monkeypatch.setattr(restoration, "assemble_video", _assemble)

    result = restoration.run_restoration(_job("video", "uploads/clip.mp4"))
    assert result.status == "done"
    assert "restored/job-1/output.mp4" in puts
    assert result.frames_total == 3
    assert result.faces_restored == 3  # 1 per frame x 3
