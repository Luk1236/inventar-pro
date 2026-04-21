# Bug-Fix Verification Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verifiziere alle 6 Bug-Fixes durch automatisierte Tests und manuelle Syntax-Checks.

**Architecture:** Bestehende pytest-Infrastruktur erweitern (`backend/tests/`), neue Test-Dateien für v1-Router und fix_encoding.py, Syntax-Checks für Electron und Shell-Skript.

**Tech Stack:** pytest 8.4.1, pytest-asyncio 0.23.8, httpx 0.27.0, motor 3.3.1, Node.js (syntax check), bash -n (syntax check)

---

## Voraussetzungen

MongoDB muss lokal laufen: `mongod` auf `localhost:27017`.
Tests laufen in der separaten `inventory_test` DB — keine Produktionsdaten betroffen.

Alle Befehle aus dem Verzeichnis `Final-main/backend/` ausführen.

---

## Task 1: Bug 1 — N+1 Query: Test mit echten Daten

**Files:**
- Modify: `backend/tests/test_dashboard.py`

Das bestehende `test_top_rented_articles_format` prüft nur die Struktur bei leerer DB. Wir brauchen einen Test, der echte Buchungsdaten anlegt und prüft, ob der Artikelname korrekt per `$lookup` aufgelöst wird (nicht "Unbekannt").

- [ ] **Step 1: Test hinzufügen**

Füge am Ende von `backend/tests/test_dashboard.py` hinzu:

```python
import uuid as _uuid

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
```

- [ ] **Step 2: Test ausführen**

```bash
cd "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/backend"
python -m pytest tests/test_dashboard.py -v
```

Erwartetes Ergebnis:
```
tests/test_dashboard.py::test_dashboard_stats_new_fields PASSED
tests/test_dashboard.py::test_top_rented_articles_format PASSED
tests/test_dashboard.py::test_top_rented_resolves_article_name PASSED
```

---

## Task 2: Bug 4 — UUID Constraint: Routing-Tests

**Files:**
- Modify: `backend/tests/test_articles.py`

- [ ] **Step 1: Bestehende test_articles.py lesen**

Öffne `backend/tests/test_articles.py` und suche nach der letzten Testfunktion, um Anhängepunkt zu finden.

- [ ] **Step 2: Tests hinzufügen**

Füge am Ende von `backend/tests/test_articles.py` hinzu:

```python
# ── UUID Constraint Tests (Bug 4) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_articles_archived_returns_200(client, auth_headers):
    """/articles/archived darf NICHT als article_id interpretiert werden."""
    resp = await client.get("/api/articles/archived", headers=auth_headers)
    assert resp.status_code == 200, (
        f"Erwartet 200, bekommen {resp.status_code}. "
        "Fehler: 'archived' wird als article_id interpretiert."
    )
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_article_invalid_uuid_returns_422(client, auth_headers):
    """Nicht-UUID article_id muss 422 zurückgeben (FastAPI-Validierung)."""
    resp = await client.get("/api/articles/not-a-valid-uuid", headers=auth_headers)
    assert resp.status_code == 422, (
        f"Erwartet 422 Unprocessable Entity, bekommen {resp.status_code}. "
        "Fehler: UUID-Constraint fehlt oder ist falsch konfiguriert."
    )


@pytest.mark.asyncio
async def test_article_valid_uuid_returns_200_or_404(client, auth_headers):
    """Gültige UUID als article_id muss 200 oder 404 zurückgeben (nie 422)."""
    import uuid
    valid_uuid = str(uuid.uuid4())
    resp = await client.get(f"/api/articles/{valid_uuid}", headers=auth_headers)
    assert resp.status_code in (200, 404), (
        f"Erwartet 200 oder 404, bekommen {resp.status_code}. "
        "Fehler: Gültige UUID wird abgelehnt."
    )
```

- [ ] **Step 3: Tests ausführen**

```bash
cd "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/backend"
python -m pytest tests/test_articles.py -v -k "uuid or archived"
```

Erwartetes Ergebnis:
```
tests/test_articles.py::test_articles_archived_returns_200 PASSED
tests/test_articles.py::test_article_invalid_uuid_returns_422 PASSED
tests/test_articles.py::test_article_valid_uuid_returns_200_or_404 PASSED
```

---

## Task 3: Bug 2 — v1 Router Alias: Neue Testdatei

**Files:**
- Create: `backend/tests/test_v1_router.py`

- [ ] **Step 1: Testdatei erstellen**

Erstelle `backend/tests/test_v1_router.py`:

```python
# backend/tests/test_v1_router.py
"""Verifiziert, dass /api/v1/ Routen existieren und korrekte Metadaten haben."""
import pytest


@pytest.mark.asyncio
async def test_v1_articles_returns_same_as_v0(client, auth_headers):
    """/api/v1/articles muss dieselbe Antwort liefern wie /api/articles."""
    resp_v0 = await client.get("/api/articles", headers=auth_headers)
    resp_v1 = await client.get("/api/v1/articles", headers=auth_headers)

    assert resp_v0.status_code == 200, f"/api/articles: {resp_v0.status_code}"
    assert resp_v1.status_code == 200, (
        f"/api/v1/articles: {resp_v1.status_code}. "
        "Fehler: v1 Route ist nicht registriert."
    )
    assert resp_v0.json() == resp_v1.json(), (
        "v0 und v1 liefern unterschiedliche Daten!"
    )


@pytest.mark.asyncio
async def test_v1_openapi_has_response_model(client):
    """OpenAPI-Schema unter /api/v1/ muss response_model-Infos enthalten."""
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()

    paths = schema.get("paths", {})

    # Prüfe, dass /api/v1/articles in der OpenAPI-Spec vorhanden ist
    v1_path = "/api/v1/articles"
    assert v1_path in paths, (
        f"{v1_path} fehlt in OpenAPI-Spec. "
        "Fehler: v1 Router wurde nicht registriert oder Metadaten gehen verloren."
    )

    # Prüfe, dass die Route ein response-Schema hat (kein leeres {})
    get_op = paths[v1_path].get("get", {})
    responses = get_op.get("responses", {})
    assert "200" in responses, f"Keine 200-Antwort definiert für {v1_path}"
    response_200 = responses["200"]
    # Wenn response_model korrekt kopiert wurde, gibt es einen content-Block
    assert "content" in response_200, (
        f"Kein 'content' in 200-Antwort für {v1_path}. "
        "Fehler: response_model wurde beim Kopieren der Route nicht übertragen."
    )
```

- [ ] **Step 2: Tests ausführen**

```bash
cd "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/backend"
python -m pytest tests/test_v1_router.py -v
```

Erwartetes Ergebnis:
```
tests/test_v1_router.py::test_v1_articles_returns_same_as_v0 PASSED
tests/test_v1_router.py::test_v1_openapi_has_response_model PASSED
```

---

## Task 4: Bug 3 — fix_encoding.py: Unit-Tests

**Files:**
- Create: `backend/tests/test_fix_encoding.py`

- [ ] **Step 1: Testdatei erstellen**

Erstelle `backend/tests/test_fix_encoding.py`:

```python
# backend/tests/test_fix_encoding.py
"""Unit-Tests für fix_encoding.py — Dry-Run, Checkpoint, Logging."""
import json
import os
import sys
import asyncio
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch, call

# fix_encoding.py liegt in backend/, nicht in tests/
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_dry_run_does_not_write(tmp_path, monkeypatch):
    """--dry-run darf keine update_one-Aufrufe auslösen."""
    import fix_encoding

    # Mock-Collection mit einem Dokument das gefixt werden muss
    doc = {"_id": "507f1f77bcf86cd799439011", "name": "caf\u00e3©"}  # double-encoded
    mock_coll = MagicMock()
    mock_coll.find.return_value.__aiter__ = AsyncMock(return_value=iter([doc]))
    mock_coll.update_one = AsyncMock()

    mock_db = MagicMock()
    mock_db.__getitem__ = MagicMock(return_value=mock_coll)

    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", tmp_path / "checkpoint.json")
    monkeypatch.setattr(fix_encoding, "LOG_FILE", tmp_path / "test.log")

    async def run():
        with patch.object(fix_encoding, "db", mock_db):
            # Simuliere einen Collection-Cursor
            mock_coll.find.return_value = AsyncMock()
            mock_coll.find.return_value.__aiter__ = AsyncMock(
                return_value=iter([doc])
            )
            await fix_encoding.main(dry_run=True)

    asyncio.run(run())

    # update_one darf NICHT aufgerufen worden sein
    mock_coll.update_one.assert_not_called()


def test_checkpoint_created_on_write(tmp_path, monkeypatch):
    """Nach einem erfolgreichen update_one muss die Checkpoint-Datei existieren."""
    import fix_encoding

    checkpoint_file = tmp_path / "checkpoint.json"
    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", checkpoint_file)
    monkeypatch.setattr(fix_encoding, "LOG_FILE", tmp_path / "test.log")

    assert not checkpoint_file.exists(), "Checkpoint-Datei sollte noch nicht existieren"

    # Speichere einen Test-Checkpoint
    fix_encoding.save_checkpoint({"articles": "507f1f77bcf86cd799439011"})

    assert checkpoint_file.exists(), "Checkpoint-Datei wurde nicht erstellt"
    data = json.loads(checkpoint_file.read_text())
    assert data.get("articles") == "507f1f77bcf86cd799439011"


def test_checkpoint_loaded_on_restart(tmp_path, monkeypatch):
    """load_checkpoint() muss gespeicherten Checkpoint korrekt laden."""
    import fix_encoding

    checkpoint_file = tmp_path / "checkpoint.json"
    checkpoint_file.write_text(json.dumps({"articles": "abc123", "bookings": None}))
    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", checkpoint_file)

    result = fix_encoding.load_checkpoint()
    assert result["articles"] == "abc123"
    assert result["bookings"] is None


def test_corrupt_checkpoint_returns_fresh(tmp_path, monkeypatch):
    """Korrupte Checkpoint-Datei muss graceful behandelt werden (kein Crash)."""
    import fix_encoding

    checkpoint_file = tmp_path / "checkpoint.json"
    checkpoint_file.write_text("{INVALID JSON{{")
    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", checkpoint_file)

    result = fix_encoding.load_checkpoint()
    # Sollte einen leeren Checkpoint zurückgeben, nicht crashen
    assert isinstance(result, dict)
    for val in result.values():
        assert val is None, "Korrupter Checkpoint muss frischen Checkpoint zurückgeben"


def test_reset_checkpoint_deletes_file(tmp_path, monkeypatch):
    """--reset-checkpoint muss die Checkpoint-Datei löschen."""
    import fix_encoding

    checkpoint_file = tmp_path / "checkpoint.json"
    checkpoint_file.write_text('{"articles": "123"}')
    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", checkpoint_file)

    fix_encoding.delete_checkpoint()
    assert not checkpoint_file.exists(), "Checkpoint-Datei wurde nicht gelöscht"
```

- [ ] **Step 2: Tests ausführen**

```bash
cd "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/backend"
python -m pytest tests/test_fix_encoding.py -v
```

Erwartetes Ergebnis:
```
tests/test_fix_encoding.py::test_dry_run_does_not_write PASSED
tests/test_fix_encoding.py::test_checkpoint_created_on_write PASSED
tests/test_fix_encoding.py::test_checkpoint_loaded_on_restart PASSED
tests/test_fix_encoding.py::test_corrupt_checkpoint_returns_fresh PASSED
tests/test_fix_encoding.py::test_reset_checkpoint_deletes_file PASSED
```

---

## Task 5: Bug 6 — Electron: Syntax-Check

**Files:**
- `electron/main.js`
- `electron/preload.js`

Kein Electron-Test-Framework vorhanden. Syntax-Check mit Node.js genügt.

- [ ] **Step 1: Syntax-Check ausführen**

```bash
node --check "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/electron/main.js"
node --check "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/electron/preload.js"
```

Erwartetes Ergebnis: keine Ausgabe = kein Syntax-Fehler.

- [ ] **Step 2: Manuelle Verifikation (Checkliste)**

Diese Punkte müssen im Code vorhanden sein (visuell prüfen):

```bash
grep -n "showUrlInputWindow" "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/electron/main.js"
grep -n "data:text/html" "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/electron/main.js"
grep -n "NodeURL" "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/electron/main.js"
grep -n "saveUrl" "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/electron/preload.js"
grep -n "onUrlError" "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/electron/preload.js"
```

Alle 5 grep-Befehle müssen mindestens 1 Treffer liefern.

---

## Task 6: Bug 5 — setup-raspi.sh: Syntax-Check + inhaltliche Prüfung

**Files:**
- `setup-raspi.sh`

- [ ] **Step 1: Bash-Syntax-Check**

```bash
bash -n "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/setup-raspi.sh"
echo "Exit code: $?"
```

Erwartetes Ergebnis: `Exit code: 0`

- [ ] **Step 2: Inhaltliche Prüfung**

```bash
grep -n "avahi-daemon" "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/setup-raspi.sh"
grep -n "inventarpro" "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/setup-raspi.sh"
grep -n "inventarpro.local" "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/setup-raspi.sh"
```

Alle 3 Befehle müssen Treffer liefern.

---

## Task 7: Alle Tests auf einmal ausführen

- [ ] **Step 1: Gesamte Test-Suite starten**

```bash
cd "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/backend"
python -m pytest tests/test_dashboard.py tests/test_articles.py tests/test_v1_router.py tests/test_fix_encoding.py -v
```

Erwartetes Ergebnis: Alle Tests PASSED, 0 FAILED.

HTML-Report wird automatisch generiert (laut `pytest.ini`): `backend/diagnosis/report.html`

- [ ] **Step 2: Report öffnen (optional)**

```bash
start "c:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main/backend/diagnosis/report.html"
```

---

## Verifikations-Zusammenfassung

| Bug | Test | Verifikations-Methode |
|-----|------|-----------------------|
| Bug 1 (N+1 Query) | `test_dashboard.py::test_top_rented_resolves_article_name` | Echte Daten in Test-DB, prüft Artikelname ≠ "Unbekannt" |
| Bug 2 (v1 Router) | `test_v1_router.py` | v1 Route erreichbar, OpenAPI hat response_model |
| Bug 3 (fix_encoding) | `test_fix_encoding.py` | dry-run kein write, checkpoint create/load/reset, corrupt handling |
| Bug 4 (UUID) | `test_articles.py::test_article_*` | /archived = 200, non-UUID = 422, valid UUID = 200/404 |
| Bug 5 (mDNS) | bash -n + grep | Syntax OK, avahi + inventarpro.local vorhanden |
| Bug 6 (Electron) | node --check + grep | Syntax OK, showUrlInputWindow + data:text/html vorhanden |
