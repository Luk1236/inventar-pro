/**
 * Warehouse Visualization Components
 *
 * Three visualization paths exist (each with a different use-case):
 *
 * - SchematicWarehouse — flat 2D top-down floor plan, SVG, used by /warehouse
 * - IsometricWarehouse — isometric 3D-look via SVG projection (no WebGL),
 *                        used by /warehouse with the 2D/3D toggle
 * - WarehouseVisualizer3D — full WebGL 3D via WebView + three.js, used by
 *                           /warehouse-3d Live tab; works on iOS/Android too
 *
 * The parametric warehouse planner at /warehouse-3d (Planer tab) is a
 * separate component (app/warehouse-3d/VisualizerCanvas.web.tsx) using
 * @react-three/fiber directly.
 */

export { default as SchematicWarehouse } from './SchematicWarehouse';
export { default as IsometricWarehouse } from './IsometricWarehouse';
export { default as WarehouseVisualizer3D } from './WarehouseVisualizer3D';
export { default as ShelfVisualizer3D } from './ShelfVisualizer3D';
export { default as LocationPanel } from './LocationPanel';

export * from './WarehouseVisualizer3D';

// Re-export utility functions
export * from '../../utils/warehouseUtils';
