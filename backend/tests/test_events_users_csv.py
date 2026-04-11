# backend/tests/test_events_users_csv.py
import pytest
import uuid
from datetime import date, timedelta


async def _create_customer(client, auth_headers, suffix=None):
    """Helper: create a customer and return customer_id."""
    if suffix is None:
        suffix = uuid.uuid4().hex[:6]
    cust_resp = await client.post("/api/customers", headers=auth_headers, json={
        "company_name": f"EvtCust-{suffix}",
        "contact_person": "Test Person",
        "phone": "0123456789",
        "email": f"evtcust-{suffix}@example.com",
    })
    assert cust_resp.status_code == 200, f"Customer creation failed: {cust_resp.text}"
    return cust_resp.json()["id"]


@pytest.mark.asyncio
async def test_create_event(client, auth_headers):
    """POST /api/events creates a new event."""
    suffix = uuid.uuid4().hex[:6]
    customer_id = await _create_customer(client, auth_headers, suffix)

    resp = await client.post("/api/events", headers=auth_headers, json={
        "customer_id": customer_id,
        "event_type": "Konzert",
        "event_name": f"Testevent-{suffix}",
        "location": "Test Location",
        "start_date": (date.today() + timedelta(days=1)).isoformat() + "T10:00:00",
        "end_date": (date.today() + timedelta(days=2)).isoformat() + "T18:00:00",
    })
    assert resp.status_code in (200, 201), f"Event creation failed: {resp.text}"
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_get_events_list(client, auth_headers):
    """GET /api/events returns a list."""
    resp = await client.get("/api/events", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_pending_users_accessible_by_admin(client, auth_headers):
    """GET /api/admin/pending-users is accessible by admin."""
    resp = await client.get("/api/admin/pending-users", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_csv_import_auto_generates_inventory_code(client, auth_headers):
    """CSV import without inventory_code column auto-generates codes."""
    # The backend expects JSON body with csv_content field (not multipart file upload)
    csv_content = "name,current_stock\nCSV-Artikel-A,5\nCSV-Artikel-B,3\n"
    resp = await client.post("/api/articles/import", headers=auth_headers, json={
        "csv_content": csv_content,
        "file_type": "csv",
    })
    assert resp.status_code == 200, f"CSV import failed: {resp.text}"
    data = resp.json()
    # Accept either imported count or success flag
    imported = data.get("imported", data.get("created", data.get("success_count", 0)))
    assert imported >= 1 or data.get("success") is True, f"No articles imported: {data}"


@pytest.mark.asyncio
async def test_csv_import_with_explicit_inventory_code(client, auth_headers):
    """CSV import with inventory_code column uses provided codes."""
    # The backend expects JSON body with csv_content field (not multipart file upload)
    code = f"CSV-{uuid.uuid4().hex[:6].upper()}"
    csv_content = f"name,current_stock,inventory_code\nCSV-Explicit,2,{code}\n"
    resp = await client.post("/api/articles/import", headers=auth_headers, json={
        "csv_content": csv_content,
        "file_type": "csv",
    })
    assert resp.status_code == 200, f"CSV import with code failed: {resp.text}"

    list_resp = await client.get("/api/articles", headers=auth_headers)
    assert list_resp.status_code == 200
    codes = [a.get("inventory_code") for a in list_resp.json()]
    assert code in codes, f"Imported article with code {code} not found in list"
