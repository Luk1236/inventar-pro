# backend/tests/test_dashboard.py
import pytest
import server
import uuid as _uuid


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


@pytest.mark.asyncio
async def test_top_rented_resolves_article_name(client, auth_headers, test_db):
    """$lookup muss den Artikelnamen korrekt auflösen — nicht 'Unbekannt'."""
    import server
    server._dashboard_cache = {}
    server._dashboard_cache_ts = 0

    # Artikel in Test-DB anlegen
    article_id = str(_uuid.uuid4())
    await test_db.articles.insert_one({
        "id": article_id,
        "name": "Testzelt XL",
        "deleted": False,
        "archived": False,
    })
    # 3 Buchungen für diesen Artikel anlegen
    for _ in range(3):
        await test_db.bookings.insert_one({
            "id": str(_uuid.uuid4()),
            "article_id": article_id,
        })

    resp = await client.get("/api/dashboard/stats", headers=auth_headers)
    assert resp.status_code == 200
    top = resp.json().get("top_rented_articles", [])

    # Artikel muss in Top-10 sein
    found = next((x for x in top if x["id"] == article_id), None)
    assert found is not None, f"Artikel {article_id} nicht in top_rented_articles"
    assert found["name"] == "Testzelt XL", (
        f"Erwartet 'Testzelt XL', bekommen '{found['name']}'. "
        "Fehler: $lookup löst Artikelname nicht auf."
    )
    assert found["booking_count"] == 3

    # Aufräumen
    await test_db.articles.delete_one({"id": article_id})
    await test_db.bookings.delete_many({"article_id": article_id})
