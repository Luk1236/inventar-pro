# backend/tests/test_rental_calculation.py
import pytest


@pytest.mark.asyncio
async def test_rental_breakdown_returned(client, auth_headers):
    """Rental endpoint returns breakdown and rates_summary fields."""
    import uuid
    code = uuid.uuid4().hex[:8]
    article_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": "Test Lamp",
        "inventory_code": f"TEST-{code}",
        "category": "lighting",
        "rental_price": 100.0,
        "rental_factor_weekend": 1.5,
        "rental_factor_week": 3.0,
        "current_stock": 1,
    })
    assert article_resp.status_code in (200, 201), article_resp.text
    article_id = article_resp.json()["id"]

    resp = await client.post(
        "/api/calculate/rental-price?days=1&is_weekend=false",
        headers=auth_headers,
        json={"article_ids": [article_id], "quantities": {article_id: 2}}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "breakdown" in data, "Missing breakdown field"
    assert "rates_summary" in data, "Missing rates_summary field"
    assert len(data["breakdown"]) >= 1
    item = data["breakdown"][0]
    assert item["quantity"] == 2
    assert item["daily_rate"] == 100.0
    assert item["weekend_rate"] == 150.0
    assert item["week_rate"] == 2100.0


@pytest.mark.asyncio
async def test_rental_quantity_multiplies_subtotal(client, auth_headers):
    """Subtotal equals daily_rate * quantity for day=1 (factor=1.0)."""
    import uuid
    code = uuid.uuid4().hex[:8]
    article_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": "Test Speaker",
        "inventory_code": f"SPK-{code}",
        "category": "audio",
        "rental_price": 50.0,
        "rental_factor_weekend": 1.5,
        "rental_factor_week": 3.0,
        "current_stock": 5,
    })
    article_id = article_resp.json()["id"]

    resp = await client.post(
        "/api/calculate/rental-price?days=1&is_weekend=false",
        headers=auth_headers,
        json={"article_ids": [article_id], "quantities": {article_id: 3}}
    )
    data = resp.json()
    assert data["breakdown"][0]["subtotal"] == 150.0  # 50 * 3 * 1.0


@pytest.mark.asyncio
async def test_rates_summary_structure(client, auth_headers):
    """rates_summary has daily_total, weekend_total, week_total keys."""
    import uuid
    code = uuid.uuid4().hex[:8]
    article_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": "Test Table",
        "inventory_code": f"TBL-{code}",
        "category": "furniture",
        "rental_price": 20.0,
        "rental_factor_weekend": 1.5,
        "rental_factor_week": 3.0,
        "current_stock": 1,
    })
    article_id = article_resp.json()["id"]

    resp = await client.post(
        "/api/calculate/rental-price?days=1",
        headers=auth_headers,
        json={"article_ids": [article_id], "quantities": {}}
    )
    data = resp.json()
    summary = data["rates_summary"]
    assert "daily_total" in summary
    assert "weekend_total" in summary
    assert "week_total" in summary
    assert summary["daily_total"] == 20.0
    assert summary["weekend_total"] == 30.0
    assert summary["week_total"] == 420.0
