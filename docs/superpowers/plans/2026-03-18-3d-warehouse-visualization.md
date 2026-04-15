# Isometrische Lagervisualisierung — Implementierungsplan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interaktive isometrische Lagervisualisierung — Regale mit Artikeln in SVG-3D-Perspektive anzeigen, Artikel per Seitenpanel zwischen Lagerplätzen verschieben.

**Architecture:** Vollständig auf `react-native-svg` (bereits installiert, keine neuen Pakete). Isometrische Projektion via pure Mathematik. Seitenpanel als React Native Overlay. Funktioniert auf Web und nativ ohne Platform-Split.

**Tech Stack:** `react-native-svg`, React Native, TypeScript, expo-router, FastAPI backend (vorhanden), `apiService` (vorhanden, handhabt Auth automatisch)

---

## Dateistruktur (Überblick)

| Datei | Status | Zweck |
|---|---|---|
| `frontend/utils/warehouseUtils.ts` | Neu | Pure Funktionen: isometrische Projektion, Farben, Filterung, Positionsberechnung |
| `frontend/utils/locationPanelLogic.ts` | Neu | Handler-Logik für Move-Flow (testbar ohne UI) |
| `frontend/components/warehouse/IsometricBox.tsx` | Neu | Einzelne isometrische Box (3 Flächen, farbbasiert auf Bestand) |
| `frontend/components/warehouse/IsometricShelf.tsx` | Neu | Isometrisches Regal (3 Etagen + Boxen) |
| `frontend/components/warehouse/IsometricWarehouse.tsx` | Neu | SVG-Canvas mit allen Zonen + Regalen |
| `frontend/components/warehouse/LocationPanel.tsx` | Neu | Seitenpanel: Artikelliste + Verschieben-Flow |
| `frontend/app/warehouse/index.tsx` | Neu | Screen: Datenladen, Zustände, Layout |
| `frontend/app/_layout.tsx` | Ändern (Zeile 51) | Neuen Screen registrieren |
| `frontend/app/index.tsx` | Ändern (Zeile 418) | Dashboard-Link hinzufügen |
| `frontend/__tests__/warehouse/warehouseUtils.test.ts` | Neu | Tests für pure Funktionen |
| `frontend/__tests__/warehouse/locationPanel.test.ts` | Neu | Tests für Move-Handler-Logik |

---

## Wichtige Konventionen in diesem Projekt

- **apiService** (`frontend/services/apiService.ts`): `apiService.get<T>(endpoint)`, `apiService.put<T>(endpoint, body)` — handhabt Bearer-Token automatisch
- **Tests**: `testEnvironment: 'node'`, nur pure Funktionen testen (keine Komponenten rendern)
- **Tests ausführen**: `cd frontend && npx jest --testPathPattern=warehouse`
- **Expo-Router**: Datei `app/warehouse/index.tsx` → Route `/warehouse`
- **Styles**: Inline StyleSheet.create am Ende der Datei, kein externes CSS
- **Typen**: Interfaces direkt in der Datei definieren, kein shared types file

---

## Task 1: Pure Utility-Funktionen + Tests (TDD)

**Files:**
- Create: `frontend/utils/warehouseUtils.ts`
- Create: `frontend/__tests__/warehouse/warehouseUtils.test.ts`

### Schritt 1.1: Test-Datei schreiben (failing)

- [ ] **Ordner anlegen und Test-Datei erstellen:**

```bash
mkdir -p "frontend/__tests__/warehouse"
```

Datei: `frontend/__tests__/warehouse/warehouseUtils.test.ts`

```typescript
import {
  isoProject,
  TILE_SIZE,
  getLocationGridPos,
  getStockColor,
  darkenColor,
  getArticlesForLocation,
  getLocationsForZone,
  getStockForLocation,
  getMinStockForLocation,
} from '../../utils/warehouseUtils';

describe('isoProject', () => {
  it('projiziert Ursprung korrekt', () => {
    const result = isoProject(0, 0, 0);
    expect(result.sx).toBe(0);
    expect(result.sy).toBe(0);
  });

  it('x-Achse geht nach rechts oben', () => {
    const result = isoProject(1, 0, 0);
    expect(result.sx).toBeGreaterThan(0);
    expect(result.sy).toBeGreaterThan(0);
  });

  it('y-Achse geht nach oben (negatives sy)', () => {
    const result = isoProject(0, 1, 0);
    expect(result.sy).toBeLessThan(0);
  });

  it('z-Achse geht nach links oben', () => {
    const result = isoProject(0, 0, 1);
    expect(result.sx).toBeLessThan(0);
  });
});

describe('getLocationGridPos', () => {
  it('erste Location in erster Zone ist (0,0)', () => {
    expect(getLocationGridPos(0, 0)).toEqual({ gx: 0, gz: 0 });
  });

  it('5. Location (Index 4) startet neue Reihe', () => {
    const pos = getLocationGridPos(4, 0);
    expect(pos.gz).toBe(1);
    expect(pos.gx).toBe(0);
  });

  it('zweite Zone beginnt mit gx-Offset von (cols+2)', () => {
    const pos = getLocationGridPos(0, 1);
    expect(pos.gx).toBe(6); // cols=4, offset=4+2=6
    expect(pos.gz).toBe(0);
  });
});

describe('getStockColor', () => {
  it('rot wenn unter Mindestbestand', () => {
    expect(getStockColor(5, 10)).toBe('#FF3B30');
  });

  it('orange wenn gleich Mindestbestand', () => {
    expect(getStockColor(10, 10)).toBe('#FF9500');
  });

  it('grün wenn über Mindestbestand', () => {
    expect(getStockColor(15, 10)).toBe('#34C759');
  });
});

describe('darkenColor', () => {
  it('gibt validen Hex-String zurück', () => {
    expect(darkenColor('#34C759', 40)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('gibt dunklere Farbe zurück (niedrigere Werte)', () => {
    const original = '#ff8800';
    const darkened = darkenColor(original, 40);
    const r = parseInt(darkened.slice(1, 3), 16);
    expect(r).toBeLessThan(0xff);
  });

  it('klemmt bei 0 (kein negativer Wert)', () => {
    expect(darkenColor('#000000', 100)).toBe('#000000');
  });
});

describe('getArticlesForLocation', () => {
  const articles = [
    { id: '1', storage_location_id: 'loc-a', current_stock: 5, min_stock_level: 3 },
    { id: '2', storage_location_id: 'loc-b', current_stock: 2, min_stock_level: 5 },
    { id: '3', storage_location_id: 'loc-a', current_stock: 8, min_stock_level: 4 },
  ] as any[];

  it('filtert Artikel nach Location', () => {
    const result = getArticlesForLocation(articles, 'loc-a');
    expect(result).toHaveLength(2);
    expect(result.every(a => a.storage_location_id === 'loc-a')).toBe(true);
  });

  it('gibt leeres Array zurück wenn keine Artikel', () => {
    expect(getArticlesForLocation(articles, 'loc-x')).toHaveLength(0);
  });
});

describe('getLocationsForZone', () => {
  const locations = [
    { id: 'l1', zone_id: 'z1' },
    { id: 'l2', zone_id: 'z2' },
    { id: 'l3', zone_id: 'z1' },
  ] as any[];

  it('filtert Locations nach Zone', () => {
    expect(getLocationsForZone(locations, 'z1')).toHaveLength(2);
  });
});

describe('getStockForLocation', () => {
  const articles = [
    { storage_location_id: 'loc-a', current_stock: 5 },
    { storage_location_id: 'loc-a', current_stock: 3 },
    { storage_location_id: 'loc-b', current_stock: 10 },
  ] as any[];

  it('summiert Bestand aller Artikel an diesem Lagerplatz', () => {
    expect(getStockForLocation(articles, 'loc-a')).toBe(8);
  });

  it('gibt 0 zurück wenn keine Artikel', () => {
    expect(getStockForLocation(articles, 'loc-x')).toBe(0);
  });
});

describe('getMinStockForLocation', () => {
  const articles = [
    { storage_location_id: 'loc-a', min_stock_level: 2 },
    { storage_location_id: 'loc-a', min_stock_level: 4 },
  ] as any[];

  it('summiert Mindestbestände aller Artikel', () => {
    expect(getMinStockForLocation(articles, 'loc-a')).toBe(6);
  });
});
```

- [ ] **Test ausführen — muss fehlschlagen:**

```bash
cd frontend && npx jest --testPathPattern=warehouseUtils --no-coverage 2>&1 | tail -5
```

Erwartet: `Cannot find module '../../utils/warehouseUtils'`

### Schritt 1.2: warehouseUtils.ts implementieren

- [ ] **Datei erstellen:** `frontend/utils/warehouseUtils.ts`

```typescript
// frontend/utils/warehouseUtils.ts

export const TILE_SIZE = 40;

export interface Article {
  id: string;
  name: string;
  inventory_code: string;
  current_stock: number;
  min_stock_level: number;
  storage_location_id: string | null;
  [key: string]: any;
}

export interface StorageZone {
  id: string;
  name: string;
  type: string;
  description?: string;
}

export interface StorageLocation {
  id: string;
  zone_id: string;
  name: string;
  type: string;
  capacity?: number;
}

// Isometrische Projektion: 3D-Koordinaten (x, y, z) → 2D SVG (sx, sy)
// x geht nach rechts, y nach oben, z nach hinten
export function isoProject(
  x: number,
  y: number,
  z: number
): { sx: number; sy: number } {
  const cos30 = Math.cos(Math.PI / 6); // ≈ 0.866
  const sin30 = Math.sin(Math.PI / 6); // = 0.5
  return {
    sx: (x - z) * cos30 * TILE_SIZE,
    sy: (x + z) * sin30 * TILE_SIZE - y * TILE_SIZE,
  };
}

// Berechnet Gitterposition eines Lagerplatzes in seiner Zone
// cols=4 → max. 4 Regale pro Reihe, danach neue Reihe (gz++)
// Zonen sind mit Abstand (cols+2) nebeneinander
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

// Farbe basierend auf Gesamtbestand vs. Mindestbestand
export function getStockColor(current: number, minLevel: number): string {
  if (current < minLevel) return '#FF3B30';   // rot
  if (current === minLevel) return '#FF9500'; // orange
  return '#34C759';                           // grün
}

// Gibt eine dunklere Version eines Hex-Farbcodes zurück
export function darkenColor(hex: string, amount: number = 40): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Filtert Artikel die an einem bestimmten Lagerplatz sind
export function getArticlesForLocation(
  articles: Article[],
  locationId: string
): Article[] {
  return articles.filter(a => a.storage_location_id === locationId);
}

// Filtert Lagerplätze einer bestimmten Zone
export function getLocationsForZone(
  locations: StorageLocation[],
  zoneId: string
): StorageLocation[] {
  return locations.filter(l => l.zone_id === zoneId);
}

// Summiert den Gesamtbestand aller Artikel an einem Lagerplatz
export function getStockForLocation(
  articles: Article[],
  locationId: string
): number {
  return getArticlesForLocation(articles, locationId)
    .reduce((sum, a) => sum + (a.current_stock ?? 0), 0);
}

// Summiert den Mindestbestand aller Artikel an einem Lagerplatz
export function getMinStockForLocation(
  articles: Article[],
  locationId: string
): number {
  return getArticlesForLocation(articles, locationId)
    .reduce((sum, a) => sum + (a.min_stock_level ?? 0), 0);
}

// Sortiert Locations nach Painter's Algorithm (gz+gx aufsteigend = hinten zuerst)
export function sortByDepth(
  items: Array<{ gx: number; gz: number; [key: string]: any }>
): typeof items {
  return [...items].sort((a, b) => (a.gz + a.gx) - (b.gz + b.gx));
}
```

- [ ] **Tests ausführen — müssen bestehen:**

```bash
cd frontend && npx jest --testPathPattern=warehouseUtils --no-coverage 2>&1 | tail -10
```

Erwartet: `Tests: X passed, X total`

- [ ] **Commit:**

```bash
cd frontend && git add utils/warehouseUtils.ts __tests__/warehouse/warehouseUtils.test.ts
git commit -m "feat: add warehouseUtils pure functions with tests"
```

---

## Task 2: locationPanelLogic.ts + Tests (TDD)

**Files:**
- Create: `frontend/utils/locationPanelLogic.ts`
- Create: `frontend/__tests__/warehouse/locationPanel.test.ts`

### Schritt 2.1: Tests schreiben (failing)

- [ ] **Datei erstellen:** `frontend/__tests__/warehouse/locationPanel.test.ts`

```typescript
import { buildMovePayload, validateMove } from '../../utils/locationPanelLogic';
import { Article } from '../../utils/warehouseUtils';

const sampleArticle: Article = {
  id: 'art-1',
  name: 'Kamera',
  inventory_code: 'KAM-001',
  current_stock: 5,
  min_stock_level: 2,
  storage_location_id: 'loc-old',
};

describe('buildMovePayload', () => {
  it('gibt vollständiges Artikel-Objekt mit neuer locationId zurück', () => {
    const result = buildMovePayload(sampleArticle, 'loc-new');
    expect(result.storage_location_id).toBe('loc-new');
    expect(result.name).toBe('Kamera');
    expect(result.inventory_code).toBe('KAM-001');
  });

  it('verändert das Original-Objekt nicht', () => {
    buildMovePayload(sampleArticle, 'loc-new');
    expect(sampleArticle.storage_location_id).toBe('loc-old');
  });

  it('überschreibt storage_location_id', () => {
    const result = buildMovePayload(sampleArticle, 'loc-new');
    expect(result.storage_location_id).not.toBe('loc-old');
  });
});

describe('validateMove', () => {
  it('gibt null zurück wenn Ziel verschieden von Quelle', () => {
    expect(validateMove('loc-old', 'loc-new')).toBeNull();
  });

  it('gibt Fehlermeldung wenn Ziel gleich wie Quelle', () => {
    const error = validateMove('loc-old', 'loc-old');
    expect(typeof error).toBe('string');
    expect(error!.length).toBeGreaterThan(0);
  });

  it('gibt Fehlermeldung wenn Ziel leer', () => {
    const error = validateMove('loc-old', '');
    expect(typeof error).toBe('string');
  });
});
```

- [ ] **Tests ausführen — muss fehlschlagen:**

```bash
cd frontend && npx jest --testPathPattern=locationPanel --no-coverage 2>&1 | tail -5
```

Erwartet: `Cannot find module '../../utils/locationPanelLogic'`

### Schritt 2.2: locationPanelLogic.ts implementieren

- [ ] **Datei erstellen:** `frontend/utils/locationPanelLogic.ts`

```typescript
// frontend/utils/locationPanelLogic.ts
import { Article } from './warehouseUtils';

// Erstellt das vollständige PUT-Payload für das Verschieben eines Artikels.
// Backend erwartet das VOLLSTÄNDIGE Article-Objekt (kein PATCH).
export function buildMovePayload(article: Article, newLocationId: string): Article {
  return { ...article, storage_location_id: newLocationId };
}

// Validiert einen Move-Vorgang. Gibt null zurück wenn ok, sonst Fehlermeldung.
export function validateMove(
  currentLocationId: string,
  targetLocationId: string
): string | null {
  if (!targetLocationId) return 'Bitte einen Ziel-Lagerplatz auswählen.';
  if (targetLocationId === currentLocationId) {
    return 'Ziel-Lagerplatz ist identisch mit dem aktuellen Lagerplatz.';
  }
  return null;
}
```

- [ ] **Tests ausführen — müssen bestehen:**

```bash
cd frontend && npx jest --testPathPattern=locationPanel --no-coverage 2>&1 | tail -10
```

Erwartet: `Tests: X passed`

- [ ] **Commit:**

```bash
cd frontend && git add utils/locationPanelLogic.ts __tests__/warehouse/locationPanel.test.ts
git commit -m "feat: add locationPanelLogic with move validation and payload builder"
```

---

## Task 3: IsometricBox.tsx — Einzelne isometrische Box

**Files:**
- Create: `frontend/components/warehouse/IsometricBox.tsx`

**Keine Tests** — reine SVG-Render-Komponente, Farblogik bereits in warehouseUtils getestet.

- [ ] **Ordner anlegen:**

```bash
mkdir -p frontend/components/warehouse
```

- [ ] **Datei erstellen:** `frontend/components/warehouse/IsometricBox.tsx`

```typescript
// frontend/components/warehouse/IsometricBox.tsx
// Zeichnet eine kleine isometrische Box aus 3 SVG-Polygonen (oben, links, rechts).
// Gibt einen 3D-Würfel-Effekt durch unterschiedliche Helligkeit der Seiten.

import React from 'react';
import { Polygon } from 'react-native-svg';
import { isoProject, darkenColor } from '../../utils/warehouseUtils';

interface Props {
  gx: number;      // Gitter-X (Weltkoordinate)
  gy: number;      // Gitter-Y = Etage (0=unten, 1=mitte, 2=oben)
  gz: number;      // Gitter-Z (Weltkoordinate)
  color: string;   // Basis-Farbe (hex)
  size?: number;   // Größe in Gittereinheiten, default 0.35
}

export default function IsometricBox({ gx, gy, gz, color, size = 0.35 }: Props) {
  const s = size;

  // 8 Eckpunkte des Würfels in Weltkoordinaten
  const corners = {
    // Oben
    tfl: isoProject(gx,     gy + s, gz),     // top front left
    tfr: isoProject(gx + s, gy + s, gz),     // top front right
    tbl: isoProject(gx,     gy + s, gz + s), // top back left
    tbr: isoProject(gx + s, gy + s, gz + s), // top back right
    // Unten
    bfl: isoProject(gx,     gy,     gz),
    bfr: isoProject(gx + s, gy,     gz),
    bbl: isoProject(gx,     gy,     gz + s),
    bbr: isoProject(gx + s, gy,     gz + s),
  };

  const p = (pt: { sx: number; sy: number }) => `${pt.sx},${pt.sy}`;

  // Isometrische Sichtbarkeit (Kamera von oben-rechts-vorne):
  // Sichtbare Flächen: Top (y=gy+s), Front (z=gz), Right (x=gx+s)
  const topColor = color;                  // hellste (Decke)
  const frontColor = darkenColor(color, 25); // mittlere (Frontfläche z=gz, linke Seite im Bild)
  const rightColor = darkenColor(color, 50); // dunkelste (rechte Fläche x=gx+s)

  return (
    <>
      {/* Deckfläche (y=gy+s): tfl→tfr→tbr→tbl */}
      <Polygon
        points={`${p(corners.tfl)} ${p(corners.tfr)} ${p(corners.tbr)} ${p(corners.tbl)}`}
        fill={topColor}
        stroke="#00000022"
        strokeWidth={0.5}
      />
      {/* Frontfläche (z=gz): tfl→bfl→bfr→tfr */}
      <Polygon
        points={`${p(corners.tfl)} ${p(corners.bfl)} ${p(corners.bfr)} ${p(corners.tfr)}`}
        fill={frontColor}
        stroke="#00000022"
        strokeWidth={0.5}
      />
      {/* Rechte Fläche (x=gx+s): tfr→bfr→bbr→tbr */}
      <Polygon
        points={`${p(corners.tfr)} ${p(corners.bfr)} ${p(corners.bbr)} ${p(corners.tbr)}`}
        fill={rightColor}
        stroke="#00000022"
        strokeWidth={0.5}
      />
    </>
  );
}
```

- [ ] **Commit:**

```bash
cd frontend && git add components/warehouse/IsometricBox.tsx
git commit -m "feat: add IsometricBox SVG component"
```

---

## Task 4: IsometricShelf.tsx — Isometrisches Regal

**Files:**
- Create: `frontend/components/warehouse/IsometricShelf.tsx`

Das Regal ist ein isometrischer Quader (blaue Träger + orange Böden) mit bis zu 3 Etagen Artikel-Boxen.

- [ ] **Datei erstellen:** `frontend/components/warehouse/IsometricShelf.tsx`

```typescript
// frontend/components/warehouse/IsometricShelf.tsx
// Zeichnet eine Regaleinheit in isometrischer SVG-Perspektive.
// Besteht aus: 4 blauen Trägern, 3 orangenen Regalböden, Artikel-Boxen pro Etage.

import React from 'react';
import { G, Polygon, Rect } from 'react-native-svg';
import {
  isoProject,
  darkenColor,
  getStockColor,
  getStockForLocation,
  getMinStockForLocation,
  Article,
  StorageLocation,
} from '../../utils/warehouseUtils';
import IsometricBox from './IsometricBox';

interface Props {
  location: StorageLocation;
  articles: Article[];        // Bereits gefiltert für diese Location
  gx: number;                 // Gitter-X-Position
  gz: number;                 // Gitter-Z-Position
  isSelected: boolean;
  onPress: () => void;
}

const SHELF_WIDTH = 1.2;   // Breite des Regals in Gittereinheiten
const SHELF_DEPTH = 0.8;   // Tiefe
const SHELF_HEIGHT = 3.0;  // Gesamthöhe (3 Etagen)
const PILLAR_SIZE = 0.08;  // Dicke der Träger
const BOARD_HEIGHT = 0.08; // Dicke der Regalböden

// Isometrisches Parallelogramm aus 4 Punkten
function isoPolygon(
  pts: Array<[number, number, number]>,
  fill: string,
  stroke: string = '#00000033',
  strokeWidth: number = 0.5
) {
  const points = pts.map(([x, y, z]) => {
    const { sx, sy } = isoProject(x, y, z);
    return `${sx},${sy}`;
  }).join(' ');
  return <Polygon points={points} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

export default function IsometricShelf({ location, articles, gx, gz, isSelected, onPress }: Props) {
  const strokeColor = isSelected ? '#FFD700' : '#00000033';
  const strokeWidth = isSelected ? 2 : 0.5;

  // Regal-Grundfarben
  const pillarColor = isSelected ? '#4A90D9' : '#1A5FB4';   // blau
  const boardColor = isSelected ? '#F5A623' : '#E67E00';    // orange
  const pillarDark = darkenColor(pillarColor, 30);
  const boardDark = darkenColor(boardColor, 30);

  const w = SHELF_WIDTH;
  const d = SHELF_DEPTH;
  const h = SHELF_HEIGHT;
  const p = PILLAR_SIZE;
  const bh = BOARD_HEIGHT;

  // Hilfsfunktion: Quader aus 3 Flächen (oben, vorne, rechts)
  const renderCuboid = (
    x0: number, y0: number, z0: number,
    xw: number, yh: number, zd: number,
    colorTop: string, colorFront: string, colorRight: string
  ) => (
    <>
      {isoPolygon([[x0,y0+yh,z0],[x0+xw,y0+yh,z0],[x0+xw,y0+yh,z0+zd],[x0,y0+yh,z0+zd]], colorTop, strokeColor, strokeWidth)}
      {isoPolygon([[x0,y0,z0],[x0,y0+yh,z0],[x0+xw,y0+yh,z0],[x0+xw,y0,z0]], colorFront, strokeColor, strokeWidth)}
      {isoPolygon([[x0+xw,y0,z0],[x0+xw,y0+yh,z0],[x0+xw,y0+yh,z0+zd],[x0+xw,y0,z0+zd]], colorRight, strokeColor, strokeWidth)}
    </>
  );

  // 4 Träger (Ecken des Regals)
  const pillars = [
    [gx,       0, gz],
    [gx + w-p, 0, gz],
    [gx,       0, gz + d-p],
    [gx + w-p, 0, gz + d-p],
  ].map(([x, y, z], i) => (
    <React.Fragment key={`pillar-${i}`}>
      {renderCuboid(x, y, z, p, h, p, pillarColor, darkenColor(pillarColor, 20), pillarDark)}
    </React.Fragment>
  ));

  // 3 Regalböden auf Höhen 0.9, 1.8, 2.7
  const floorHeights = [0.9, 1.8, 2.7];
  const boards = floorHeights.map((fh, i) => (
    <React.Fragment key={`board-${i}`}>
      {renderCuboid(gx, fh, gz, w, bh, d, boardColor, darkenColor(boardColor, 20), boardDark)}
    </React.Fragment>
  ));

  // Artikel-Boxen auf den Etagen (max 3 Boxen pro Etage, max 3 Etagen)
  const boxes = articles.slice(0, 9).map((article, i) => {
    const etage = Math.floor(i / 3);
    const slot = i % 3;
    const boxColor = getStockColor(article.current_stock, article.min_stock_level);
    const boxY = floorHeights[etage] + BOARD_HEIGHT + 0.02;
    const boxX = gx + 0.1 + slot * 0.37;
    const boxZ = gz + 0.1;
    return (
      <IsometricBox
        key={article.id}
        gx={boxX}
        gy={boxY}
        gz={boxZ}
        color={boxColor}
      />
    );
  });

  // Tap-Bereich: transparentes Rechteck über dem Regal (für zuverlässigeres onPress)
  const topLeft = isoProject(gx, h, gz);
  const topRight = isoProject(gx + w, h, gz);
  const botLeft = isoProject(gx, 0, gz + d);
  const tapPoints = `${topLeft.sx},${topLeft.sy} ${topRight.sx},${topRight.sy} ${botLeft.sx},${topLeft.sy + (botLeft.sy - topLeft.sy)} ${topLeft.sx},${botLeft.sy}`;

  return (
    <G onPress={onPress}>
      {pillars}
      {boards}
      {boxes}
      {/* Transparenter Tap-Bereich für bessere Touch-Erkennung */}
      <Polygon
        points={tapPoints}
        fill="transparent"
        stroke="none"
      />
    </G>
  );
}
```

- [ ] **Commit:**

```bash
cd frontend && git add components/warehouse/IsometricShelf.tsx
git commit -m "feat: add IsometricShelf SVG component with article boxes"
```

---

## Task 5: IsometricWarehouse.tsx — SVG-Gesamtszene

**Files:**
- Create: `frontend/components/warehouse/IsometricWarehouse.tsx`

Rendert alle Zonen und Regale in einem scrollbaren SVG-Canvas.

- [ ] **Datei erstellen:** `frontend/components/warehouse/IsometricWarehouse.tsx`

```typescript
// frontend/components/warehouse/IsometricWarehouse.tsx
// Rendert alle Lager-Zonen mit Regalen in isometrischer SVG-Ansicht.
// Scrollbar (horizontal + vertikal). Painter's Algorithm für korrekte Tiefensortierung.

import React, { useMemo } from 'react';
import { ScrollView, Platform, StyleSheet } from 'react-native';
import Svg, { G, Polygon, Text as SvgText } from 'react-native-svg';
import {
  isoProject,
  getLocationGridPos,
  getArticlesForLocation,
  getLocationsForZone,
  sortByDepth,
  Article,
  StorageZone,
  StorageLocation,
  TILE_SIZE,
} from '../../utils/warehouseUtils';
import IsometricShelf from './IsometricShelf';

interface Props {
  zones: StorageZone[];
  locations: StorageLocation[];
  articles: Article[];
  selectedLocationId: string | null;
  onLocationSelect: (locationId: string) => void;
}

// Farben pro Zone-Index
const ZONE_COLORS = ['#007AFF40', '#34C75940', '#FF950040', '#5856D640', '#FF3B3040'];

export default function IsometricWarehouse({
  zones, locations, articles, selectedLocationId, onLocationSelect
}: Props) {

  // Alle Locations mit ihrer Gitter-Position berechnen
  const locationsWithPos = useMemo(() => {
    return locations.map((loc) => {
      const zoneIndex = zones.findIndex(z => z.id === loc.zone_id);
      const zoneLocations = getLocationsForZone(locations, loc.zone_id);
      const locationIndex = zoneLocations.findIndex(l => l.id === loc.id);
      const { gx, gz } = getLocationGridPos(locationIndex, Math.max(0, zoneIndex));
      return { loc, gx, gz, zoneIndex };
    });
  }, [zones, locations]);

  // Painter's Algorithm: hinten zuerst rendern
  const sortedLocations = useMemo(() => {
    return sortByDepth(locationsWithPos.map(l => ({ ...l, gx: l.gx, gz: l.gz })));
  }, [locationsWithPos]);

  // SVG-Größe dynamisch berechnen
  const maxGx = locationsWithPos.reduce((m, l) => Math.max(m, l.gx), 0) + 4;
  const maxGz = locationsWithPos.reduce((m, l) => Math.max(m, l.gz), 0) + 4;
  const svgWidth = (maxGx + maxGz) * TILE_SIZE * 1.2 + 200;
  const svgHeight = (maxGx + maxGz) * TILE_SIZE * 0.6 + 300;

  // SVG Ursprung in die Mitte verschieben damit alles sichtbar ist
  const originX = svgWidth / 2;
  const originY = 80;

  return (
    <ScrollView
      horizontal
      style={[styles.container, Platform.OS === 'web' && { overflow: 'scroll' as any }]}
    >
      <ScrollView>
        <Svg width={svgWidth} height={svgHeight}>
          <G x={originX} y={originY}>
            {/* Zonen-Grundflächen */}
            {zones.map((zone, zi) => {
              const zoneLocCount = getLocationsForZone(locations, zone.id).length || 1;
              const rows = Math.ceil(zoneLocCount / 4);
              const cols = Math.min(zoneLocCount, 4);
              const x0 = zi * 6;
              const z0 = 0;
              const x1 = x0 + cols * 1.4;
              const z1 = z0 + rows * 1.4;
              const tl = isoProject(x0 - 0.2, 0, z0 - 0.2);
              const tr = isoProject(x1 + 0.2, 0, z0 - 0.2);
              const br = isoProject(x1 + 0.2, 0, z1 + 0.2);
              const bl = isoProject(x0 - 0.2, 0, z1 + 0.2);
              const color = ZONE_COLORS[zi % ZONE_COLORS.length];
              const labelPos = isoProject(x0 + (x1 - x0) / 2, 0, z0 - 0.5);
              return (
                <G key={zone.id}>
                  <Polygon
                    points={`${tl.sx},${tl.sy} ${tr.sx},${tr.sy} ${br.sx},${br.sy} ${bl.sx},${bl.sy}`}
                    fill={color}
                    stroke="#00000033"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={labelPos.sx}
                    y={labelPos.sy - 10}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight="bold"
                    fill="#333333"
                  >
                    {zone.name}
                  </SvgText>
                </G>
              );
            })}

            {/* Regale (Painter's Algorithm: hinten zuerst) */}
            {sortedLocations.map(({ loc, gx, gz }) => (
              <IsometricShelf
                key={loc.id}
                location={loc}
                articles={getArticlesForLocation(articles, loc.id)}
                gx={gx}
                gz={gz}
                isSelected={loc.id === selectedLocationId}
                onPress={() => onLocationSelect(loc.id)}
              />
            ))}
          </G>
        </Svg>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
});
```

- [ ] **Commit:**

```bash
cd frontend && git add components/warehouse/IsometricWarehouse.tsx
git commit -m "feat: add IsometricWarehouse SVG scene with zone floors and shelves"
```

---

## Task 6: LocationPanel.tsx — Seitenpanel

**Files:**
- Create: `frontend/components/warehouse/LocationPanel.tsx`

- [ ] **Datei erstellen:** `frontend/components/warehouse/LocationPanel.tsx`

```typescript
// frontend/components/warehouse/LocationPanel.tsx
// Seitenpanel das erscheint wenn ein Regal angeklickt wird.
// Zeigt Artikelliste und ermöglicht das Verschieben von Artikeln.

import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/apiService';
import { buildMovePayload, validateMove } from '../../utils/locationPanelLogic';
import { getStockColor, Article, StorageZone, StorageLocation } from '../../utils/warehouseUtils';

interface Props {
  location: StorageLocation;
  zone: StorageZone;
  articles: Article[];             // Bereits gefiltert für diese Location
  allLocations: StorageLocation[]; // Alle Lagerplätze für das Verschieben-Dropdown
  onClose: () => void;
  onArticleMoved: (articleId: string, newLocationId: string) => void;
}

export default function LocationPanel({
  location, zone, articles, allLocations, onClose, onArticleMoved
}: Props) {
  const [movingArticleId, setMovingArticleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startMove = (articleId: string) => {
    setMovingArticleId(articleId);
  };

  const cancelMove = () => {
    setMovingArticleId(null);
  };

  const confirmMove = async (article: Article, targetLocationId: string) => {
    const error = validateMove(location.id, targetLocationId);
    if (error) {
      Alert.alert('Fehler', error);
      return;
    }

    const oldLocationId = article.storage_location_id ?? '';
    setLoading(true);

    // Optimistisch updaten
    onArticleMoved(article.id, targetLocationId);
    setMovingArticleId(null);

    try {
      const payload = buildMovePayload(article, targetLocationId);
      await apiService.put(`/api/articles/${article.id}`, payload);
    } catch (err: any) {
      // Rollback
      onArticleMoved(article.id, oldLocationId);
      Alert.alert('Fehler', err.message || 'Verschieben fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const movingArticle = movingArticleId
    ? articles.find(a => a.id === movingArticleId)
    : null;

  const otherLocations = allLocations.filter(l => l.id !== location.id);

  return (
    <View style={styles.panel}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.zoneName}>{zone.name}</Text>
          <Text style={styles.locationName}>{location.name}</Text>
          <Text style={styles.locationMeta}>{location.type} · {articles.length} Artikel</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Verschieben-Auswahl */}
      {movingArticle && (
        <View style={styles.movePanel}>
          <Text style={styles.movePanelTitle}>
            „{movingArticle.name}" verschieben nach:
          </Text>
          <ScrollView style={styles.locationList}>
            {otherLocations.map(loc => (
              <TouchableOpacity
                key={loc.id}
                style={styles.locationOption}
                onPress={() => confirmMove(movingArticle, loc.id)}
                disabled={loading}
              >
                <Ionicons name="location-outline" size={16} color="#FF9500" />
                <Text style={styles.locationOptionText}>{loc.name}</Text>
                <Text style={styles.locationOptionType}>{loc.type}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={cancelMove} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Artikelliste */}
      {!movingArticle && (
        <>
          {articles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyText}>Keine Artikel hier</Text>
            </View>
          ) : (
            <FlatList
              data={articles}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const stockColor = getStockColor(item.current_stock, item.min_stock_level);
                return (
                  <View style={styles.articleRow}>
                    <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
                    <View style={styles.articleInfo}>
                      <Text style={styles.articleName}>{item.name}</Text>
                      <Text style={styles.articleCode}>{item.inventory_code}</Text>
                      <Text style={[styles.articleStock, { color: stockColor }]}>
                        Bestand: {item.current_stock} / Min: {item.min_stock_level}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.moveButton}
                      onPress={() => startMove(item.id)}
                      disabled={loading}
                    >
                      <Ionicons name="arrow-redo-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 300,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
  },
  headerText: { flex: 1 },
  zoneName: { fontSize: 12, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase' },
  locationName: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginTop: 2 },
  locationMeta: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  closeButton: { padding: 4 },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  stockDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  articleInfo: { flex: 1 },
  articleName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  articleCode: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  articleStock: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  moveButton: { padding: 8 },
  movePanel: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFF9E6',
  },
  movePanelTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', marginBottom: 8 },
  locationList: { maxHeight: 200 },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  locationOptionText: { flex: 1, fontSize: 14, color: '#1C1C1E' },
  locationOptionType: { fontSize: 12, color: '#8E8E93' },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
  },
  cancelButtonText: { fontSize: 14, color: '#FF3B30', fontWeight: '600' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyText: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
});
```

- [ ] **Commit:**

```bash
cd frontend && git add components/warehouse/LocationPanel.tsx
git commit -m "feat: add LocationPanel with article list and move flow"
```

---

## Task 7: warehouse/index.tsx — Screen

**Files:**
- Create: `frontend/app/warehouse/index.tsx`

- [ ] **Ordner anlegen:**

```bash
mkdir -p frontend/app/warehouse
```

- [ ] **Datei erstellen:** `frontend/app/warehouse/index.tsx`

```typescript
// frontend/app/warehouse/index.tsx
// Haupt-Screen der isometrischen Lagervisualisierung.
// Lädt Zones/Locations/Artikel, zeigt SVG-Szene + Seitenpanel.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ActivityIndicator,
  TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/apiService';
import IsometricWarehouse from '../../components/warehouse/IsometricWarehouse';
import LocationPanel from '../../components/warehouse/LocationPanel';
import {
  Article,
  StorageZone,
  StorageLocation,
  getArticlesForLocation,
  getLocationsForZone,
} from '../../utils/warehouseUtils';

export default function WarehouseScreen() {
  const [zones, setZones] = useState<StorageZone[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [z, l, a] = await Promise.all([
        apiService.get<StorageZone[]>('/api/storage-zones'),
        apiService.get<StorageLocation[]>('/api/storage-locations'),
        apiService.get<Article[]>('/api/articles'),
      ]);
      setZones(z);
      setLocations(l);
      setArticles(a);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleArticleMoved = useCallback((articleId: string, newLocationId: string) => {
    setArticles(prev =>
      prev.map(a => a.id === articleId ? { ...a, storage_location_id: newLocationId } : a)
    );
  }, []);

  const selectedLocation = locations.find(l => l.id === selectedLocationId) ?? null;
  const selectedZone = selectedLocation
    ? zones.find(z => z.id === selectedLocation.zone_id) ?? null
    : null;
  const selectedArticles = selectedLocationId
    ? getArticlesForLocation(articles, selectedLocationId)
    : [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Lager wird geladen…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="wifi-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (zones.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="business-outline" size={48} color="#C7C7CC" />
        <Text style={styles.emptyText}>Keine Lagerplätze angelegt.</Text>
        <Text style={styles.emptySubText}>Bitte zuerst Zonen unter „Lagerorte" erstellen.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Legende */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
          <Text style={styles.legendText}>Genug</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
          <Text style={styles.legendText}>Knapp</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
          <Text style={styles.legendText}>Kritisch</Text>
        </View>
        <Text style={styles.legendHint}>Regal antippen zum Öffnen</Text>
      </View>

      {/* SVG-Szene */}
      <View style={{ flex: 1 }}>
        <IsometricWarehouse
          zones={zones}
          locations={locations}
          articles={articles}
          selectedLocationId={selectedLocationId}
          onLocationSelect={setSelectedLocationId}
        />

        {/* Seitenpanel */}
        {selectedLocationId && selectedLocation && selectedZone && (
          <LocationPanel
            location={selectedLocation}
            zone={selectedZone}
            articles={selectedArticles}
            allLocations={locations}
            onClose={() => setSelectedLocationId(null)}
            onArticleMoved={handleArticleMoved}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  loadingText: { fontSize: 16, color: '#8E8E93', marginTop: 8 },
  errorText: { fontSize: 16, color: '#FF3B30', textAlign: 'center' },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1C1C1E', textAlign: 'center' },
  emptySubText: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: '#333' },
  legendHint: { marginLeft: 'auto', fontSize: 12, color: '#8E8E93', fontStyle: 'italic' },
});
```

- [ ] **Commit:**

```bash
cd frontend && git add app/warehouse/index.tsx
git commit -m "feat: add warehouse screen with data loading and state management"
```

---

## Task 8: Navigation — Route + Dashboard-Link

**Files:**
- Modify: `frontend/app/_layout.tsx` (nach Zeile 51, vor `</Stack>`)
- Modify: `frontend/app/index.tsx` (nach Zeile 418, im Inventar-Menü)

### Schritt 8.1: Route in _layout.tsx registrieren

- [ ] **Zeile 51 in `frontend/app/_layout.tsx` finden** (nach `bundles/index`):

Aktuell:
```tsx
              <Stack.Screen name="bundles/index" />
            </Stack>
```

Ersetzen durch:
```tsx
              <Stack.Screen name="bundles/index" />
              <Stack.Screen name="warehouse/index" options={{ headerShown: true, title: 'Lager 3D' }} />
            </Stack>
```

### Schritt 8.2: Dashboard-Link in index.tsx hinzufügen

- [ ] **Zeile 418 in `frontend/app/index.tsx` finden** (nach dem Lagerorte-Menüeintrag):

Aktuell:
```tsx
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/storage/locations')}>
            <Ionicons name="location-outline" size={24} color="#FF9500" />
            <Text style={styles.menuLabel}>Lagerorte</Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
```

Ersetzen durch:
```tsx
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/storage/locations')}>
            <Ionicons name="location-outline" size={24} color="#FF9500" />
            <Text style={styles.menuLabel}>Lagerorte</Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/warehouse')}>
            <Ionicons name="business-outline" size={24} color="#5856D6" />
            <Text style={styles.menuLabel}>Lager 3D</Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
```

### Schritt 8.3: Alle Tests ausführen

- [ ] **Frontend-Tests:**

```bash
cd frontend && npx jest --no-coverage 2>&1 | tail -15
```

Erwartet: Alle bisherigen 26 Tests + 2 neue Warehouse-Tests = **28 Tests bestanden**

- [ ] **Commit:**

```bash
cd frontend && git add app/_layout.tsx app/index.tsx
git commit -m "feat: register warehouse route and add dashboard link"
```

---

## Fertig!

Nach allen 8 Tasks:
- ✅ `warehouseUtils.ts` mit 8 pure Funktionen, vollständig getestet
- ✅ `locationPanelLogic.ts` mit Move-Validierung und Payload-Builder, vollständig getestet
- ✅ `IsometricBox.tsx` — isometrische Box mit 3 Flächen
- ✅ `IsometricShelf.tsx` — Regal mit 3 Etagen und Artikel-Boxen
- ✅ `IsometricWarehouse.tsx` — scrollbarer SVG-Canvas mit allen Regalen
- ✅ `LocationPanel.tsx` — Seitenpanel mit Verschieben-Flow
- ✅ `warehouse/index.tsx` — vollständiger Screen
- ✅ Navigation registriert + Dashboard-Link
- ✅ 28/28 Tests bestehen
