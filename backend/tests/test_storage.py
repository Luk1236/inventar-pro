# backend/tests/test_storage.py
"""Tests für Lagerzonen und Lagerorte (inkl. Archivierung)."""
import pytest
import uuid


async def create_zone(client, auth_headers) -> dict:
    code = uuid.uuid4().hex[:6]
    r = await client.post("/api/storage-zones", json={
        "name": f"Zone {code}",
        "type": "Innenlager",
        "description": "Testzone",
    }, headers=auth_headers)
    assert r.status_code == 200, f"Zone CREATE fehlgeschlagen: {r.text}"
    return r.json()


@pytest.mark.asyncio
async def test_storage_zone_crud(client, auth_headers):
    """Vollständiger CRUD-Zyklus für Lagerzonen."""
    code = uuid.uuid4().hex[:6]

    # CREATE
    r = await client.post("/api/storage-zones", json={
        "name": f"TestZone {code}",
        "type": "Innenlager",
    }, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    zone = r.json()
    zid = zone["id"]

    # GET LIST
    r = await client.get("/api/storage-zones", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    # UPDATE
    r = await client.put(f"/api/storage-zones/{zid}", json={
        "name": f"TestZone {code} (geändert)",
        "type": "Sperrlager",
    }, headers=auth_headers)
    assert r.status_code == 200

    # DELETE
    r = await client.delete(f"/api/storage-zones/{zid}", headers=auth_headers)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_storage_location_crud(client, auth_headers):
    """Vollständiger CRUD-Zyklus für Lagerorte."""
    zone = await create_zone(client, auth_headers)
    code = uuid.uuid4().hex[:6]

    # CREATE
    r = await client.post("/api/storage-locations", json={
        "zone_id": zone["id"],
        "name": f"Regal-{code}",
        "type": "Regal",
        "capacity": 10,
    }, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    loc = r.json()
    lid = loc["id"]
    assert loc["zone_id"] == zone["id"]

    # GET LIST
    r = await client.get("/api/storage-locations", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    # UPDATE
    r = await client.put(f"/api/storage-locations/{lid}", json={
        "zone_id": zone["id"],
        "name": f"Regal-{code}-neu",
        "type": "Fach",
        "capacity": 20,
    }, headers=auth_headers)
    assert r.status_code == 200

    # DELETE
    r = await client.delete(f"/api/storage-locations/{lid}", headers=auth_headers)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_storage_location_archive_unarchive(client, auth_headers):
    """Archivieren und Dearchivieren eines Lagerorts."""
    zone = await create_zone(client, auth_headers)
    code = uuid.uuid4().hex[:6]

    r = await client.post("/api/storage-locations", json={
        "zone_id": zone["id"],
        "name": f"Archiv-Regal-{code}",
        "type": "Regal",
    }, headers=auth_headers)
    assert r.status_code == 200
    lid = r.json()["id"]

    # ARCHIVE
    r = await client.post(f"/api/storage-locations/{lid}/archive", headers=auth_headers)
    assert r.status_code == 200, f"Archive fehlgeschlagen: {r.text}"

    # UNARCHIVE
    r = await client.post(f"/api/storage-locations/{lid}/unarchive", headers=auth_headers)
    assert r.status_code == 200, f"Unarchive fehlgeschlagen: {r.text}"


@pytest.mark.asyncio
async def test_storage_location_not_found(client, auth_headers):
    """Archive auf unbekannte ID → 404."""
    r = await client.post("/api/storage-locations/nonexistent-id/archive", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_storage_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/storage-zones")
    assert r.status_code == 401
