# backend/tests/test_categories.py
"""Tests für Kategorien-CRUD."""
import pytest
import uuid


@pytest.mark.asyncio
async def test_category_crud(client, auth_headers):
    """Vollständiger CRUD-Zyklus für Kategorien."""
    name = f"Testkategorie {uuid.uuid4().hex[:6]}"

    # CREATE
    r = await client.post("/api/categories", json={"name": name, "description": "Testbeschreibung"}, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    cat = r.json()
    cid = cat["id"]
    assert cat["name"] == name

    # READ by ID
    r = await client.get(f"/api/categories/{cid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == cid

    # UPDATE
    r = await client.put(f"/api/categories/{cid}", json={"name": name + " (geändert)", "description": "neu"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["name"] == name + " (geändert)"

    # DELETE
    r = await client.delete(f"/api/categories/{cid}", headers=auth_headers)
    assert r.status_code == 200

    # 404 AFTER DELETE
    r = await client.get(f"/api/categories/{cid}", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_category_list_returns_list(client, auth_headers):
    """GET /categories gibt eine Liste zurück."""
    r = await client.get("/api/categories", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_category_not_found(client, auth_headers):
    """GET mit unbekannter ID → 404."""
    r = await client.get("/api/categories/nonexistent-id-xyz", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_category_requires_name(client, auth_headers):
    """CREATE ohne name → 422 Validation Error."""
    r = await client.post("/api/categories", json={"description": "nur Beschreibung"}, headers=auth_headers)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_category_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/categories")
    assert r.status_code == 401
