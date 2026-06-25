"""Dashboard restoration metrics — footprint growth multiplier + counts."""

from datetime import UTC, datetime

import pytest

from app.service import jobs as jobs_service
from app.types.jobs import RestorationJob


def _job(jid: str, status: str, faces: int = 0) -> RestorationJob:
    now = datetime.now(UTC)
    return RestorationJob(
        id=jid,
        name=jid,
        source_key=f"uploads/{jid}.png",
        source_type="image",
        status=status,
        created_at=now,
        updated_at=now,
        source_bytes=100,
        faces_restored=faces,
    )


@pytest.mark.asyncio
async def test_stats_compute_growth_and_status_breakdown(client, monkeypatch):
    monkeypatch.setattr(
        jobs_service,
        "list_manifests",
        lambda: [_job("a", "done", faces=3), _job("b", "queued")],
    )

    def _list(prefix, max_keys=1000):
        if prefix == "uploads/":
            return [{"key": "uploads/a.png", "size": 1000, "last_modified": None}]
        if prefix == "restored/":
            return [
                {"key": "restored/a/output.png", "size": 4000, "last_modified": None}
            ]
        return []

    monkeypatch.setattr(jobs_service, "list_object_keys", _list)

    resp = await client.get("/jobs/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["jobs_total"] == 2
    assert data["jobs_by_status"] == {"done": 1, "queued": 1}
    assert data["sources_bytes"] == 1000
    assert data["restored_bytes"] == 4000
    # 4000 / 1000 = 4.0x footprint growth — the headline metric
    assert data["output_footprint_growth"] == 4.0
    assert data["faces_restored"] == 3


@pytest.mark.asyncio
async def test_stats_growth_zero_when_no_sources(client, monkeypatch):
    monkeypatch.setattr(jobs_service, "list_manifests", lambda: [])
    monkeypatch.setattr(jobs_service, "list_object_keys", lambda p, max_keys=1000: [])
    resp = await client.get("/jobs/stats")
    assert resp.json()["output_footprint_growth"] == 0.0
