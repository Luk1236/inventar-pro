import pytest
import uuid


async def _setup_event_with_booking(client, auth_headers):
    suffix = uuid.uuid4().hex[:6]
    cust = await client.post("/api/customers", headers=auth_headers, json={
        "company_name": f"PDFCust-{suffix}",
        "contact_person": "Test",
        "phone": "0",
        "email": f"pdf-{suffix}@test.de",
    })
    assert cust.status_code == 200
    customer_id = cust.json()["id"]

    event = await client.post("/api/events", headers=auth_headers, json={
        "customer_id": customer_id,
        "event_type": "Konzert",
        "event_name": f"PDFEvent-{suffix}",
        "location": "Berlin",
        "start_date": "2027-06-01T10:00:00",
        "end_date": "2027-06-03T18:00:00",
    })
    assert event.status_code == 200
    event_id = event.json()["id"]

    article = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"PDFArt-{suffix}",
        "current_stock": 5,
    })
    assert article.status_code == 200
    article_id = article.json()["id"]

    booking = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event_id,
        "article_id": article_id,
        "quantity": 1,
        "pickup_date": "2027-06-01T10:00:00",
        "return_date": "2027-06-03T18:00:00",
    })
    assert booking.status_code in (200, 201)

    return event_id, customer_id


@pytest.mark.asyncio
async def test_packing_list_pdf(client, auth_headers):
    event_id, _ = await _setup_event_with_booking(client, auth_headers)
    resp = await client.get(f"/api/events/{event_id}/packing-list/pdf", headers=auth_headers)
    assert resp.status_code == 200
    assert "application/pdf" in resp.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_invoice_pdf_data(client, auth_headers):
    event_id, _ = await _setup_event_with_booking(client, auth_headers)

    inv_resp = await client.post("/api/invoices", headers=auth_headers, json={
        "event_id": event_id,
        "due_days": 14,
    })
    assert inv_resp.status_code == 200, inv_resp.text
    invoice_id = inv_resp.json()["id"]

    resp = await client.get(f"/api/invoices/{invoice_id}/pdf-data", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "invoice_number" in data or "items" in data or "total" in data


@pytest.mark.asyncio
async def test_packing_list_endpoint_returns_items(client, auth_headers):
    event_id, _ = await _setup_event_with_booking(client, auth_headers)
    resp = await client.get(f"/api/events/{event_id}/packing-list", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "sub_rentals" in data
