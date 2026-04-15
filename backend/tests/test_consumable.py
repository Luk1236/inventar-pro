"""Tests for consumable material tracking."""
import pytest
import uuid


@pytest.mark.asyncio
async def test_consumable_low_stock_shows_in_alerts(client, auth_headers):
    """Article with is_consumable=True and stock <= min_stock shows in alerts."""
    code = uuid.uuid4().hex[:8]
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": "Test Consumable Low",
        "inventory_code": f"CONS-LOW-{code}",
        "is_consumable": True,
        "current_stock": 2,
        "min_stock_level": 5,
    })
    assert resp.status_code in (200, 201), resp.text

    alerts_resp = await client.get("/api/articles/consumable-alerts", headers=auth_headers)
    assert alerts_resp.status_code == 200, alerts_resp.text
    alerts = alerts_resp.json()
    assert isinstance(alerts, list)
    codes = [a.get("inventory_code") for a in alerts]
    assert f"CONS-LOW-{code}" in codes


@pytest.mark.asyncio
async def test_non_consumable_not_in_alerts(client, auth_headers):
    """Article with is_consumable=False does NOT show in consumable alerts."""
    code = uuid.uuid4().hex[:8]
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": "Test Non Consumable",
        "inventory_code": f"NCONS-{code}",
        "is_consumable": False,
        "current_stock": 0,
        "min_stock_level": 10,
    })
    assert resp.status_code in (200, 201), resp.text

    alerts_resp = await client.get("/api/articles/consumable-alerts", headers=auth_headers)
    assert alerts_resp.status_code == 200, alerts_resp.text
    alerts = alerts_resp.json()
    codes = [a.get("inventory_code") for a in alerts]
    assert f"NCONS-{code}" not in codes


@pytest.mark.asyncio
async def test_consumable_sufficient_stock_not_in_alerts(client, auth_headers):
    """Article with is_consumable=True but stock > min_stock does NOT show in alerts."""
    code = uuid.uuid4().hex[:8]
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": "Test Consumable OK",
        "inventory_code": f"CONS-OK-{code}",
        "is_consumable": True,
        "current_stock": 20,
        "min_stock_level": 5,
    })
    assert resp.status_code in (200, 201), resp.text

    alerts_resp = await client.get("/api/articles/consumable-alerts", headers=auth_headers)
    assert alerts_resp.status_code == 200, alerts_resp.text
    alerts = alerts_resp.json()
    codes = [a.get("inventory_code") for a in alerts]
    assert f"CONS-OK-{code}" not in codes
