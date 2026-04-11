# backend/tests/test_reports.py
"""Tests für Report-Endpunkte."""
import pytest


@pytest.mark.asyncio
async def test_inventory_report_returns_data(client, auth_headers):
    """GET /reports/inventory gibt JSON mit total_items und items zurück."""
    r = await client.get("/api/reports/inventory", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "total_items" in data, f"Fehlendes Feld 'total_items'. Keys: {list(data.keys())}"
    assert "items" in data
    assert "generated_at" in data
    assert isinstance(data["items"], list)
    assert isinstance(data["total_items"], int)


@pytest.mark.asyncio
async def test_inventory_csv_returns_csv(client, auth_headers):
    """GET /reports/inventory-csv gibt CSV zurück (Content-Type: text/csv)."""
    r = await client.get("/api/reports/inventory-csv", headers=auth_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", ""), \
        f"Erwarteter Content-Type text/csv, bekommen: {r.headers.get('content-type')}"
    # CSV hat mindestens den Header
    assert "Name" in r.text or "inventory" in r.text.lower()


@pytest.mark.asyncio
async def test_customers_report_returns_data(client, auth_headers):
    """GET /reports/customers gibt JSON mit total_customers und customers zurück."""
    r = await client.get("/api/reports/customers", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "total_customers" in data, f"Fehlendes Feld. Keys: {list(data.keys())}"
    assert "customers" in data
    assert isinstance(data["customers"], list)


@pytest.mark.asyncio
async def test_customers_csv_returns_csv(client, auth_headers):
    """GET /reports/customers-csv gibt CSV zurück."""
    r = await client.get("/api/reports/customers-csv", headers=auth_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_monthly_report_returns_data(client, auth_headers):
    """GET /reports/monthly gibt JSON zurück."""
    r = await client.get("/api/reports/monthly", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


@pytest.mark.asyncio
async def test_reports_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/reports/inventory")
    assert r.status_code == 401
