# backend/tests/test_packing_list.py
import pytest


@pytest.mark.asyncio
async def test_packing_list_items_sorted(client, auth_headers):
    """Packing list items returned sorted by storage_location then zone_name."""
    import uuid, sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import server

    # Create a customer first (required by EventCreate)
    cust_resp = await client.post("/api/customers", headers=auth_headers, json={
        "company_name": f"PL Firma {uuid.uuid4().hex[:6]}",
        "contact_person": "Max Muster",
        "email": f"pl{uuid.uuid4().hex[:6]}@test.de",
        "phone": "0123456789",
        "address": "Teststraße 1",
    })
    assert cust_resp.status_code in (200, 201), cust_resp.text
    customer_id = cust_resp.json()["id"]

    event_resp = await client.post("/api/events", headers=auth_headers, json={
        "customer_id": customer_id,
        "event_type": "Messe",
        "event_name": f"Sort Test {uuid.uuid4().hex[:6]}",
        "location": "Hamburg",
        "start_date": "2026-04-01T00:00:00",
        "end_date": "2026-04-03T00:00:00",
    })
    assert event_resp.status_code in (200, 201), event_resp.text
    event_id = event_resp.json()["id"]

    # Insert items with different storage locations
    items = [
        {"id": f"item-c-{uuid.uuid4().hex[:4]}", "event_id": event_id,
         "article_id": "a1", "article_name": "C", "inventory_code": "C",
         "quantity": 1, "storage_location": "Lager C", "zone_name": "Zone C",
         "weight_kg": 0, "checked_out": False, "checked_in": False},
        {"id": f"item-a-{uuid.uuid4().hex[:4]}", "event_id": event_id,
         "article_id": "a2", "article_name": "A", "inventory_code": "A",
         "quantity": 1, "storage_location": "Lager A", "zone_name": "Zone A",
         "weight_kg": 0, "checked_out": False, "checked_in": False},
        {"id": f"item-b-{uuid.uuid4().hex[:4]}", "event_id": event_id,
         "article_id": "a3", "article_name": "B", "inventory_code": "B",
         "quantity": 1, "storage_location": "Lager B", "zone_name": "Zone B",
         "weight_kg": 0, "checked_out": False, "checked_in": False},
    ]
    await server.db.packing_list_items.insert_many(items)

    resp = await client.get(f"/api/events/{event_id}/packing-list-items", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data

    storage_locations = [item.get("storage_location", "") for item in items if item.get("storage_location")]
    if len(storage_locations) >= 2:
        assert storage_locations == sorted(storage_locations), \
            f"Items not sorted: {storage_locations}"
