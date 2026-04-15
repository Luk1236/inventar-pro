import { filterConsumableAlerts } from '../utils/consumableUtils';

describe('filterConsumableAlerts', () => {
  it('includes consumable articles where current_stock <= min_stock_level', () => {
    const articles = [
      { is_consumable: true, current_stock: 2, min_stock_level: 5 },
    ];
    const result = filterConsumableAlerts(articles);
    expect(result).toHaveLength(1);
    expect(result[0].current_stock).toBe(2);
  });

  it('excludes non-consumable articles even if stock is low', () => {
    const articles = [
      { is_consumable: false, current_stock: 0, min_stock_level: 10 },
    ];
    const result = filterConsumableAlerts(articles);
    expect(result).toHaveLength(0);
  });

  it('excludes consumable articles where current_stock > min_stock_level', () => {
    const articles = [
      { is_consumable: true, current_stock: 10, min_stock_level: 5 },
    ];
    const result = filterConsumableAlerts(articles);
    expect(result).toHaveLength(0);
  });
});
