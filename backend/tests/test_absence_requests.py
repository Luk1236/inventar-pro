import pytest
import uuid


def _absence_payload():
    return {
        "crew_member_id": str(uuid.uuid4()),
        "crew_member_name": f"Crew-{uuid.uuid4().hex[:6]}",
        "start_date": "2027-07-01",
        "end_date": "2027-07-05",
        "type": "Urlaub",
        "reason": "Jahresurlaub",
        "status": "beantragt",
    }


@pytest.mark.asyncio
async def test_create_absence_request(client, auth_headers):
    resp = await client.post("/api/absence-requests", headers=auth_headers, json=_absence_payload())
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "id" in data
    assert data["type"] == "Urlaub"


@pytest.mark.asyncio
async def test_list_absence_requests(client, auth_headers):
    await client.post("/api/absence-requests", headers=auth_headers, json=_absence_payload())
    resp = await client.get("/api/absence-requests", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), (list, dict))


@pytest.mark.asyncio
async def test_update_absence_request(client, auth_headers):
    create_resp = await client.post("/api/absence-requests", headers=auth_headers, json=_absence_payload())
    req_id = create_resp.json()["id"]

    update_payload = _absence_payload()
    update_payload["status"] = "genehmigt"
    resp = await client.put(f"/api/absence-requests/{req_id}", headers=auth_headers, json=update_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "genehmigt"


@pytest.mark.asyncio
async def test_approve_absence_via_status_endpoint(client, auth_headers):
    create_resp = await client.post("/api/absence-requests", headers=auth_headers, json=_absence_payload())
    req_id = create_resp.json()["id"]

    resp = await client.put(f"/api/absence-requests/{req_id}/status", headers=auth_headers, json={
        "status": "genehmigt"
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_absence_request(client, auth_headers):
    create_resp = await client.post("/api/absence-requests", headers=auth_headers, json=_absence_payload())
    req_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/absence-requests/{req_id}", headers=auth_headers)
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_delete_nonexistent_absence_request(client, auth_headers):
    resp = await client.delete(f"/api/absence-requests/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
