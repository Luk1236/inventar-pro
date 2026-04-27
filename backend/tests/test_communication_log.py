import pytest
import uuid


def _log_payload():
    return {
        "type": "email",
        "direction": "outgoing",
        "subject": f"Betreff-{uuid.uuid4().hex[:6]}",
        "body": "Testinhalt",
        "recipient": "kunde@example.com",
        "sender": "info@firma.de",
        "customer_id": str(uuid.uuid4()),
        "customer_name": "Mustermann GmbH",
        "event_id": str(uuid.uuid4()),
        "event_name": "Test Event",
        "sent_at": "2027-06-01T10:00:00",
        "status": "sent",
    }


@pytest.mark.asyncio
async def test_create_communication_log(client, auth_headers):
    resp = await client.post("/api/communication-log", headers=auth_headers, json=_log_payload())
    assert resp.status_code == 200, resp.text
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_list_communication_log(client, auth_headers):
    await client.post("/api/communication-log", headers=auth_headers, json=_log_payload())
    resp = await client.get("/api/communication-log", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), (list, dict))


@pytest.mark.asyncio
async def test_update_communication_log(client, auth_headers):
    create_resp = await client.post("/api/communication-log", headers=auth_headers, json=_log_payload())
    log_id = create_resp.json()["id"]

    update_payload = _log_payload()
    update_payload["status"] = "read"
    resp = await client.put(f"/api/communication-log/{log_id}", headers=auth_headers, json=update_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "read"


@pytest.mark.asyncio
async def test_delete_communication_log(client, auth_headers):
    create_resp = await client.post("/api/communication-log", headers=auth_headers, json=_log_payload())
    log_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/communication-log/{log_id}", headers=auth_headers)
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_delete_nonexistent_log(client, auth_headers):
    resp = await client.delete(f"/api/communication-log/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
