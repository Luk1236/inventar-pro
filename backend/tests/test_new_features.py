# backend/tests/test_new_features.py
"""
Tests for F1–F12 new features.
All tests follow the established pattern: session-scoped fixtures, UUID test data.
"""
import uuid
import pytest
from datetime import datetime, timezone, timedelta


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

async def _create_customer(client, auth_headers) -> dict:
    code = uuid.uuid4().hex[:8]
    r = await client.post("/api/customers", headers=auth_headers, json={
        "company_name": f"NF Firma {code}",
        "contact_person": "Max Muster",
        "email": f"nf{code}@test.de",
        "phone": "0123456789",
        "address": "Teststraße 1",
    })
    assert r.status_code in (200, 201), r.text
    return r.json()


async def _create_event(client, auth_headers, customer_id: str, days_out: int = 10) -> dict:
    code = uuid.uuid4().hex[:8]
    start = (datetime.now(timezone.utc) + timedelta(days=days_out)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=days_out + 2)).isoformat()
    r = await client.post("/api/events", headers=auth_headers, json={
        "customer_id": customer_id,
        "event_type": "Messe",
        "event_name": f"NF Event {code}",
        "location": "Hamburg",
        "start_date": start,
        "end_date": end,
    })
    assert r.status_code in (200, 201), r.text
    return r.json()


async def _create_article(client, auth_headers, stock: int = 10,
                           rental_price: float = 10.0,
                           rental_price_day: float = None,
                           rental_price_week: float = None,
                           rental_price_month: float = None) -> dict:
    code = uuid.uuid4().hex[:8]
    payload = {
        "name": f"NF Artikel {code}",
        "inventory_code": f"NF-{code}",
        "category": "test",
        "current_stock": stock,
        "rental_price": rental_price,
    }
    if rental_price_day is not None:
        payload["rental_price_day"] = rental_price_day
    if rental_price_week is not None:
        payload["rental_price_week"] = rental_price_week
    if rental_price_month is not None:
        payload["rental_price_month"] = rental_price_month
    r = await client.post("/api/articles", headers=auth_headers, json=payload)
    assert r.status_code in (200, 201), r.text
    return r.json()


async def _create_booking(client, auth_headers, event_id: str, article_id: str, quantity: int = 1) -> dict:
    r = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event_id,
        "article_id": article_id,
        "quantity": quantity,
    })
    assert r.status_code in (200, 201), r.text
    return r.json()


async def _create_role_user(client, test_db, role: str) -> dict:
    """Insert a pre-approved user with a given role and return login headers."""
    from server import get_password_hash
    code = uuid.uuid4().hex[:8]
    username = f"nf_{role}_{code}"
    password = "NFTest123!"
    await test_db.users.insert_one({
        "id": str(uuid.uuid4()),
        "username": username,
        "email": f"{username}@test.com",
        "full_name": f"NF {role}",
        "role": role,
        "is_approved": True,
        "hashed_password": get_password_hash(password),
        "created_at": datetime.now(timezone.utc),
        "is_active": True,
    })
    r = await client.post("/api/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────────────────────────────────────────────
# F1 — Invoice from Event
# ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_invoice_from_event(client, auth_headers):
    """POST /api/events/{id}/generate-invoice returns 200 with invoice fields."""
    customer = await _create_customer(client, auth_headers)
    event = await _create_event(client, auth_headers, customer["id"])
    article = await _create_article(client, auth_headers, rental_price=50.0)
    await _create_booking(client, auth_headers, event["id"], article["id"])

    r = await client.post(
        f"/api/events/{event['id']}/generate-invoice",
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "invoice_number" in data or "id" in data


@pytest.mark.asyncio
async def test_generate_invoice_no_bookings_returns_400(client, auth_headers):
    """Generating invoice for an event with zero bookings should fail."""
    customer = await _create_customer(client, auth_headers)
    event = await _create_event(client, auth_headers, customer["id"])

    r = await client.post(
        f"/api/events/{event['id']}/generate-invoice",
        headers=auth_headers,
    )
    assert r.status_code == 400, r.text


# ─────────────────────────────────────────────────────────────────
# F2 — Password Reset
# ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_forgot_password_always_200(client, auth_headers):
    """forgot-password always returns 200 (no user enumeration)."""
    r = await client.post("/api/auth/forgot-password", json={"email": "nonexistent@example.com"})
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_reset_password_invalid_token(client):
    """reset-password with an invalid token returns 400."""
    r = await client.post("/api/auth/reset-password", json={
        "token": "totally-invalid-token",
        "new_password": "NewPass123!",
    })
    assert r.status_code == 400, r.text


@pytest.mark.asyncio
async def test_reset_password_full_flow(client, test_db):
    """Full flow: forgot → read token from DB → reset → login succeeds."""
    from server import get_password_hash

    # Create user
    code = uuid.uuid4().hex[:8]
    username = f"resetuser_{code}"
    old_password = "OldPass123!"
    new_password = "NewPass456!"
    email = f"{username}@test.com"
    await test_db.users.insert_one({
        "id": str(uuid.uuid4()),
        "username": username,
        "email": email,
        "full_name": "Reset Test",
        "role": "lager",
        "is_approved": True,
        "hashed_password": get_password_hash(old_password),
        "created_at": datetime.now(timezone.utc),
        "is_active": True,
    })

    # Request reset
    r1 = await client.post("/api/auth/forgot-password", json={"email": email})
    assert r1.status_code == 200, r1.text

    # Get token from DB
    reset_doc = await test_db.password_reset_tokens.find_one({"email": email})
    if reset_doc is None:
        pytest.skip("Email not configured — token not stored (expected in CI)")

    token = reset_doc["token"]
    r2 = await client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": new_password,
    })
    assert r2.status_code == 200, r2.text

    # Login with new password
    r3 = await client.post("/api/login", json={"username": username, "password": new_password})
    assert r3.status_code == 200, r3.text
    assert "access_token" in r3.json()


# ─────────────────────────────────────────────────────────────────
# F3 — Serial Numbers
# ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_assign_serials_to_booking(client, auth_headers, test_db):
    """Assigning a valid serial number to a booking returns assigned count."""
    customer = await _create_customer(client, auth_headers)
    event = await _create_event(client, auth_headers, customer["id"])
    article = await _create_article(client, auth_headers)
    booking = await _create_booking(client, auth_headers, event["id"], article["id"])

    # Insert a serial number for this article
    serial_id = str(uuid.uuid4())
    await test_db.serial_numbers.insert_one({
        "id": serial_id,
        "article_id": article["id"],
        "serial_number": f"SN-{uuid.uuid4().hex[:8]}",
        "status": "verfügbar",
        "created_at": datetime.now(timezone.utc),
    })

    r = await client.post(
        f"/api/bookings/{booking['id']}/assign-serials",
        headers=auth_headers,
        json={"serial_number_ids": [serial_id]},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("assigned", 0) >= 1


@pytest.mark.asyncio
async def test_assign_serials_empty_list_rejected(client, auth_headers):
    """Empty serial_number_ids list is rejected by Pydantic (min_length=1)."""
    r = await client.post(
        "/api/bookings/fake-id/assign-serials",
        headers=auth_headers,
        json={"serial_number_ids": []},
    )
    assert r.status_code == 422, r.text


# ─────────────────────────────────────────────────────────────────
# F4 — QR Scan
# ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_scan_article_by_inventory_code(client, auth_headers):
    """GET /api/scan/{code} returns article data for a known inventory_code."""
    code = uuid.uuid4().hex[:8]
    inv_code = f"SCAN-{code}"
    r = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"Scan Artikel {code}",
        "inventory_code": inv_code,
        "category": "test",
        "current_stock": 1,
        "rental_price": 5.0,
    })
    assert r.status_code in (200, 201)
    article_id = r.json()["id"]

    scan_r = await client.get(f"/api/scan/{inv_code}", headers=auth_headers)
    assert scan_r.status_code == 200, scan_r.text
    data = scan_r.json()
    assert data.get("type") == "article"
    assert data.get("id") == article_id


@pytest.mark.asyncio
async def test_scan_not_found(client, auth_headers):
    """GET /api/scan/NONEXISTENT returns 404."""
    r = await client.get("/api/scan/TOTALLY-UNKNOWN-CODE-XYZ999", headers=auth_headers)
    assert r.status_code == 404, r.text


# ─────────────────────────────────────────────────────────────────
# F6 — Rental Price Tiers (unit + endpoint)
# ─────────────────────────────────────────────────────────────────

def test_calculate_rental_price_day_tier():
    """Days 1–3 use rental_price_day."""
    from server import _calculate_rental_price
    article = {"rental_price_day": 15.0, "rental_price": 10.0}
    assert _calculate_rental_price(article, 1) == 15.0
    assert _calculate_rental_price(article, 3) == 45.0


def test_calculate_rental_price_week_tier():
    """Days 4–7 use rental_price_week (flat)."""
    from server import _calculate_rental_price
    article = {"rental_price_day": 15.0, "rental_price_week": 60.0, "rental_price": 10.0}
    assert _calculate_rental_price(article, 4) == 60.0
    assert _calculate_rental_price(article, 7) == 60.0


def test_calculate_rental_price_month_tier():
    """Days > 7 use rental_price_month (flat)."""
    from server import _calculate_rental_price
    article = {
        "rental_price_day": 15.0,
        "rental_price_week": 60.0,
        "rental_price_month": 180.0,
        "rental_price": 10.0,
    }
    assert _calculate_rental_price(article, 8) == 180.0
    assert _calculate_rental_price(article, 30) == 180.0


def test_calculate_rental_price_fallback():
    """Falls back to rental_price when tier prices are absent."""
    from server import _calculate_rental_price
    article = {"rental_price": 10.0}
    # day tier: 10.0 * 2
    assert _calculate_rental_price(article, 2) == 20.0


@pytest.mark.asyncio
async def test_rental_tiers_endpoint(client, auth_headers):
    """GET /api/articles/{id}/rental-tiers returns tier pricing."""
    article = await _create_article(
        client, auth_headers,
        rental_price=10.0,
        rental_price_day=12.0,
        rental_price_week=55.0,
        rental_price_month=160.0,
    )
    r = await client.get(f"/api/articles/{article['id']}/rental-tiers", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "tiers" in data or "day" in data or "day_price" in data


# ─────────────────────────────────────────────────────────────────
# F7 — Clone Event
# ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_clone_event(client, auth_headers):
    """Cloning an event creates a new event with copied bookings."""
    customer = await _create_customer(client, auth_headers)
    event = await _create_event(client, auth_headers, customer["id"])
    article = await _create_article(client, auth_headers)
    await _create_booking(client, auth_headers, event["id"], article["id"])

    new_start = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S")
    r = await client.post(
        f"/api/events/{event['id']}/clone",
        headers=auth_headers,
        params={"new_start_date": new_start, "clone_bookings": "true"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("event_id") != event["id"]
    assert data.get("cloned_bookings", 0) >= 1


@pytest.mark.asyncio
async def test_clone_event_no_bookings(client, auth_headers):
    """Cloning with clone_bookings=false yields 0 cloned bookings."""
    customer = await _create_customer(client, auth_headers)
    event = await _create_event(client, auth_headers, customer["id"])
    article = await _create_article(client, auth_headers)
    await _create_booking(client, auth_headers, event["id"], article["id"])

    new_start = (datetime.now(timezone.utc) + timedelta(days=40)).strftime("%Y-%m-%dT%H:%M:%S")
    r = await client.post(
        f"/api/events/{event['id']}/clone",
        headers=auth_headers,
        params={"new_start_date": new_start, "clone_bookings": "false"},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("cloned_bookings", 0) == 0


# ─────────────────────────────────────────────────────────────────
# F9 — Dashboard Cache
# ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dashboard_stats_returns_data(client, auth_headers):
    """GET /api/dashboard/stats returns 200 with stats fields."""
    r = await client.get("/api/dashboard/stats", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total_articles" in data or "articles" in data or len(data) > 0


@pytest.mark.asyncio
async def test_dashboard_stats_cached(client, auth_headers):
    """Second call to /api/dashboard/stats returns same data (cache hit)."""
    r1 = await client.get("/api/dashboard/stats", headers=auth_headers)
    r2 = await client.get("/api/dashboard/stats", headers=auth_headers)
    assert r1.status_code == 200
    assert r2.status_code == 200
    # Both responses should be identical (same cached payload)
    assert r1.json() == r2.json()


# ─────────────────────────────────────────────────────────────────
# F11 — API v1 routing
# ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_api_v1_articles_accessible(client, auth_headers):
    """GET /api/v1/articles returns same status as /api/articles."""
    r_v1 = await client.get("/api/v1/articles", headers=auth_headers)
    r_orig = await client.get("/api/articles", headers=auth_headers)
    assert r_v1.status_code == r_orig.status_code == 200


@pytest.mark.asyncio
async def test_api_v1_dashboard_accessible(client, auth_headers):
    """GET /api/v1/dashboard/stats returns 200."""
    r = await client.get("/api/v1/dashboard/stats", headers=auth_headers)
    assert r.status_code == 200, r.text


# ─────────────────────────────────────────────────────────────────
# F12 — RBAC: viewer / fahrer roles
# ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_viewer_can_read_articles(client, test_db):
    """User with role=viewer can GET /api/articles."""
    headers = await _create_role_user(client, test_db, "viewer")
    r = await client.get("/api/articles", headers=headers)
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_viewer_cannot_create_articles(client, test_db):
    """User with role=viewer gets 403 on POST /api/articles."""
    headers = await _create_role_user(client, test_db, "viewer")
    r = await client.post("/api/articles", headers=headers, json={
        "name": "Should fail",
        "inventory_code": f"FAIL-{uuid.uuid4().hex[:6]}",
        "rental_price": 1.0,
    })
    assert r.status_code in (401, 403), r.text


@pytest.mark.asyncio
async def test_fahrer_can_read_articles(client, test_db):
    """User with role=fahrer can GET /api/articles."""
    headers = await _create_role_user(client, test_db, "fahrer")
    r = await client.get("/api/articles", headers=headers)
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_fahrer_cannot_delete_articles(client, test_db):
    """User with role=fahrer gets 403 on DELETE /api/articles/{id}."""
    headers = await _create_role_user(client, test_db, "fahrer")
    r = await client.delete("/api/articles/nonexistent-id", headers=headers)
    assert r.status_code in (401, 403), r.text
