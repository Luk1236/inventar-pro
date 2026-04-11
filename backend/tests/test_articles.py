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


@pytest.mark.asyncio
async def test_create_article_auto_inventory_code(client, auth_headers):
    """Article creation without inventory_code auto-generates one."""
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"AutoCode-{uuid.uuid4().hex[:6]}",
        "current_stock": 3,
    })
    assert resp.status_code == 200, f"Create failed: {resp.text}"
    data = resp.json()
    assert data["inventory_code"], "inventory_code must be auto-generated"
    assert data["qr_code"] == data["inventory_code"], \
        f"qr_code ({data['qr_code']}) must equal inventory_code ({data['inventory_code']}), not have double prefix"


@pytest.mark.asyncio
async def test_create_article_with_explicit_inventory_code(client, auth_headers):
    """Article creation with explicit inventory_code uses it."""
    code = f"ART-{uuid.uuid4().hex[:6].upper()}"
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"ManualCode-{uuid.uuid4().hex[:6]}",
        "inventory_code": code,
        "current_stock": 1,
    })
    assert resp.status_code == 200, f"Create failed: {resp.text}"
    assert resp.json()["inventory_code"] == code


@pytest.mark.asyncio
async def test_get_article_by_id(client, auth_headers):
    """GET /api/articles/{id} returns the created article."""
    create_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"GetById-{uuid.uuid4().hex[:6]}",
        "current_stock": 1,
    })
    assert create_resp.status_code == 200
    article_id = create_resp.json()["id"]

    resp = await client.get(f"/api/articles/{article_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == article_id


@pytest.mark.asyncio
async def test_update_article(client, auth_headers):
    """PUT /api/articles/{id} updates fields."""
    create_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"UpdateMe-{uuid.uuid4().hex[:6]}",
        "current_stock": 5,
    })
    assert create_resp.status_code == 200
    article_id = create_resp.json()["id"]

    update_resp = await client.put(f"/api/articles/{article_id}", headers=auth_headers, json={
        "name": "Updated Name",
        "current_stock": 10,
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Name"
    assert update_resp.json()["current_stock"] == 10


@pytest.mark.asyncio
async def test_delete_article_appears_in_archived(client, auth_headers):
    """DELETE /api/articles/{id} soft-deletes. Article appears in archived list."""
    create_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"DeleteMe-{uuid.uuid4().hex[:6]}",
        "current_stock": 1,
    })
    assert create_resp.status_code == 200
    article_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/articles/{article_id}", headers=auth_headers)
    assert del_resp.status_code in (200, 204), f"Delete failed: {del_resp.text}"

    archived_resp = await client.get("/api/articles/archived", headers=auth_headers)
    assert archived_resp.status_code == 200
    archived_ids = [a["id"] for a in archived_resp.json()]
    assert article_id in archived_ids, "Deleted article should be in archived list"


@pytest.mark.asyncio
async def test_article_list_excludes_deleted(client, auth_headers):
    """GET /api/articles does not return soft-deleted articles."""
    create_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"SoftDel-{uuid.uuid4().hex[:6]}",
        "current_stock": 1,
    })
    assert create_resp.status_code == 200
    article_id = create_resp.json()["id"]
    await client.delete(f"/api/articles/{article_id}", headers=auth_headers)

    list_resp = await client.get("/api/articles", headers=auth_headers)
    assert list_resp.status_code == 200
    ids = [a["id"] for a in list_resp.json()]
    assert article_id not in ids, "Deleted article must not appear in active list"
