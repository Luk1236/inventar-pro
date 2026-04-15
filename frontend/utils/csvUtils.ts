export interface CsvRow { [key: string]: string }

export function parseCsv(content: string): CsvRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

export function generateCsvTemplate(): string {
  return 'name,inventory_code,description,base_unit,current_stock,min_stock_level,price_per_unit,status,is_consumable\nBeispiel Artikel,ART-001,Beschreibung,Stück,10,2,99.99,OK,false\n';
}
