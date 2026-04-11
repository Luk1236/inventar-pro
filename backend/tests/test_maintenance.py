# backend/tests/test_maintenance.py
"""Tests für Repair-Tickets (Wartung/Reparatur)."""
import pytest
import uuid


async def create_article_for_repair(client, auth_headers) -> dict:
    """Erstellt einen Artikel für Repair-Ticket-Tests."""
    code = uuid.uuid4().hex[:8]
    r = await client.post("/api/articles", json={
        "name": f"Reparatur-Artikel {code}",
        "inventory_code": f"REP-{code}",
        "category": "test",
        "current_stock": 1,
    }, headers=auth_headers)
    assert r.status_code in (200, 201), f"Artikel CREATE fehlgeschlagen: {r.text}"
    return r.json()


@pytest.mark.asyncio
async def test_repair_ticket_create_and_read(client, auth_headers):
    """Repair-Ticket anlegen und lesen."""
    article = await create_article_for_repair(client, auth_headers)

    # CREATE
    r = await client.post("/api/repair-tickets", json={
        "article_id": article["id"],
        "title": "Defekter Stecker",
        "description": "Der Stecker ist abgebrochen.",
        "defect_type": "mechanical",
        "severity": "medium",
    }, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    ticket = r.json()
    tid = ticket["id"]
    assert ticket["article_id"] == article["id"]
    assert "ticket_number" in ticket

    # READ by ID
    r = await client.get(f"/api/repair-tickets/{tid}", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == tid
    assert "article" in data  # GET by ID liefert auch Artikel-Info


@pytest.mark.asyncio
async def test_repair_ticket_list(client, auth_headers):
    """GET /repair-tickets gibt eine Liste zurück."""
    r = await client.get("/api/repair-tickets", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_repair_ticket_update_status(client, auth_headers):
    """Status eines Tickets auf 'in_progress' ändern."""
    article = await create_article_for_repair(client, auth_headers)

    r = await client.post("/api/repair-tickets", json={
        "article_id": article["id"],
        "title": "Kratzer am Gehäuse",
        "description": "Optischer Defekt.",
        "severity": "low",
    }, headers=auth_headers)
    assert r.status_code == 200
    tid = r.json()["id"]

    # UPDATE: Status → in_progress (Query-Parameter!)
    r = await client.put(f"/api/repair-tickets/{tid}?status=in_progress", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["ticket_id"] == tid

    # Verify
    r = await client.get(f"/api/repair-tickets/{tid}", headers=auth_headers)
    assert r.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_repair_ticket_invalid_article(client, auth_headers):
    """Ticket mit unbekannter article_id → 404."""
    r = await client.post("/api/repair-tickets", json={
        "article_id": "nonexistent-article-id",
        "title": "Test",
        "description": "Test",
    }, headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_repair_ticket_not_found(client, auth_headers):
    """GET mit unbekannter Ticket-ID → 404."""
    r = await client.get("/api/repair-tickets/nonexistent-ticket-id", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_repair_ticket_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/repair-tickets")
    assert r.status_code == 401
