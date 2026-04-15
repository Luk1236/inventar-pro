# EquipTrack Inventory — Completion Design Spec
**Date:** 2026-03-17
**Status:** Approved (revised after spec review)

## Overview

Complete the EquipTrack Inventory app (React Native + FastAPI + MongoDB) by implementing three confirmed missing features and adding a comprehensive test framework.

**Implementation order:** Backend → Frontend → Tests

---

## Feature A: Mietfaktoren-Logik (Rental Factor Calculation)

### Problem
The existing `POST /api/calculate/rental-price` endpoint applies only one factor at a time (weekend OR week rate). The frontend calculator does not show a breakdown of daily / weekend / week rates side by side. Users cannot compare rates before booking.

### Backend
- File: `backend/server.py`
- **Extend existing endpoint** `POST /api/calculate/rental-price` (do NOT create a new route)
- Request body (already accepted):
```json
{
  "article_ids": ["<id>"],
  "quantities": { "<id>": 2 },
  "start_date": "2026-03-20",
  "end_date": "2026-03-22"
}
```
- Add `quantities` field support: if supplied, multiply per-article cost by the given quantity (default: 1)
- **Extend response** additively (preserve existing fields, add new ones):
```json
{
  "days": 2,
  "is_weekend": true,
  "base_price": 200.0,
  "factor_applied": 1.5,
  "final_price": 300.0,
  "details": [...],
  "breakdown": [
    {
      "article_id": "...",
      "name": "...",
      "quantity": 2,
      "daily_rate": 50.0,
      "weekend_rate": 75.0,
      "week_rate": 280.0,
      "subtotal": 150.0
    }
  ],
  "rates_summary": {
    "daily_total": 200.0,
    "weekend_total": 300.0,
    "week_total": 1120.0
  }
}
```
- `daily_rate` = `article.rental_price_per_day`
- `weekend_rate` = `article.rental_price_per_day * article.rental_factor_weekend`
- `week_rate` = `article.rental_price_per_day * article.rental_factor_week * 7`
- `subtotal` = rate matching `is_weekend` / multi-week flag × quantity × days

### Frontend
- File: `frontend/app/calculator/index.tsx`
- After the existing total price display, render a `breakdown` table
- Columns: Artikel | Menge | Täglich | Wochenende | Woche
- "Täglich" = `daily_rate` (unit price per day, regardless of booking duration — shown for comparison)
- Use existing `styles`; no new design tokens needed

---

## Feature B: WebSocket Live-Sync

### Problem
`websocket_handler.py` defines `ConnectionManager` and a WebSocket endpoint, but it is never imported into `server.py`. The `/ws` route is therefore not registered and broadcasts cannot be added. Additionally `websocket_handler.py` imports a non-existent `sync_service` module which will crash the app if imported as-is.

### Backend — Prerequisites (must do first)
1. **Rewrite `websocket_handler.py`**: The existing file has a `sync_service` dependency that permeates the entire `WebSocketHandler` class — not just the import. The `connect()` method, all branches of `handle_message()`, and the `handle_connection()` lifecycle all call `await get_sync_service()` or invoke methods on the returned object. **Replace the entire file** with a minimal implementation that keeps only `ConnectionManager` (with `connect`, `disconnect`, `broadcast`) and a simple `websocket_endpoint` function that uses `manager` directly. Example minimal replacement:
   ```python
   import json
   from typing import List
   from fastapi import WebSocket, WebSocketDisconnect

   class ConnectionManager:
       def __init__(self):
           self.active_connections: List[WebSocket] = []

       async def connect(self, websocket: WebSocket):
           await websocket.accept()
           self.active_connections.append(websocket)

       def disconnect(self, websocket: WebSocket):
           self.active_connections.remove(websocket)

       async def broadcast(self, message: str):
           disconnected = []
           for connection in self.active_connections:
               try:
                   await connection.send_text(message)
               except Exception:
                   disconnected.append(connection)
           for conn in disconnected:
               self.active_connections.remove(conn)

   manager = ConnectionManager()

   async def websocket_endpoint(websocket: WebSocket):
       await manager.connect(websocket)
       try:
           while True:
               await websocket.receive_text()  # keep connection alive
       except WebSocketDisconnect:
           manager.disconnect(websocket)
   ```
2. **Register the route in `server.py`**: Add near the top of `server.py`:
   ```python
   from websocket_handler import manager, websocket_endpoint
   app.add_api_websocket_route("/ws", websocket_endpoint)
   ```

### Backend — Broadcasts
After the prerequisites above, add `await manager.broadcast(...)` calls. Note: `server.py` has **two definitions** of `PUT /api/articles/{article_id}` (at lines ~1518 and ~3131). FastAPI uses the first match. Add the broadcast to the **first** definition (line ~1518). The duplicate at line ~3131 should be removed as a cleanup step.

Endpoints to instrument:
| Endpoint | Broadcast type |
|---|---|
| `POST /api/articles` | `article_created` |
| `PUT /api/articles/{id}` (first definition, ~line 1518) | `article_updated` |
| `DELETE /api/articles/{id}` | `article_deleted` |
| `POST /api/maintenance` | `maintenance_created` |
| `PUT /api/maintenance/{id}` | `maintenance_updated` |
| `POST /api/events` | `event_created` |
| `PUT /api/events/{id}` | `event_updated` |

Broadcast message shape:
```python
await manager.broadcast(json.dumps({"type": "article_updated", "id": str(article_id)}))
```

### Frontend
- New file: `frontend/hooks/useWebSocket.ts`
- Derives WebSocket URL from `EXPO_PUBLIC_BACKEND_URL` with scheme conversion:
  - `https://` → `wss://`
  - `http://` → `ws://`
  - Append `/ws`
- Connects on mount, calls `onMessage(data: {type: string, id: string})` on each message
- Reconnect on disconnect: exponential backoff (1s, 2s, 4s, 8s, max 5 attempts), then gives up silently
- Cleans up WebSocket on unmount
- Integration: `frontend/app/articles/index.tsx`, `frontend/app/events/index.tsx`, `frontend/app/maintenance/index.tsx` — call `refetch()` when a relevant event type is received

---

## Feature C: Packliste sortiert nach Lagerort (Packing List by Storage Location)

### Problem
The frontend calls `GET /api/events/{event_id}/packing-list-items` which returns a flat list. The frontend already does client-side grouping by `zone_name`, but does not sort by `storage_location` before grouping, so items within a zone are unordered.

### Backend
- File: `backend/server.py`
- Endpoint: `GET /api/events/{event_id}/packing-list-items` (the endpoint the frontend actually calls, ~line 3772)
- Add `.sort([("storage_location", 1), ("zone_name", 1)])` to the MongoDB query
- No response shape changes — the flat list format is preserved; sorting happens server-side

### Frontend
- File: `frontend/app/packing-list/index.tsx`
- The frontend already groups by `zone_name` (lines 271–278). After grouping, sort groups alphabetically by `zone_name`
- Replace the existing `FlatList` with a `SectionList` where each section is one `zone_name` group
- `renderSectionHeader` renders the zone/storage location name as a bold header
- All existing fields preserved: `zone_name`, `location_name`, `checked_out`, `checked_in`, `checkin_condition`, `id`, `article_name`, `inventory_code`, `weight_kg`

---

## Test Framework

### Backend — Pytest

**New packages** (add to `backend/requirements.txt`):
```
httpx
pytest-asyncio
pytest-cov
```

**Directory structure** (`backend/tests/` — create from scratch):
```
backend/tests/
  __init__.py
  conftest.py
  test_rental_calculation.py
  test_websocket.py
  test_packing_list.py
  test_auth.py
```

**`conftest.py`**: Creates an `AsyncClient` pointed at the FastAPI app. Uses `inventory_test` database (separate from production). Drops and recreates the test DB before each test session via `autouse` session-scoped fixture.

**Test files:**
- `test_rental_calculation.py`: Unit tests for rental factor math (daily/weekend/week rate calculation, quantity multiplier, breakdown shape)
- `test_websocket.py`: WebSocket connect/disconnect, broadcast reaches connected client, disconnected clients cleaned up
- `test_packing_list.py`: API integration — items returned sorted by `storage_location` then `zone_name`
- `test_auth.py`: Login success/fail, token refresh, RBAC (admin vs. lager vs. techniker permissions)

Coverage target: ≥ 80% on new/modified code.

### Frontend — Jest

**New packages** (add to `frontend/package.json`):
```
jest-expo
@testing-library/react-native
@testing-library/jest-native
```

**`frontend/jest.config.js`** — create this file:
```js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ]
};
```

**Test files** (`frontend/__tests__/`):
- `hooks/useWebSocket.test.ts`: connect, message callback invoked, reconnect after disconnect, cleanup on unmount
- `calculator.test.tsx`: breakdown table renders `daily_rate`, `weekend_rate`, `week_rate` per article
- `packing-list.test.tsx`: `SectionList` renders section headers per `zone_name`, items appear under correct section

---

## Implementation Order

1. **Backend Prerequisite** — Fix `websocket_handler.py` (remove `sync_service` import), register `/ws` route in `server.py`, remove duplicate `PUT /api/articles/{id}`
2. **Backend Feature A** — Extend rental-price endpoint with `breakdown` + `rates_summary` + `quantities`
3. **Backend Feature B** — Add `await manager.broadcast(...)` to 7 write endpoints
4. **Backend Feature C** — Add sort to packing-list-items query
5. **Frontend Feature A** — Breakdown table in calculator screen
6. **Frontend Feature B** — `useWebSocket` hook + integrate into 3 screens
7. **Frontend Feature C** — SectionList with sorted section headers in packing list
8. **Pytest tests** — Full backend test suite with `httpx` + `pytest-asyncio`
9. **Jest tests** — Frontend test suite with `jest-expo` + Testing Library

---

## Out of Scope
- Offline mode (separate future project)
- New authentication providers
- Lademeter-Plan (not confirmed as broken)
- Mietvertrag-PDF generation (not in scope for this iteration)
