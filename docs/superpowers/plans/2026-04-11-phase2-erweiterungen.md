# Phase 2: Frontend-Erweiterungen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WebSocket-Integration im Dashboard, Dashboard-Erweiterungen (Top-10, Inventarwert, offene Rechnungen), Passwort-Änderung korrekt verdrahten, Seriennummern-Screen testen/fixen.

**Architecture:** Alle Änderungen im `frontend/` Verzeichnis. `frontend/app/index.tsx` ist der kombinierte Login+Dashboard-Screen. `useWebSocket` Hook existiert bereits in `frontend/hooks/useWebSocket.ts`.

**Tech Stack:** React Native, Expo Router, TypeScript, AsyncStorage

---

## Kontext für den Implementierer

- Frontend starten: `cd frontend && npx expo start --port 8081`
- Backend-URL: `http://localhost:8002` (in `frontend/.env` und `frontend/app.json`)
- `useWebSocket(onMessage)` Hook: `frontend/hooks/useWebSocket.ts` — existiert, bereits in articles/index.tsx und events/index.tsx genutzt
- `apiService` in `frontend/services/apiService.ts` — zentrale HTTP-Klasse, nutzt AsyncStorage für Token
- Dashboard ist in `frontend/app/index.tsx` — großer Screen mit Login-Modal und Dashboard-Ansicht
- Settings-Screen: `frontend/app/settings/index.tsx` — ruft Passwort-Änderung via `fetch` auf Zeile ~375

---

## Task 1: Dashboard — WebSocket Integration

**Ziel:** Dashboard aktualisiert sich automatisch wenn Artikel oder Buchungen sich ändern — kein manueller Refresh nötig.

**Files:**
- Modify: `frontend/app/index.tsx`

- [ ] **Step 1: Lese den Dashboard-Teil von index.tsx**

```bash
grep -n "useWebSocket\|loadDashboard\|fetchStats\|dashboard/stats\|DashboardStats" frontend/app/index.tsx | head -30
```

Notiere die Zeilennummern der `loadDashboard`/`fetchStats` Funktion und wo der Screen gerendert wird.

- [ ] **Step 2: Füge WebSocket-Import hinzu**

In `frontend/app/index.tsx`, füge den Import hinzu (falls noch nicht vorhanden):

```typescript
import { useWebSocket } from '../hooks/useWebSocket';
```

- [ ] **Step 3: WebSocket-Hook im Dashboard-Bereich einbinden**

In der Dashboard-Komponente (nach dem Login-Check, wo `loadDashboard` aufgerufen wird), füge hinzu:

```typescript
// WebSocket: auto-refresh dashboard on data changes
useWebSocket((msg) => {
  if (
    msg.type === 'article_created' ||
    msg.type === 'article_updated' ||
    msg.type === 'article_deleted' ||
    msg.type === 'booking_created' ||
    msg.type === 'booking_cancelled' ||
    msg.type === 'event_created' ||
    msg.type === 'event_updated'
  ) {
    loadDashboardStats();  // Name der bestehenden Ladefunktion anpassen
  }
});
```

**Wichtig:** Finde den exakten Namen der Dashboard-Ladefunktion in index.tsx (z.B. `loadDashboardStats`, `fetchDashboard`, `loadStats`) und nutze diesen.

- [ ] **Step 4: Teste im Browser**

```bash
cd frontend && npx expo start --port 8081
```

Öffne App, logge ein. Erstelle in einem anderen Tab einen neuen Artikel via API:
```bash
curl -X POST http://localhost:8002/api/articles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"WS-Test","current_stock":5}'
```

Dashboard sollte sich automatisch aktualisieren.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/index.tsx
git commit -m "feat: add WebSocket auto-refresh to dashboard"
```

---

## Task 2: Dashboard — Inventarwert, Top-10, Offene Rechnungen anzeigen

**Ziel:** Die neuen Dashboard-Stats (aus Phase 1 Backend-Task 3) im UI anzeigen.

**Files:**
- Modify: `frontend/app/index.tsx`

- [ ] **Step 1: Prüfe aktuelle DashboardStats-Typdefinition**

```bash
grep -n "DashboardStats\|total_inventory_value\|top_rented\|pending_invoices" frontend/app/index.tsx | head -20
```

- [ ] **Step 2: Erweitere DashboardStats Interface**

Finde das `interface DashboardStats` (oder `type DashboardStats`) in `index.tsx`. Füge hinzu:

```typescript
interface DashboardStats {
  // ... existing fields ...
  total_inventory_value: number;
  top_rented_articles: Array<{ id: string; name: string; booking_count: number }>;
  pending_invoices_total: number;
  pending_invoices_count: number;
}
```

- [ ] **Step 3: Inventarwert-Karte anzeigen**

Suche in der JSX-Ausgabe des Dashboards nach den Kennzahl-Karten (wahrscheinlich gibt es schon eine Karte für `total_articles`, `low_stock_articles` etc.). Füge eine neue Karte hinzu:

```tsx
{/* Inventarwert */}
<View style={[styles.statCard, { backgroundColor: colors.card }]}>
  <Ionicons name="wallet-outline" size={24} color="#34C759" />
  <Text style={[styles.statValue, { color: colors.text }]}>
    {stats.total_inventory_value !== undefined
      ? `€ ${stats.total_inventory_value.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
      : '—'}
  </Text>
  <Text style={[styles.statLabel, { color: colors.subText }]}>Inventarwert</Text>
</View>

{/* Offene Rechnungen */}
<View style={[styles.statCard, { backgroundColor: colors.card }]}>
  <Ionicons name="receipt-outline" size={24} color="#FF9500" />
  <Text style={[styles.statValue, { color: colors.text }]}>
    {stats.pending_invoices_count ?? 0}
  </Text>
  <Text style={[styles.statLabel, { color: colors.subText }]}>
    Offene Rechnungen {stats.pending_invoices_total > 0 ? `(€ ${stats.pending_invoices_total.toLocaleString('de-DE', { minimumFractionDigits: 2 })})` : ''}
  </Text>
</View>
```

Passe die StyleSheet-Klassen (`statCard`, `statValue`, `statLabel`) an die bestehenden Stile an.

- [ ] **Step 4: Top-10-Widget anzeigen**

Füge nach den Kennzahl-Karten ein neues Widget hinzu:

```tsx
{/* Top 10 Artikel */}
{stats.top_rented_articles && stats.top_rented_articles.length > 0 && (
  <View style={[styles.section, { backgroundColor: colors.card }]}>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>
      Top 10 meist-gebuchte Artikel
    </Text>
    {stats.top_rented_articles.slice(0, 10).map((item, index) => (
      <View key={item.id} style={styles.topRentedRow}>
        <Text style={[styles.topRentedRank, { color: colors.subText }]}>
          {index + 1}.
        </Text>
        <Text style={[styles.topRentedName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.topRentedCount, { color: '#007AFF' }]}>
          {item.booking_count}x
        </Text>
      </View>
    ))}
  </View>
)}
```

Füge diese Styles in das StyleSheet hinzu:

```typescript
topRentedRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 4,
},
topRentedRank: {
  width: 24,
  fontSize: 13,
},
topRentedName: {
  flex: 1,
  fontSize: 14,
},
topRentedCount: {
  fontSize: 14,
  fontWeight: '600',
  marginLeft: 8,
},
```

- [ ] **Step 5: Visuell prüfen**

Öffne App, logge ein, prüfe Dashboard. Inventarwert-Karte und Top-10-Liste sollen sichtbar sein.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/index.tsx
git commit -m "feat: display inventory value, top-10 articles and pending invoices on dashboard"
```

---

## Task 3: Passwort-Änderung korrekt verdrahten

**Problem:** `frontend/app/settings/index.tsx` Zeile ~375 ruft `/api/users/change-password` über `fetch` auf — aber der Endpoint ist `/api/v1/users/change-password` (via api_router). Prüfen und ggf. fixen.

**Files:**
- Modify: `frontend/app/settings/index.tsx`

- [ ] **Step 1: Finde den Passwort-Change-Code in settings/index.tsx**

```bash
grep -n "change-password\|changePassword\|currentPassword\|newPassword" frontend/app/settings/index.tsx | head -20
```

- [ ] **Step 2: Prüfe ob der Endpoint korrekt aufgerufen wird**

Lese den betroffenen Code-Block (ca. 10 Zeilen um Zeile 375).

Erwartetes korrektes Verhalten:
- Nutzt `apiService.post('/api/users/change-password', {...})` ODER
- Nutzt `fetch` mit korrekter URL

Falls `fetch` genutzt wird: ersetze durch `apiService.post` damit Auth-Token automatisch mitgeschickt wird:

```typescript
// Ersetze den fetch-Block durch:
const result = await apiService.post<{ message: string }>(
  '/api/users/change-password',
  {
    current_password: currentPassword,
    new_password: newPassword,
  }
);
```

**Wichtig:** `apiService.post` hängt automatisch den Bearer-Token an. Der `fetch`-Aufruf muss manuell den Token holen, was fehleranfällig ist.

- [ ] **Step 3: Backend-Endpoint prüfen**

```bash
grep -n "change-password\|change_password" backend/server.py | head -10
```

Erwartete Ausgabe: `@api_router.post("/users/change-password")` existiert.

Prüfe ob der Endpoint `current_password` und `new_password` als Body-Parameter erwartet:

```bash
sed -n '6717,6760p' backend/server.py
```

- [ ] **Step 4: Manuelle Test**

In der App: Settings → Passwort-Sektion öffnen → aktuelles Passwort eingeben → neues Passwort eingeben → Speichern.

Erwartete Ausgabe: Erfolgsmeldung ohne Fehler.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/settings/index.tsx
git commit -m "fix: use apiService for password change to ensure auth token is sent"
```

---

## Task 4: Seriennummern-Screen verifizieren & fixen

**Ziel:** `frontend/app/serial-numbers/index.tsx` funktioniert — Seriennummern laden, erstellen, Status ändern.

**Files:**
- Modify: `frontend/app/serial-numbers/index.tsx` (falls nötig)

- [ ] **Step 1: Prüfe welche Backend-Endpoints der Screen aufruft**

```bash
grep -n "apiService\.\|/api/" frontend/app/serial-numbers/index.tsx | head -20
```

- [ ] **Step 2: Prüfe ob die Endpoints im Backend existieren**

Für jeden gefundenen Endpoint:
```bash
grep -n "<endpoint-pfad>" backend/server.py | head -5
```

Falls ein Endpoint fehlt — notiere es und implementiere einen einfachen Stub:

```python
@api_router.get("/serial-numbers")
async def get_serial_numbers(
    article_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if article_id:
        query["article_id"] = article_id
    items = await db.serial_numbers.find(query).sort("created_at", -1).to_list(1000)
    return items
```

- [ ] **Step 3: Screen in App öffnen**

Navigiere zu Serial Numbers Screen. Prüfe:
- [ ] Seite lädt ohne Fehler
- [ ] Liste zeigt vorhandene Seriennummern (oder leere Liste)
- [ ] "Neu anlegen" Modal öffnet sich
- [ ] Seriennummer anlegen funktioniert
- [ ] Status ändern (verfügbar → verliehen) funktioniert

- [ ] **Step 4: Fixen was nicht funktioniert**

Falls API-Fehler: prüfe Browser-Console / Expo-Logs für den genauen Fehler.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/serial-numbers/index.tsx backend/server.py
git commit -m "fix: serial numbers screen endpoint verification and fixes"
```

---

## Task 5: Bookings-Screen WebSocket Integration

**Ziel:** `frontend/app/bookings/index.tsx` aktualisiert sich automatisch wenn neue Buchungen erstellt werden.

**Files:**
- Modify: `frontend/app/bookings/index.tsx`

- [ ] **Step 1: Prüfe ob WebSocket bereits genutzt wird**

```bash
grep -n "useWebSocket" frontend/app/bookings/index.tsx
```

Falls vorhanden: überspringen. Falls nicht:

- [ ] **Step 2: Import und Hook hinzufügen**

```typescript
import { useWebSocket } from '../../hooks/useWebSocket';
```

Finde die Ladefunktion (z.B. `loadBookings`, `fetchBookings`). Füge hinzu:

```typescript
useWebSocket((msg) => {
  if (msg.type === 'booking_created' || msg.type === 'booking_cancelled') {
    loadBookings();
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/bookings/index.tsx
git commit -m "feat: add WebSocket auto-refresh to bookings screen"
```
