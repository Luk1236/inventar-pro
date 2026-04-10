# backend/tests/test_dashboard.py
import pytest
import server


@pytest.mark.asyncio
async def test_dashboard_stats_new_fields(client, auth_headers):
    """Dashboard stats must include top_rented_articles and pending_invoices fields."""
    server._dashboard_cache = {}
    server._dashboard_cache_ts = 0

    resp = await client.get("/api/dashboard/stats", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    # Existing fields still present
    assert "total_articles" in data
    assert "total_inventory_value" in data

    # New fields
    assert "top_rented_articles" in data, f"Missing top_rented_articles. Keys: {list(data.keys())}"
    assert isinstance(data["top_rented_articles"], list)
    assert len(data["top_rented_articles"]) <= 10

    assert "pending_invoices_total" in data, "Missing pending_invoices_total"
    assert isinstance(data["pending_invoices_total"], (int, float))

    assert "pending_invoices_count" in data, "Missing pending_invoices_count"
    assert isinstance(data["pending_invoices_count"], int)


@pytest.mark.asyncio
async def test_top_rented_articles_format(client, auth_headers):
    """Each top_rented entry must have id, name, booking_count."""
    server._dashboard_cache = {}
    server._dashboard_cache_ts = 0

    resp = await client.get("/api/dashboard/stats", headers=auth_headers)
    assert resp.status_code == 200
    top = resp.json().get("top_rented_articles", [])
    for item in top:
        assert "id" in item, f"Missing 'id' in {item}"
        assert "name" in item, f"Missing 'name' in {item}"
        assert "booking_count" in item, f"Missing 'booking_count' in {item}"
