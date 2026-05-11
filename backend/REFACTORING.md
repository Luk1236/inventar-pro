# server.py Refactoring-Strategie

`server.py` hat 8800+ Zeilen. Direktes Aufteilen ist hochriskant — die Routes haben viele gemeinsame Imports, Helpers und State.

## Sicherer Ansatz: schrittweise Extraktion

Bereits extrahiert in `app/routes/`:
- `categories.py`
- `customers.py`
- `suppliers.py`
- `teams.py`
- `vehicles.py`
- `messages.py`
- `packing_list.py`
- `ai_inventory.py` (neu)
- `labels.py` (neu)
- `warehouses.py` (neu)

## Empfohlene Reihenfolge für künftige Extraktionen

Sortiert nach **Risiko/Aufwand** (low → high):

| Domain | Geschätzte Zeilen | Risiko | Notizen |
|--------|-------------------|--------|---------|
| 1. **Health/Version** | ~30 | sehr niedrig | Keine DB-Abhängigkeiten |
| 2. **Reports/Charts** | ~150 | niedrig | Nur DB-Reads, isoliert |
| 3. **Backup/Export** | ~300 | niedrig | Aber File-IO |
| 4. **Notifications** | ~250 | mittel | SMTP-Integration |
| 5. **Audit-Log** | ~200 | mittel | DB-Schreibzugriffe |
| 6. **Storage Zones/Locations** | ~400 | mittel | Querverweise zu Articles |
| 7. **Articles (Hauptdomain)** | ~1200 | hoch | Kern, viele Hooks |
| 8. **Auth/Users** | ~800 | hoch | Sicherheit, JWT |
| 9. **WebSocket** | ~300 | hoch | Realtime-State |

## Extraktions-Pattern

Für jeden Router gleich vorgehen:

### 1. Neue Datei: `app/routes/<domain>.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from app.database import db
from app.deps.auth import get_current_user

router = APIRouter(prefix="/<domain>", tags=["<domain>"])

@router.get("")
async def list_items(current_user=Depends(get_current_user)):
    ...
```

### 2. Routes aus `server.py` ausschneiden

- Alle `@api_router.<method>("/<domain>/...")` finden
- In neue Datei verschieben
- `@api_router.` durch `@router.` ersetzen
- Prefix anpassen (war `/api/<domain>` → jetzt nur `/<domain>` da Router prefix gesetzt)

### 3. Router in `server.py` einbinden

Nach den anderen `app.routes` Imports (~Zeile 7585):

```python
from app.routes.<domain> import router as _<domain>_router
api_router.include_router(_<domain>_router)
```

### 4. Verifikation

```bash
# Backend startet ohne Fehler:
cd backend && python -c "import server"

# Routen sind alle da:
curl http://localhost:8002/openapi.json | python -m json.tool | grep '"/<domain>'

# Tests laufen:
pytest backend/tests/
```

## Was NICHT machen

- ❌ Großen Block kommentieren und parallel neuen schreiben (Drift)
- ❌ Viele Domains gleichzeitig (Mergekonflikte, Test-Hölle)
- ❌ Pydantic-Modelle aus models.py verschieben (zu viele Imports brechen)
- ❌ Helper-Funktionen extrahieren bevor alle Caller bekannt sind
- ❌ Tests skippen — nach jeder Extraktion alle integration tests laufen lassen

## Prinzipien

1. **Eine Domain pro PR** — leicht zu reviewen, leicht zu rollbacken
2. **Tests vor Refactor** — wenn keine existieren, erst Smoke-Tests schreiben
3. **Imports mitwandern lassen** — nicht versuchen Imports zu deduplizieren beim Extrahieren
4. **Type-Hints behalten** — auch wenn die Models `from server import` werden (zirkulär OK temporär)
5. **Git-Tag setzen** vor jeder Extraktion: `git tag refactor-pre-<domain>`

## Nächster konkreter Schritt

Empfehlung: **Reports/Charts** als nächste Extraktion — die neu hinzugefügten Charts-Endpoints sind ohnehin isoliert. Das wäre ein guter Pilot für die Methode.

```bash
# Datei erstellen:
touch backend/app/routes/reports.py

# Routes verschieben (geschätzt 150 Zeilen):
#   /reports/charts/inventory-by-category
#   /reports/charts/stock-status
#   /reports/charts/timeline
#   /reports/charts/top-articles
#   /reports/inventory
#   /reports/inventory-csv
#   /reports/inventory-pdf
#   /reports/customers
#   /reports/customers-csv
#   /reports/customers-pdf
#   /reports/inventory-excel
```

Erwarteter Aufwand: **2-3 Stunden** inkl. Tests.
