import { parseCsv, generateCsvTemplate } from '../utils/csvUtils';

describe('parseCsv', () => {
  it('returns empty array for single line (header only)', () => {
    const result = parseCsv('name,inventory_code,description');
    expect(result).toEqual([]);
  });

  it('parses 2 rows correctly', () => {
    const csv = 'name,inventory_code,description\nArtikel A,ART-001,Desc A\nArtikel B,ART-002,Desc B';
    const result = parseCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Artikel A', inventory_code: 'ART-001', description: 'Desc A' });
    expect(result[1]).toEqual({ name: 'Artikel B', inventory_code: 'ART-002', description: 'Desc B' });
  });
});

describe('generateCsvTemplate', () => {
  it('returns string containing name,inventory_code', () => {
    const template = generateCsvTemplate();
    expect(template).toContain('name,inventory_code');
  });
});
