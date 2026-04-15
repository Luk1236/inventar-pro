# Inventar Pro — Vollständige Bug Fixes & Erweiterungen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical bugs, logic errors, and missing features found during full system test on 2026-04-09.

**Architecture:** All backend fixes in `backend/server.py` (single FastAPI file ~9900 lines). Frontend fixes scattered across `frontend/app/` and `frontend/services/apiService.ts`. No restructuring — targeted surgical fixes only.

**Tech Stack:** Python 3.12, FastAPI, MongoDB/Motor, React Native Expo, TypeScript

**Base path:** `C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main`

---

## File Map

```
backend/
└── server.py              MODIFY — bugs 1,2,3,4,5,6

frontend/
├── services/apiService.ts MODIFY — bug 7 (v1 route rewrite)
├── app/index.tsx          MODIFY — bug 8 (Passwort vergessen link)
└── app/admin/users.tsx    CREATE — feature: User Management UI
```

---

## Task 1: inventory_code Auto-Generierung + QR-Code Fix

**Bugs:** `inventory_code` ist Pflichtfeld ohne Auto-Generierung. QR-Code bekommt doppeltes `ART-ART-` Prefix.

**Files:**
- Modify: `backend/server.py:383` (ArticleCreate model)
- Modify: `backend/server.py:1884` (create_article endpoint)
- Modify: `backend/server.py:1886` (qr_code generation)

- [ ] **Step 1: ArticleCreate — inventory_code optional machen**

In `backend/server.py` Zeile 383, ändere:
```python
inventory_code: str = Field(..., max_length=100)
```
zu:
```python
inventory_code: Optional[str] = Field(None, max_length=100)
```

- [ ] **Step 2: create_article — Auto-Generierung + QR-Code Fix**

In `backend/server.py` bei `async def create_article` (Zeile 1884), füge nach dem Funktionskopf ein:

```python
async def create_article(article_data: ArticleCreate, current_user: User = Depends(require_permission(Permission.CREATE_ARTICLE))):
    # Auto-generate inventory_code if not provided
    if not article_data.inventory_code:
        short_id = str(uuid.uuid4())[:6].upper()
        article_data.inventory_code = f"ART-{short_id}"
    
    # Check for duplicate inventory_code
    existing = await db.articles.find_one({"inventory_code": article_data.inventory_code})
    if existing:
        raise HTTPException(status_code=409, detail=f"Inventarnummer '{article_data.inventory_code}' bereits vorhanden")
```

- [ ] **Step 3: QR-Code Prefix Fix**

Zeile 1886, ändere:
```python
qr_code = f"ART-{article_data.inventory_code}"
```
zu:
```python
# inventory_code already contains prefix like "ART-xxx", use as-is
qr_code = article_data.inventory_code
```

- [ ] **Step 4: Testen**

```bash
curl -s -X POST http://localhost:8002/api/v1/articles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Artikel","current_stock":5,"base_unit":"Stueck"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('inventory_code:', d.get('inventory_code'), '| qr_code:', d.get('qr_code'))"
```

Erwartetes Ergebnis: `inventory_code: ART-XXXXXX | qr_code: ART-XXXXXX` (kein doppeltes `ART-ART-`)

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main"
git add backend/server.py
git commit -m "fix: auto-generate inventory_code and fix QR-code double ART- prefix"
```

---

## Task 2: Dashboard Low-Stock Logik Fix

**Bug:** Alle 20 Artikel gelten als "Low Stock" weil `current_stock=0` und `min_stock_level=0` — `0 <= 0` ist immer true.

**Fix:** Nur als Low-Stock zählen wenn `min_stock_level > 0` UND `current_stock < min_stock_level`.

**Files:**
- Modify: `backend/server.py:3136` (dashboard stats query)

- [ ] **Step 1: Low-Stock Query fixen**

In `backend/server.py` Zeile 3136–3138, ändere:
```python
low_stock_articles = await db.articles.count_documents({
    "$expr": {"$lte": ["$current_stock", "$min_stock_level"]}
})
```
zu:
```python
low_stock_articles = await db.articles.count_documents({
    "$expr": {
        "$and": [
            {"$gt": ["$min_stock_level", 0]},
            {"$lt": ["$current_stock", "$min_stock_level"]}
        ]
    }
})
```

- [ ] **Step 2: Dashboard Cache invalidieren**

Direkt nach der Änderung den Cache-Reset sicherstellen. Suche `_dashboard_cache = result` (Zeile ~3207) — das ist bereits vorhanden. Kein Handlungsbedarf.

- [ ] **Step 3: Testen**

```bash
# Cache-TTL abwarten (30s) oder Server neu starten, dann:
curl -s http://localhost:8002/api/v1/dashboard/stats \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('low_stock:', d['low_stock_articles'], '(sollte 0 sein wenn keine min_stock_level gesetzt)')"
```

Erwartetes Ergebnis: `low_stock: 0`

- [ ] **Step 4: Commit**

```bash
git add backend/server.py
git commit -m "fix: low_stock_articles only counts articles where min_stock_level > 0 and stock < min"
```

---

## Task 3: Dashboard total_inventory_value Fix

**Bug:** `total_inventory_value` ist immer 0 weil 19/20 Artikel `rental_price=null` haben. Berechnung nutzt `rental_price`, sollte `price_per_unit` nutzen.

**Files:**
- Modify: `backend/server.py:3175` (value pipeline)

- [ ] **Step 1: Value-Pipeline auf price_per_unit umstellen**

In `backend/server.py` Zeile 3175–3181, ändere:
```python
_value_pipeline = [
    {"$project": {"value": {"$multiply": [
        {"$ifNull": ["$rental_price", 0]},
        {"$ifNull": ["$current_stock", 0]}
    ]}}},
    {"$group": {"_id": None, "total": {"$sum": "$value"}}}
]
```
zu:
```python
_value_pipeline = [
    {"$project": {"value": {"$multiply": [
        {"$ifNull": ["$price_per_unit", 0]},
        {"$ifNull": ["$current_stock", 0]}
    ]}}},
    {"$group": {"_id": None, "total": {"$sum": "$value"}}}
]
```

- [ ] **Step 2: Testen**

```bash
curl -s http://localhost:8002/api/v1/dashboard/stats \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('inventory_value:', d['total_inventory_value'])"
```

- [ ] **Step 3: Commit**

```bash
git add backend/server.py
git commit -m "fix: dashboard uses price_per_unit (not rental_price) for inventory value"
```

---

## Task 4: Invoice ohne Event ermöglichen

**Bug:** `InvoiceCreate` hat `event_id: str` als Pflichtfeld. Freie Rechnungen ohne Event nicht möglich. Auch `create_invoice` wirft Fehler wenn kein Event.

**Files:**
- Modify: `backend/server.py:942` (InvoiceCreate model)
- Modify: `backend/server.py:4090` (create_invoice endpoint)

- [ ] **Step 1: InvoiceCreate — event_id optional**

In `backend/server.py` Zeile 943, ändere:
```python
event_id: str
```
zu:
```python
event_id: Optional[str] = None
```

- [ ] **Step 2: create_invoice — Event-Logik anpassen**

In `backend/server.py` bei `async def create_invoice` (Zeile 4091), finde den Block der Bookings lädt und mache ihn optional. Suche nach `No bookings found for this event` und passe die Logik an:

```python
# Finde den Block (suche nach "No bookings found")
# Ändere von:
if not bookings:
    raise HTTPException(status_code=400, detail="No bookings found for this event")

# zu:
if invoice_data.event_id and not bookings:
    raise HTTPException(status_code=400, detail="No bookings found for this event")
```

- [ ] **Step 3: Testen**

```bash
CUST_ID=$(curl -s http://localhost:8002/api/v1/customers -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
curl -s -X POST http://localhost:8002/api/v1/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"customer_id\":\"$CUST_ID\",\"notes\":\"Manuelle Rechnung\",\"due_days\":14}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('invoice_number:', d.get('invoice_number','ERROR'), d.get('detail',''))"
```

Erwartetes Ergebnis: `invoice_number: INV-2026-XXXX`

- [ ] **Step 4: Commit**

```bash
git add backend/server.py
git commit -m "fix: invoices can be created without event_id (free invoices)"
```

---

## Task 5: Booking Stock-Check Fix

**Bug:** Buchung schlägt mit "Nicht genug Bestand" fehl, selbst wenn `quantity=1` und `current_stock=0` ← Das ist eigentlich korrekt! Aber der Fehlertext ist irreführend wenn kein Race Condition vorliegt.

**Fix:** Bessere Fehlermeldung + prüfen ob stock überhaupt >= quantity ist bevor die Buchung angelegt wird.

**Files:**
- Modify: `backend/server.py:3655` (create_booking)

- [ ] **Step 1: Pre-Check vor dem Insert**

In `backend/server.py` bei `create_booking` (nach Zeile 3668), füge vor dem Insert ein:
```python
# Early stock check before insert (avoid unnecessary DB writes)
article_stock = article.get("current_stock", 0)
if article_stock < booking_data.quantity:
    raise HTTPException(
        status_code=400,
        detail=f"Nicht genug Bestand. Verfügbar: {article_stock}, angefragt: {booking_data.quantity}"
    )
```

- [ ] **Step 2: Fehlermeldung beim Rollback verbessern**

Zeile 3708–3710, ändere:
```python
detail="Nicht genug Bestand – ein anderer Vorgang hat den Bestand gleichzeitig verändert."
```
zu:
```python
detail=f"Nicht genug Bestand – gleichzeitiger Zugriff erkannt. Verfügbarer Bestand: {article.get('current_stock', 0)}"
```

- [ ] **Step 3: Testen**

```bash
# Artikel mit stock=0 -> klare Fehlermeldung
ARTICLE_ID=$(curl -s http://localhost:8002/api/v1/articles -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); a=[x for x in d if x['current_stock']==0]; print(a[0]['id'] if a else 'none')")
EVENT_ID=$(curl -s http://localhost:8002/api/v1/events -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
curl -s -X POST http://localhost:8002/api/v1/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\":\"$EVENT_ID\",\"article_id\":\"$ARTICLE_ID\",\"quantity\":1,\"start_date\":\"2026-12-01T10:00:00\",\"end_date\":\"2026-12-05T10:00:00\"}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('detail',''))"
```

Erwartetes Ergebnis: `Nicht genug Bestand. Verfügbar: 0, angefragt: 1`

- [ ] **Step 4: Commit**

```bash
git add backend/server.py
git commit -m "fix: booking shows clear stock error before insert, better error messages"
```

---

## Task 6: Backend @app Routes → v1 kompatibel machen

**Bug:** 68 Routen sind mit `@app.get/post/put/delete` statt `@api_router` registriert. Das Frontend-`apiService.ts` schreibt alle `/api/` Calls zu `/api/v1/` um → diese 68 Routen geben 404.

**Betroffene Routen (nicht komplett, repräsentativ):**
- `/api/settings/app` (GET, PUT)
- `/api/serial-numbers` (GET, POST, PUT, DELETE)
- `/api/absence-requests` (GET, POST, PUT, DELETE)
- `/api/stock-counts` (GET, POST, PUT, DELETE)
- `/api/activities` (GET, POST, PUT, DELETE)
- `/api/vehicles` (GET, POST, PUT, DELETE)
- `/api/tasks` (GET, POST, PUT, DELETE)
- `/api/inspections` (GET, POST, PUT, DELETE)
- `/api/purchase-orders` (GET, POST, PUT, DELETE)
- `/api/job-board` (GET, POST, PUT, DELETE)
- `/api/communication-log` (GET, POST, PUT, DELETE)
- `/api/billing-queue` (GET)
- `/api/rental-requests` (GET, POST, PUT, DELETE)
- `/api/cross-docking` (GET, POST, PUT, DELETE)
- `/api/articles/archived`, `/api/storage-locations/archived` (GET)
- `/api/dashboard/financial` (GET)

**Einfachste Lösung:** v1-Router-Generierung ans Ende der Datei verschieben (nach allen @app-Route-Registrierungen) und auch @app-Routen einschließen.

**Files:**
- Modify: `backend/server.py:8542` (v1 router generation block)
- Modify: `backend/server.py:8556` (include_router call)

- [ ] **Step 1: v1-Router-Block ans Ende verschieben**

Suche in `server.py` den Block (Zeile 8540–8556):
```python
# Legacy /api/ routes remain intact for backwards compatibility.
from fastapi.routing import APIRoute as _APIRoute
api_router_v1 = APIRouter(prefix="/api/v1")
for _route in api_router.routes:
    if isinstance(_route, _APIRoute):
        _rel = _route.path[len(api_router.prefix):]
        api_router_v1.add_api_route(
            _rel,
            _route.endpoint,
            methods=list(_route.methods) if _route.methods else None,
            response_model=_route.response_model,
            tags=_route.tags,
            dependencies=_route.dependencies,
        )
app.include_router(api_router_v1)
```

Ersetze diesen Block durch:
```python
# NOTE: v1 router is registered at the BOTTOM of this file (after all @app routes)
# See "v1 Router Registration" section near end of file
```

- [ ] **Step 2: Neuen v1-Block ans absolute Ende der Datei setzen**

Füge ganz am Ende von `server.py` (nach der letzten Zeile) ein:

```python

# =============================================================================
# /api/v1 Route Aliases — must be registered AFTER all @app routes above
# =============================================================================
from fastapi.routing import APIRoute as _APIRoute

_api_router_v1 = APIRouter(prefix="/api/v1")
_seen_paths = set()

# 1) Copy all routes from api_router (those registered with @api_router)
for _route in api_router.routes:
    if isinstance(_route, _APIRoute):
        _rel = _route.path[len(api_router.prefix):]
        _key = (frozenset(_route.methods or []), _rel)
        if _key not in _seen_paths:
            _seen_paths.add(_key)
            _api_router_v1.add_api_route(
                _rel,
                _route.endpoint,
                methods=list(_route.methods) if _route.methods else None,
                response_model=_route.response_model,
                tags=_route.tags,
                dependencies=_route.dependencies,
            )

# 2) Also copy all @app routes that start with /api/ but not /api/v1/
for _route in list(app.routes):
    if isinstance(_route, _APIRoute) and _route.path.startswith("/api/") and not _route.path.startswith("/api/v1/"):
        _rel = _route.path[len("/api"):]  # e.g. "/settings/app"
        _key = (frozenset(_route.methods or []), _rel)
        if _key not in _seen_paths:
            _seen_paths.add(_key)
            _api_router_v1.add_api_route(
                _rel,
                _route.endpoint,
                methods=list(_route.methods) if _route.methods else None,
                response_model=_route.response_model,
                tags=_route.tags,
                dependencies=_route.dependencies,
            )

app.include_router(_api_router_v1)
```

- [ ] **Step 3: Server neu starten**

```bash
# Kill existing backend process and restart
pkill -f "py -3.12 server.py" 2>/dev/null || true
cd "C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main\backend"
py -3.12 server.py > server_out.txt 2>&1 &
sleep 5
```

- [ ] **Step 4: Testen — zuvor fehlende Routes prüfen**

```bash
TOKEN=$(curl -s -X POST http://localhost:8002/api/v1/login -H "Content-Type: application/json" -d '{"username":"Admin","password":"YNwJT56G"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

for ep in "/api/v1/settings/app" "/api/v1/serial-numbers" "/api/v1/stock-counts" "/api/v1/activities" "/api/v1/vehicles" "/api/v1/tasks" "/api/v1/absence-requests" "/api/v1/inspections" "/api/v1/purchase-orders" "/api/v1/job-board" "/api/v1/communication-log" "/api/v1/billing-queue" "/api/v1/articles/archived" "/api/v1/dashboard/financial"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8002$ep" -H "Authorization: Bearer $TOKEN")
  echo "$ep -> $CODE"
done
```

Alle Codes sollten 200 sein (nicht 404).

- [ ] **Step 5: Commit**

```bash
git add backend/server.py
git commit -m "fix: register all @app routes as /api/v1/ aliases — fixes 68 missing v1 endpoints"
```

---

## Task 7: Frontend apiService — v1 Rewrite entfernen (Fallback)

**Kontext:** Falls Task 6 nicht alle Fälle abdeckt oder der Server nicht neu gestartet werden kann, ist dies der einfachste sofortige Fix: Das URL-Rewriting in `apiService.ts` deaktivieren, sodass alle Calls auf `/api/` gehen (was immer funktioniert hat).

**Files:**
- Modify: `frontend/services/apiService.ts:216`

- [ ] **Step 1: Rewrite-Logik entfernen**

In `frontend/services/apiService.ts` Zeile 215–218, ändere:
```typescript
// F11: rewrite /api/ → /api/v1/ so clients use the versioned prefix
const resolvedEndpoint = endpoint.startsWith('/api/')
  ? API_PREFIX + endpoint.slice('/api'.length)
  : endpoint;
```
zu:
```typescript
// Routes available under both /api/ and /api/v1/ — use /api/ as stable base
const resolvedEndpoint = endpoint;
```

- [ ] **Step 2: API_PREFIX Konstante bereinigen**

Zeile 14, ändere:
```typescript
const API_PREFIX = '/api/v1';
```
zu:
```typescript
// API_PREFIX unused — kept for reference only
// const API_PREFIX = '/api/v1';
```

- [ ] **Step 3: Frontend neu starten**

```bash
# Frontend-Prozess neu starten damit apiService.ts neu gebundelt wird
# Im Terminal: Ctrl+C dann npm start
```

- [ ] **Step 4: Login testen**

Browser öffnen: http://localhost:8081  
Login mit Admin / YNwJT56G → Dashboard muss erscheinen.

- [ ] **Step 5: Commit**

```bash
git add frontend/services/apiService.ts
git commit -m "fix: remove /api/v1 URL rewrite in apiService — use /api/ directly"
```

---

## Task 8: User Management UI

**Feature:** Admin-Seite zum Anzeigen aller Benutzer, Genehmigen ausstehender Registrierungen und Deaktivieren von Accounts.

**Backend-Endpoints bereits vorhanden:**
- `GET /api/users/all` — alle Benutzer
- `GET /api/admin/pending-users` — ausstehende Genehmigungen
- `PUT /api/admin/approve-user/{user_id}` — Benutzer genehmigen
- `DELETE /api/admin/reject-user/{user_id}` — Benutzer ablehnen

**Files:**
- Create: `frontend/app/admin/users.tsx`

- [ ] **Step 1: Seite erstellen**

Erstelle `frontend/app/admin/users.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, StyleSheet, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
}

export default function UserManagement() {
  const { colors } = useTheme();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'all' | 'pending'>('pending');

  const load = async () => {
    try {
      const [all, pending] = await Promise.all([
        apiService.get<UserItem[]>('/api/users/all'),
        apiService.get<UserItem[]>('/api/admin/pending-users'),
      ]);
      setUsers(all);
      setPendingUsers(pending);
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (userId: string, username: string) => {
    Alert.alert('Bestätigen', `Benutzer "${username}" freischalten?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Freischalten', onPress: async () => {
          try {
            await apiService.put(`/api/admin/approve-user/${userId}`);
            load();
          } catch (e: any) {
            Alert.alert('Fehler', e.message);
          }
        }
      }
    ]);
  };

  const reject = async (userId: string, username: string) => {
    Alert.alert('Ablehnen', `Benutzer "${username}" ablehnen und löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Ablehnen', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/api/admin/reject-user/${userId}`);
            load();
          } catch (e: any) {
            Alert.alert('Fehler', e.message);
          }
        }
      }
    ]);
  };

  const displayList = tab === 'pending' ? pendingUsers : users;

  if (loading) return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Benutzerverwaltung</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'pending' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('pending')}
        >
          <Text style={{ color: tab === 'pending' ? colors.primary : colors.textSecondary, fontWeight: '600' }}>
            Ausstehend {pendingUsers.length > 0 ? `(${pendingUsers.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'all' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('all')}
        >
          <Text style={{ color: tab === 'all' ? colors.primary : colors.textSecondary, fontWeight: '600' }}>
            Alle Benutzer ({users.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ padding: 16 }}
      >
        {displayList.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
              {tab === 'pending' ? 'Keine ausstehenden Anfragen' : 'Keine Benutzer'}
            </Text>
          </View>
        ) : (
          displayList.map(user => (
            <View key={user.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.username, { color: colors.text }]}>{user.username}</Text>
                  <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
                  <View style={styles.badges}>
                    <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={{ color: colors.primary, fontSize: 11 }}>{user.role}</Text>
                    </View>
                    {!user.is_approved && (
                      <View style={[styles.badge, { backgroundColor: '#FF9500' + '20' }]}>
                        <Text style={{ color: '#FF9500', fontSize: 11 }}>Ausstehend</Text>
                      </View>
                    )}
                    {!user.is_active && (
                      <View style={[styles.badge, { backgroundColor: '#FF3B30' + '20' }]}>
                        <Text style={{ color: '#FF3B30', fontSize: 11 }}>Inaktiv</Text>
                      </View>
                    )}
                  </View>
                </View>
                {tab === 'pending' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#34C759' }]}
                      onPress={() => approve(user.id, user.username)}
                    >
                      <Ionicons name="checkmark" size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FF3B30', marginLeft: 8 }]}
                      onPress={() => reject(user.id, user.username)}
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', padding: 12 },
  card: {
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  username: { fontSize: 15, fontWeight: '600' },
  email: { fontSize: 13, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  actions: { flexDirection: 'row' },
  actionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
```

- [ ] **Step 2: Link zur Benutzerverwaltung im Dashboard / Settings hinzufügen**

In `frontend/app/index.tsx`, suche nach dem Admin-Bereich (nach `settings` oder `admin`). Im Settings-Quick-Action-Bereich füge hinzu:

```typescript
// Im Dashboard Quick-Actions oder im Admin-Bereich:
{ icon: 'people', label: 'Benutzer', route: '/admin/users', adminOnly: true }
```

Finde den Block wo andere Admin-Links stehen (suche nach `admin` oder `Einstellungen` in index.tsx) und füge dort einen TouchableOpacity hinzu:

```typescript
<TouchableOpacity
  onPress={() => router.push('/admin/users' as any)}
  style={[styles.quickAction, { backgroundColor: colors.card }]}
>
  <Ionicons name="people" size={22} color={colors.primary} />
  <Text style={[styles.quickActionLabel, { color: colors.text }]}>Benutzer</Text>
</TouchableOpacity>
```

- [ ] **Step 3: Testen**

- Browser öffnen: http://localhost:8081
- Als Admin einloggen
- Zur User-Management Seite navigieren
- Prüfen: Alle Benutzer werden angezeigt, Genehmigen/Ablehnen funktioniert

- [ ] **Step 4: Commit**

```bash
git add frontend/app/admin/users.tsx frontend/app/index.tsx
git commit -m "feat: add user management UI for admin (approve/reject pending users)"
```

---

## Task 9: Passwort Vergessen auf Login Screen

**Feature:** Link "Passwort vergessen?" auf dem Login-Screen der zu `/forgot-password` navigiert oder den Backend-Endpoint aufruft.

**Files:**
- Modify: `frontend/app/index.tsx` (Login-Screen)

- [ ] **Step 1: "Passwort vergessen" Link zum Login-Formular hinzufügen**

In `frontend/app/index.tsx`, suche nach dem Login-Formular-Block (um Zeile 957–965 wo der Login-Button ist). Füge nach dem Password-Input-Feld und vor dem Login-Button ein:

```typescript
{isLogin && (
  <TouchableOpacity
    style={{ alignSelf: 'flex-end', marginBottom: 12, marginTop: -4 }}
    onPress={() => setForgotPasswordVisible(true)}
  >
    <Text style={{ color: colors.primary, fontSize: 13 }}>Passwort vergessen?</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 2: State und Modal hinzufügen**

Am Anfang der `Index` Komponente (bei den anderen States), füge hinzu:
```typescript
const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
const [forgotEmail, setForgotEmail] = useState('');
const [forgotLoading, setForgotLoading] = useState(false);
```

- [ ] **Step 3: handleForgotPassword Funktion**

Füge nach `handleLogin` ein:
```typescript
const handleForgotPassword = async () => {
  if (!forgotEmail.trim()) {
    Alert.alert('Fehler', 'Bitte E-Mail-Adresse eingeben');
    return;
  }
  setForgotLoading(true);
  try {
    await apiService.post('/api/auth/forgot-password', { email: forgotEmail }, { skipAuth: true, showErrorAlert: false });
    Alert.alert('Erfolg', 'Falls diese E-Mail existiert, wurde ein Reset-Link gesendet.');
    setForgotPasswordVisible(false);
    setForgotEmail('');
  } catch (e: any) {
    Alert.alert('Fehler', e.message || 'Fehler beim Senden');
  } finally {
    setForgotLoading(false);
  }
};
```

- [ ] **Step 4: Modal-JSX ins Return einfügen**

Füge vor dem abschließenden `</KeyboardAvoidingView>` (wenn `!isLoggedIn`) ein:
```typescript
<Modal visible={forgotPasswordVisible} transparent animationType="fade">
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
    <View style={[styles.loginCard, { backgroundColor: colors.card }]}>
      <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 16 }]}>Passwort zurücksetzen</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
        placeholder="E-Mail-Adresse"
        placeholderTextColor={colors.textSecondary}
        value={forgotEmail}
        onChangeText={setForgotEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TouchableOpacity
        style={[styles.primaryButton, { marginTop: 12 }]}
        onPress={handleForgotPassword}
        disabled={forgotLoading}
      >
        {forgotLoading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '600' }}>Reset-Link senden</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setForgotPasswordVisible(false)}>
        <Text style={{ color: colors.textSecondary }}>Abbrechen</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

- [ ] **Step 5: Testen**

- Browser öffnen: http://localhost:8081
- Login-Screen: Link "Passwort vergessen?" sollte erscheinen
- Klick öffnet Modal mit E-Mail-Feld
- E-Mail eingeben → Reset-Link-Bestätigung erscheint

- [ ] **Step 6: Commit**

```bash
git add frontend/app/index.tsx
git commit -m "feat: add forgot password modal to login screen"
```

---

## Task 10: UTF-8 Double-Encoding Migration

**Bug:** Bestehende Datenbankeinträge haben doppelt kodierte Umlaute: `Empf\u00c3\u00a4nger` statt `Empf\u00e4nger`. Betrifft alle String-Felder in allen Collections.

**Files:**
- Create: `backend/fix_encoding.py` (einmalig auszuführendes Migrationsskript)

- [ ] **Step 1: Migration Script erstellen**

Erstelle `backend/fix_encoding.py`:

```python
"""
Einmaliges Skript zum Beheben von UTF-8 Double-Encoding in MongoDB.
Führe aus: py -3.12 fix_encoding.py
"""
import asyncio
import motor.motor_asyncio
from dotenv import load_dotenv
import os

load_dotenv()
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "inventory_db")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

def fix_string(s: str) -> str:
    """Fix double-encoded UTF-8: decode as latin-1, re-encode as utf-8."""
    if not isinstance(s, str):
        return s
    try:
        fixed = s.encode('latin-1').decode('utf-8')
        return fixed if fixed != s else s
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s

def fix_doc(doc: dict) -> tuple[dict, bool]:
    """Recursively fix all string fields. Returns (fixed_doc, was_changed)."""
    changed = False
    for key, value in doc.items():
        if key == '_id':
            continue
        if isinstance(value, str):
            fixed = fix_string(value)
            if fixed != value:
                doc[key] = fixed
                changed = True
        elif isinstance(value, dict):
            _, sub_changed = fix_doc(value)
            if sub_changed:
                changed = True
        elif isinstance(value, list):
            for i, item in enumerate(value):
                if isinstance(item, str):
                    fixed = fix_string(item)
                    if fixed != item:
                        value[i] = fixed
                        changed = True
                elif isinstance(item, dict):
                    _, sub_changed = fix_doc(item)
                    if sub_changed:
                        changed = True
    return doc, changed

COLLECTIONS = [
    "users", "articles", "categories", "customers", "events",
    "bookings", "suppliers", "crew", "vehicles", "teams",
    "maintenance_tasks", "maintenance_records", "invoices", "quotes",
    "movements", "storage_zones", "storage_locations",
]

async def main():
    total_fixed = 0
    for coll_name in COLLECTIONS:
        coll = db[coll_name]
        count = 0
        async for doc in coll.find({}):
            doc_id = doc.pop('_id')
            fixed_doc, changed = fix_doc(doc)
            if changed:
                await coll.replace_one({'_id': doc_id}, fixed_doc)
                count += 1
        print(f"{coll_name}: {count} Dokumente korrigiert")
        total_fixed += count
    print(f"\nGesamt: {total_fixed} Dokumente korrigiert")

asyncio.run(main())
```

- [ ] **Step 2: Script ausführen**

```bash
cd "C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main\backend"
py -3.12 fix_encoding.py
```

Erwartetes Ergebnis:
```
users: X Dokumente korrigiert
articles: X Dokumente korrigiert
customers: X Dokumente korrigiert
...
Gesamt: X Dokumente korrigiert
```

- [ ] **Step 3: Verifizieren**

```bash
TOKEN=$(curl -s -X POST http://localhost:8002/api/v1/login -H "Content-Type: application/json" -d '{"username":"Admin","password":"YNwJT56G"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8002/api/v1/customers -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json; d=json.load(sys.stdin)
for c in d[:3]: print(c.get('contact_person','') or c.get('company_name',''))
"
```

Umlaute sollten korrekt angezeigt werden: `Empfänger` (nicht `EmpfÃ¤nger`).

- [ ] **Step 4: Commit**

```bash
git add backend/fix_encoding.py
git commit -m "fix: add UTF-8 double-encoding migration script for existing DB records"
```

---

## Abschluss

Nach Erledigung aller Tasks:

- [ ] Backend neu starten: `py -3.12 server.py`
- [ ] Frontend neu starten: `npm start`
- [ ] Vollständiger Test aller Seiten im Browser (http://localhost:8081)
- [ ] Prüfen: Dashboard zeigt korrekte Low-Stock und Inventory-Value
- [ ] Prüfen: Artikel erstellen ohne inventory_code → auto-generiert
- [ ] Prüfen: Alle Settings/Serial-Numbers/Stock-Count Seiten → kein 404 mehr
- [ ] Prüfen: Passwort-Vergessen Modal funktioniert
- [ ] Prüfen: Admin → User Management Seite erreichbar und funktionsfähig

---

## Reihenfolge-Empfehlung

1. Task 6 (v1 Routes) — betrifft die meisten Seiten
2. Task 7 (apiService Rewrite entfernen) — sofortiger Login-Fix
3. Task 1 (inventory_code) — Artikel anlegen funktioniert
4. Task 2 (Low-Stock) — Dashboard korrekt
5. Task 3 (Inventory Value) — Dashboard korrekt
6. Task 4 (Invoice) — Rechnungen frei erstellbar
7. Task 5 (Booking Error) — bessere Fehlermeldung
8. Task 8 (User Management) — neues Feature
9. Task 9 (Passwort vergessen) — neues Feature
10. Task 10 (UTF-8 Migration) — Datenpflege

