"""Restoration Job CRUD — create/read/edit/delete through the API.

The B2 manifest store is fully faked with an in-memory dict so these tests
run with base deps only (no boto3 network, no ML stack).
"""

from datetime import UTC, datetime

import pytest

from app.service import jobs as jobs_service
from app.types import FileMetadata
from app.types.jobs import RestorationJob


@pytest.fixture
def fake_store(monkeypatch):
    """In-memory manifest store wired into the jobs service + its router."""
    store: dict[str, RestorationJob] = {}

    def _save(job: RestorationJob) -> None:
        store[job.id] = job

    def _load(job_id: str):
        return store.get(job_id)

    def _list():
        return sorted(store.values(), key=lambda j: j.created_at, reverse=True)

    def _delete(job_id: str) -> None:
        store.pop(job_id, None)

    def _meta(key: str):
        return FileMetadata(
            key=key,
            filename=key.split("/")[-1],
            folder="uploads/",
            size_bytes=1024,
            size_human="1.0 KB",
            content_type="image/png",
            uploaded_at=datetime.now(UTC),
            url=None,
        )

    monkeypatch.setattr(jobs_service, "save_manifest", _save)
    monkeypatch.setattr(jobs_service, "load_manifest", _load)
    monkeypatch.setattr(jobs_service, "list_manifests", _list)
    monkeypatch.setattr(jobs_service, "delete_manifest_and_outputs", _delete)
    monkeypatch.setattr(jobs_service, "get_file_metadata", _meta)
    return store


@pytest.fixture
def stub_presigned(monkeypatch):
    """Stub the presigned-URL helpers as the router sees them (network calls)."""
    from app.runtime import jobs as jobs_router

    monkeypatch.setattr(jobs_router, "get_source_url", lambda job: "https://src")
    monkeypatch.setattr(jobs_router, "get_output_url", lambda job: None)


@pytest.mark.asyncio
async def test_create_read_update_delete(client, fake_store, stub_presigned):
    # CREATE
    resp = await client.post(
        "/jobs",
        json={"name": "Clip A", "source_key": "uploads/clip.png", "scale": 4},
    )
    assert resp.status_code == 201
    job = resp.json()
    assert job["status"] == "queued"
    assert job["source_type"] == "image"
    assert job["source_bytes"] == 1024
    job_id = job["id"]

    # READ list + detail
    listed = await client.get("/jobs")
    assert listed.status_code == 200
    assert any(j["id"] == job_id for j in listed.json())

    detail = await client.get(f"/jobs/{job_id}")
    assert detail.status_code == 200
    assert detail.json()["job"]["id"] == job_id
    assert detail.json()["source_url"] == "https://src"

    # UPDATE (queued -> editable)
    upd = await client.put(f"/jobs/{job_id}", json={"name": "Clip B", "scale": 8})
    assert upd.status_code == 200
    assert upd.json()["name"] == "Clip B"
    assert upd.json()["scale"] == 8

    # DELETE
    dele = await client.delete(f"/jobs/{job_id}")
    assert dele.status_code == 200
    assert dele.json()["deleted"] is True
    assert job_id not in fake_store


@pytest.mark.asyncio
async def test_create_rejects_non_upload_source(client, fake_store):
    resp = await client.post(
        "/jobs", json={"name": "bad", "source_key": "restored/x/output.png"}
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_video_source_type_inferred(client, fake_store, stub_presigned):
    resp = await client.post(
        "/jobs", json={"name": "Movie", "source_key": "uploads/movie.mp4"}
    )
    assert resp.json()["source_type"] == "video"


@pytest.mark.asyncio
async def test_running_or_done_job_is_locked(client, fake_store):
    now = datetime.now(UTC)
    fake_store["fixed"] = RestorationJob(
        id="fixed",
        name="done one",
        source_key="uploads/a.png",
        source_type="image",
        status="done",
        created_at=now,
        updated_at=now,
        source_bytes=10,
    )
    resp = await client.put("/jobs/fixed", json={"name": "rename"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_get_missing_job_404(client, fake_store):
    resp = await client.get("/jobs/does-not-exist")
    assert resp.status_code == 404
