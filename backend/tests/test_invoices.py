# backend/tests/test_invoices.py
import pytest
import uuid
from datetime import date, timedelta


async def _create_customer_and_event(client, auth_headers, suffix=None):
    """Helper: create a customer and event, return (customer_id, event_id)."""
    if suffix is None:
        suffix = uuid.uuid4().hex[:6]

    cust_resp = await client.post("/api/customers", headers=auth_headers, json={
        "company_name": f"InvCust-{suffix}",
        "contact_person": "Test Person",
        "phone": "0123456789",
        "email": f"invcust-{suffix}@example.com",
    })
    assert cust_resp.status_code == 200, f"Customer creation failed: {cust_resp.text}"
    customer_id = cust_resp.json()["id"]

    event_resp = await client.post("/api/events", headers=auth_headers, json={
        "customer_id": customer_id,
        "event_type": "Konzert",
        "event_name": f"InvEvent-{suffix}",
        "location": "Test Location",
        "start_date": (date.today() + timedelta(days=1)).isoformat() + "T10:00:00",
        "end_date": (date.today() + timedelta(days=2)).isoformat() + "T18:00:00",
    })
    assert event_resp.status_code == 200, f"Event creation failed: {event_resp.text}"
    event_id = event_resp.json()["id"]

    return customer_id, event_id


@pytest.mark.asyncio
async def test_create_invoice_without_event_id(client, auth_headers):
    """Invoice creation must succeed without event_id when customer_id is provided."""
    # The API requires customer_id for free invoices (without event_id)
    suffix = uuid.uuid4().hex[:4]
    cust_resp = await client.post("/api/customers", headers=auth_headers, json={
        "company_name": f"FreeInvCust-{suffix}",
        "contact_person": "Test Person",
        "phone": "0123456789",
        "email": f"freeinv-{suffix}@example.com",
    })
    assert cust_resp.status_code == 200, f"Customer creation failed: {cust_resp.text}"
    customer_id = cust_resp.json()["id"]

    resp = await client.post("/api/invoices", headers=auth_headers, json={
        "customer_id": customer_id,
    })
    assert resp.status_code in (200, 201), f"Invoice creation failed: {resp.text}"
    data = resp.json()
    assert "id" in data


@pytest.mark.asyncio
async def test_invoice_list_returns_list(client, auth_headers):
    """GET /api/invoices returns a list."""
    resp = await client.get("/api/invoices", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_booking_overbooking_returns_error(client, auth_headers):
    """Booking more than available stock returns 4xx with descriptive message."""
    # Create article with limited stock
    art_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"LimitedStock-{uuid.uuid4().hex[:6]}",
        "current_stock": 2,
        "available_quantity": 2,
    })
    assert art_resp.status_code == 200
    article_id = art_resp.json()["id"]

    # Create a customer and event for booking context
    suffix = uuid.uuid4().hex[:4]
    customer_id, event_id = await _create_customer_and_event(client, auth_headers, suffix)

    booking_data = {
        "event_id": event_id,
        "article_id": article_id,
        "quantity": 99,
        "pickup_date": (date.today() + timedelta(days=1)).isoformat() + "T10:00:00",
        "return_date": (date.today() + timedelta(days=3)).isoformat() + "T18:00:00",
    }

    resp = await client.post("/api/bookings", headers=auth_headers, json=booking_data)
    assert resp.status_code in (400, 422), f"Expected 4xx for overbooking, got {resp.status_code}: {resp.text}"
