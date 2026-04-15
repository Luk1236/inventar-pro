export function filterConsumableAlerts(
  articles: Array<{ is_consumable: boolean; current_stock: number; min_stock_level: number }>
): typeof articles {
  return articles.filter(a => a.is_consumable && a.current_stock <= a.min_stock_level);
}
