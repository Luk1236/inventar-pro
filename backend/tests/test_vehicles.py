# backend/tests/test_vehicles.py
"""Tests für Fahrzeuge-CRUD."""
import pytest
import uuid


@pytest.mark.asyncio
async def test_vehicle_crud(client, auth_headers):
    """Vollständiger CRUD-Zyklus für Fahrzeuge (ohne GET by ID)."""
    plate = f"HH-TEST-{uuid.uuid4().hex[:4].upper()}"

    # CREATE
    r = await client.post("/api/vehicles", json={
        "name": f"Testfahrzeug {plate}",
        "type": "Transporter",
        "license_plate": plate,
    }, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    vehicle = r.json()
    vid = vehicle["id"]
    assert vehicle.get("license_plate") == plate

    # Verify in list
    r = await client.get("/api/vehicles", headers=auth_headers)
    assert r.status_code == 200
    ids_in_list = [v["id"] for v in r.json()]
    assert vid in ids_in_list, "Fahrzeug nicht in Liste gefunden"

    # UPDATE
    r = await client.put(f"/api/vehicles/{vid}", json={
        "name": f"Updated {plate}",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json().get("status") == "success"

    # DELETE
    r = await client.delete(f"/api/vehicles/{vid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json().get("status") == "deleted"

    # Verify removed from list
    r = await client.get("/api/vehicles", headers=auth_headers)
    ids_after = [v["id"] for v in r.json()]
    assert vid not in ids_after, "Gelöschtes Fahrzeug noch in Liste"


@pytest.mark.asyncio
async def test_vehicle_list_returns_list(client, auth_headers):
    """GET /vehicles gibt eine Liste zurück."""
    r = await client.get("/api/vehicles", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_vehicle_delete_not_found(client, auth_headers):
    """DELETE mit unbekannter ID → 404."""
    r = await client.delete("/api/vehicles/nonexistent-id-xyz", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_vehicle_requires_name(client, auth_headers):
    """CREATE ohne name → 422."""
    r = await client.post("/api/vehicles", json={"license_plate": "HH-X-1"}, headers=auth_headers)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_vehicle_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/vehicles")
    assert r.status_code == 401
