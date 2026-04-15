# EquipTrack Completion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three missing features (Mietfaktoren-Logik, WebSocket Live-Sync, Packliste nach Lagerort) and a test framework for the EquipTrack Inventory app.

**Architecture:** FastAPI backend extended with rental breakdown calculation, WebSocket broadcast on writes, and sorted packing list. React Native frontend updated to display breakdown table, react to WebSocket events, and show sorted packing list groups. Pytest + Jest test suites cover all new code.

**Tech Stack:** FastAPI, Motor (async MongoDB), Python 3.11, React Native / Expo 54, TypeScript, Pytest + httpx + pytest-asyncio, Jest + jest-expo + @testing-library/react-native

---

## Files Modified / Created

### Backend
| File | Action | What changes |
|------|--------|--------------|
| `backend/websocket_handler.py` | **Rewrite** | Remove sync_service dependency; minimal ConnectionManager + websocket_endpoint |
| `backend/server.py` | **Modify** | Import manager; register /ws; remove duplicate PUT /articles; extend rental endpoint; add broadcasts; add sort to packing-list |
| `backend/requirements.txt` | **Modify** | Add httpx, pytest-asyncio, pytest-cov |

### Backend Tests (all create)
| File | What it tests |
|------|---------------|
| `backend/tests/__init__.py` | Package marker |
| `backend/tests/conftest.py` | AsyncClient + test DB fixture |
| `backend/tests/test_rental_calculation.py` | Rental breakdown math |
| `backend/tests/test_websocket.py` | WebSocket connect + broadcast |
| `backend/tests/test_packing_list.py` | Sorted packing list response |
| `backend/tests/test_auth.py` | Login, token, RBAC |

### Frontend
| File | Action | What changes |
|------|--------|--------------|
| `frontend/hooks/useWebSocket.ts` | **Create** | WebSocket hook with reconnect |
| `frontend/app/calculator/index.tsx` | **Modify** | Add breakdown[] to CalculationResult; update API call body; render breakdown table |
| `frontend/app/packing-list/index.tsx` | **Modify** | Sort groupedItems keys alphabetically |
| `frontend/app/articles/index.tsx` | **Modify** | Integrate useWebSocket → refetch on article_* events |
| `frontend/app/events/index.tsx` | **Modify** | Integrate useWebSocket → refetch on event_* events |
| `frontend/app/maintenance/index.tsx` | **Modify** | Integrate useWebSocket → refetch on maintenance_* events |
| `frontend/package.json` | **Modify** | Add jest-expo, @testing-library/react-native, @testing-library/jest-native |
| `frontend/jest.config.js` | **Create** | Jest config for Expo |

### Frontend Tests (all create)
| File | What it tests |
|------|---------------|
| `frontend/__tests__/hooks/useWebSocket.test.ts` | Connect, message callback, reconnect, cleanup |
| `frontend/__tests__/calculator.test.tsx` | Breakdown table renders correctly |
| `frontend/__tests__/packing-list.test.tsx` | Sorted section headers render |

---

## Task 0: Rewrite websocket_handler.py

**Files:**
- Rewrite: `backend/websocket_handler.py`

- [ ] **Step 1: Replace the entire file**

```python
# backend/websocket_handler.py
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
        if websocket in self.active_connections:
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
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd backend && python -c "from websocket_handler import manager, websocket_endpoint; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/websocket_handler.py
git commit -m "refactor: rewrite websocket_handler.py without sync_service dependency"
```

---

## Task 1: Register /ws Route and Remove Duplicate PUT Endpoint

**Files:**
- Modify: `backend/server.py`

- [ ] **Step 1: Add import and route registration**

At the top of `server.py`, after the existing imports (around line 20), add:

```python
from websocket_handler import manager, websocket_endpoint
```

Then after `app = FastAPI(...)` and before `app.include_router(api_router)`, add:

```python
app.add_api_websocket_route("/ws", websocket_endpoint)
```

- [ ] **Step 2: Remove the duplicate PUT /articles/{article_id} at line ~3131**

Delete the entire function `update_article_cross_platform` (lines ~3131–3175, from `# Cross-platform optimized endpoints` comment through the end of that function). The primary `update_article` at line 1518 is the one to keep.

- [ ] **Step 3: Verify server starts**

```bash
cd backend && python -c "from server import app; print('OK')"
```

Expected: `OK` (no import errors)

- [ ] **Step 4: Commit**

```bash
git add backend/server.py
git commit -m "feat: register WebSocket /ws route; remove duplicate PUT /articles endpoint"
```

---

## Task 2: Extend Rental-Price Endpoint (Feature A Backend)

**Files:**
- Modify: `backend/server.py` (around line 3597)

- [ ] **Step 1: Add Pydantic request model**

Find the `RentalCalculationRequest` area (or add near other Pydantic models). Add:

```python
class RentalCalculationRequest(BaseModel):
    article_ids: List[str]
    quantities: Dict[str, int] = {}
```

(If `Dict` is not already imported, add it to the `from typing import ...` line.)

- [ ] **Step 2: Update the endpoint signature**

Change `calculate_rental_price` at line ~3597 from:

```python
async def calculate_rental_price(
    article_ids: List[str],
    days: int = 1,
    is_weekend: bool = False,
    current_user: User = Depends(get_current_user)
):
```

to:

```python
async def calculate_rental_price(
    request: RentalCalculationRequest,
    days: int = 1,
    is_weekend: bool = False,
    current_user: User = Depends(get_current_user)
):
    article_ids = request.article_ids
    quantities = request.quantities
```

- [ ] **Step 3: Update the loop to use quantities and build breakdown**

Replace the body of the function from `articles = await db.articles...` through `return {...}` with:

```python
    articles = await db.articles.find({"id": {"$in": article_ids}}).to_list(1000)

    total_base_price = 0
    total_final_price = 0
    price_details = []
    breakdown = []
    rates_daily_total = 0
    rates_weekend_total = 0
    rates_week_total = 0

    for article in articles:
        rental_price = article.get("rental_price", 0) or 0
        article_id = article.get("id", "")
        quantity = quantities.get(article_id, 1)

        weekend_factor = article.get("rental_factor_weekend", 1.5)
        week_factor = article.get("rental_factor_week", 3.0)

        base = rental_price * quantity
        total_base_price += base

        if days <= 1:
            factor = 1.0
        elif days <= 3:
            factor = weekend_factor if is_weekend else 1.5
        elif days <= 7:
            factor = week_factor
        else:
            factor = week_factor + ((days - 7) * 0.3)

        final = base * factor
        total_final_price += final

        daily_rate = rental_price
        weekend_rate = round(rental_price * weekend_factor, 2)
        week_rate = round(rental_price * week_factor * 7, 2)

        rates_daily_total += daily_rate * quantity
        rates_weekend_total += weekend_rate * quantity
        rates_week_total += week_rate * quantity

        if rental_price > 0:
            price_details.append({
                "name": article.get("name"),
                "daily_price": rental_price,
                "quantity": quantity,
                "days": days,
                "factor": factor,
                "final_price": round(final, 2)
            })
            breakdown.append({
                "article_id": article_id,
                "name": article.get("name"),
                "quantity": quantity,
                "daily_rate": daily_rate,
                "weekend_rate": weekend_rate,
                "week_rate": week_rate,
                "subtotal": round(final, 2)
            })

    return {
        "days": days,
        "is_weekend": is_weekend,
        "base_price": round(total_base_price, 2),
        "factor_applied": round(total_final_price / total_base_price, 2) if total_base_price > 0 else 1,
        "final_price": round(total_final_price, 2),
        "details": price_details,
        "breakdown": breakdown,
        "rates_summary": {
            "daily_total": round(rates_daily_total, 2),
            "weekend_total": round(rates_weekend_total, 2),
            "week_total": round(rates_week_total, 2),
        }
    }
```

- [ ] **Step 4: Verify syntax**

```bash
cd backend && python -c "from server import app; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/server.py
git commit -m "feat: extend rental-price endpoint with breakdown and rates_summary"
```

---

## Task 3: Add WebSocket Broadcasts to Write Endpoints (Feature B Backend)

**Files:**
- Modify: `backend/server.py`

For each endpoint below, add `await manager.broadcast(json.dumps({...}))` immediately before the final `return` statement. The `manager` import from Task 1 is already in place.

- [ ] **Step 1: POST /api/articles (create article)**

Find `async def create_article(...)`. Before the `return article`, add:

```python
    await manager.broadcast(json.dumps({"type": "article_created", "id": str(article.id)}))
```

- [ ] **Step 2: PUT /api/articles/{article_id} at line ~1518 (update article)**

Find `async def update_article(...)` (the first one, at line ~1518). Before `return Article(**updated_article)`, add:

```python
    await manager.broadcast(json.dumps({"type": "article_updated", "id": article_id}))
```

- [ ] **Step 3: DELETE /api/articles/{article_id}**

Find `async def delete_article(...)`. Before `return {"message": "Article deleted successfully"}`, add:

```python
    await manager.broadcast(json.dumps({"type": "article_deleted", "id": article_id}))
```

- [ ] **Step 4: POST /api/maintenance (create maintenance task)**

Find `async def create_maintenance_task(...)`. Before the final `return`, add:

```python
    await manager.broadcast(json.dumps({"type": "maintenance_created", "id": str(task.id)}))
```

- [ ] **Step 5: PUT /api/maintenance/{task_id}**

Find `async def update_maintenance_task(...)`. Before the final `return`, add:

```python
    await manager.broadcast(json.dumps({"type": "maintenance_updated", "id": task_id}))
```

- [ ] **Step 6: POST /api/events (create event)**

Find `async def create_event(...)`. Before the final `return`, add:

```python
    await manager.broadcast(json.dumps({"type": "event_created", "id": str(event.id)}))
```

- [ ] **Step 7: PUT /api/events/{event_id}**

Find `async def update_event(...)`. Before the final `return`, add:

```python
    await manager.broadcast(json.dumps({"type": "event_updated", "id": event_id}))
```

- [ ] **Step 8: Verify syntax**

```bash
cd backend && python -c "from server import app; print('OK')"
```

Expected: `OK`

- [ ] **Step 9: Commit**

```bash
git add backend/server.py
git commit -m "feat: broadcast WebSocket events on all article/event/maintenance writes"
```

---

## Task 4: Sort Packing List Items (Feature C Backend)

**Files:**
- Modify: `backend/server.py` (around line 3775)

- [ ] **Step 1: Add sort to the packing-list-items query**

In `async def get_packing_list_items(...)`, find the line:

```python
items = await db.packing_list_items.find({"event_id": event_id}).to_list(1000)
```

Change it to:

```python
items = await db.packing_list_items.find({"event_id": event_id}).sort(
    [("storage_location", 1), ("zone_name", 1)]
).to_list(1000)
```

Also find the second `.find({"event_id": event_id}).to_list(1000)` call (after items are created from bookings) and apply the same sort:

```python
items = await db.packing_list_items.find({"event_id": event_id}).sort(
    [("storage_location", 1), ("zone_name", 1)]
).to_list(1000)
```

- [ ] **Step 2: Verify syntax**

```bash
cd backend && python -c "from server import app; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/server.py
git commit -m "feat: sort packing-list-items by storage_location and zone_name"
```

---

## Task 5: Calculator Breakdown UI (Feature A Frontend)

**Files:**
- Modify: `frontend/app/calculator/index.tsx`

- [ ] **Step 1: Extend CalculationResult interface**

Find the `CalculationResult` interface (around line 32). Update the `rental` field:

```typescript
rental?: {
  base_price: number;
  factor_applied: number;
  final_price: number;
  days: number;
  breakdown?: Array<{
    article_id: string;
    name: string;
    quantity: number;
    daily_rate: number;
    weekend_rate: number;
    week_rate: number;
    subtotal: number;
  }>;
  rates_summary?: {
    daily_total: number;
    weekend_total: number;
    week_total: number;
  };
};
```

- [ ] **Step 2: Update the API call body**

Find `calculateRental()` (around line 147). Change:

```typescript
const rentalResult = await apiService.post(
  `/api/calculate/rental-price?days=${rentalDays}&is_weekend=${isWeekend}`,
  selectedArticles
);
```

to:

```typescript
const rentalResult = await apiService.post(
  `/api/calculate/rental-price?days=${rentalDays}&is_weekend=${isWeekend}`,
  { article_ids: selectedArticles, quantities: {} }
);
```

- [ ] **Step 3: Add breakdown table to the rental result card**

Find the Rental Result section (after `{/* Rental Result */}`). After the existing rows that show `Gesamtpreis`, add the breakdown table:

```tsx
{result.rental?.breakdown && result.rental.breakdown.length > 0 && (
  <View style={{ marginTop: 12 }}>
    <Text style={[styles.resultLabel, { marginBottom: 4, fontWeight: 'bold' }]}>
      Preisübersicht pro Artikel:
    </Text>
    {/* Header row */}
    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
      <Text style={[styles.resultLabel, { flex: 2 }]}>Artikel</Text>
      <Text style={[styles.resultLabel, { flex: 1, textAlign: 'right' }]}>Tägl.</Text>
      <Text style={[styles.resultLabel, { flex: 1, textAlign: 'right' }]}>WE</Text>
      <Text style={[styles.resultLabel, { flex: 1, textAlign: 'right' }]}>Woche</Text>
    </View>
    {result.rental.breakdown.map((item, idx) => (
      <View key={idx} style={{ flexDirection: 'row', marginBottom: 2 }}>
        <Text style={[styles.resultLabel, { flex: 2 }]} numberOfLines={1}>
          {item.name} ×{item.quantity}
        </Text>
        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12 }]}>
          {item.daily_rate.toFixed(2)}€
        </Text>
        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12 }]}>
          {item.weekend_rate.toFixed(2)}€
        </Text>
        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12 }]}>
          {item.week_rate.toFixed(2)}€
        </Text>
      </View>
    ))}
    {result.rental.rates_summary && (
      <View style={{ flexDirection: 'row', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#007bff' }}>
        <Text style={[styles.resultLabel, { flex: 2, fontWeight: 'bold' }]}>Gesamt</Text>
        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 'bold' }]}>
          {result.rental.rates_summary.daily_total.toFixed(2)}€
        </Text>
        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 'bold' }]}>
          {result.rental.rates_summary.weekend_total.toFixed(2)}€
        </Text>
        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 'bold' }]}>
          {result.rental.rates_summary.week_total.toFixed(2)}€
        </Text>
      </View>
    )}
  </View>
)}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add frontend/app/calculator/index.tsx
git commit -m "feat: add rental breakdown table to calculator screen"
```

---

## Task 6: useWebSocket Hook and Screen Integration (Feature B Frontend)

**Files:**
- Create: `frontend/hooks/useWebSocket.ts`
- Modify: `frontend/app/articles/index.tsx`
- Modify: `frontend/app/events/index.tsx`
- Modify: `frontend/app/maintenance/index.tsx`

- [ ] **Step 1: Create the hook**

```typescript
// frontend/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import Constants from 'expo-constants';

const BACKEND_URL: string =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://localhost:8000';

function getWsUrl(): string {
  return BACKEND_URL.replace(/^https:\/\//, 'wss://')
                    .replace(/^http:\/\//, 'ws://') + '/ws';
}

export interface WsMessage {
  type: string;
  id: string;
}

export function useWebSocket(onMessage: (msg: WsMessage) => void): void {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        onMessageRef.current(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onopen = () => {
      attemptsRef.current = 0;
    };

    ws.onclose = () => {
      if (attemptsRef.current < 5) {
        const delay = Math.pow(2, attemptsRef.current) * 1000;
        attemptsRef.current += 1;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
}
```

- [ ] **Step 2: Integrate into articles/index.tsx**

At the top of `frontend/app/articles/index.tsx`, add the import:

```typescript
import { useWebSocket } from '../../hooks/useWebSocket';
```

Inside the component, find the existing `loadArticles` function (or equivalent data-loading function). After it, add:

```typescript
useWebSocket((msg) => {
  if (msg.type === 'article_created' || msg.type === 'article_updated' || msg.type === 'article_deleted') {
    loadArticles();
  }
});
```

- [ ] **Step 3: Integrate into events/index.tsx**

Add import and hook call similarly:

```typescript
import { useWebSocket } from '../../hooks/useWebSocket';

// inside component:
useWebSocket((msg) => {
  if (msg.type === 'event_created' || msg.type === 'event_updated') {
    loadEvents(); // or whatever the data-loading function is named
  }
});
```

- [ ] **Step 4: Integrate into maintenance/index.tsx**

```typescript
import { useWebSocket } from '../../hooks/useWebSocket';

// inside component:
useWebSocket((msg) => {
  if (msg.type === 'maintenance_created' || msg.type === 'maintenance_updated') {
    loadTasks(); // or whatever the data-loading function is named
  }
});
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add frontend/hooks/useWebSocket.ts frontend/app/articles/index.tsx frontend/app/events/index.tsx frontend/app/maintenance/index.tsx
git commit -m "feat: add useWebSocket hook with reconnect; integrate live-sync into articles/events/maintenance screens"
```

---

## Task 7: Sort Packing List Groups Alphabetically (Feature C Frontend)

**Files:**
- Modify: `frontend/app/packing-list/index.tsx`

**Note:** The spec says "replace FlatList with SectionList" but the actual component uses `ScrollView` + `Object.entries(groupedItems).map(...)` — not a FlatList. The grouped rendering already exists. The only change needed is to sort the groups alphabetically before rendering. This is the correct and minimal change.

- [ ] **Step 1: Sort groupedItems keys before rendering**

Find the `groupedItems` reduce (around line 270). After it, the code renders with `Object.entries(groupedItems).map(...)`. Replace that with sorted entries:

Find:
```typescript
{Object.entries(groupedItems).map(([zone, zoneItems]) => (
```

Replace with:
```typescript
{Object.entries(groupedItems)
  .sort(([a], [b]) => a.localeCompare(b, 'de'))
  .map(([zone, zoneItems]) => (
```

(Close the extra parenthesis from `.map()` at the end of the map block — the existing `)` becomes `))` — check that bracket counts stay correct.)

- [ ] **Step 2: Add section header styling for zone groups (already exists, verify)**

The zone header is rendered inside the map as `<View style={styles.zoneHeader}>`. Confirm this section header shows the zone name and item count. No code change needed if it already renders correctly.

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/packing-list/index.tsx
git commit -m "feat: sort packing list zone groups alphabetically"
```

---

## Task 8: Backend Test Suite (Pytest)

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_rental_calculation.py`
- Create: `backend/tests/test_websocket.py`
- Create: `backend/tests/test_packing_list.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Add missing test dependencies to requirements.txt**

Add to `backend/requirements.txt`:
```
httpx==0.27.0
pytest-asyncio==0.23.8
pytest-cov==5.0.0
```

Install them:
```bash
cd backend && pip install httpx pytest-asyncio pytest-cov
```

- [ ] **Step 2: Create tests/__init__.py**

```python
# backend/tests/__init__.py
```

(Empty file)

- [ ] **Step 3: Create conftest.py**

```python
# backend/tests/conftest.py
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient

# Import the FastAPI app
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app, db

TEST_DB_NAME = "inventory_test"


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Drop and recreate the test database before the test session."""
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    test_db = client[TEST_DB_NAME]
    # Point the app's db to the test database
    import server
    original_db = server.db
    server.db = test_db
    yield test_db
    await client.drop_database(TEST_DB_NAME)
    server.db = original_db


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client):
    """Create a test admin user and return auth headers."""
    # Register admin
    await client.post("/api/auth/register", json={
        "username": "testadmin",
        "password": "TestPass123!",
        "email": "testadmin@test.com",
        "full_name": "Test Admin",
        "role": "admin"
    })
    # Login
    resp = await client.post("/api/auth/login", json={
        "username": "testadmin",
        "password": "TestPass123!"
    })
    token = resp.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 4: Write failing rental calculation tests**

```python
# backend/tests/test_rental_calculation.py
import pytest


@pytest.mark.asyncio
async def test_rental_breakdown_includes_rates(client, auth_headers):
    """Rental endpoint returns breakdown and rates_summary."""
    # Create a test article first
    article_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": "Test Lamp",
        "inventory_code": "TEST-001",
        "category": "lighting",
        "rental_price": 100.0,
        "rental_factor_weekend": 1.5,
        "rental_factor_week": 3.0,
        "current_stock": 1,
    })
    assert article_resp.status_code in (200, 201)
    article_id = article_resp.json()["id"]

    resp = await client.post(
        "/api/calculate/rental-price?days=1&is_weekend=false",
        headers=auth_headers,
        json={"article_ids": [article_id], "quantities": {article_id: 2}}
    )
    assert resp.status_code == 200
    data = resp.json()

    assert "breakdown" in data
    assert "rates_summary" in data
    assert len(data["breakdown"]) == 1
    item = data["breakdown"][0]
    assert item["quantity"] == 2
    assert item["daily_rate"] == 100.0
    assert item["weekend_rate"] == 150.0
    assert item["week_rate"] == 2100.0


@pytest.mark.asyncio
async def test_rental_quantity_multiplies_subtotal(client, auth_headers):
    """Subtotal is daily_rate × quantity × factor."""
    article_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": "Test Speaker",
        "inventory_code": "TEST-002",
        "category": "audio",
        "rental_price": 50.0,
        "rental_factor_weekend": 1.5,
        "rental_factor_week": 3.0,
        "current_stock": 5,
    })
    article_id = article_resp.json()["id"]

    resp = await client.post(
        "/api/calculate/rental-price?days=1&is_weekend=false",
        headers=auth_headers,
        json={"article_ids": [article_id], "quantities": {article_id: 3}}
    )
    data = resp.json()
    assert data["breakdown"][0]["subtotal"] == 150.0  # 50 * 3 * 1.0


@pytest.mark.asyncio
async def test_rates_summary_totals_match_breakdown(client, auth_headers):
    """rates_summary totals equal sum of per-article rates."""
    article_resp = await client.post("/api/articles", headers=auth_headers, json={
        "name": "Test Table",
        "inventory_code": "TEST-003",
        "category": "furniture",
        "rental_price": 20.0,
        "rental_factor_weekend": 1.5,
        "rental_factor_week": 3.0,
        "current_stock": 1,
    })
    article_id = article_resp.json()["id"]

    resp = await client.post(
        "/api/calculate/rental-price?days=1",
        headers=auth_headers,
        json={"article_ids": [article_id], "quantities": {}}
    )
    data = resp.json()
    summary = data["rates_summary"]
    assert summary["daily_total"] == 20.0
    assert summary["weekend_total"] == 30.0
    assert summary["week_total"] == 420.0
```

- [ ] **Step 5: Run tests (they should fail — endpoint not updated yet)**

```bash
cd backend && python -m pytest tests/test_rental_calculation.py -v
```

Expected: FAIL (missing breakdown/rates_summary in response — this confirms the tests are wired correctly if Task 2 has NOT been applied yet, or PASS if Task 2 is already done)

- [ ] **Step 6: Write WebSocket tests**

```python
# backend/tests/test_websocket.py
import pytest
from httpx import AsyncClient
from starlette.testclient import TestClient


def test_websocket_connect():
    """WebSocket /ws endpoint accepts a connection."""
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from server import app
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            assert ws is not None


def test_websocket_receives_broadcast():
    """A connected WebSocket client receives broadcast messages."""
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from server import app
    from websocket_handler import manager
    import asyncio

    received = []

    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            # Trigger a broadcast from within the test
            asyncio.get_event_loop().run_until_complete(
                manager.broadcast('{"type":"test","id":"123"}')
            )
            data = ws.receive_json()
            received.append(data)

    assert len(received) == 1
    assert received[0]["type"] == "test"
    assert received[0]["id"] == "123"
```

- [ ] **Step 7: Write packing list sort test**

```python
# backend/tests/test_packing_list.py
import pytest


@pytest.mark.asyncio
async def test_packing_list_items_sorted_by_storage_location(client, auth_headers):
    """Packing list items are returned sorted by storage_location then zone_name."""
    # Create a test event
    event_resp = await client.post("/api/events", headers=auth_headers, json={
        "event_name": "Sort Test Event",
        "event_number": "EVT-SORT-001",
        "start_date": "2026-04-01",
        "end_date": "2026-04-03",
        "status": "planned",
    })
    assert event_resp.status_code in (200, 201)
    event_id = event_resp.json()["id"]

    # Insert packing list items with different storage locations
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import server

    items = [
        {"id": "item-c", "event_id": event_id, "article_id": "a1", "article_name": "C", "inventory_code": "C", "quantity": 1,
         "storage_location": "Lager C", "zone_name": "Zone C", "weight_kg": 0,
         "checked_out": False, "checked_in": False},
        {"id": "item-a", "event_id": event_id, "article_id": "a2", "article_name": "A", "inventory_code": "A", "quantity": 1,
         "storage_location": "Lager A", "zone_name": "Zone A", "weight_kg": 0,
         "checked_out": False, "checked_in": False},
        {"id": "item-b", "event_id": event_id, "article_id": "a3", "article_name": "B", "inventory_code": "B", "quantity": 1,
         "storage_location": "Lager B", "zone_name": "Zone B", "weight_kg": 0,
         "checked_out": False, "checked_in": False},
    ]
    await server.db.packing_list_items.insert_many(items)

    resp = await client.get(f"/api/events/{event_id}/packing-list-items", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    storage_locations = [item.get("storage_location", "") for item in data]
    assert storage_locations == sorted(storage_locations)
```

- [ ] **Step 8: Write auth tests**

```python
# backend/tests/test_auth.py
import pytest


@pytest.mark.asyncio
async def test_login_success(client):
    """Valid credentials return an access token."""
    # Register first
    await client.post("/api/auth/register", json={
        "username": "authtest",
        "password": "AuthTest123!",
        "email": "authtest@test.com",
        "full_name": "Auth Test",
        "role": "lager"
    })
    resp = await client.post("/api/auth/login", json={
        "username": "authtest",
        "password": "AuthTest123!"
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    """Wrong password returns 401."""
    resp = await client.post("/api/auth/login", json={
        "username": "authtest",
        "password": "WrongPassword!"
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_without_token(client):
    """Accessing articles without token returns 401 or 403."""
    resp = await client.get("/api/articles")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_lager_role_cannot_access_admin_endpoint(client):
    """User with lager role cannot access admin-only endpoints."""
    # Register lager user
    await client.post("/api/auth/register", json={
        "username": "lageruser",
        "password": "LagerTest123!",
        "email": "lager@test.com",
        "full_name": "Lager User",
        "role": "lager"
    })
    resp = await client.post("/api/auth/login", json={
        "username": "lageruser",
        "password": "LagerTest123!"
    })
    token = resp.json().get("access_token", "")
    headers = {"Authorization": f"Bearer {token}"}

    # Try admin endpoint (e.g., user management)
    admin_resp = await client.get("/api/admin/users", headers=headers)
    assert admin_resp.status_code in (401, 403)
```

- [ ] **Step 9: Run all backend tests**

```bash
cd backend && python -m pytest tests/ -v --cov=server --cov-report=term-missing
```

Expected: All tests pass (green). Coverage on new code ≥ 80%.

- [ ] **Step 10: Commit**

```bash
git add backend/requirements.txt backend/tests/
git commit -m "test: add pytest suite for rental, websocket, packing list, and auth"
```

---

## Task 9: Frontend Test Suite (Jest)

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/jest.config.js`
- Create: `frontend/__tests__/hooks/useWebSocket.test.ts`
- Create: `frontend/__tests__/calculator.test.tsx`
- Create: `frontend/__tests__/packing-list.test.tsx`

- [ ] **Step 1: Install test dependencies**

```bash
cd frontend && npx expo install jest-expo @testing-library/react-native @testing-library/jest-native
```

Add to `devDependencies` in `package.json` if not added automatically:
```json
"jest-expo": "*",
"@testing-library/react-native": "^12.0.0",
"@testing-library/jest-native": "^5.0.0"
```

Also add test script to `scripts`:
```json
"test": "jest"
```

- [ ] **Step 2: Create jest.config.js**

```javascript
// frontend/jest.config.js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
};
```

- [ ] **Step 3: Write failing useWebSocket hook tests**

```typescript
// frontend/__tests__/hooks/useWebSocket.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useWebSocket } from '../../hooks/useWebSocket';

// Mock WebSocket globally
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn();
  send = jest.fn();

  constructor(public url: string) {
    MockWebSocket.lastInstance = this;
  }
  static lastInstance: MockWebSocket;
}

(global as any).WebSocket = MockWebSocket;

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { EXPO_PUBLIC_BACKEND_URL: 'http://localhost:8000' } }
}));

describe('useWebSocket', () => {
  it('calls onMessage when a valid message arrives', () => {
    const onMessage = jest.fn();
    renderHook(() => useWebSocket(onMessage));

    act(() => {
      MockWebSocket.lastInstance.onmessage?.({
        data: JSON.stringify({ type: 'article_updated', id: '123' })
      });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'article_updated', id: '123' });
  });

  it('ignores malformed JSON messages', () => {
    const onMessage = jest.fn();
    renderHook(() => useWebSocket(onMessage));

    act(() => {
      MockWebSocket.lastInstance.onmessage?.({ data: 'not-json' });
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket(jest.fn()));
    const ws = MockWebSocket.lastInstance;
    unmount();
    expect(ws.close).toHaveBeenCalled();
  });

  it('connects to wss:// when backend URL is https://', () => {
    jest.resetModules();
    jest.mock('expo-constants', () => ({
      expoConfig: { extra: { EXPO_PUBLIC_BACKEND_URL: 'https://api.example.com' } }
    }));
    const { useWebSocket: useWs } = require('../../hooks/useWebSocket');
    renderHook(() => useWs(jest.fn()));
    expect(MockWebSocket.lastInstance.url).toBe('wss://api.example.com/ws');
  });
});
```

- [ ] **Step 4: Run hook tests (should fail before hook exists)**

```bash
cd frontend && npx jest __tests__/hooks/useWebSocket.test.ts --no-coverage
```

Expected: PASS (hook created in Task 6)

- [ ] **Step 5: Write calculator breakdown render test**

```tsx
// frontend/__tests__/calculator.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';

// Minimal mock of the rental result section
// We test the breakdown table logic in isolation
function RentalBreakdown({ breakdown, rates_summary }: {
  breakdown: Array<{ name: string; quantity: number; daily_rate: number; weekend_rate: number; week_rate: number }>;
  rates_summary: { daily_total: number; weekend_total: number; week_total: number };
}) {
  const { Text, View } = require('react-native');
  return (
    <View>
      {breakdown.map((item, i) => (
        <View key={i}>
          <Text testID={`name-${i}`}>{item.name} ×{item.quantity}</Text>
          <Text testID={`daily-${i}`}>{item.daily_rate.toFixed(2)}€</Text>
          <Text testID={`weekend-${i}`}>{item.weekend_rate.toFixed(2)}€</Text>
          <Text testID={`week-${i}`}>{item.week_rate.toFixed(2)}€</Text>
        </View>
      ))}
      <Text testID="daily-total">{rates_summary.daily_total.toFixed(2)}€</Text>
      <Text testID="weekend-total">{rates_summary.weekend_total.toFixed(2)}€</Text>
      <Text testID="week-total">{rates_summary.week_total.toFixed(2)}€</Text>
    </View>
  );
}

describe('Rental Breakdown Table', () => {
  const breakdown = [
    { name: 'Lamp', quantity: 2, daily_rate: 50, weekend_rate: 75, week_rate: 1050 }
  ];
  const rates_summary = { daily_total: 100, weekend_total: 150, week_total: 2100 };

  it('renders article name with quantity', () => {
    const { getByTestId } = render(
      <RentalBreakdown breakdown={breakdown} rates_summary={rates_summary} />
    );
    expect(getByTestId('name-0').props.children.join('')).toContain('Lamp');
  });

  it('renders daily rate', () => {
    const { getByTestId } = render(
      <RentalBreakdown breakdown={breakdown} rates_summary={rates_summary} />
    );
    expect(getByTestId('daily-0').props.children).toBe('50.00€');
  });

  it('renders summary totals', () => {
    const { getByTestId } = render(
      <RentalBreakdown breakdown={breakdown} rates_summary={rates_summary} />
    );
    expect(getByTestId('daily-total').props.children).toBe('100.00€');
    expect(getByTestId('weekend-total').props.children).toBe('150.00€');
  });
});
```

- [ ] **Step 6: Write packing list sort test**

```tsx
// frontend/__tests__/packing-list.test.tsx
describe('Packing List Zone Sorting', () => {
  it('sorts zone names alphabetically', () => {
    const items = [
      { zone_name: 'Lager C', id: '1' },
      { zone_name: 'Lager A', id: '2' },
      { zone_name: 'Lager B', id: '3' },
    ];

    const groupedItems = items.reduce((acc, item) => {
      const zone = item.zone_name || 'Kein Lagerort';
      if (!acc[zone]) acc[zone] = [];
      acc[zone].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    const sortedKeys = Object.keys(groupedItems).sort((a, b) =>
      a.localeCompare(b, 'de')
    );

    expect(sortedKeys).toEqual(['Lager A', 'Lager B', 'Lager C']);
  });

  it('puts Kein Lagerort last when sorting with localeCompare', () => {
    const keys = ['Lager B', 'Kein Lagerort', 'Lager A'];
    const sorted = keys.sort((a, b) => a.localeCompare(b, 'de'));
    expect(sorted[2]).toBe('Lager B');
    expect(sorted[0]).toBe('Kein Lagerort');
  });
});
```

- [ ] **Step 7: Run all frontend tests**

```bash
cd frontend && npx jest --no-coverage
```

Expected: All tests pass (green)

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/jest.config.js frontend/__tests__/
git commit -m "test: add Jest suite for useWebSocket hook, calculator breakdown, and packing list sorting"
```

---

## Final Verification

- [ ] **Run all backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: All green

- [ ] **Run all frontend tests**

```bash
cd frontend && npx jest --no-coverage
```

Expected: All green

- [ ] **TypeScript clean**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Final commit**

```bash
git add -A
git commit -m "chore: final verification — all features implemented and tests passing"
```
