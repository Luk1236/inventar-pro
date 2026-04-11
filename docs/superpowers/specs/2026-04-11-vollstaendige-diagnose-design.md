# Vollständige Diagnose — Design Spec

**Datum:** 2026-04-11
**Scope:** Full-Stack Diagnose mit pytest (Backend + Frontend API-Layer), HTML-Report, Ausführungs-Script

---

## Ziel

Ein einziger Befehl (`run-diagnosis.bat` / `run-diagnosis.sh`) führt die vollständige Diagnose durch und öffnet einen HTML-Report. Die Diagnose prüft:
1. Alle Backend-API-Bereiche (Happy Path + Fehlerfall)
2. Die Frontend API-Service-Schicht (`apiService.ts` — URL-Logik, Auth-Header)

---

## Architektur

```
backend/
├── tests/
│   ├── conftest.py                   ← vorhanden (fixtures: client, auth_headers)
│   ├── test_articles.py              ← vorhanden, ausreichend
│   ├── test_bookings.py              ← vorhanden, ausreichend
│   ├── test_auth.py                  ← vorhanden, ausreichend
│   ├── test_dashboard.py             ← vorhanden, ausreichend
│   ├── test_events_users_csv.py      ← vorhanden, ausreichend
│   ├── test_invoices.py              ← vorhanden, erweitern
│   ├── test_new_features.py          ← vorhanden, bleibt
│   ├── test_rental_calculation.py    ← vorhanden, bleibt
│   ├── test_packing_list.py          ← vorhanden, bleibt
│   ├── test_consumable.py            ← vorhanden, bleibt
│   ├── test_websocket.py             ← vorhanden, bleibt
│   ├── test_scanner.py               ← vorhanden, bleibt
│   ├── test_customers.py             ← NEU
│   ├── test_storage.py               ← NEU
│   ├── test_categories.py            ← NEU
│   ├── test_suppliers.py             ← NEU
│   ├── test_vehicles.py              ← NEU
│   ├── test_maintenance.py           ← NEU
│   ├── test_reports.py               ← NEU
│   └── test_frontend_api.py          ← NEU (Frontend API-Layer via Node.js)
├── pytest.ini                        ← erweitern (pytest-html addopts)
└── diagnosis/
    └── report.html                   ← generiert von pytest-html

run-diagnosis.bat                     ← NEU (Windows)
run-diagnosis.sh                      ← NEU (Pi/Linux)
```

---

## Testmuster

Alle neuen CRUD-Testdateien folgen exakt diesem Muster:

```python
@pytest.mark.asyncio
async def test_<resource>_crud(client, auth_headers):
    # CREATE
    r = await client.post("/api/<resource>", json={<minimal valid payload>}, headers=auth_headers)
    assert r.status_code == 200
    rid = r.json()["id"]

    # READ
    r = await client.get(f"/api/<resource>/{rid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == rid

    # UPDATE
    r = await client.put(f"/api/<resource>/{rid}", json={<update payload>}, headers=auth_headers)
    assert r.status_code == 200

    # DELETE
    r = await client.delete(f"/api/<resource>/{rid}", headers=auth_headers)
    assert r.status_code == 200

    # 404 AFTER DELETE
    r = await client.get(f"/api/<resource>/{rid}", headers=auth_headers)
    assert r.status_code == 404
```

Zusätzlich pro Bereich: mindestens ein Fehlerfall (z.B. ungültige ID, fehlende Pflichtfelder, Zugriff ohne Auth).

---

## Neue Testdateien — Details

### test_customers.py
Endpunkte: `POST /api/customers`, `GET /api/customers`, `GET /api/customers/{id}`, `PUT /api/customers/{id}`, `DELETE /api/customers/{id}`

Testfälle:
- `test_customer_crud` — vollständiger CRUD-Zyklus
- `test_customer_list_returns_list` — GET gibt Liste zurück
- `test_customer_not_found` — GET mit unbekannter ID → 404

### test_storage.py
Endpunkte: `POST /api/storage-locations`, `GET /api/storage-locations`, `GET /api/storage-locations/{id}`, `PUT /api/storage-locations/{id}`, `DELETE /api/storage-locations/{id}`, `POST /api/storage-locations/{id}/archive`, `POST /api/storage-locations/{id}/unarchive`

Testfälle:
- `test_storage_location_crud` — vollständiger CRUD-Zyklus
- `test_storage_location_archive_unarchive` — archivieren → prüfen → dearchivieren → prüfen
- `test_storage_location_not_found` — GET mit unbekannter ID → 404

### test_categories.py
Endpunkte: `POST /api/categories`, `GET /api/categories`, `GET /api/categories/{id}`, `PUT /api/categories/{id}`, `DELETE /api/categories/{id}`

Testfälle:
- `test_category_crud` — vollständiger CRUD-Zyklus
- `test_category_list_returns_list` — GET gibt Liste zurück
- `test_duplicate_category_name` — zweimal gleicher Name → 400 oder 200 (je nach Implementierung)

### test_suppliers.py
Endpunkte: `POST /api/suppliers`, `GET /api/suppliers`, `GET /api/suppliers/{id}`, `PUT /api/suppliers/{id}`, `DELETE /api/suppliers/{id}`

Testfälle:
- `test_supplier_crud` — vollständiger CRUD-Zyklus
- `test_supplier_list_returns_list` — GET gibt Liste zurück
- `test_supplier_not_found` — GET mit unbekannter ID → 404

### test_vehicles.py
Endpunkte: `POST /api/vehicles`, `GET /api/vehicles`, `GET /api/vehicles/{id}`, `PUT /api/vehicles/{id}`, `DELETE /api/vehicles/{id}`

Testfälle:
- `test_vehicle_crud` — vollständiger CRUD-Zyklus
- `test_vehicle_list_returns_list` — GET gibt Liste zurück
- `test_vehicle_not_found` — GET mit unbekannter ID → 404

### test_maintenance.py
Endpunkte: `POST /api/repair-tickets`, `GET /api/repair-tickets`, `GET /api/repair-tickets/{id}`, `PUT /api/repair-tickets/{id}`, `DELETE /api/repair-tickets/{id}`

Testfälle:
- `test_repair_ticket_crud` — vollständiger CRUD-Zyklus
- `test_repair_ticket_list_returns_list` — GET gibt Liste zurück
- `test_repair_ticket_not_found` — 404 bei unbekannter ID

### test_reports.py
Endpunkte: `GET /api/reports/inventory`, `GET /api/reports/inventory-csv`, `GET /api/reports/customers`, `GET /api/reports/monthly`

Testfälle:
- `test_inventory_report_returns_data` — Antwort ist JSON mit Inventarliste
- `test_inventory_csv_returns_csv` — Content-Type ist text/csv
- `test_customers_report_returns_data` — Antwort ist JSON
- `test_monthly_report_returns_data` — Antwort ist JSON

### test_frontend_api.py
Prüft die `frontend/services/apiService.ts` Logik über `npx ts-node`:

Testfälle:
- `test_default_backend_url` — `getBackendUrl()` gibt `http://localhost:8002` zurück
- `test_set_backend_url_override` — `setBackendUrl("http://pi:8002")` → `getBackendUrl()` gibt neuen Wert zurück
- `test_auth_header_attached` — Login-Token wird als `Authorization: Bearer <token>` angehängt
- `test_api_prefix_correct` — alle Requests gehen an `/api/` Prefix

---

## pytest.ini Erweiterung

```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = session
asyncio_default_test_loop_scope = session
addopts = --html=diagnosis/report.html --self-contained-html
```

---

## run-diagnosis.bat (Windows)

```bat
@echo off
echo === Inventar Pro — Vollständige Diagnose ===
echo.
cd backend

echo [1/3] pytest-html installieren (falls nötig)...
pip install pytest-html -q

echo [2/3] Tests ausführen...
python -m pytest tests/ -v
set EXIT=%ERRORLEVEL%

echo [3/3] Report öffnen...
if exist diagnosis\report.html (
    start diagnosis\report.html
    echo Report: backend\diagnosis\report.html
) else (
    echo Kein Report generiert.
)

echo.
if %EXIT%==0 (
    echo ✅ Alle Tests bestanden.
) else (
    echo ❌ Tests fehlgeschlagen — Report prüfen.
)
exit /b %EXIT%
```

---

## run-diagnosis.sh (Pi/Linux)

```bash
#!/bin/bash
set -e
echo "=== Inventar Pro — Vollständige Diagnose ==="
cd "$(dirname "$0")/backend"

echo "[1/3] pytest-html installieren (falls nötig)..."
pip install pytest-html -q

echo "[2/3] Tests ausführen..."
python3 -m pytest tests/ -v
EXIT=$?

echo "[3/3] Report-Pfad:"
echo "  $(pwd)/diagnosis/report.html"

echo ""
if [ $EXIT -eq 0 ]; then
    echo "✅ Alle Tests bestanden."
else
    echo "❌ Tests fehlgeschlagen — Report prüfen."
fi
exit $EXIT
```

---

## Erfolgskriterien

- [ ] Alle vorhandenen 71 Tests bestehen weiterhin
- [ ] Mindestens 110 Tests insgesamt nach Erweiterung
- [ ] `diagnosis/report.html` wird nach jedem Lauf generiert
- [ ] `run-diagnosis.bat` läuft auf Windows ohne manuelle Schritte
- [ ] `run-diagnosis.sh` läuft auf Raspberry Pi ohne manuelle Schritte
- [ ] Storage Location Archive-Test schlägt nicht mehr fehl (Bug bereits behoben)
