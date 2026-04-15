# Vollständige Diagnose — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vollständige pytest-Diagnose (Backend + Frontend API-Layer) mit HTML-Report und Ausführungs-Script.

**Architecture:** pytest erweitert auf alle Hauptbereiche (Kategorien, Lieferanten, Kunden, Lager, Fahrzeuge, Wartung, Berichte) + Frontend-Jest-Suite via Subprocess. pytest-html generiert `diagnosis/report.html`. `run-diagnosis.bat`/`run-diagnosis.sh` starten alles mit einem Befehl.

**Tech Stack:** pytest, pytest-html, pytest-asyncio, httpx (AsyncClient), Jest (Frontend), Node.js subprocess

---

## Datei-Übersicht

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `backend/pytest.ini` | Modify | `--html` addopts hinzufügen |
| `backend/diagnosis/` | Create dir | Ausgabeverzeichnis für HTML-Report |
| `backend/tests/test_categories.py` | Create | Kategorien CRUD |
| `backend/tests/test_suppliers.py` | Create | Lieferanten CRUD |
| `backend/tests/test_customers.py` | Create | Kunden CRUD + Soft-Delete |
| `backend/tests/test_storage.py` | Create | Lagerzonen + Lagerorte CRUD + Archiv |
| `backend/tests/test_vehicles.py` | Create | Fahrzeuge CRUD |
| `backend/tests/test_maintenance.py` | Create | Repair-Tickets CRUD |
| `backend/tests/test_reports.py` | Create | Report-Endpunkte |
| `frontend/__tests__/apiService.test.ts` | Create | apiService URL-Logik + Auth-Header |
| `backend/tests/test_frontend_api.py` | Create | Führt Jest-Suite via Subprocess aus |
| `run-diagnosis.bat` | Create | Windows Ausführungs-Script |
| `run-diagnosis.sh` | Create | Pi/Linux Ausführungs-Script |

---

## Kontext für alle Tasks

**Working directory:** `C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main`

**Fixtures** (aus `backend/tests/conftest.py`):
- `client` — AsyncClient gegen Test-DB (scope=session)
- `auth_headers` — `{"Authorization": "Bearer <token>"}` eines Admin-Users (scope=session)
- Test-DB: `inventory_test` (MongoDB, wird nach Session gelöscht)

**Wichtige Eigenheiten der API:**
- Alle Endpunkte unter `/api/` (api_router gemountet)
- Customers: Soft-Delete (`is_active=False`) — nach Delete ist GET by ID noch möglich, aber List zeigt es nicht mehr
- Vehicles: Kein GET by ID — nur List. Update nimmt `dict` als Body, gibt `{"status":"success"}` zurück. Delete gibt `{"status":"deleted"}` zurück.
- Repair-Tickets: Kein DELETE-Endpunkt — nur Create, Read, Update
- Storage Locations: brauchen eine `zone_id` — erst Zone anlegen, dann Location
- Categories: Delete schlägt fehl (400) wenn Artikel der Kategorie zugeordnet sind

---

## Task 1: pytest.ini + diagnosis-Verzeichnis + pytest-html

**Files:**
- Modify: `backend/pytest.ini`
- Create: `backend/diagnosis/.gitkeep`

- [ ] **Step 1: pytest-html installieren**

```bash
cd backend
pip install pytest-html
```

Erwartete Ausgabe: `Successfully installed pytest-html-...`

- [ ] **Step 2: pytest.ini erweitern**

Aktuelle `backend/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = session
asyncio_default_test_loop_scope = session
```

Ersetze durch:
```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = session
asyncio_default_test_loop_scope = session
addopts = --html=diagnosis/report.html --self-contained-html
```

- [ ] **Step 3: diagnosis-Verzeichnis anlegen**

```bash
mkdir -p backend/diagnosis
touch backend/diagnosis/.gitkeep
```

- [ ] **Step 4: Vorhandene Tests prüfen — laufen noch alle durch?**

```bash
cd backend
python -m pytest tests/ -q --ignore=tests/test_frontend_api.py 2>&1 | tail -5
```

Erwartete Ausgabe: `71 passed, 1 skipped` (oder ähnlich, kein FAILED)

- [ ] **Step 5: Prüfen ob HTML-Report generiert wurde**

```bash
ls -la backend/diagnosis/report.html
```

Erwartete Ausgabe: Datei vorhanden, Größe > 0

- [ ] **Step 6: Commit**

```bash
git add backend/pytest.ini backend/diagnosis/.gitkeep
git commit -m "feat: add pytest-html report generation to diagnosis/"
```

---

## Task 2: test_categories.py

**Files:**
- Create: `backend/tests/test_categories.py`

**API-Endpunkte:** `POST /api/categories`, `GET /api/categories`, `GET /api/categories/{id}`, `PUT /api/categories/{id}`, `DELETE /api/categories/{id}`

**Model:** `Category(id, name, description, parent_id, created_at)` — `name` ist Pflichtfeld

- [ ] **Step 1: Testdatei erstellen**

Erstelle `backend/tests/test_categories.py`:

```python
# backend/tests/test_categories.py
"""Tests für Kategorien-CRUD."""
import pytest
import uuid


@pytest.mark.asyncio
async def test_category_crud(client, auth_headers):
    """Vollständiger CRUD-Zyklus für Kategorien."""
    name = f"Testkategorie {uuid.uuid4().hex[:6]}"

    # CREATE
    r = await client.post("/api/categories", json={"name": name, "description": "Testbeschreibung"}, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    cat = r.json()
    cid = cat["id"]
    assert cat["name"] == name

    # READ by ID
    r = await client.get(f"/api/categories/{cid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == cid

    # UPDATE
    r = await client.put(f"/api/categories/{cid}", json={"name": name + " (geändert)", "description": "neu"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["name"] == name + " (geändert)"

    # DELETE
    r = await client.delete(f"/api/categories/{cid}", headers=auth_headers)
    assert r.status_code == 200

    # 404 AFTER DELETE
    r = await client.get(f"/api/categories/{cid}", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_category_list_returns_list(client, auth_headers):
    """GET /categories gibt eine Liste zurück."""
    r = await client.get("/api/categories", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_category_not_found(client, auth_headers):
    """GET mit unbekannter ID → 404."""
    r = await client.get("/api/categories/nonexistent-id-xyz", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_category_requires_name(client, auth_headers):
    """CREATE ohne name → 422 Validation Error."""
    r = await client.post("/api/categories", json={"description": "nur Beschreibung"}, headers=auth_headers)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_category_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/categories")
    assert r.status_code == 401
```

- [ ] **Step 2: Tests ausführen**

```bash
cd backend
python -m pytest tests/test_categories.py -v
```

Erwartete Ausgabe: alle 5 Tests PASSED

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_categories.py
git commit -m "test: add category CRUD tests"
```

---

## Task 3: test_suppliers.py

**Files:**
- Create: `backend/tests/test_suppliers.py`

**API-Endpunkte:** `POST /api/suppliers`, `GET /api/suppliers`, `GET /api/suppliers/{id}`, `PUT /api/suppliers/{id}`, `DELETE /api/suppliers/{id}`

**Model:** `SupplierCreate(name, contact_person, email, phone, address, website, notes)` — `name` Pflichtfeld

- [ ] **Step 1: Testdatei erstellen**

Erstelle `backend/tests/test_suppliers.py`:

```python
# backend/tests/test_suppliers.py
"""Tests für Lieferanten-CRUD."""
import pytest
import uuid


@pytest.mark.asyncio
async def test_supplier_crud(client, auth_headers):
    """Vollständiger CRUD-Zyklus für Lieferanten."""
    name = f"Test Lieferant {uuid.uuid4().hex[:6]}"

    # CREATE
    r = await client.post("/api/suppliers", json={
        "name": name,
        "contact_person": "Max Muster",
        "email": "max@test.de",
        "phone": "0123456789",
    }, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    sup = r.json()
    sid = sup["id"]
    assert sup["name"] == name

    # READ by ID
    r = await client.get(f"/api/suppliers/{sid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == sid

    # UPDATE
    r = await client.put(f"/api/suppliers/{sid}", json={
        "name": name + " (geändert)",
        "contact_person": "Erika Muster",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["name"] == name + " (geändert)"

    # DELETE
    r = await client.delete(f"/api/suppliers/{sid}", headers=auth_headers)
    assert r.status_code == 200

    # 404 AFTER DELETE
    r = await client.get(f"/api/suppliers/{sid}", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_supplier_list_returns_list(client, auth_headers):
    """GET /suppliers gibt eine Liste zurück."""
    r = await client.get("/api/suppliers", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_supplier_not_found(client, auth_headers):
    """GET mit unbekannter ID → 404."""
    r = await client.get("/api/suppliers/nonexistent-id-xyz", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_supplier_requires_name(client, auth_headers):
    """CREATE ohne name → 422 Validation Error."""
    r = await client.post("/api/suppliers", json={"contact_person": "Jemand"}, headers=auth_headers)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_supplier_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/suppliers")
    assert r.status_code == 401
```

- [ ] **Step 2: Tests ausführen**

```bash
cd backend
python -m pytest tests/test_suppliers.py -v
```

Erwartete Ausgabe: alle 5 Tests PASSED

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_suppliers.py
git commit -m "test: add supplier CRUD tests"
```

---

## Task 4: test_customers.py

**Files:**
- Create: `backend/tests/test_customers.py`

**API-Endpunkte:** `POST /api/customers`, `GET /api/customers`, `GET /api/customers/{id}`, `PUT /api/customers/{id}`, `DELETE /api/customers/{id}`

**Wichtig:** DELETE ist ein Soft-Delete (`is_active=False`). GET by ID gibt den Kunden weiterhin zurück. GET List schließt inaktive Kunden aus (`{"is_active": True}` filter).

- [ ] **Step 1: Testdatei erstellen**

Erstelle `backend/tests/test_customers.py`:

```python
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
```

- [ ] **Step 2: Tests ausführen**

```bash
cd backend
python -m pytest tests/test_customers.py -v
```

Erwartete Ausgabe: alle 6 Tests PASSED

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_customers.py
git commit -m "test: add customer CRUD tests (incl. soft-delete)"
```

---

## Task 5: test_storage.py

**Files:**
- Create: `backend/tests/test_storage.py`

**API-Endpunkte:**
- Zonen: `POST /api/storage-zones`, `GET /api/storage-zones`, `PUT /api/storage-zones/{id}`, `DELETE /api/storage-zones/{id}`
- Orte: `POST /api/storage-locations`, `GET /api/storage-locations`, `PUT /api/storage-locations/{id}`, `DELETE /api/storage-locations/{id}`, `POST /api/storage-locations/{id}/archive`, `POST /api/storage-locations/{id}/unarchive`

**Wichtig:** `StorageLocation` braucht `zone_id` — erst Zone anlegen.

- [ ] **Step 1: Testdatei erstellen**

Erstelle `backend/tests/test_storage.py`:

```python
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
```

- [ ] **Step 2: Tests ausführen**

```bash
cd backend
python -m pytest tests/test_storage.py -v
```

Erwartete Ausgabe: alle 5 Tests PASSED

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_storage.py
git commit -m "test: add storage zones and locations tests (incl. archive)"
```

---

## Task 6: test_vehicles.py

**Files:**
- Create: `backend/tests/test_vehicles.py`

**API-Endpunkte:** `GET /api/vehicles`, `POST /api/vehicles`, `PUT /api/vehicles/{id}`, `DELETE /api/vehicles/{id}`

**Wichtig:**
- Kein GET by ID-Endpunkt — nur die Liste prüfen
- PUT nimmt einen freien `dict` als Body (kein Schema), gibt `{"status": "success"}` zurück
- DELETE gibt `{"status": "deleted"}` zurück

- [ ] **Step 1: Testdatei erstellen**

Erstelle `backend/tests/test_vehicles.py`:

```python
# backend/tests/test_vehicles.py
"""Tests für Fahrzeuge-CRUD."""
import pytest
import uuid


@pytest.mark.asyncio
async def test_vehicle_crud(client, auth_headers):
    """Vollständiger CRUD-Zyklus für Fahrzeuge (ohne GET by ID)."""
    plate = f"HH-TEST-{uuid.uuid4().hex[:4].upper()}"

    # CREATE
    r = await client.post("/api/vehicles", json={
        "name": f"Testfahrzeug {plate}",
        "license_plate": plate,
        "brand": "VW",
        "model_name": "Transporter",
        "fuel_type": "Diesel",
        "status": "verfügbar",
    }, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    vehicle = r.json()
    vid = vehicle["id"]
    assert vehicle["license_plate"] == plate

    # Verify in list
    r = await client.get("/api/vehicles", headers=auth_headers)
    assert r.status_code == 200
    ids_in_list = [v["id"] for v in r.json()]
    assert vid in ids_in_list, "Fahrzeug nicht in Liste gefunden"

    # UPDATE
    r = await client.put(f"/api/vehicles/{vid}", json={
        "status": "in_wartung",
        "notes": "TÜV fällig",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json().get("status") == "success"

    # DELETE
    r = await client.delete(f"/api/vehicles/{vid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json().get("status") == "deleted"

    # Verify removed from list
    r = await client.get("/api/vehicles", headers=auth_headers)
    ids_after = [v["id"] for v in r.json()]
    assert vid not in ids_after, "Gelöschtes Fahrzeug noch in Liste"


@pytest.mark.asyncio
async def test_vehicle_list_returns_list(client, auth_headers):
    """GET /vehicles gibt eine Liste zurück."""
    r = await client.get("/api/vehicles", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_vehicle_delete_not_found(client, auth_headers):
    """DELETE mit unbekannter ID → 404."""
    r = await client.delete("/api/vehicles/nonexistent-id-xyz", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_vehicle_requires_name(client, auth_headers):
    """CREATE ohne name → 422."""
    r = await client.post("/api/vehicles", json={"license_plate": "HH-X-1"}, headers=auth_headers)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_vehicle_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/vehicles")
    assert r.status_code == 401
```

- [ ] **Step 2: Tests ausführen**

```bash
cd backend
python -m pytest tests/test_vehicles.py -v
```

Erwartete Ausgabe: alle 5 Tests PASSED

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_vehicles.py
git commit -m "test: add vehicle CRUD tests"
```

---

## Task 7: test_maintenance.py

**Files:**
- Create: `backend/tests/test_maintenance.py`

**API-Endpunkte:** `POST /api/repair-tickets`, `GET /api/repair-tickets`, `GET /api/repair-tickets/{id}`, `PUT /api/repair-tickets/{id}`

**Wichtig:**
- Kein DELETE-Endpunkt für Repair-Tickets
- CREATE braucht eine gültige `article_id` (erstellt auch einen Maintenance-Task in der DB)
- PUT nimmt Query-Parameter (`status`, `assigned_to`, `repair_notes`, etc.) — kein JSON-Body
- GET by ID gibt auch `article`-Info zurück

- [ ] **Step 1: Hilfsfunktion und Testdatei erstellen**

Erstelle `backend/tests/test_maintenance.py`:

```python
# backend/tests/test_maintenance.py
"""Tests für Repair-Tickets (Wartung/Reparatur)."""
import pytest
import uuid


async def create_article_for_repair(client, auth_headers) -> dict:
    """Erstellt einen Artikel für Repair-Ticket-Tests."""
    code = uuid.uuid4().hex[:8]
    r = await client.post("/api/articles", json={
        "name": f"Reparatur-Artikel {code}",
        "inventory_code": f"REP-{code}",
        "category": "test",
        "current_stock": 1,
    }, headers=auth_headers)
    assert r.status_code in (200, 201), f"Artikel CREATE fehlgeschlagen: {r.text}"
    return r.json()


@pytest.mark.asyncio
async def test_repair_ticket_create_and_read(client, auth_headers):
    """Repair-Ticket anlegen und lesen."""
    article = await create_article_for_repair(client, auth_headers)

    # CREATE
    r = await client.post("/api/repair-tickets", json={
        "article_id": article["id"],
        "title": "Defekter Stecker",
        "description": "Der Stecker ist abgebrochen.",
        "defect_type": "mechanical",
        "severity": "medium",
    }, headers=auth_headers)
    assert r.status_code == 200, f"CREATE fehlgeschlagen: {r.text}"
    ticket = r.json()
    tid = ticket["id"]
    assert ticket["article_id"] == article["id"]
    assert "ticket_number" in ticket

    # READ by ID
    r = await client.get(f"/api/repair-tickets/{tid}", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == tid
    assert "article" in data  # GET by ID liefert auch Artikel-Info


@pytest.mark.asyncio
async def test_repair_ticket_list(client, auth_headers):
    """GET /repair-tickets gibt eine Liste zurück."""
    r = await client.get("/api/repair-tickets", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_repair_ticket_update_status(client, auth_headers):
    """Status eines Tickets auf 'in_progress' ändern."""
    article = await create_article_for_repair(client, auth_headers)

    r = await client.post("/api/repair-tickets", json={
        "article_id": article["id"],
        "title": "Kratzer am Gehäuse",
        "description": "Optischer Defekt.",
        "severity": "low",
    }, headers=auth_headers)
    assert r.status_code == 200
    tid = r.json()["id"]

    # UPDATE: Status → in_progress (Query-Parameter!)
    r = await client.put(f"/api/repair-tickets/{tid}?status=in_progress", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["ticket_id"] == tid

    # Verify
    r = await client.get(f"/api/repair-tickets/{tid}", headers=auth_headers)
    assert r.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_repair_ticket_invalid_article(client, auth_headers):
    """Ticket mit unbekannter article_id → 404."""
    r = await client.post("/api/repair-tickets", json={
        "article_id": "nonexistent-article-id",
        "title": "Test",
        "description": "Test",
    }, headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_repair_ticket_not_found(client, auth_headers):
    """GET mit unbekannter Ticket-ID → 404."""
    r = await client.get("/api/repair-tickets/nonexistent-ticket-id", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_repair_ticket_unauthenticated(client):
    """Ohne Token kein Zugriff."""
    r = await client.get("/api/repair-tickets")
    assert r.status_code == 401
```

- [ ] **Step 2: Tests ausführen**

```bash
cd backend
python -m pytest tests/test_maintenance.py -v
```

Erwartete Ausgabe: alle 6 Tests PASSED

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_maintenance.py
git commit -m "test: add repair ticket tests"
```

---

## Task 8: test_reports.py

**Files:**
- Create: `backend/tests/test_reports.py`

**API-Endpunkte:**
- `GET /api/reports/inventory` → JSON mit `{total_items, generated_at, items}`
- `GET /api/reports/inventory-csv` → CSV-Text (`text/csv`)
- `GET /api/reports/customers` → JSON mit `{total_customers, generated_at, customers}`
- `GET /api/reports/customers-csv` → CSV-Text
- `GET /api/reports/monthly` → JSON mit monatlichen Daten

- [ ] **Step 1: Testdatei erstellen**

Erstelle `backend/tests/test_reports.py`:

```python
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
```

- [ ] **Step 2: Tests ausführen**

```bash
cd backend
python -m pytest tests/test_reports.py -v
```

Erwartete Ausgabe: alle 6 Tests PASSED

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_reports.py
git commit -m "test: add report endpoint tests"
```

---

## Task 9: Frontend apiService Jest-Tests + test_frontend_api.py

**Files:**
- Create: `frontend/__tests__/apiService.test.ts`
- Create: `backend/tests/test_frontend_api.py`

**Zweck:** Prüft `frontend/services/apiService.ts` — korrekte Standard-URL, Override via `setBackendUrl()`, Auth-Header-Anhängung.

- [ ] **Step 1: Jest-Test für apiService erstellen**

Erstelle `frontend/__tests__/apiService.test.ts`:

```typescript
// frontend/__tests__/apiService.test.ts
/**
 * Tests für apiService.ts — URL-Logik und Auth-Header
 */
import { getBackendUrl, setBackendUrl } from '../services/apiService';

describe('apiService URL-Logik', () => {
  afterEach(() => {
    // Reset runtime override nach jedem Test
    setBackendUrl('http://localhost:8002');
  });

  it('getBackendUrl() gibt Standard-URL zurück', () => {
    // Nach Reset soll Standard-URL gelten
    const url = getBackendUrl();
    expect(url).toMatch(/^http/);
    expect(url).not.toContain(' ');
    expect(url).not.toContain(undefined as any);
  });

  it('setBackendUrl() überschreibt die URL', () => {
    setBackendUrl('http://192.168.1.100:8002');
    expect(getBackendUrl()).toBe('http://192.168.1.100:8002');
  });

  it('setBackendUrl() entfernt trailing slash', () => {
    setBackendUrl('http://192.168.1.100:8002/');
    expect(getBackendUrl()).toBe('http://192.168.1.100:8002');
  });

  it('getBackendUrl() gibt keine undefined oder leere URL zurück', () => {
    const url = getBackendUrl();
    expect(url).toBeTruthy();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2: Jest-Test lokal ausführen**

```bash
cd frontend
npx jest __tests__/apiService.test.ts --no-coverage
```

Erwartete Ausgabe: `4 passed`

Falls Tests fehlschlagen wegen Import-Problemen: prüfen ob `frontend/__mocks__/expo-constants.js` `expoConfig.extra.EXPO_PUBLIC_BACKEND_URL` enthält. Falls nicht, ergänzen:
```javascript
// frontend/__mocks__/expo-constants.js (falls Datei existiert, anpassen)
module.exports = {
  default: {
    expoConfig: {
      extra: { EXPO_PUBLIC_BACKEND_URL: 'http://localhost:8002' },
    },
  },
};
```

- [ ] **Step 3: pytest-Wrapper erstellen**

Erstelle `backend/tests/test_frontend_api.py`:

```python
# backend/tests/test_frontend_api.py
"""
Führt die Frontend Jest-Tests als Teil der Gesamtdiagnose aus.
Braucht Node.js + npm (im frontend/-Verzeichnis).
"""
import subprocess
import os
import pytest


FRONTEND_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend"
)


def test_frontend_jest_suite():
    """Frontend Jest-Tests (apiService URL-Logik) via Subprocess."""
    frontend_path = os.path.normpath(FRONTEND_DIR)
    
    if not os.path.isdir(frontend_path):
        pytest.skip(f"Frontend-Verzeichnis nicht gefunden: {frontend_path}")
    
    result = subprocess.run(
        ["npx", "jest", "__tests__/apiService.test.ts", "--no-coverage", "--forceExit", "--ci"],
        cwd=frontend_path,
        capture_output=True,
        text=True,
        timeout=120,
        shell=True,  # Windows-kompatibel
    )
    
    output = result.stdout + "\n" + result.stderr
    assert result.returncode == 0, (
        f"Frontend Jest-Tests fehlgeschlagen (exit code {result.returncode}):\n{output}"
    )
```

- [ ] **Step 4: pytest-Wrapper ausführen**

```bash
cd backend
python -m pytest tests/test_frontend_api.py -v -s
```

Erwartete Ausgabe: `PASSED tests/test_frontend_api.py::test_frontend_jest_suite`

- [ ] **Step 5: Commit**

```bash
git add frontend/__tests__/apiService.test.ts backend/tests/test_frontend_api.py
git commit -m "test: add apiService Jest tests + pytest frontend wrapper"
```

---

## Task 10: Ausführungs-Scripts

**Files:**
- Create: `run-diagnosis.bat` (Projekt-Root)
- Create: `run-diagnosis.sh` (Projekt-Root)

- [ ] **Step 1: run-diagnosis.bat erstellen**

Erstelle `run-diagnosis.bat` im Projekt-Root (`C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main\`):

```bat
@echo off
setlocal enabledelayedexpansion
echo ============================================
echo   Inventar Pro -- Vollstaendige Diagnose
echo ============================================
echo.

cd /d "%~dp0backend"

echo [1/3] pytest-html installieren (falls noetig)...
pip install pytest-html -q
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: pip install fehlgeschlagen
    exit /b 1
)

echo [2/3] Tests ausfuehren...
echo.
python -m pytest tests/ -v
set EXIT=%ERRORLEVEL%
echo.

echo [3/3] HTML-Report...
if exist diagnosis\report.html (
    echo Report: %~dp0backend\diagnosis\report.html
    start "" "%~dp0backend\diagnosis\report.html"
) else (
    echo Kein Report generiert.
)

echo.
echo ============================================
if %EXIT%==0 (
    echo   Ergebnis: ALLE TESTS BESTANDEN
) else (
    echo   Ergebnis: TESTS FEHLGESCHLAGEN -- Report pruefen
)
echo ============================================
exit /b %EXIT%
```

- [ ] **Step 2: run-diagnosis.sh erstellen**

Erstelle `run-diagnosis.sh` im Projekt-Root:

```bash
#!/bin/bash
set -e
echo "============================================"
echo "  Inventar Pro -- Vollständige Diagnose"
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

echo "[1/3] pytest-html installieren (falls nötig)..."
pip install pytest-html -q

echo "[2/3] Tests ausführen..."
echo ""
python3 -m pytest tests/ -v
EXIT=$?
echo ""

echo "[3/3] HTML-Report:"
if [ -f "diagnosis/report.html" ]; then
    echo "  $SCRIPT_DIR/backend/diagnosis/report.html"
else
    echo "  Kein Report generiert."
fi

echo ""
echo "============================================"
if [ $EXIT -eq 0 ]; then
    echo "  Ergebnis: ALLE TESTS BESTANDEN ✅"
else
    echo "  Ergebnis: TESTS FEHLGESCHLAGEN ❌ -- Report prüfen"
fi
echo "============================================"
exit $EXIT
```

- [ ] **Step 3: run-diagnosis.bat testen**

```bat
cd C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main
run-diagnosis.bat
```

Erwartete Terminal-Ausgabe am Ende: `Ergebnis: ALLE TESTS BESTANDEN`
Erwartetes Verhalten: Browser öffnet `diagnosis/report.html`

- [ ] **Step 4: Gesamtzahl der Tests prüfen**

```bash
cd backend
python -m pytest tests/ --collect-only -q 2>&1 | tail -3
```

Erwartete Ausgabe: mindestens `110 tests collected`

- [ ] **Step 5: Commit**

```bash
git add run-diagnosis.bat run-diagnosis.sh
git commit -m "feat: add run-diagnosis scripts (bat + sh) with HTML report"
```

---

## Task 11: Gesamtlauf + Abschluss-Verifikation

- [ ] **Step 1: Alle Tests komplett durchlaufen**

```bash
cd backend
python -m pytest tests/ -v 2>&1 | tail -10
```

Erwartete Ausgabe:
```
==================== X passed, Y skipped in Z.Xs ====================
```
Kein `FAILED`.

- [ ] **Step 2: HTML-Report öffnen und prüfen**

```bash
ls -la backend/diagnosis/report.html
```

Öffne `backend/diagnosis/report.html` im Browser — alle Tests sollten grün sein.

- [ ] **Step 3: Commit (falls noch nicht alles committed)**

```bash
git add -A
git status
# Nur committen wenn wirklich noch Änderungen offen sind
git commit -m "test: vollständige Diagnose komplett (alle Tests grün)"
```
