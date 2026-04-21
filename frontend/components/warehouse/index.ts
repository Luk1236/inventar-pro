/**
 * Warehouse Visualization Components
 *
 * This module provides 2D and 3D visualization components for warehouse/storage management.
 *
 * Components:
 * - WarehouseVisualizer2D: Top-down 2D floor plan view
 * - WarehouseVisualizer3D: Interactive 3D shelf visualization
 *
 * Usage:
 * ```tsx
 * import { WarehouseVisualizer2D, WarehouseVisualizer3D } from '@/components/warehouse';
 *
 * // 2D View
 * <WarehouseVisualizer2D
 *   zones={zones}
 *   locations={locations}
 *   onLocationPress={(loc) => console.log('Selected:', loc.code)}
 *   showCapacity={true}
 * />
 *
 * // 3D View
 * <WarehouseVisualizer3D
 *   config={{ blocks: 3, levels: 4, spotsPerLevel: 5 }}
 *   data={shelfData}
 *   onSpotSelect={(block, level, spot, code, data) => ...}
 * />
 * ```
 */

export { default as WarehouseVisualizer2D } from './WarehouseVisualizer2D';
export { default as WarehouseVisualizer3D } from './WarehouseVisualizer3D';
export { default as ShelfVisualizer3D } from './ShelfVisualizer3D';

export * from './WarehouseVisualizer2D';
export * from './WarehouseVisualizer3D';

// Re-export utility functions
export * from '../../utils/warehouseUtils';