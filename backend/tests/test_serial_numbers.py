import pytest
import uuid


async def _create_article(client, auth_headers):
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"SNArt-{uuid.uuid4().hex[:6]}",
        "current_stock": 5,
    })
    assert resp.status_code == 200
    return resp.json()


def _sn_payload(article_id, article_name):
    return {
        "article_id": article_id,
        "article_name": article_name,
        "serial_number": f"SN-{uuid.uuid4().hex[:8].upper()}",
        "status": "verfügbar",
        "condition": "neu",
        "purchase_date": "2026-01-01",
        "purchase_price": 500.0,
        "notes": "Testgerät",
    }


@pytest.mark.asyncio
async def test_create_serial_number(client, auth_headers):
    article = await _create_article(client, auth_headers)
    payload = _sn_payload(article["id"], article["name"])
    resp = await client.post("/api/serial-numbers", headers=auth_headers, json=payload)
    assert resp.status_code == 200, resp.text
    assert "id" in resp.json()
    assert resp.json()["serial_number"] == payload["serial_number"]


@pytest.mark.asyncio
async def test_list_serial_numbers(client, auth_headers):
    article = await _create_article(client, auth_headers)
    await client.post("/api/serial-numbers", headers=auth_headers, json=_sn_payload(article["id"], article["name"]))

    resp = await client.get("/api/serial-numbers", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), (list, dict))


@pytest.mark.asyncio
async def test_filter_serial_numbers_by_article(client, auth_headers):
    article = await _create_article(client, auth_headers)
    await client.post("/api/serial-numbers", headers=auth_headers, json=_sn_payload(article["id"], article["name"]))

    resp = await client.get(f"/api/serial-numbers?article_id={article['id']}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    items = data if isinstance(data, list) else data.get("items", data.get("serial_numbers", []))
    assert all(sn["article_id"] == article["id"] for sn in items)


@pytest.mark.asyncio
async def test_update_serial_number(client, auth_headers):
    article = await _create_article(client, auth_headers)
    create_resp = await client.post("/api/serial-numbers", headers=auth_headers, json=_sn_payload(article["id"], article["name"]))
    sn_id = create_resp.json()["id"]

    payload = _sn_payload(article["id"], article["name"])
    payload["condition"] = "gebraucht"
    resp = await client.put(f"/api/serial-numbers/{sn_id}", headers=auth_headers, json=payload)
    assert resp.status_code == 200
    assert resp.json()["condition"] == "gebraucht"


@pytest.mark.asyncio
async def test_delete_serial_number(client, auth_headers):
    article = await _create_article(client, auth_headers)
    create_resp = await client.post("/api/serial-numbers", headers=auth_headers, json=_sn_payload(article["id"], article["name"]))
    sn_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/serial-numbers/{sn_id}", headers=auth_headers)
    assert resp.status_code in (200, 204)
