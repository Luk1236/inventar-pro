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
