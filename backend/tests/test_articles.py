# backend/tests/test_articles.py
import pytest
import uuid


@pytest.mark.asyncio
async def test_archived_route_not_treated_as_article_id(client, auth_headers):
    """GET /api/articles/archived must not return 404 (routing conflict check)."""
    resp = await client.get("/api/articles/archived", headers=auth_headers)
    assert resp.status_code == 200, f"Routing conflict: got {resp.status_code}"
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_archived_v1_route(client, auth_headers):
    """GET /api/v1/articles/archived must also work."""
    resp = await client.get("/api/v1/articles/archived", headers=auth_headers)
    assert resp.status_code == 200, f"v1 routing conflict: got {resp.status_code}"
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_booking_create_succeeds(client, auth_headers):
    """Creating a booking must succeed (broadcast is fire-and-forget)."""
    suffix = uuid.uuid4().hex[:6]

    # Create a customer
    cust_resp = await client.post("/api/customers", headers=auth_headers, json={
        "company_name": f"WS-Cust-{suffix}",
        "contact_person": "Test Person",
        "phone": "0123456789",
        "email": f"ws-test-{suffix}@example.com",
    })
    assert cust_resp.status_code == 200, f"Customer creation failed: {cust_resp.text}"
    customer_id = cust_resp.json()["id"]

    # Create an event
    event_resp = await client.post("/api/events", headers=auth_headers, json={
        "customer_id": customer_id,
        "event_type": "Konzert",
        "event_name": f"WS-Event-{suffix}",
        "location": "Test Location",
        "start_date": "2027-06-01T10:00:00",
        "end_date": "2027-06-03T18:00:00",
    })
    assert event_resp.status_code == 200, f"Event creation failed: {event_resp.text}"
    event_id = event_resp.json()["id"]

    # Create an article with stock
    art_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"WS-Test-{suffix}",
        "current_stock": 5,
    })
    assert art_resp.status_code == 200, f"Article creation failed: {art_resp.text}"
    article_id = art_resp.json()["id"]

    # Create a booking
    resp = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event_id,
        "article_id": article_id,
        "quantity": 1,
        "pickup_date": "2027-06-01T10:00:00",
        "return_date": "2027-06-03T18:00:00",
    })
    assert resp.status_code in (200, 201), f"Booking failed: {resp.text}"
