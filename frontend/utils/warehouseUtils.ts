export const TILE_SIZE = 40;

// ─── Warehouse layout constants ──────────────────────────────────────────
// Used by SchematicWarehouse, IsometricWarehouse, app/warehouse/index.tsx
// for fill-ratio calculation. Keeping them here means a future "real
// per-location capacity" lookup needs only one swap point.
//
// Default: 3 levels × 3 spots-per-level = 9 slots/location. Override via
// `StorageLocation.capacity` if a specific location has a different size.
export const DEFAULT_LEVELS_PER_LOCATION = 3;
export const DEFAULT_SPOTS_PER_LEVEL = 3;
export const DEFAULT_SLOTS_PER_LOCATION =
  DEFAULT_LEVELS_PER_LOCATION * DEFAULT_SPOTS_PER_LEVEL;

/** Capacity for a location: explicit override if set, default 9 otherwise. */
export function getLocationCapacity(location: { capacity?: number | null }): number {
  return location.capacity && location.capacity > 0
    ? location.capacity
    : DEFAULT_SLOTS_PER_LOCATION;
}

/** Fill ratio (0..1) for a single location. */
export function getLocationFillRatio(
  location: { capacity?: number | null },
  articleCount: number,
): number {
  const cap = getLocationCapacity(location);
  return Math.min(articleCount / cap, 1);
}

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
  grid_width?: number;   // Anzahl Felder X (1 Feld = 1,5 m)
  grid_depth?: number;   // Anzahl Felder Z (1 Feld = 1,5 m)
}

export interface StorageLocation {
  id: string;
  zone_id: string;
  name: string;
  type: string;
  capacity?: number;
}

export function isoProject(x: number, y: number, z: number): { sx: number; sy: number } {
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  return {
    sx: (x - z) * cos30 * TILE_SIZE,
    sy: (x + z) * sin30 * TILE_SIZE - y * TILE_SIZE,
  };
}

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

export function getStockColor(current: number, minLevel: number): string {
  if (current < minLevel) return '#FF3B30';
  if (current === minLevel) return '#FF9500';
  return '#34C759';
}

export function darkenColor(hex: string, amount: number = 40): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function getArticlesForLocation(articles: Article[], locationId: string): Article[] {
  return articles.filter(a => a.storage_location_id === locationId);
}

export function getLocationsForZone(locations: StorageLocation[], zoneId: string): StorageLocation[] {
  return locations.filter(l => l.zone_id === zoneId);
}

export function getStockForLocation(articles: Article[], locationId: string): number {
  return getArticlesForLocation(articles, locationId)
    .reduce((sum, a) => sum + (a.current_stock ?? 0), 0);
}

export function getMinStockForLocation(articles: Article[], locationId: string): number {
  return getArticlesForLocation(articles, locationId)
    .reduce((sum, a) => sum + (a.min_stock_level ?? 0), 0);
}

export function sortByDepth(
  items: Array<{ gx: number; gz: number; [key: string]: any }>
): typeof items {
  return [...items].sort((a, b) => (a.gz + a.gx) - (b.gz + b.gx));
}
