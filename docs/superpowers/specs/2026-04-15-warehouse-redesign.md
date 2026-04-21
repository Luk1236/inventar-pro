# Lager 2D & 3D — Redesign & Feature-Erweiterung

**Datum:** 2026-04-15  
**Status:** Genehmigt  

---

## Ziel

Verbesserung der bestehenden Lager-Ansichten (`/warehouse`) in Bezug auf Design und Funktionalität. Ansatz A: Schrittweise Erweiterung der bestehenden SVG-Komponenten — kein Neubau.

---

## Design

### Farbschema — Dark Pro
Beide Ansichten erhalten das Dark Pro Farbschema passend zum neuen Dashboard:

| Element | Wert |
|---------|------|
| Hintergrund | `#060e1a` |
| Karten/Panels | `#0f1e35` |
| Regal-Körper | `#0D1F38` |
| Border | `#1e293b` |
| Text primär | `#e2e8f0` |
| Text sekundär | `#64748b` |
| Frei (grün) | `#4CAF50` |
| Knapp (orange) | `#FF9800` |
| Voll/Kritisch (rot) | `#EF5350` |
| Ausgewählt | `#FFD700` |

### Toolbar (beide Ansichten)
Einheitliche Toolbar oben mit:
- Suchfeld (bereits vorhanden, neu gestaltet)
- Filter-Chips: **Alle / Frei / Knapp / Voll**
- Statistik-Button (öffnet Stats-Overlay)
- Drucken/PDF-Button
- 2D↔3D Umschalter (bereits vorhanden, neu gestaltet)

### Statistik-Leiste
Permanente Leiste unterhalb der Hauptansicht:
- Gesamtauslastung in % 
- Anzahl kritisch voller Lagerorte
- Gesamtartikelanzahl im Lager
- Anzahl Zonen

---

## Features

### 1. Filter nach Füllstand
**Datei:** `frontend/app/warehouse/index.tsx`  
Neuer State `filterMode: 'all' | 'free' | 'low' | 'full'`. Locations werden gefiltert bevor sie an `SchematicWarehouse` und `IsometricWarehouse` übergeben werden. Filter-Chips in der Toolbar.

Schwellwerte (bereits definiert in `SchematicWarehouse.tsx`):
- Frei: `ratio < 0.7`
- Knapp: `0.7 ≤ ratio < 0.92`
- Voll: `ratio ≥ 0.92`

### 2. Artikel-Detail bei Klick
**Datei:** `frontend/components/warehouse/LocationPanel.tsx`  
Bereits vorhanden — wird visuell verbessert (Dark Pro Stil) und erweitert um:
- Vollständige Artikelliste der Location mit Namen
- "Artikel verschieben"-Button pro Artikel
- Füllstand-Anzeige (Fortschrittsbalken)
- Warnmeldung wenn Regal voll

### 3. Artikel verschieben (Drag & Drop)
**Datei:** `frontend/components/warehouse/LocationPanel.tsx`  
Im LocationPanel: Dropdown zum Auswählen eines Ziellagerorts + Bestätigen. Backend-Call: `PUT /api/articles/{id}` mit neuer `storage_location_id`. State-Update lokal nach Erfolg.

Kein echtes SVG-Drag-and-Drop (zu komplex für Web + Mobile) — stattdessen:
Artikel anklicken → Zielort-Dropdown → Speichern.

### 4. Statistiken pro Zone
**Datei:** `frontend/components/warehouse/SchematicWarehouse.tsx` und `IsometricWarehouse.tsx`  
Pro Zone wird angezeigt: Anzahl Regale + Auslastung in % (z.B. „4 Regale · 78% belegt").  
Statistik-Overlay (Modal): Balkendiagramm pro Zone, Gesamtübersicht.

### 5. PDF/Druck-Export
**Datei:** `frontend/app/warehouse/index.tsx`  
Druck-Button in Toolbar. Auf Web: `window.print()` mit einem print-spezifischen CSS-Layout das nur die SVG-Ansicht zeigt. Auf Mobile: `expo-print` mit HTML-Rendering der aktuellen Ansicht.

---

## Betroffene Dateien

| Datei | Änderung |
|-------|---------|
| `frontend/app/warehouse/index.tsx` | Toolbar-Redesign, Filter-State, Stats-Leiste, Print-Button |
| `frontend/components/warehouse/SchematicWarehouse.tsx` | Dark Pro Styling, Zone-Stats-Label, Filter-Props |
| `frontend/components/warehouse/IsometricWarehouse.tsx` | Dark Pro Styling, Zone-Stats-Label, Filter-Props |
| `frontend/components/warehouse/LocationPanel.tsx` | Dark Pro Styling, Artikelliste, Verschieben-Funktion |

---

## Nicht im Scope

- Echter SVG-Drag-and-Drop von Artikeln zwischen Regalen
- Neue 3D-Engine (WebGL/Three.js)
- Echtzeit-Updates via WebSocket bei Lagerumzügen
- Mobile-spezifische Gesten (Pinch-Zoom im 3D)
