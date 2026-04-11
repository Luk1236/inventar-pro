# backend/tests/test_suppliers.py
"""Tests für Lieferanten-CRUD."""
import pytest
import uuid


@pytest.mark.asyncio
async def test_supplier_crud(client, auth_headers):
    """Vollständiger CRUD-Zyklus für Lieferanten."""
    name = f"Test Lieferant {uuid.uuid4().hex[:6]}"

    # CREATE
    r = await client.post("/api/suppliers", json={
        "name": name,
        "contact_person": "Max Muster",
        "email": "max@test.de",
        "phone": "0123456789",
    }, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    sup = r.json()
    sid = sup["id"]
    assert sup["name"] == name

    # READ by ID
    r = await client.get(f"/api/suppliers/{sid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == sid

    # UPDATE
    r = await client.put(f"/api/suppliers/{sid}", json={
        "name": name + " (geändert)",
        "contact_person": "Erika Muster",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["name"] == name + " (geändert)"

    # DELETE
    r = await client.delete(f"/api/suppliers/{sid}", headers=auth_headers)
    assert r.status_code == 200

    # 404 AFTER DELETE
    r = await client.get(f"/api/suppliers/{sid}", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_supplier_list_returns_list(client, auth_headers):
    """GET /suppliers gibt eine Liste zurück."""
    r = await client.get("/api/suppliers", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_supplier_not_found(client, auth_headers):
    """GET mit unbekannter ID → 404."""
    r = await client.get("/api/suppliers/nonexistent-id-xyz", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_supplier_requires_name(client, auth_headers):
    """CREATE ohne name → 422 Validation Error."""
    r = await client.post("/api/suppliers", json={"contact_person": "Jemand"}, headers=auth_headers)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_supplier_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/suppliers")
    assert r.status_code == 401
