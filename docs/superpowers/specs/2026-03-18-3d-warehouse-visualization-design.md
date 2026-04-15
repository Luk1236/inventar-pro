# Isometrische Lagervisualisierung — Design

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan.

**Goal:** Interaktive isometrische Lagervisualisierung — Regale mit Artikeln in isometrischer 3D-Perspektive anzeigen, per Klick Artikel zwischen Lagerplätzen verschieben. Funktioniert auf Web und nativ.

**Architecture:** Vollständig auf `react-native-svg` (bereits installiert) basierend. Isometrische Projektion via SVG-Transformationen (keine externen 3D-Pakete). Seitenpanel als normales React Native View. Beide Plattformen — kein Platform-Split nötig.

**Tech Stack:** `react-native-svg` (vorhanden), React Native, TypeScript, FastAPI (vorhanden). Keine neuen Pakete.

---

## Datenmodell (vorhanden)

```
StorageZone:     id, name, type (Innenlager/Sperrlager/Transport), description
StorageLocation: id, zone_id, name, type (Regal/Fach/Case/Container), capacity
Article:         id, name, inventory_code, current_stock, min_stock_level, storage_location_id
```

Join: `StorageLocation.zone_id → StorageZone.id`, `Article.storage_location_id → StorageLocation.id`

API (vorhanden):
- `GET /api/storage-zones`
- `GET /api/storage-locations`
- `GET /api/articles`
- `PUT /api/articles/{id}` — body: `{ storage_location_id: string }`, Bearer-Token aus AsyncStorage

---

## Neue Quelldateien

| Datei | Zweck |
|---|---|
| `frontend/app/warehouse/index.tsx` | Screen: Datenladen, Zustand, Layout |
| `frontend/components/warehouse/IsometricWarehouse.tsx` | SVG-Canvas mit isometrischer Szene |
| `frontend/components/warehouse/IsometricShelf.tsx` | Ein Regal in isometrischer SVG-Darstellung |
| `frontend/components/warehouse/IsometricBox.tsx` | Eine Artikel-Box auf dem Regal |
| `frontend/components/warehouse/LocationPanel.tsx` | Seitenpanel: Artikelliste + Verschieben |
| `frontend/utils/warehouseUtils.ts` | Pure Funktionen: iso-Projektion, Farben, Filterung |

---

## Isometrische Projektion (`warehouseUtils.ts`)

Isometrisch bedeutet: 3D-Koordinaten (x, y, z) → 2D SVG-Koordinaten (sx, sy).

```typescript
// Isometrische Projektion: 3D → 2D SVG
export function isoProject(x: number, y: number, z: number): { sx: number; sy: number } {
  return {
    sx: (x - z) * Math.cos(Math.PI / 6) * TILE_SIZE,
    sy: (x + z) * Math.sin(Math.PI / 6) * TILE_SIZE - y * TILE_SIZE,
  };
}

export const TILE_SIZE = 40; // Basisgröße in Pixeln

// Berechnet Gitterposition eines Lagerplatzes in seiner Zone
export function getLocationGridPos(
  locationIndex: number,
  zoneIndex: number,
  cols: number = 4
): { gx: number; gz: number } {
  return {
    gx: zoneIndex * (cols + 2) + (locationIndex % cols),
    gz: Math.floor(locationIndex / cols),
  };
}

// Stockfarbe basierend auf Bestand
export function getStockColor(current: number, minLevel: number): string {
  if (current < minLevel) return '#FF3B30';
  if (current === minLevel) return '#FF9500';
  return '#34C759';
}

// Artikel für einen Lagerplatz filtern
export function getArticlesForLocation(articles: Article[], locationId: string): Article[] {
  return articles.filter(a => a.storage_location_id === locationId);
}

// Locations einer Zone filtern
export function getLocationsForZone(locations: StorageLocation[], zoneId: string): StorageLocation[] {
  return locations.filter(l => l.zone_id === zoneId);
}
```

---

## Screen: `frontend/app/warehouse/index.tsx`

**Datenladen (useEffect on mount):**
```typescript
const [zones, setZones] = useState<StorageZone[]>([]);
const [locations, setLocations] = useState<StorageLocation[]>([]);
const [articles, setArticles] = useState<Article[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

// Parallel fetch aller 3 Endpunkte via apiService.get()
// setLoading(false) wenn alle fertig
// setError(...) wenn einer fehlschlägt
```

**Loading-State:** Vollbild `<ActivityIndicator size="large" />` mit Text „Lager wird geladen…"

**Error-State:** Fehlermeldung + „Erneut versuchen"-Button der `loadData()` nochmal aufruft

**Empty-State:** Wenn `zones.length === 0` → Text „Keine Lagerplätze angelegt. Bitte zuerst Zonen erstellen."

**Layout:**
```
<View style={{ flex: 1 }}>
  <IsometricWarehouse ... />   {/* ScrollView + SVG */}
  {selectedLocationId && (
    <LocationPanel ... />       {/* absolut rechts */}
  )}
</View>
```

**Navigation:** In `frontend/app/_layout.tsx` registrieren:
```tsx
<Stack.Screen name="warehouse/index" options={{ title: 'Lager', headerShown: true }} />
```

---

## `frontend/components/warehouse/IsometricWarehouse.tsx`

```tsx
// ScrollView (horizontal + vertical) enthält SVG
// SVG-Breite/Höhe: dynamisch berechnet aus Anzahl Zones/Locations
// viewBox: groß genug für alle Regale

<ScrollView horizontal>
  <ScrollView>
    <Svg width={svgWidth} height={svgHeight}>
      {/* Boden-Fläche pro Zone (isometrische Raute) */}
      {zones.map((zone, zi) => (
        <ZoneFloor key={zone.id} zone={zone} zoneIndex={zi} locationCount={...} />
      ))}
      {/* Regale sortiert nach Tiefe (Painter's Algorithm: hinten zuerst) */}
      {sortedLocations.map((loc) => (
        <IsometricShelf
          key={loc.id}
          location={loc}
          articles={getArticlesForLocation(articles, loc.id)}
          position={getLocationGridPos(locIndex, zoneIndex)}
          isSelected={loc.id === selectedLocationId}
          onPress={() => setSelectedLocationId(loc.id)}
        />
      ))}
    </Svg>
  </ScrollView>
</ScrollView>
```

**Painter's Algorithm:** Locations nach `gz + gx` absteigend sortieren, damit vordere Regale über hinteren gezeichnet werden.

**Props:** `zones`, `locations`, `articles`, `selectedLocationId`, `onLocationSelect`

---

## `frontend/components/warehouse/IsometricShelf.tsx`

Zeichnet ein Regal aus SVG-Polygonen in isometrischer Perspektive:

**Struktur eines isometrischen Regals:**
- **Seitenansicht links** (dunkelblau): Parallelogramm
- **Frontansicht** (blau): Parallelogramm
- **Deckfläche** (hellblau): Raute oben
- **3 Regalböden** (orange Streifen auf Front + Seite)
- **Artikel-Boxen** (`<IsometricBox>`) auf jedem Boden

**Höhe des Regals:** 3 Etagen à `TILE_SIZE` Höhe

**isSelected:** Alle Flächen mit Stroke `#FFD700` (gold) und `strokeWidth={2}`

**onPress:** `<G onPress={onPress}>` um alle Regal-Elemente

**Props:** `location: StorageLocation`, `articles: Article[]`, `position: {gx, gz}`, `isSelected: boolean`, `onPress: () => void`

**Berechnung der Eckpunkte** via `isoProject()` aus `warehouseUtils.ts`:
```typescript
// Regal-Grundriss: Würfel-Basis an (gx, 0, gz)
const base = isoProject(gx, 0, gz);
// 8 Eckpunkte des Regalkubus berechnen, dann Flächen zeichnen
```

---

## `frontend/components/warehouse/IsometricBox.tsx`

Kleine isometrische Box (0.4×0.4×0.4 Einheiten) auf einem Regalboden:

- 3 Flächen: oben (hell), links (mittel), rechts (dunkel) — gibt 3D-Effekt
- Farbe: `getStockColor(article.current_stock, article.min_stock_level)`
- Dunkel/Hell-Variante: `color` = Basisfarbe, `darken(color)` für Seiten
- Props: `article: Article`, `gridX: number`, `gridY: number`, `gridZ: number` (Etage)

**Hilfsfunktion in warehouseUtils.ts:**
```typescript
export function darkenColor(hex: string, amount: number = 40): string {
  // RGB hex → subtrahiere amount → zurück zu hex
}
```

---

## `frontend/components/warehouse/LocationPanel.tsx`

**Positionierung:** absolut, rechts, volle Höhe, Breite 300px (auf kleinen Screens: 100% Breite als Bottom-Sheet via flex)

```tsx
<View style={styles.panel}>
  {/* Header */}
  <View style={styles.header}>
    <Text style={styles.zoneName}>{zone.name}</Text>
    <Text style={styles.locationName}>{location.name}</Text>
    <TouchableOpacity onPress={onClose}><Text>✕</Text></TouchableOpacity>
  </View>

  {/* Artikelliste */}
  <FlatList
    data={articles}  // bereits gefiltert für diese Location
    renderItem={({ item }) => <ArticleRow article={item} onMove={startMove} />}
  />

  {/* Verschieben-Auswahl (wenn movingArticleId gesetzt) */}
  {movingArticleId && (
    <View style={styles.picker}>
      <Text>Ziel-Lagerplatz wählen:</Text>
      <FlatList
        data={allLocations.filter(l => l.id !== location.id)}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => confirmMove(item.id)}>
            <Text>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )}
</View>
```

**Verschieben-Flow:**
1. „Verschieben" → `setMovingArticleId(article.id)`
2. User tippt Ziel-Location → `confirmMove(targetLocationId)`:
   - Optimistisch: `onArticleMoved(articleId, targetLocationId)` sofort aufrufen (Parent updated State)
   - `PUT /api/articles/{articleId}` via `apiService.put()` (hat Auth-Header automatisch)
   - Bei Fehler: `Alert.alert('Fehler', ...)` + Rollback via `onArticleMoved(articleId, oldLocationId)`
3. `setMovingArticleId(null)`, Panel bleibt offen (zeigt neuen Zustand)

**Props:** `location: StorageLocation`, `zone: StorageZone`, `articles: Article[]`, `allLocations: StorageLocation[]`, `onClose: () => void`, `onArticleMoved: (articleId: string, newLocationId: string) => void`

---

## Navigation & Einstiegspunkt

`frontend/app/_layout.tsx` — neuen Screen registrieren:
```tsx
<Stack.Screen name="warehouse/index" options={{ title: 'Lager', headerShown: true }} />
```

Im Dashboard (`frontend/app/index.tsx` oder Tabs) einen Link hinzufügen:
```tsx
<TouchableOpacity onPress={() => router.push('/warehouse')}>
  <Text>🏭 Lager 3D</Text>
</TouchableOpacity>
```

---

## Tests (`frontend/__tests__/warehouse/`)

**`warehouseUtils.test.ts`** — alle pure Funktionen, kein Rendering:
```typescript
// isoProject
expect(isoProject(0, 0, 0)).toEqual({ sx: 0, sy: 0 });
expect(isoProject(1, 0, 0).sx).toBeGreaterThan(0);
expect(isoProject(0, 1, 0).sy).toBeLessThan(0); // y geht nach oben

// getLocationGridPos
expect(getLocationGridPos(0, 0)).toEqual({ gx: 0, gz: 0 });
expect(getLocationGridPos(4, 0)).toEqual({ gx: 4 % 4, gz: 1 }); // neue Reihe
expect(getLocationGridPos(0, 1)).toEqual({ gx: 6, gz: 0 }); // neue Zone (cols+2=6)

// getStockColor
expect(getStockColor(5, 10)).toBe('#FF3B30');
expect(getStockColor(10, 10)).toBe('#FF9500');
expect(getStockColor(15, 10)).toBe('#34C759');

// darkenColor
expect(darkenColor('#34C759', 40)).toMatch(/^#[0-9a-f]{6}$/i);

// getArticlesForLocation
const articles = [{ storage_location_id: 'a' }, { storage_location_id: 'b' }];
expect(getArticlesForLocation(articles, 'a')).toHaveLength(1);

// getLocationsForZone
const locs = [{ zone_id: 'z1' }, { zone_id: 'z2' }];
expect(getLocationsForZone(locs, 'z1')).toHaveLength(1);
```

**`locationPanel.test.ts`** — testet nur die Callback-Logik (kein Rendering):
```typescript
// onArticleMoved wird mit korrekten IDs aufgerufen
// onClose wird aufgerufen
// apiService.put wird mit korrektem Endpunkt aufgerufen
// Bei API-Fehler: Rollback-Aufruf
```
→ Diese Tests mocken `apiService` und testen die Handler-Funktionen direkt (extrahiert aus Komponente).

---

## Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| API-Ladefehler beim Start | Error-State mit Retry-Button |
| Keine Zonen in DB | Empty-State mit Hinweis |
| Zone ohne Locations | Zone-Boden gezeichnet, keine Regale darin |
| Location ohne Artikel | Leeres Regal (nur Rahmen, keine Boxen) |
| PUT schlägt fehl | Alert + optimistisches Update zurückrollen |
| Sehr viele Locations | ScrollView ermöglicht scrollen |

---

## Korrekturen und Präzisierungen

### Bestand pro Lagerplatz (client-seitig berechnet)
`StorageLocation` hat kein `current_stock`-Feld. Der Bestand wird client-seitig abgeleitet:
```typescript
// In warehouseUtils.ts
export function getStockForLocation(articles: Article[], locationId: string): number {
  return getArticlesForLocation(articles, locationId)
    .reduce((sum, a) => sum + (a.current_stock ?? 0), 0);
}
export function getMinStockForLocation(articles: Article[], locationId: string): number {
  return getArticlesForLocation(articles, locationId)
    .reduce((sum, a) => sum + (a.min_stock_level ?? 0), 0);
}
```
`IsometricShelf` und `IsometricBox` erhalten Artikel als Props und leiten Farben daraus ab.

### PUT-Payload beim Verschieben (vollständiges Article-Objekt nötig)
`PUT /api/articles/{id}` erwartet das vollständige `ArticleCreate`-Schema (inkl. `name`, `inventory_code`). PATCH gibt es nicht. Der Move-Flow muss:
1. Das betroffene `Article`-Objekt aus dem lokalen `articles`-State laden (bereits vorhanden)
2. Klonen mit `{ ...article, storage_location_id: newLocationId }`
3. Das vollständige Objekt per `apiService.put(\`/api/articles/${articleId}\`, payload)` senden
4. Bei Fehler: Alert + Rollback auf `oldLocationId`

### Painter's Algorithm — Sortier-Schlüssel
Locations werden nach `gz + gx` aufsteigend sortiert, bevor die SVG-Elemente gerendert werden (hinten = kleinerer Wert zuerst):
```typescript
const sorted = [...locationsWithPos].sort((a, b) => (a.gz + a.gx) - (b.gz + b.gx));
```

### Web-Scrolling
Auf Web braucht die äußere `ScrollView` `style={{ overflow: 'scroll' }}` damit das SVG scrollbar ist. Die `Svg`-Komponente bekommt feste `width` und `height` (berechnet aus Anzahl Locations).

### Interaktions-Test auf nativem New Architecture
`<G onPress={...}>` aus `react-native-svg` nutzt `SvgTouchableMixin`. Muss nach Implementierung auf Android mit `newArchEnabled: true` getestet werden. Falls `onPress` nicht feuert: Alternative ist ein transparentes `<Rect>` über dem Regal als Tap-Target.

### `locationPanel.test.ts` — nur Handler-Logik
Die Testdatei importiert **nicht** `LocationPanel` direkt (würde FlatList/Svg laden). Stattdessen werden die Handler-Funktionen als separate named exports aus einer `locationPanelLogic.ts` Hilfsdatei extrahiert und dort getestet:
- `buildMovePayload(article, newLocationId)` → gibt vollständiges Article-Objekt zurück
- Die Tests mocken `apiService.put` und prüfen Aufruf + Rollback-Logik
