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
