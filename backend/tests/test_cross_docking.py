import pytest
import uuid


def _cd_payload():
    return {
        "article_id": str(uuid.uuid4()),
        "article_name": f"Art-{uuid.uuid4().hex[:6]}",
        "quantity": 2,
        "source_event_id": str(uuid.uuid4()),
        "source_event_name": "Quelle Event",
        "target_event_id": str(uuid.uuid4()),
        "target_event_name": "Ziel Event",
        "transfer_date": "2027-06-01T10:00:00",
        "status": "geplant",
        "notes": "Test cross-dock",
    }


@pytest.mark.asyncio
async def test_create_cross_docking(client, auth_headers):
    resp = await client.post("/api/cross-docking", headers=auth_headers, json=_cd_payload())
    assert resp.status_code == 200, resp.text
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_list_cross_docking(client, auth_headers):
    await client.post("/api/cross-docking", headers=auth_headers, json=_cd_payload())
    resp = await client.get("/api/cross-docking", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), (list, dict))


@pytest.mark.asyncio
async def test_update_cross_docking(client, auth_headers):
    create_resp = await client.post("/api/cross-docking", headers=auth_headers, json=_cd_payload())
    cd_id = create_resp.json()["id"]

    update_payload = _cd_payload()
    update_payload["status"] = "abgeschlossen"
    resp = await client.put(f"/api/cross-docking/{cd_id}", headers=auth_headers, json=update_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "abgeschlossen"


@pytest.mark.asyncio
async def test_delete_cross_docking(client, auth_headers):
    create_resp = await client.post("/api/cross-docking", headers=auth_headers, json=_cd_payload())
    cd_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/cross-docking/{cd_id}", headers=auth_headers)
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_delete_nonexistent_cross_docking(client, auth_headers):
    resp = await client.delete(f"/api/cross-docking/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
