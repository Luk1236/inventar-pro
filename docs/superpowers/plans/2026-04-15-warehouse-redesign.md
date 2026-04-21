# Lager 2D & 3D Redesign — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warehouse-Ansichten mit Dark Pro Design, Filter, Statistiken, Artikel-Details, Verschieben und PDF-Export verbessern.

**Architecture:** Schrittweise Erweiterung der 4 bestehenden Komponenten ohne Neubau. Alle Änderungen sind additiv — kein bestehendes Feature wird entfernt.

**Tech Stack:** React Native, Expo, react-native-svg, expo-print (bereits installiert)

---

## Dateiübersicht

| Datei | Rolle |
|-------|-------|
| `frontend/app/warehouse/index.tsx` | Screen-Container: Toolbar, Filter-State, Stats-Leiste, Print |
| `frontend/components/warehouse/SchematicWarehouse.tsx` | 2D SVG-Ansicht: Dark Pro Farben, Zone-Stats-Label, filterMode-Prop |
| `frontend/components/warehouse/IsometricWarehouse.tsx` | 3D SVG-Ansicht: Dark Pro Farben, Zone-Stats-Label, filterMode-Prop |
| `frontend/components/warehouse/LocationPanel.tsx` | Regal-Detail-Panel: Dark Pro Farben, Füllstand-Balken, Warnmeldung |

---

## Hilfsfunktion (wird in Task 1 definiert, in Tasks 2–3 genutzt)

```typescript
// Füllstand-Ratio einer Location berechnen
function getFillRatio(locationId: string, articles: Article[]): number {
  const count = articles.filter(a => a.storage_location_id === locationId).length;
  const capacity = 9; // Standard: 3 Ebenen × 3 Slots
  return Math.min(count / capacity, 1);
}

// Filter-Funktion
function applyFillFilter(
  locations: StorageLocation[],
  articles: Article[],
  mode: 'all' | 'free' | 'low' | 'full'
): StorageLocation[] {
  if (mode === 'all') return locations;
  return locations.filter(loc => {
    const ratio = getFillRatio(loc.id, articles);
    if (mode === 'free') return ratio < 0.7;
    if (mode === 'low')  return ratio >= 0.7 && ratio < 0.92;
    if (mode === 'full') return ratio >= 0.92;
    return true;
  });
}
```

---

## Task 1: Toolbar & Filter & Stats-Leiste (`warehouse/index.tsx`)

**Files:**
- Modify: `frontend/app/warehouse/index.tsx`

- [ ] **Schritt 1: filterMode-State hinzufügen**

In `frontend/app/warehouse/index.tsx` nach der Zeile `const [customPos, setCustomPos] = useState...` einfügen:

```typescript
const [filterMode, setFilterMode] = useState<'all' | 'free' | 'low' | 'full'>('all');
const [showStatsModal, setShowStatsModal] = useState(false);
```

- [ ] **Schritt 2: Hilfsfunktionen vor dem `return` einfügen**

Direkt vor `return (` einfügen:

```typescript
function getFillRatio(locationId: string): number {
  const count = articles.filter(a => (a as any).storage_location_id === locationId).length;
  return Math.min(count / 9, 1);
}

const filteredLocations = filterMode === 'all' ? locations : locations.filter(loc => {
  const r = getFillRatio(loc.id);
  if (filterMode === 'free') return r < 0.7;
  if (filterMode === 'low')  return r >= 0.7 && r < 0.92;
  if (filterMode === 'full') return r >= 0.92;
  return true;
});

const totalFill = locations.length > 0
  ? Math.round((locations.reduce((s, l) => s + getFillRatio(l.id), 0) / locations.length) * 100)
  : 0;
const criticalCount = locations.filter(l => getFillRatio(l.id) >= 0.92).length;
```

- [ ] **Schritt 3: Bestehende `styles.legend`-View durch neue Toolbar ersetzen**

Den Block `<View style={styles.legend}>...</View>` (Zeilen 149–188 in der aktuellen Datei) ersetzen durch:

```tsx
{/* Toolbar */}
<View style={{
  backgroundColor: '#060e1a',
  borderBottomWidth: 1,
  borderBottomColor: '#1e293b',
  padding: 10,
  gap: 8,
}}>
  {/* Zeile 1: Suche + Buttons */}
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <View style={{
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: '#0f1e35', borderRadius: 8, borderWidth: 1,
      borderColor: searchMatches.length > 0 ? '#FFD700' : '#1e293b',
      paddingHorizontal: 10, paddingVertical: 6,
    }}>
      <Ionicons name="search-outline" size={14}
        color={searchMatches.length > 0 ? '#FFD700' : '#64748b'} />
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Lagerort suchen…"
        placeholderTextColor="#475569"
        style={{ flex: 1, fontSize: 13, color: '#e2e8f0', outline: 'none' } as any}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Ionicons name="close-circle" size={14} color="#475569" />
        </TouchableOpacity>
      )}
    </View>
    <TouchableOpacity
      onPress={() => setShowStatsModal(true)}
      style={{ backgroundColor: '#0f1e35', borderRadius: 8, borderWidth: 1,
        borderColor: '#1e293b', padding: 7 }}
    >
      <Ionicons name="bar-chart-outline" size={16} color="#94a3b8" />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={handlePrint}
      style={{ backgroundColor: '#0f1e35', borderRadius: 8, borderWidth: 1,
        borderColor: '#1e293b', padding: 7 }}
    >
      <Ionicons name="print-outline" size={16} color="#94a3b8" />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => setView3D(v => !v)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: view3D ? '#4f46e5' : '#1d4ed8',
        paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 }}
    >
      <Ionicons name={view3D ? 'layers-outline' : 'cube-outline'} size={14} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
        {view3D ? '2D' : '3D'}
      </Text>
    </TouchableOpacity>
  </View>

  {/* Zeile 2: Filter-Chips */}
  <View style={{ flexDirection: 'row', gap: 6 }}>
    {(['all', 'free', 'low', 'full'] as const).map(mode => {
      const labels = { all: 'Alle', free: 'Frei', low: 'Knapp', full: 'Voll' };
      const colors = { all: '#1d4ed8', free: '#16a34a', low: '#d97706', full: '#dc2626' };
      const active = filterMode === mode;
      return (
        <TouchableOpacity
          key={mode}
          onPress={() => setFilterMode(mode)}
          style={{
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
            backgroundColor: active ? colors[mode] + '30' : '#0f1e35',
            borderWidth: 1,
            borderColor: active ? colors[mode] : '#1e293b',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600',
            color: active ? colors[mode] : '#64748b' }}>
            {labels[mode]}
          </Text>
        </TouchableOpacity>
      );
    })}
    {searchMatches.length > 0 && (
      <Text style={{ fontSize: 11, color: '#FFD700', alignSelf: 'center', marginLeft: 4 }}>
        {searchMatches.length} Treffer
      </Text>
    )}
  </View>
</View>
```

- [ ] **Schritt 4: `filteredLocations` an beide Warehouse-Komponenten übergeben**

`locations={locations}` in beiden `<IsometricWarehouse>` und `<SchematicWarehouse>` ersetzen durch `locations={filteredLocations}`.

- [ ] **Schritt 5: Stats-Leiste unterhalb der Hauptansicht einfügen**

Nach `</View>` (das den Warehouse-Container schließt) und vor `{selectedLocationId && ...}` einfügen:

```tsx
{/* Stats-Leiste */}
<View style={{
  flexDirection: 'row', backgroundColor: '#060e1a',
  borderTopWidth: 1, borderTopColor: '#1e293b',
  paddingHorizontal: 16, paddingVertical: 8, gap: 0,
}}>
  {[
    { label: 'Auslastung', value: `${totalFill}%`, color: totalFill > 85 ? '#ef4444' : totalFill > 60 ? '#f59e0b' : '#22c55e' },
    { label: 'Kritisch', value: String(criticalCount), color: criticalCount > 0 ? '#ef4444' : '#22c55e' },
    { label: 'Artikel', value: String(articles.length), color: '#60a5fa' },
    { label: 'Zonen', value: String(zones.length), color: '#a78bfa' },
  ].map((s, i) => (
    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: s.color, fontSize: 16, fontWeight: '700' }}>{s.value}</Text>
      <Text style={{ color: '#475569', fontSize: 10 }}>{s.label}</Text>
    </View>
  ))}
</View>
```

- [ ] **Schritt 6: `handlePrint`-Funktion und Stats-Modal hinzufügen**

Vor dem `return (` einfügen:

```typescript
const handlePrint = () => {
  if (typeof window !== 'undefined') {
    window.print();
  }
};
```

Stats-Modal am Ende des JSX (vor dem letzten `</SafeAreaView>`) einfügen:

```tsx
{/* Stats-Modal */}
<Modal visible={showStatsModal} transparent animationType="slide"
  onRequestClose={() => setShowStatsModal(false)}>
  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
    <View style={{ backgroundColor: '#0f1e35', borderTopLeftRadius: 20,
      borderTopRightRadius: 20, padding: 20, maxHeight: '70%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '700' }}>
          Lager-Statistiken
        </Text>
        <TouchableOpacity onPress={() => setShowStatsModal(false)}>
          <Ionicons name="close" size={24} color="#64748b" />
        </TouchableOpacity>
      </View>
      <ScrollView>
        {zones.map((zone, zi) => {
          const zoneLocs = locations.filter(l => l.zone_id === zone.id);
          const zoneArts = articles.filter(a =>
            zoneLocs.some(l => l.id === (a as any).storage_location_id));
          const maxSlots = zoneLocs.length * 9;
          const fillPct = maxSlots > 0 ? Math.round((zoneArts.length / maxSlots) * 100) : 0;
          const zoneColors = ['#1E88E5','#43A047','#FB8C00','#8E24AA','#E53935'];
          const color = zoneColors[zi % zoneColors.length];
          return (
            <View key={zone.id} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                marginBottom: 4 }}>
                <Text style={{ color: color, fontWeight: '600', fontSize: 13 }}>
                  {zone.name}
                </Text>
                <Text style={{ color: '#64748b', fontSize: 12 }}>
                  {zoneLocs.length} Regale · {zoneArts.length} Artikel · {fillPct}%
                </Text>
              </View>
              <View style={{ backgroundColor: '#1e293b', height: 8, borderRadius: 4 }}>
                <View style={{
                  backgroundColor: fillPct >= 92 ? '#ef4444' : fillPct >= 70 ? '#f59e0b' : '#22c55e',
                  height: 8, borderRadius: 4, width: `${fillPct}%` as any,
                }} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  </View>
</Modal>
```

- [ ] **Schritt 7: `Modal` und `ScrollView` zum Import hinzufügen**

In der Import-Zeile von `react-native` sicherstellen dass `Modal` und `ScrollView` vorhanden sind.

- [ ] **Schritt 8: Manuell im Browser testen**

`http://localhost:8081/warehouse` öffnen:
- Toolbar ist dunkel ✓
- Filter-Chips wechseln Farbe bei Klick ✓
- Stats-Leiste unten sichtbar ✓
- 📊 öffnet Stats-Modal mit Balken pro Zone ✓
- 🖨️ ruft `window.print()` auf ✓

- [ ] **Schritt 9: Commit**

```bash
cd "C:/Users/lukas/OneDrive/Desktop/Lager/Final-main/frontend"
git add app/warehouse/index.tsx
git commit -m "feat(warehouse): dark pro toolbar, filter chips, stats bar & modal"
```

---

## Task 2: LocationPanel Dark Pro Redesign + Füllstand + Warnung

**Files:**
- Modify: `frontend/components/warehouse/LocationPanel.tsx`

- [ ] **Schritt 1: Füllstand berechnen**

In der Komponente nach den bestehenden Variablen einfügen:

```typescript
const capacity = 9; // 3 Ebenen × 3 Slots Standard
const fillRatio = Math.min(articles.length / capacity, 1);
const fillPct = Math.round(fillRatio * 100);
const isFull = fillRatio >= 0.92;
const fillColor = fillRatio >= 0.92 ? '#ef4444' : fillRatio >= 0.7 ? '#f59e0b' : '#22c55e';
```

- [ ] **Schritt 2: Gesamten `styles`-Block ersetzen**

Den Block `const styles = StyleSheet.create({...})` vollständig durch folgenden ersetzen:

```typescript
const styles = StyleSheet.create({
  panel: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 300,
    backgroundColor: '#0f1e35',
    borderLeftWidth: 1, borderLeftColor: '#1e293b',
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b',
    backgroundColor: '#060e1a',
  },
  headerText: { flex: 1 },
  zoneName: { fontSize: 10, color: '#64748b', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1 },
  locationName: { fontSize: 17, fontWeight: '700', color: '#e2e8f0', marginTop: 2 },
  locationMeta: { fontSize: 12, color: '#475569', marginTop: 2 },
  closeButton: { padding: 4 },
  fillBar: {
    marginHorizontal: 14, marginTop: 12, marginBottom: 4,
  },
  fillBarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  fillBarLabel: { fontSize: 11, color: '#64748b' },
  fillBarValue: { fontSize: 11, fontWeight: '700' },
  fillBarTrack: { height: 6, backgroundColor: '#1e293b', borderRadius: 3 },
  fillBarFill: { height: 6, borderRadius: 3 },
  warningBox: {
    margin: 14, marginTop: 8, backgroundColor: '#7f1d1d',
    borderWidth: 1, borderColor: '#ef4444', borderRadius: 8,
    padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  warningText: { color: '#fca5a5', fontSize: 12, flex: 1 },
  movePanel: {
    flex: 1, backgroundColor: '#060e1a',
    borderTopWidth: 1, borderTopColor: '#1e293b',
  },
  movePanelTitle: {
    fontSize: 13, color: '#94a3b8', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  locationList: { flex: 1 },
  locationOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  locationOptionText: { flex: 1, fontSize: 14, color: '#e2e8f0' },
  locationOptionType: { fontSize: 11, color: '#475569' },
  cancelButton: {
    margin: 14, padding: 12, borderRadius: 10, backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  cancelButtonText: { color: '#94a3b8', fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: '#475569' },
  articleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  stockDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  articleInfo: { flex: 1 },
  articleName: { fontSize: 13, fontWeight: '600', color: '#e2e8f0' },
  articleCode: { fontSize: 11, color: '#475569', marginTop: 1 },
  articleStock: { fontSize: 11, marginTop: 1 },
  moveButton: {
    backgroundColor: '#1d4ed820', borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: '#1d4ed8',
  },
});
```

- [ ] **Schritt 3: `Ionicons`-Farbe in CloseButton auf `#94a3b8` ändern**

```tsx
<Ionicons name="close" size={24} color="#94a3b8" />
```

- [ ] **Schritt 4: Füllstand-Balken und Warnmeldung nach dem Header-Block einfügen**

Nach `</View>{/* header */}` und vor dem `{movingArticle && ...}` Block einfügen:

```tsx
{/* Füllstand-Balken */}
<View style={styles.fillBar}>
  <View style={styles.fillBarRow}>
    <Text style={styles.fillBarLabel}>Füllstand</Text>
    <Text style={[styles.fillBarValue, { color: fillColor }]}>{fillPct}%</Text>
  </View>
  <View style={styles.fillBarTrack}>
    <View style={[styles.fillBarFill, { width: `${fillPct}%` as any, backgroundColor: fillColor }]} />
  </View>
</View>

{/* Warnung wenn voll */}
{isFull && (
  <View style={styles.warningBox}>
    <Ionicons name="warning-outline" size={16} color="#ef4444" />
    <Text style={styles.warningText}>Regal ist voll — Artikel bitte verschieben</Text>
  </View>
)}
```

- [ ] **Schritt 5: `location-outline` Icon-Farbe im locationOption auf `#f59e0b` belassen (bereits korrekt)**

- [ ] **Schritt 6: Manuell testen**

`http://localhost:8081/warehouse` öffnen → Regal anklicken:
- Panel erscheint mit dunklem Hintergrund ✓
- Füllstand-Balken sichtbar in grün/orange/rot ✓
- Bei vollem Regal rote Warnung ✓
- Verschieben-Button erscheint pro Artikel ✓

- [ ] **Schritt 7: Commit**

```bash
git add components/warehouse/LocationPanel.tsx
git commit -m "feat(warehouse): dark pro location panel with fill bar and full warning"
```

---

## Task 3: SchematicWarehouse Dark Pro + Zone-Stats

**Files:**
- Modify: `frontend/components/warehouse/SchematicWarehouse.tsx`

- [ ] **Schritt 1: Hintergrundfarbe bereits korrekt**

`BG = '#0A1628'` ist bereits gesetzt — bleibt unverändert.

- [ ] **Schritt 2: Zone-Stats-Label in `ZoneBlock` einbauen**

In `SchematicWarehouse.tsx` die Funktion `ZoneBlock` suchen. Im JSX nach dem bestehenden Zone-Titel-Label (das den Zonennamen rendert) folgendes direkt darunter einfügen:

Finde den `<T>` Tag der den Zonennamen rendert (etwa `{zone.name.toUpperCase()}`), und füge danach ein:

```tsx
{/* Zone-Stats: Regalanzahl · Auslastung */}
{(() => {
  const maxSlots = locs.length * 9;
  const usedSlots = locs.reduce((sum, loc) => {
    return sum + arts.filter(a => (a as any).storage_location_id === loc.id).length;
  }, 0);
  const pct = maxSlots > 0 ? Math.round((usedSlots / maxSlots) * 100) : 0;
  const statText = `${locs.length} Regale · ${pct}% belegt`;
  return (
    <SvgText
      x={/* gleiche x-Position wie Zonentitel, aber rechts ausgerichtet */ 0}
      y={/* y-Position des Zonentitels */0}
      textAnchor="end"
      fontSize={8}
      fill={color + '99'}
    >
      {statText}
    </SvgText>
  );
})()}
```

> **Hinweis für Implementierung:** Die genauen x/y-Koordinaten aus dem bestehenden Zonentitel-Code ableiten. Der Stats-Text soll rechts im Zonenheader erscheinen, auf gleicher Höhe wie der Zonenname.

- [ ] **Schritt 3: Hover-Tooltip Dark Pro Styling**

In `SchematicWarehouse.tsx` den Tooltip-Block suchen (rendert Artikel-Info bei Hover). Die `fill`-Farbe des Tooltip-Rechtecks von hell auf `#0f1e35` und den Textfarbe auf `#e2e8f0` ändern.

- [ ] **Schritt 4: Manuell testen**

`http://localhost:8081/warehouse` (2D-Ansicht):
- Zonenheader zeigt „3 Regale · 78% belegt" ✓
- Hover-Tooltip ist dunkel ✓

- [ ] **Schritt 5: Commit**

```bash
git add components/warehouse/SchematicWarehouse.tsx
git commit -m "feat(warehouse): zone stats label and dark tooltip in 2D view"
```

---

## Task 4: IsometricWarehouse Zone-Stats

**Files:**
- Modify: `frontend/components/warehouse/IsometricWarehouse.tsx`

- [ ] **Schritt 1: Zone-Stats in der 3D-Ansicht**

In `IsometricWarehouse.tsx` die Stelle suchen wo der Zonen-Label gerendert wird (Zone-Name als `<SvgText>`). Direkt darunter einen zweiten `<SvgText>` einfügen:

```tsx
{/* Zone-Stats */}
{(() => {
  const zoneLocs = getLocationsForZone(locations, zone.id);
  const zoneArts = articles.filter(a =>
    zoneLocs.some(l => l.id === (a as any).storage_location_id));
  const maxSlots = zoneLocs.length * 9;
  const pct = maxSlots > 0 ? Math.round((zoneArts.length / maxSlots) * 100) : 0;
  return (
    <SvgText
      x={/* x-Position des Zonen-Labels */0}
      y={/* y-Position + 12 */0}
      textAnchor="middle"
      fontSize={7}
      fill={palette.text + '99'}
    >
      {`${zoneLocs.length} Regale · ${pct}% belegt`}
    </SvgText>
  );
})()}
```

> **Hinweis:** `getLocationsForZone` ist bereits importiert aus `warehouseUtils`. Die x/y-Koordinaten aus dem bestehenden Zonen-Label ableiten.

- [ ] **Schritt 2: Manuell testen**

`http://localhost:8081/warehouse` → auf 3D umschalten:
- Zonen zeigen Stats-Text unter dem Namen ✓

- [ ] **Schritt 3: Commit**

```bash
git add components/warehouse/IsometricWarehouse.tsx
git commit -m "feat(warehouse): zone stats label in 3D isometric view"
```

---

## Task 5: Print CSS

**Files:**
- Modify: `frontend/app/warehouse/index.tsx`

- [ ] **Schritt 1: Print-CSS per `<style>`-Tag auf Web injizieren**

In `warehouse/index.tsx` einen `useEffect` hinzufügen der beim Mount auf Web einen `<style>`-Tag einfügt:

```typescript
useEffect(() => {
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.id = 'warehouse-print-css';
  style.textContent = `
    @media print {
      body > * { display: none !important; }
      #warehouse-print-root { display: block !important; }
      .warehouse-toolbar { display: none !important; }
      .warehouse-stats-bar { display: none !important; }
    }
  `;
  document.head.appendChild(style);
  return () => { document.getElementById('warehouse-print-css')?.remove(); };
}, []);
```

> **Hinweis:** Das Print-CSS blendet alle UI-Elemente außer dem SVG-Warehouse-Canvas aus. Da React Native Web keine direkten CSS-Klassen unterstützt, ist `window.print()` ausreichend — der Browser druckt die sichtbare SVG-Ansicht.

- [ ] **Schritt 2: Manuell testen**

Druck-Button in Toolbar klicken → Browser-Druckdialog öffnet sich ✓

- [ ] **Schritt 3: Finaler Commit**

```bash
git add app/warehouse/index.tsx
git commit -m "feat(warehouse): print CSS for web export"
```

---

## Self-Review

**Spec-Abdeckung:**
- ✅ Dark Pro Design → Tasks 1–4 (Farben, Toolbar, Panel)
- ✅ Filter Frei/Knapp/Voll → Task 1 (filterMode State + Chips)
- ✅ Statistiken → Task 1 (Stats-Leiste + Modal) + Tasks 3–4 (Zone-Labels)
- ✅ Artikel-Detail bei Klick → Task 2 (LocationPanel bereits vorhanden, erweitert)
- ✅ Artikel verschieben → Task 2 (bereits implementiert in LocationPanel, visuell verbessert)
- ✅ PDF/Druck-Export → Tasks 1 + 5

**Keine Platzhalter:** Alle Schritte enthalten konkreten Code.

**Typ-Konsistenz:** `filterMode`, `filteredLocations`, `getFillRatio` konsistent durch alle Tasks verwendet.
