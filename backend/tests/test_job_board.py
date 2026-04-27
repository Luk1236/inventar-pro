import pytest
import uuid


def _job_payload():
    return {
        "title": f"Job-{uuid.uuid4().hex[:6]}",
        "description": "Test job description",
        "event_id": str(uuid.uuid4()),
        "event_name": "Test Event",
        "assigned_to_id": str(uuid.uuid4()),
        "assigned_to_name": "Max Mustermann",
        "job_type": "Aufbau",
        "date": "2027-06-01",
        "start_time": "08:00",
        "end_time": "16:00",
        "location": "Messe Berlin",
        "status": "offen",
    }


@pytest.mark.asyncio
async def test_create_job_board_entry(client, auth_headers):
    resp = await client.post("/api/job-board", headers=auth_headers, json=_job_payload())
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "id" in data
    assert data["title"].startswith("Job-")


@pytest.mark.asyncio
async def test_list_job_board_entries(client, auth_headers):
    await client.post("/api/job-board", headers=auth_headers, json=_job_payload())
    resp = await client.get("/api/job-board", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (list, dict))


@pytest.mark.asyncio
async def test_update_job_board_entry(client, auth_headers):
    create_resp = await client.post("/api/job-board", headers=auth_headers, json=_job_payload())
    entry_id = create_resp.json()["id"]

    update_payload = _job_payload()
    update_payload["status"] = "abgeschlossen"
    resp = await client.put(f"/api/job-board/{entry_id}", headers=auth_headers, json=update_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "abgeschlossen"


@pytest.mark.asyncio
async def test_delete_job_board_entry(client, auth_headers):
    create_resp = await client.post("/api/job-board", headers=auth_headers, json=_job_payload())
    entry_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/job-board/{entry_id}", headers=auth_headers)
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_get_nonexistent_job_returns_404(client, auth_headers):
    resp = await client.delete(f"/api/job-board/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
