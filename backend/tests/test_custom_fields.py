import pytest
import uuid


def _cf_payload(entity_type="article"):
    name = f"field_{uuid.uuid4().hex[:6]}"
    return {
        "entity_type": entity_type,
        "field_label": f"Feld {uuid.uuid4().hex[:4]}",
        "field_name": name,
        "field_type": "text",
        "options": [],
        "required": False,
        "sort_order": 1,
    }


@pytest.mark.asyncio
async def test_create_custom_field(client, auth_headers):
    resp = await client.post("/api/custom-fields", headers=auth_headers, json=_cf_payload())
    assert resp.status_code == 200, resp.text
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_list_custom_fields(client, auth_headers):
    await client.post("/api/custom-fields", headers=auth_headers, json=_cf_payload())
    resp = await client.get("/api/custom-fields", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), (list, dict))


@pytest.mark.asyncio
async def test_filter_custom_fields_by_entity(client, auth_headers):
    await client.post("/api/custom-fields", headers=auth_headers, json=_cf_payload("article"))
    await client.post("/api/custom-fields", headers=auth_headers, json=_cf_payload("event"))

    resp = await client.get("/api/custom-fields?entity_type=article", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    items = data if isinstance(data, list) else data.get("items", [])
    assert all(f["entity_type"] == "article" for f in items)


@pytest.mark.asyncio
async def test_update_custom_field(client, auth_headers):
    create_resp = await client.post("/api/custom-fields", headers=auth_headers, json=_cf_payload())
    field_id = create_resp.json()["id"]

    update_payload = _cf_payload()
    update_payload["field_label"] = "Aktualisiertes Feld"
    resp = await client.put(f"/api/custom-fields/{field_id}", headers=auth_headers, json=update_payload)
    assert resp.status_code == 200
    assert resp.json()["field_label"] == "Aktualisiertes Feld"


@pytest.mark.asyncio
async def test_delete_custom_field(client, auth_headers):
    create_resp = await client.post("/api/custom-fields", headers=auth_headers, json=_cf_payload())
    field_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/custom-fields/{field_id}", headers=auth_headers)
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_delete_nonexistent_custom_field(client, auth_headers):
    resp = await client.delete(f"/api/custom-fields/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
