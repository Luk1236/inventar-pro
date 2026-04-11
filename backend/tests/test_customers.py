# backend/tests/test_customers.py
"""Tests für Kunden-CRUD (inkl. Soft-Delete)."""
import pytest
import uuid


def _customer_payload(suffix=""):
    code = uuid.uuid4().hex[:6]
    return {
        "company_name": f"Test Firma {code}{suffix}",
        "contact_person": "Max Muster",
        "phone": "0123456789",
        "email": f"firma{code}@test.de",
        "address_city": "Hamburg",
    }


@pytest.mark.asyncio
async def test_customer_crud(client, auth_headers):
    """Vollständiger CRUD-Zyklus für Kunden."""
    payload = _customer_payload()

    # CREATE
    r = await client.post("/api/customers", json=payload, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    customer = r.json()
    cid = customer["id"]
    assert customer["company_name"] == payload["company_name"]
    assert "customer_number" in customer  # auto-generiert

    # READ by ID
    r = await client.get(f"/api/customers/{cid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == cid

    # UPDATE
    updated_payload = _customer_payload(suffix=" (geändert)")
    r = await client.put(f"/api/customers/{cid}", json=updated_payload, headers=auth_headers)
    assert r.status_code == 200
    assert "(geändert)" in r.json()["company_name"]

    # DELETE (Soft-Delete: setzt is_active=False)
    r = await client.delete(f"/api/customers/{cid}", headers=auth_headers)
    assert r.status_code == 200

    # Nach Soft-Delete: nicht mehr in der Liste
    r = await client.get("/api/customers", headers=auth_headers)
    assert r.status_code == 200
    ids_in_list = [c["id"] for c in r.json()]
    assert cid not in ids_in_list, "Soft-gelöschter Kunde sollte nicht in der Liste erscheinen"


@pytest.mark.asyncio
async def test_customer_list_returns_list(client, auth_headers):
    """GET /customers gibt eine Liste zurück."""
    r = await client.get("/api/customers", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_customer_search(client, auth_headers):
    """GET /customers?search= filtert die Liste."""
    unique = uuid.uuid4().hex[:10]
    payload = {
        "company_name": f"Suchfirma {unique}",
        "contact_person": "Such Person",
        "phone": "0987654321",
        "email": f"such{unique}@test.de",
    }
    await client.post("/api/customers", json=payload, headers=auth_headers)

    r = await client.get(f"/api/customers?search={unique}", headers=auth_headers)
    assert r.status_code == 200
    results = r.json()
    assert any(unique in c["company_name"] for c in results), "Suche hat keine Ergebnisse geliefert"


@pytest.mark.asyncio
async def test_customer_requires_email_and_name(client, auth_headers):
    """CREATE ohne Pflichtfelder → 422."""
    r = await client.post("/api/customers", json={"company_name": "Nur Name"}, headers=auth_headers)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_customer_not_found(client, auth_headers):
    """GET mit unbekannter ID → 404."""
    r = await client.get("/api/customers/nonexistent-id-xyz", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_customer_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/customers")
    assert r.status_code == 401
