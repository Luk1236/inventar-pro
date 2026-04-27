import pytest
import uuid
from datetime import datetime, timezone, timedelta


async def _create_article(client, auth_headers):
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"SubArt-{uuid.uuid4().hex[:6]}",
        "current_stock": 0,
    })
    assert resp.status_code == 200
    return resp.json()["id"]


async def _create_supplier(client, auth_headers):
    resp = await client.post("/api/suppliers", headers=auth_headers, json={
        "name": f"Supplier-{uuid.uuid4().hex[:6]}",
        "contact_person": "Test Person",
    })
    assert resp.status_code == 200
    return resp.json()["id"]


async def _create_sub_rental(client, auth_headers, article_id=None, supplier_id=None, **kwargs):
    if article_id is None:
        article_id = await _create_article(client, auth_headers)
    if supplier_id is None:
        supplier_id = await _create_supplier(client, auth_headers)
    payload = {"article_id": article_id, "supplier_id": supplier_id, "cost": 50.0, "quantity": 1}
    payload.update(kwargs)
    resp = await client.post("/api/sub-rentals", headers=auth_headers, json=payload)
    assert resp.status_code == 200, f"Create sub-rental failed: {resp.text}"
    return resp.json()


@pytest.mark.asyncio
async def test_create_sub_rental(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    assert rental["status"] == "requested"
    assert rental["overdue"] is False
    assert rental["billable_to_customer"] is False


@pytest.mark.asyncio
async def test_get_sub_rental_by_id(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    resp = await client.get(f"/api/sub-rentals/{rental['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == rental["id"]


@pytest.mark.asyncio
async def test_update_sub_rental(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    resp = await client.put(f"/api/sub-rentals/{rental['id']}", headers=auth_headers, json={
        "cost": 99.0, "notes": "Updated"
    })
    assert resp.status_code == 200
    assert resp.json()["cost"] == 99.0
    assert resp.json()["notes"] == "Updated"


@pytest.mark.asyncio
async def test_delete_sub_rental_when_requested(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    resp = await client.delete(f"/api/sub-rentals/{rental['id']}", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_sub_rental_blocked_when_confirmed(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    await client.put(f"/api/sub-rentals/{rental['id']}/confirm", headers=auth_headers, json={})
    resp = await client.delete(f"/api/sub-rentals/{rental['id']}", headers=auth_headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_status_transition_full_lifecycle(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    rental_id = rental["id"]

    # requested → confirmed
    resp = await client.put(f"/api/sub-rentals/{rental_id}/confirm", headers=auth_headers, json={})
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"

    # confirmed → delivered
    resp = await client.put(f"/api/sub-rentals/{rental_id}/deliver", headers=auth_headers, json={})
    assert resp.status_code == 200
    assert resp.json()["status"] == "delivered"

    # delivered → returned
    resp = await client.put(f"/api/sub-rentals/{rental_id}/return", headers=auth_headers, json={})
    assert resp.status_code == 200
    assert resp.json()["message"] == "Sub-rental returned successfully"

    detail = await client.get(f"/api/sub-rentals/{rental_id}", headers=auth_headers)
    assert detail.json()["status"] == "returned"


@pytest.mark.asyncio
async def test_confirm_fails_when_not_requested(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    await client.put(f"/api/sub-rentals/{rental['id']}/confirm", headers=auth_headers, json={})
    # Confirm twice should fail
    resp = await client.put(f"/api/sub-rentals/{rental['id']}/confirm", headers=auth_headers, json={})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_deliver_fails_when_not_confirmed(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    resp = await client.put(f"/api/sub-rentals/{rental['id']}/deliver", headers=auth_headers, json={})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_cancel_from_requested(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    resp = await client.put(f"/api/sub-rentals/{rental['id']}/cancel", headers=auth_headers, json={})
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_from_delivered(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    rental_id = rental["id"]
    await client.put(f"/api/sub-rentals/{rental_id}/confirm", headers=auth_headers, json={})
    await client.put(f"/api/sub-rentals/{rental_id}/deliver", headers=auth_headers, json={})
    resp = await client.put(f"/api/sub-rentals/{rental_id}/cancel", headers=auth_headers, json={})
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_blocked_when_returned(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers)
    rental_id = rental["id"]
    await client.put(f"/api/sub-rentals/{rental_id}/confirm", headers=auth_headers, json={})
    await client.put(f"/api/sub-rentals/{rental_id}/deliver", headers=auth_headers, json={})
    await client.put(f"/api/sub-rentals/{rental_id}/return", headers=auth_headers, json={})
    resp = await client.put(f"/api/sub-rentals/{rental_id}/cancel", headers=auth_headers, json={})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_overdue_flag_computed(client, auth_headers):
    past_date = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    rental = await _create_sub_rental(client, auth_headers, rental_end=past_date)
    rental_id = rental["id"]
    await client.put(f"/api/sub-rentals/{rental_id}/confirm", headers=auth_headers, json={})
    await client.put(f"/api/sub-rentals/{rental_id}/deliver", headers=auth_headers, json={})

    resp = await client.get(f"/api/sub-rentals/{rental_id}", headers=auth_headers)
    assert resp.json()["overdue"] is True


@pytest.mark.asyncio
async def test_event_filter(client, auth_headers):
    suffix = uuid.uuid4().hex[:6]
    cust = await client.post("/api/customers", headers=auth_headers, json={
        "company_name": f"Cust-{suffix}", "contact_person": "A", "phone": "0", "email": f"{suffix}@t.de"
    })
    event_id = (await client.post("/api/events", headers=auth_headers, json={
        "customer_id": cust.json()["id"],
        "event_type": "Test",
        "event_name": f"Ev-{suffix}",
        "location": "X",
        "start_date": "2027-01-01T10:00:00",
        "end_date": "2027-01-02T10:00:00",
    })).json()["id"]

    await _create_sub_rental(client, auth_headers, event_id=event_id)
    await _create_sub_rental(client, auth_headers)  # no event

    resp = await client.get(f"/api/sub-rentals?event_id={event_id}", headers=auth_headers)
    assert resp.status_code == 200
    records = resp.json()["sub_rental_records"]
    assert all(r["event_id"] == event_id for r in records)
    assert len(records) == 1


@pytest.mark.asyncio
async def test_billable_to_customer(client, auth_headers):
    rental = await _create_sub_rental(client, auth_headers, billable_to_customer=True)
    assert rental["billable_to_customer"] is True
