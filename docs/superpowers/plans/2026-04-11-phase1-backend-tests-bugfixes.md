# Phase 1: Backend-Tests & Bug-Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vollständige Pytest-Suite für alle Backend-Module + Fixes für den archived-Routing-Konflikt, fehlende Booking-WebSocket-Broadcasts und Dashboard-Erweiterungen (Top-10, offene Rechnungen).

**Architecture:** Tests laufen gegen eine isolierte Test-Datenbank (`inventory_test`) via httpx AsyncClient. Alle Fixes gehen in `backend/server.py`. Die Test-Infrastruktur in `backend/tests/conftest.py` bleibt unverändert.

**Tech Stack:** Python 3.12, FastAPI, Motor (MongoDB), pytest-asyncio, httpx

---

## Kontext für den Implementierer

- Backend läuft auf Port 8002 (`cd backend && python server.py`)
- Tests laufen: `cd backend && python -m pytest tests/ -v`
- Bestehende Tests: `tests/test_auth.py`, `tests/test_bookings.py`, `tests/test_consumable.py`, `tests/test_new_features.py`
- Konfig: `backend/pytest.ini` — asyncio_mode=auto, session scope
- conftest.py stellt `client`, `test_db`, `auth_headers` Fixtures bereit
- MongoDB läuft lokal auf Port 27017

---

## Task 1: Fix — Archived-Artikel Routing-Konflikt

**Problem:** `@api_router.get("/articles/{article_id}")` ist vor `/articles/archived` registriert. Beim Aufruf von `/api/v1/articles/archived` wird "archived" als article_id interpretiert → 404.

**Fix:** Route `/articles/archived` direkt in api_router VOR `{article_id}` verschieben.

**Files:**
- Modify: `backend/server.py` (Zeilen ~2244 und ~9632)

- [ ] **Step 1: Finde die bestehenden Routen**

```bash
grep -n "articles/archived\|articles/{article_id}" backend/server.py
```

Erwartete Ausgabe:
```
1904: @api_router.get("/articles", ...)
2244: @api_router.get("/articles/{article_id}", ...)
9632: @app.get("/api/articles/archived")
```

- [ ] **Step 2: Lese den Archived-Handler (Zeilen 9632–9662)**

```bash
sed -n '9632,9665p' backend/server.py
```

Notiere den kompletten Handler-Code.

- [ ] **Step 3: Schreibe den Failing-Test**

Datei: `backend/tests/test_articles.py` (neu anlegen)

```python
# backend/tests/test_articles.py
import pytest
import uuid


@pytest.mark.asyncio
async def test_archived_route_not_treated_as_article_id(client, auth_headers):
    """GET /api/articles/archived must not return 404 (routing conflict check)."""
    resp = await client.get("/api/articles/archived", headers=auth_headers)
    assert resp.status_code == 200, f"Routing conflict: got {resp.status_code}"
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_archived_v1_route(client, auth_headers):
    """GET /api/v1/articles/archived must also work."""
    resp = await client.get("/api/v1/articles/archived", headers=auth_headers)
    assert resp.status_code == 200, f"v1 routing conflict: got {resp.status_code}"
    assert isinstance(resp.json(), list)
```

- [ ] **Step 4: Test ausführen — erwartet FAIL**

```bash
cd backend && python -m pytest tests/test_articles.py::test_archived_v1_route -v
```

Erwartete Ausgabe: `FAILED` (404 wegen Routing-Konflikt)

- [ ] **Step 5: Fix in server.py — Archived-Route in api_router verschieben**

Suche in `server.py` nach `@app.get("/api/articles/archived")` (ca. Zeile 9632) und den zugehörigen Handler (ca. 30 Zeilen).

Kopiere den Handler-Code. Dann füge ihn in `api_router` EIN, direkt VOR der `{article_id}`-Route (vor `@api_router.get("/articles/{article_id}")`).

Der Handler sieht ungefähr so aus — passe ihn für `api_router` an (entferne `/api/`-Prefix und `current_user`-Check falls nötig, behalte ihn falls vorhanden):

```python
@api_router.get("/articles/archived", response_model=List[Article])
async def get_archived_articles(current_user: User = Depends(get_current_user)):
    articles = await db.articles.find({"deleted": True}).sort("name", 1).to_list(1000)
    return [Article(**a) for a in articles]
```

Entferne danach die ursprüngliche `@app.get("/api/articles/archived")` Route (und ihren Handler) weiter unten in der Datei.

- [ ] **Step 6: Tests ausführen — erwartet PASS**

```bash
cd backend && python -m pytest tests/test_articles.py -v
```

Erwartete Ausgabe: `2 passed`

- [ ] **Step 7: Commit**

```bash
git add backend/server.py backend/tests/test_articles.py
git commit -m "fix: move articles/archived route before {article_id} to resolve routing conflict"
```

---

## Task 2: Fix — Booking WebSocket Broadcasts

**Problem:** Beim Erstellen/Stornieren von Buchungen werden keine WebSocket-Events gesendet. `articles/index.tsx` hört auf `article_updated` — Buchungen ändern den Bestand, aber kein Event wird gesendet.

**Files:**
- Modify: `backend/server.py` (Booking-Create und Booking-Cancel Endpoints)

- [ ] **Step 1: Finde die Booking-Endpoints**

```bash
grep -n "@api_router.post.*booking\|@api_router.put.*booking\|@api_router.delete.*booking\|@api_router.patch.*booking" backend/server.py
```

Notiere die Zeilennummern für: Buchung erstellen, Buchung stornieren/löschen.

- [ ] **Step 2: Schreibe den Failing-Test**

Füge in `backend/tests/test_articles.py` hinzu:

```python
@pytest.mark.asyncio
async def test_booking_broadcast_on_create(client, auth_headers, test_db):
    """Creating a booking should not crash — broadcast is fire-and-forget."""
    # Create an article first
    art_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"WS-Test-{uuid.uuid4().hex[:6]}",
        "current_stock": 5,
        "available_quantity": 5,
    })
    assert art_resp.status_code == 200
    article_id = art_resp.json()["id"]

    from datetime import date, timedelta
    start = (date.today() + timedelta(days=1)).isoformat()
    end = (date.today() + timedelta(days=3)).isoformat()

    resp = await client.post("/api/bookings", headers=auth_headers, json={
        "article_id": article_id,
        "quantity": 1,
        "start_date": start,
        "end_date": end,
        "customer_name": "WS Test",
    })
    # 200 or 201 = success, broadcast was called (fire-and-forget, no way to assert directly)
    assert resp.status_code in (200, 201), f"Booking failed: {resp.text}"
```

- [ ] **Step 3: Test ausführen — erwartet PASS (Test prüft nur ob kein Crash)**

```bash
cd backend && python -m pytest tests/test_articles.py::test_booking_broadcast_on_create -v
```

- [ ] **Step 4: Füge broadcasts in Booking-Endpoints ein**

In `server.py`, suche den Endpoint der Buchungen erstellt (wahrscheinlich `@api_router.post("/bookings")`). Direkt nach dem erfolgreichen `insert_one()` / `return booking` füge hinzu:

```python
import json as _json
await manager.broadcast(_json.dumps({"type": "booking_created", "id": str(booking.id)}))
```

Suche den Endpoint der Buchungen storniert/löscht. Füge hinzu:

```python
await manager.broadcast(_json.dumps({"type": "booking_cancelled", "id": booking_id}))
```

**Wichtig:** `manager` ist bereits importiert in server.py (`from websocket_handler import manager, websocket_endpoint`). Nutze `json` nicht als Variablenname (Konflikt mit stdlib) — verwende `_json` oder importiere lokal.

- [ ] **Step 5: Server neu starten und Tests ausführen**

```bash
cd backend && python -m pytest tests/test_articles.py -v
```

Erwartete Ausgabe: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/server.py backend/tests/test_articles.py
git commit -m "feat: broadcast WebSocket events on booking create/cancel"
```

---

## Task 3: Feature — Dashboard Stats Erweiterung (Top-10 + Offene Rechnungen)

**Ziel:** `GET /api/dashboard/stats` gibt zusätzlich zurück:
- `top_rented_articles`: Liste der 10 am häufigsten gebuchten Artikel `[{id, name, booking_count}]`
- `pending_invoices_total`: Summe aller unbezahlten Rechnungen (float)
- `pending_invoices_count`: Anzahl unbezahlter Rechnungen (int)

**Files:**
- Modify: `backend/server.py` (Zeile ~3141, `get_dashboard_stats` Funktion)

- [ ] **Step 1: Schreibe den Failing-Test**

Erstelle `backend/tests/test_dashboard.py`:

```python
# backend/tests/test_dashboard.py
import pytest


@pytest.mark.asyncio
async def test_dashboard_stats_structure(client, auth_headers):
    """Dashboard stats must include all required fields."""
    resp = await client.get("/api/dashboard/stats", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    
    # Existing fields
    assert "total_articles" in data
    assert "low_stock_articles" in data
    assert "total_inventory_value" in data
    
    # New fields
    assert "top_rented_articles" in data, "Missing top_rented_articles"
    assert isinstance(data["top_rented_articles"], list)
    assert len(data["top_rented_articles"]) <= 10
    
    assert "pending_invoices_total" in data, "Missing pending_invoices_total"
    assert isinstance(data["pending_invoices_total"], (int, float))
    
    assert "pending_invoices_count" in data, "Missing pending_invoices_count"
    assert isinstance(data["pending_invoices_count"], int)


@pytest.mark.asyncio
async def test_top_rented_articles_format(client, auth_headers):
    """Each top_rented entry must have id, name, booking_count."""
    resp = await client.get("/api/dashboard/stats", headers=auth_headers)
    assert resp.status_code == 200
    top = resp.json().get("top_rented_articles", [])
    for item in top:
        assert "name" in item
        assert "booking_count" in item
```

- [ ] **Step 2: Test ausführen — erwartet FAIL**

```bash
cd backend && python -m pytest tests/test_dashboard.py -v
```

Erwartete Ausgabe: `FAILED` (KeyError: 'top_rented_articles')

- [ ] **Step 3: Füge die neuen Aggregations in get_dashboard_stats ein**

In `server.py`, in der Funktion `get_dashboard_stats` (Zeile ~3141), füge VOR dem `result = {...}` Block ein:

```python
# Top 10 meist-gebuchte Artikel
_top_pipeline = [
    {"$group": {"_id": "$article_id", "booking_count": {"$sum": 1}}},
    {"$sort": {"booking_count": -1}},
    {"$limit": 10},
]
_top_results = await db.bookings.aggregate(_top_pipeline).to_list(10)
# Artikel-Namen nachladen
top_rented = []
for entry in _top_results:
    _art = await db.articles.find_one({"id": entry["_id"]}, {"name": 1})
    top_rented.append({
        "id": entry["_id"],
        "name": _art["name"] if _art else "Unbekannt",
        "booking_count": entry["booking_count"],
    })

# Offene Rechnungen
_inv_pipeline = [
    {"$match": {"payment_status": {"$ne": "paid"}}},
    {"$group": {"_id": None, "total": {"$sum": "$total_amount"}, "count": {"$sum": 1}}},
]
_inv_result = await db.invoices.aggregate(_inv_pipeline).to_list(1)
pending_invoices_total = round(_inv_result[0]["total"], 2) if _inv_result else 0.0
pending_invoices_count = _inv_result[0]["count"] if _inv_result else 0
```

Dann im `result = {...}` Block füge hinzu:

```python
"top_rented_articles": top_rented,
"pending_invoices_total": pending_invoices_total,
"pending_invoices_count": pending_invoices_count,
```

**Wichtig:** Der Cache (`_dashboard_cache`) muss nach dieser Änderung weiterhin funktionieren — er cached das gesamte `result`-Dict, die neuen Felder werden automatisch gecacht.

- [ ] **Step 4: Tests ausführen — erwartet PASS**

```bash
cd backend && python -m pytest tests/test_dashboard.py -v
```

Erwartete Ausgabe: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/server.py backend/tests/test_dashboard.py
git commit -m "feat: add top_rented_articles and pending_invoices to dashboard stats"
```

---

## Task 4: Tests — Artikel CRUD

**Files:**
- Modify: `backend/tests/test_articles.py`

- [ ] **Step 1: Füge CRUD-Tests zu test_articles.py hinzu**

```python
@pytest.mark.asyncio
async def test_create_article_auto_inventory_code(client, auth_headers):
    """Article creation without inventory_code auto-generates one."""
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"AutoCode-{uuid.uuid4().hex[:6]}",
        "current_stock": 3,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["inventory_code"], "inventory_code must be auto-generated"
    assert data["qr_code"] == data["inventory_code"], \
        f"qr_code ({data['qr_code']}) must equal inventory_code ({data['inventory_code']}), not have double prefix"


@pytest.mark.asyncio
async def test_create_article_with_inventory_code(client, auth_headers):
    """Article creation with explicit inventory_code uses it."""
    code = f"ART-{uuid.uuid4().hex[:6].upper()}"
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"ManualCode-{uuid.uuid4().hex[:6]}",
        "inventory_code": code,
        "current_stock": 1,
    })
    assert resp.status_code == 200
    assert resp.json()["inventory_code"] == code


@pytest.mark.asyncio
async def test_get_article_by_id(client, auth_headers):
    """GET /api/articles/{id} returns the created article."""
    create_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"GetById-{uuid.uuid4().hex[:6]}",
        "current_stock": 1,
    })
    assert create_resp.status_code == 200
    article_id = create_resp.json()["id"]

    resp = await client.get(f"/api/articles/{article_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == article_id


@pytest.mark.asyncio
async def test_update_article(client, auth_headers):
    """PUT /api/articles/{id} updates fields."""
    create_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"UpdateMe-{uuid.uuid4().hex[:6]}",
        "current_stock": 5,
    })
    article_id = create_resp.json()["id"]

    update_resp = await client.put(f"/api/articles/{article_id}", headers=auth_headers, json={
        "name": "Updated Name",
        "current_stock": 10,
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Name"
    assert update_resp.json()["current_stock"] == 10


@pytest.mark.asyncio
async def test_delete_article(client, auth_headers):
    """DELETE /api/articles/{id} soft-deletes the article."""
    create_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"DeleteMe-{uuid.uuid4().hex[:6]}",
        "current_stock": 1,
    })
    article_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/articles/{article_id}", headers=auth_headers)
    assert del_resp.status_code in (200, 204)

    # Should appear in archived
    archived_resp = await client.get("/api/articles/archived", headers=auth_headers)
    archived_ids = [a["id"] for a in archived_resp.json()]
    assert article_id in archived_ids, "Deleted article should be in archived list"


@pytest.mark.asyncio
async def test_article_list_excludes_deleted(client, auth_headers):
    """GET /api/articles does not return soft-deleted articles."""
    create_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"SoftDel-{uuid.uuid4().hex[:6]}",
        "current_stock": 1,
    })
    article_id = create_resp.json()["id"]
    await client.delete(f"/api/articles/{article_id}", headers=auth_headers)

    list_resp = await client.get("/api/articles", headers=auth_headers)
    ids = [a["id"] for a in list_resp.json()]
    assert article_id not in ids, "Deleted article must not appear in active list"
```

- [ ] **Step 2: Tests ausführen**

```bash
cd backend && python -m pytest tests/test_articles.py -v
```

Erwartete Ausgabe: alle tests passed (fix any failures found)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_articles.py
git commit -m "test: add article CRUD and routing tests"
```

---

## Task 5: Tests — Buchungen & Rechnungen

**Files:**
- Create: `backend/tests/test_invoices.py`
- Modify: `backend/tests/test_bookings.py` (ergänzen falls Tests fehlen)

- [ ] **Step 1: Lese bestehende test_bookings.py**

```bash
cat backend/tests/test_bookings.py
```

- [ ] **Step 2: Erstelle test_invoices.py**

```python
# backend/tests/test_invoices.py
import pytest
import uuid
from datetime import date, timedelta


async def _create_article(client, auth_headers, stock=10):
    resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": f"InvTest-{uuid.uuid4().hex[:6]}",
        "current_stock": stock,
        "available_quantity": stock,
        "price_per_unit": 50.0,
    })
    assert resp.status_code == 200
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_invoice_without_event_id(client, auth_headers):
    """Invoice creation must succeed without event_id (it's optional)."""
    resp = await client.post("/api/invoices", headers=auth_headers, json={
        "customer_name": f"TestKunde-{uuid.uuid4().hex[:4]}",
        "items": [{"description": "Test", "quantity": 1, "unit_price": 100.0}],
        "total_amount": 100.0,
    })
    assert resp.status_code in (200, 201), f"Invoice creation failed: {resp.text}"
    data = resp.json()
    assert "id" in data


@pytest.mark.asyncio
async def test_create_invoice_with_event_id(client, auth_headers, test_db):
    """Invoice creation with event_id must also work."""
    # Create event first
    event_resp = await client.post("/api/events", headers=auth_headers, json={
        "name": f"TestEvent-{uuid.uuid4().hex[:6]}",
        "start_date": (date.today() + timedelta(days=1)).isoformat(),
        "end_date": (date.today() + timedelta(days=2)).isoformat(),
    })
    event_id = event_resp.json().get("id", "dummy-event-id")

    resp = await client.post("/api/invoices", headers=auth_headers, json={
        "customer_name": "EventKunde",
        "event_id": event_id,
        "items": [{"description": "Event Item", "quantity": 1, "unit_price": 200.0}],
        "total_amount": 200.0,
    })
    assert resp.status_code in (200, 201), f"Invoice with event_id failed: {resp.text}"


@pytest.mark.asyncio
async def test_invoice_list(client, auth_headers):
    """GET /api/invoices returns a list."""
    resp = await client.get("/api/invoices", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_booking_stock_check(client, auth_headers):
    """Booking more than available stock returns 400 with clear message."""
    article_id = await _create_article(client, auth_headers, stock=2)
    start = (date.today() + timedelta(days=5)).isoformat()
    end = (date.today() + timedelta(days=6)).isoformat()

    resp = await client.post("/api/bookings", headers=auth_headers, json={
        "article_id": article_id,
        "quantity": 99,
        "start_date": start,
        "end_date": end,
        "customer_name": "Overbooker",
    })
    assert resp.status_code in (400, 422), f"Expected 400/422 for overbooking, got {resp.status_code}"
    # Error message should mention available quantity
    body = resp.text.lower()
    assert any(word in body for word in ["verfügbar", "available", "stock", "bestand"]), \
        f"Error message not informative enough: {resp.text}"
```

- [ ] **Step 3: Tests ausführen**

```bash
cd backend && python -m pytest tests/test_invoices.py tests/test_bookings.py -v
```

Erwartete Ausgabe: alle passed (fix any failures found)

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_invoices.py backend/tests/test_bookings.py
git commit -m "test: add invoice and booking stock-check tests"
```

---

## Task 6: Tests — Events & Users & CSV-Import

**Files:**
- Create: `backend/tests/test_events_users_csv.py`

- [ ] **Step 1: Erstelle test_events_users_csv.py**

```python
# backend/tests/test_events_users_csv.py
import pytest
import uuid
from datetime import date, timedelta
import io


@pytest.mark.asyncio
async def test_create_event(client, auth_headers):
    """POST /api/events creates a new event."""
    resp = await client.post("/api/events", headers=auth_headers, json={
        "name": f"Testevent-{uuid.uuid4().hex[:6]}",
        "start_date": (date.today() + timedelta(days=1)).isoformat(),
        "end_date": (date.today() + timedelta(days=2)).isoformat(),
    })
    assert resp.status_code in (200, 201), f"Event creation failed: {resp.text}"
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_get_events_list(client, auth_headers):
    """GET /api/events returns a list."""
    resp = await client.get("/api/events", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_pending_users_admin_only(client, auth_headers, test_db):
    """GET /api/admin/pending-users is accessible by admin."""
    resp = await client.get("/api/admin/pending-users", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_csv_import_auto_generates_inventory_code(client, auth_headers):
    """CSV import without inventory_code column auto-generates codes."""
    csv_content = "name,current_stock\nCSV-Artikel-A,5\nCSV-Artikel-B,3\n"
    files = {"file": ("import.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    resp = await client.post("/api/articles/import", headers=auth_headers, files=files)
    assert resp.status_code == 200, f"CSV import failed: {resp.text}"
    data = resp.json()
    assert data.get("imported", 0) >= 1 or data.get("success", False), \
        f"No articles imported: {data}"


@pytest.mark.asyncio
async def test_csv_import_with_inventory_code(client, auth_headers):
    """CSV import with inventory_code uses provided codes."""
    code = f"CSV-{uuid.uuid4().hex[:6].upper()}"
    csv_content = f"name,current_stock,inventory_code\nCSV-Explicit,2,{code}\n"
    files = {"file": ("import2.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    resp = await client.post("/api/articles/import", headers=auth_headers, files=files)
    assert resp.status_code == 200, f"CSV import with code failed: {resp.text}"

    # Verify the article exists with the given code
    list_resp = await client.get("/api/articles", headers=auth_headers)
    codes = [a.get("inventory_code") for a in list_resp.json()]
    assert code in codes, f"Imported article with code {code} not found in list"
```

- [ ] **Step 2: Tests ausführen**

```bash
cd backend && python -m pytest tests/test_events_users_csv.py -v
```

Erwartete Ausgabe: alle passed (fix any failures found)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_events_users_csv.py
git commit -m "test: add events, users and CSV import tests"
```

---

## Task 7: Alle Tests ausführen & Failures fixen

- [ ] **Step 1: Vollständige Test-Suite ausführen**

```bash
cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tee test_results.txt
```

- [ ] **Step 2: Failures analysieren**

```bash
grep -E "FAILED|ERROR" test_results.txt
```

- [ ] **Step 3: Jeden Failure beheben**

Für jeden FAILED Test:
1. Lese den Fehler genau
2. Finde die betroffene Stelle in `server.py` oder dem Testfile
3. Fixe den Bug (in server.py wenn es ein Backend-Bug ist, im Test wenn der Test falsch ist)
4. Führe nur den betroffenen Test erneut aus: `python -m pytest tests/test_xxx.py::test_name -v`

- [ ] **Step 4: Alle Tests grün**

```bash
cd backend && python -m pytest tests/ -v
```

Erwartete Ausgabe: `X passed, 0 failed`

- [ ] **Step 5: Final Commit**

```bash
git add backend/server.py backend/tests/
git commit -m "fix: resolve all failing backend tests"
```
