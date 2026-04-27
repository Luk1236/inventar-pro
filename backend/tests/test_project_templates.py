import pytest
import uuid


def _template_payload():
    return {
        "name": f"Template-{uuid.uuid4().hex[:6]}",
        "description": "Test Projektvorlage",
        "event_type": "Konzert",
        "location_type": "Innen",
        "notes_template": "Standardnotizen",
        "bom_id": None,
    }


@pytest.mark.asyncio
async def test_create_project_template(client, auth_headers):
    resp = await client.post("/api/project-templates", headers=auth_headers, json=_template_payload())
    assert resp.status_code == 200, resp.text
    assert "id" in resp.json()
    assert resp.json()["event_type"] == "Konzert"


@pytest.mark.asyncio
async def test_list_project_templates(client, auth_headers):
    await client.post("/api/project-templates", headers=auth_headers, json=_template_payload())
    resp = await client.get("/api/project-templates", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), (list, dict))


@pytest.mark.asyncio
async def test_update_project_template(client, auth_headers):
    create_resp = await client.post("/api/project-templates", headers=auth_headers, json=_template_payload())
    template_id = create_resp.json()["id"]

    update_payload = _template_payload()
    update_payload["description"] = "Aktualisierte Beschreibung"
    resp = await client.put(f"/api/project-templates/{template_id}", headers=auth_headers, json=update_payload)
    assert resp.status_code == 200
    assert resp.json()["description"] == "Aktualisierte Beschreibung"


@pytest.mark.asyncio
async def test_delete_project_template(client, auth_headers):
    create_resp = await client.post("/api/project-templates", headers=auth_headers, json=_template_payload())
    template_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/project-templates/{template_id}", headers=auth_headers)
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_delete_nonexistent_template(client, auth_headers):
    resp = await client.delete(f"/api/project-templates/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
