# backend/tests/test_bookings.py
"""
Tests für kritische Buchungslogik:
- Lagerbestandsabzug und Rückgabe
- Doppelrückgabe wird verhindert
- Buchung mit unzureichendem Bestand schlägt fehl
- Datum-Validierung (pickup < return)
- Negative Menge wird abgelehnt
"""
import pytest
import uuid
from datetime import datetime, timedelta


# ─────────────────────────────────────────
# Hilfsfunktionen
# ─────────────────────────────────────────

async def create_article(client, auth_headers, stock: int = 5) -> dict:
    code = uuid.uuid4().hex[:8]
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"Test Artikel {code}",
        "inventory_code": f"ART-{code}",
        "category": "test",
        "current_stock": stock,
        "rental_price": 10.0,
    })
    assert resp.status_code in (200, 201), f"Artikel konnte nicht erstellt werden: {resp.text}"
    return resp.json()


async def create_customer(client, auth_headers) -> dict:
    code = uuid.uuid4().hex[:8]
    resp = await client.post("/api/customers", headers=auth_headers, json={
        "company_name": f"Test Firma {code}",
        "contact_person": "Max Muster",
        "email": f"firma{code}@test.de",
        "phone": "0123456789",
        "address": "Teststraße 1",
    })
    assert resp.status_code in (200, 201), f"Kunde konnte nicht erstellt werden: {resp.text}"
    return resp.json()


async def create_event(client, auth_headers, customer_id: str) -> dict:
    code = uuid.uuid4().hex[:8]
    start = (datetime.utcnow() + timedelta(days=10)).isoformat()
    end = (datetime.utcnow() + timedelta(days=12)).isoformat()
    resp = await client.post("/api/events", headers=auth_headers, json={
        "customer_id": customer_id,
        "event_type": "Messe",
        "event_name": f"Test Event {code}",
        "location": "Hamburg",
        "start_date": start,
        "end_date": end,
    })
    assert resp.status_code in (200, 201), f"Event konnte nicht erstellt werden: {resp.text}"
    return resp.json()


# ─────────────────────────────────────────
# Buchungslogik-Tests
# ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_booking_reduces_stock(client, auth_headers):
    """Buchung zieht Bestand korrekt ab."""
    customer = await create_customer(client, auth_headers)
    event = await create_event(client, auth_headers, customer["id"])
    article = await create_article(client, auth_headers, stock=5)

    resp = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event["id"],
        "article_id": article["id"],
        "quantity": 3,
    })
    assert resp.status_code in (200, 201), resp.text

    updated = await client.get(f"/api/articles/{article['id']}", headers=auth_headers)
    assert updated.json()["current_stock"] == 2


@pytest.mark.asyncio
async def test_booking_fails_when_stock_insufficient(client, auth_headers):
    """Buchung schlägt fehl wenn Bestand nicht ausreicht."""
    customer = await create_customer(client, auth_headers)
    event = await create_event(client, auth_headers, customer["id"])
    article = await create_article(client, auth_headers, stock=2)

    resp = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event["id"],
        "article_id": article["id"],
        "quantity": 5,  # mehr als vorhanden
    })
    assert resp.status_code == 400, f"Erwartet 400, bekommen: {resp.status_code}"


@pytest.mark.asyncio
async def test_return_booking_restores_stock(client, auth_headers):
    """Rückgabe schreibt Bestand korrekt gut."""
    customer = await create_customer(client, auth_headers)
    event = await create_event(client, auth_headers, customer["id"])
    article = await create_article(client, auth_headers, stock=5)

    booking_resp = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event["id"],
        "article_id": article["id"],
        "quantity": 3,
    })
    assert booking_resp.status_code in (200, 201)
    booking_id = booking_resp.json()["id"]

    return_resp = await client.put(f"/api/bookings/{booking_id}/return", headers=auth_headers)
    assert return_resp.status_code == 200, return_resp.text

    updated = await client.get(f"/api/articles/{article['id']}", headers=auth_headers)
    assert updated.json()["current_stock"] == 5


@pytest.mark.asyncio
async def test_double_return_is_rejected(client, auth_headers):
    """Doppelrückgabe wird abgelehnt – verhindert doppeltes Gutschreiben."""
    customer = await create_customer(client, auth_headers)
    event = await create_event(client, auth_headers, customer["id"])
    article = await create_article(client, auth_headers, stock=5)

    booking_resp = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event["id"],
        "article_id": article["id"],
        "quantity": 2,
    })
    booking_id = booking_resp.json()["id"]

    first = await client.put(f"/api/bookings/{booking_id}/return", headers=auth_headers)
    assert first.status_code == 200

    second = await client.put(f"/api/bookings/{booking_id}/return", headers=auth_headers)
    assert second.status_code == 400, "Doppelrückgabe hätte abgelehnt werden müssen"

    # Bestand darf nur einmal gutgeschrieben worden sein
    updated = await client.get(f"/api/articles/{article['id']}", headers=auth_headers)
    assert updated.json()["current_stock"] == 5


# ─────────────────────────────────────────
# Datum-Validierung
# ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_booking_rejects_return_before_pickup(client, auth_headers):
    """Buchung mit return_date vor pickup_date wird abgelehnt."""
    customer = await create_customer(client, auth_headers)
    event = await create_event(client, auth_headers, customer["id"])
    article = await create_article(client, auth_headers, stock=5)

    pickup = (datetime.utcnow() + timedelta(days=10)).isoformat()
    early_return = (datetime.utcnow() + timedelta(days=5)).isoformat()  # vor pickup!

    resp = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event["id"],
        "article_id": article["id"],
        "quantity": 1,
        "pickup_date": pickup,
        "return_date": early_return,
    })
    assert resp.status_code == 422, f"Ungültige Datumsreihenfolge hätte abgelehnt werden müssen, bekommen: {resp.status_code}"


@pytest.mark.asyncio
async def test_booking_rejects_zero_quantity(client, auth_headers):
    """Buchung mit Menge 0 wird abgelehnt."""
    customer = await create_customer(client, auth_headers)
    event = await create_event(client, auth_headers, customer["id"])
    article = await create_article(client, auth_headers, stock=5)

    resp = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event["id"],
        "article_id": article["id"],
        "quantity": 0,
    })
    assert resp.status_code == 422, f"Menge 0 hätte abgelehnt werden müssen, bekommen: {resp.status_code}"


@pytest.mark.asyncio
async def test_booking_rejects_negative_quantity(client, auth_headers):
    """Buchung mit negativer Menge wird abgelehnt."""
    customer = await create_customer(client, auth_headers)
    event = await create_event(client, auth_headers, customer["id"])
    article = await create_article(client, auth_headers, stock=5)

    resp = await client.post("/api/bookings", headers=auth_headers, json={
        "event_id": event["id"],
        "article_id": article["id"],
        "quantity": -3,
    })
    assert resp.status_code == 422, f"Negative Menge hätte abgelehnt werden müssen, bekommen: {resp.status_code}"


# ─────────────────────────────────────────
# Pagination
# ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_bookings_pagination_params(client, auth_headers):
    """GET /bookings akzeptiert page/page_size Parameter."""
    resp = await client.get("/api/bookings?page=1&page_size=10", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_bookings_pagination_invalid_page(client, auth_headers):
    """page=0 wird abgelehnt."""
    resp = await client.get("/api/bookings?page=0", headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_bookings_pagination_max_page_size(client, auth_headers):
    """page_size > 500 wird abgelehnt."""
    resp = await client.get("/api/bookings?page_size=501", headers=auth_headers)
    assert resp.status_code == 422
