import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, ScrollView, TextInput, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// TYPEN
// ============================================================

export interface Shelf3DConfig {
  blocks: number;
  levels: number;
  spotsPerLevel: number;
  name?: string;
}

export interface Shelf3DData {
  code: string;
  fillPercent: number;
  articleName?: string;
  articleId?: string;
  stock?: number;
  lastUpdated?: string;
  isLocked?: boolean;
  hasWarning?: boolean;
}

export interface Shelf3DProps {
  config: Shelf3DConfig;
  data: Record<string, Shelf3DData>;
  onSpotSelect?: (block: number, level: number, spot: number, code: string, data: Shelf3DData) => void;
  onMultiSelect?: (spots: Array<{ block: number; level: number; spot: number; code: string; data: Shelf3DData }>) => void;
  onExport?: (imageData: string) => void;
  selectedSpot?: string | null;
  theme?: 'light' | 'dark' | 'auto';
  showLabels?: boolean;
  enableAnimation?: boolean;
  compactMode?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  highlightArticleId?: string | null;
  multiSelectMode?: boolean;
}

// ============================================================
// PREMIUM HTML GENERATOR
// ============================================================

function generate3DHtml(
  config: Shelf3DConfig,
  data: Record<string, Shelf3DData>,
  options: {
    isDark: boolean;
    showLabels: boolean;
    selectedSpot: string | null;
    enableAnimation: boolean;
    compactMode: boolean;
    showSearch: boolean;
    showFilters: boolean;
    highlightArticleId: string | null;
    multiSelectMode?: boolean;
    selectedSpots?: string[];
  }
): string {
  const { blocks, levels, spotsPerLevel, name } = config;
  const { isDark, selectedSpot, enableAnimation, highlightArticleId, multiSelectMode, selectedSpots } = options;

  // Premium Farbschema
  const colors = isDark ? {
    bg: '#030712',
    bgGradient: 'linear-gradient(135deg, #030712 0%, #0c1222 50%, #111827 100%)',
    panel: 'rgba(17, 24, 39, 0.95)',
    panelGlass: 'rgba(17, 24, 39, 0.7)',
    card: 'rgba(31, 41, 55, 0.8)',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    accent: '#3b82f6',
    accentGlow: 'rgba(59, 130, 246, 0.4)',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    border: 'rgba(59, 130, 246, 0.2)',
    shelfFrame: '#1e40af',
    shelfBoard: '#44403c',
    floor: '#1e293b',
  } : {
    bg: '#f8fafc',
    bgGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)',
    panel: 'rgba(255, 255, 255, 0.95)',
    panelGlass: 'rgba(255, 255, 255, 0.8)',
    card: 'rgba(241, 245, 249, 0.9)',
    text: '#0f172a',
    textMuted: '#64748b',
    accent: '#2563eb',
    accentGlow: 'rgba(37, 99, 235, 0.3)',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    border: 'rgba(37, 99, 235, 0.15)',
    shelfFrame: '#1d4ed8',
    shelfBoard: '#a8a29e',
    floor: '#e2e8f0',
  };

  // Daten für jeden Spot
  const spotData: Record<string, any> = {};
  Object.entries(data).forEach(([key, value]) => {
    spotData[key] = {
      pct: value.fillPercent ?? 0,
      article: value.articleName,
      articleId: value.articleId,
      stock: value.stock,
      isLocked: value.isLocked,
      hasWarning: value.hasWarning,
    };
  });

  const shelfName = name || `Regal ${blocks}×${levels}×${spotsPerLevel}`;
  const totalSpots = blocks * levels * spotsPerLevel;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${shelfName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}

:root {
  --bg: ${colors.bg};
  --panel: ${colors.panel};
  --panel-glass: ${colors.panelGlass};
  --card: ${colors.card};
  --text: ${colors.text};
  --muted: ${colors.textMuted};
  --accent: ${colors.accent};
  --accent-glow: ${colors.accentGlow};
  --success: ${colors.success};
  --warning: ${colors.warning};
  --danger: ${colors.danger};
  --border: ${colors.border};
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  height: 100vh;
  overflow: hidden;
  background: ${colors.bgGradient};
  background-attachment: fixed;
}

/* Main Container */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Premium Header */
.header {
  background: ${colors.panelGlass};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid ${colors.border};
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, ${colors.accent} 0%, #8b5cf6 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px ${colors.accentGlow};
}

.header-icon svg {
  width: 22px;
  height: 22px;
  fill: white;
}

.header-content {
  flex: 1;
}

.header-title {
  font-size: 17px;
  font-weight: 700;
  color: ${colors.text};
  letter-spacing: -0.3px;
}

.header-subtitle {
  font-size: 11px;
  color: ${colors.textMuted};
  margin-top: 2px;
  font-weight: 500;
}

.header-stats {
  display: flex;
  gap: 16px;
}

.header-stat {
  text-align: center;
  padding: 6px 12px;
  background: ${colors.card};
  border-radius: 10px;
  border: 1px solid ${colors.border};
}

.header-stat-value {
  font-size: 16px;
  font-weight: 700;
  color: ${colors.accent};
}

.header-stat-label {
  font-size: 9px;
  color: ${colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Search Bar */
.search-bar {
  background: ${colors.panelGlass};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid ${colors.border};
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  flex: 1;
  background: ${colors.card};
  border: 1px solid ${colors.border};
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: ${colors.text};
  outline: none;
}

.search-input::placeholder {
  color: ${colors.textMuted};
}

.filter-chips {
  display: flex;
  gap: 6px;
}

.filter-chip {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 11px;
  font-weight: 600;
  background: ${colors.card};
  border: 1px solid ${colors.border};
  color: ${colors.textMuted};
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-chip:hover {
  background: ${colors.panel};
  color: ${colors.text};
}

.filter-chip.active {
  background: ${colors.accent};
  color: white;
  border-color: ${colors.accent};
}

.filter-chip.empty { background: #22c55e; color: white; border-color: #22c55e; }
.filter-chip.filled { background: #f59e0b; color: white; border-color: #f59e0b; }
.filter-chip.warning { background: #ef4444; color: white; border-color: #ef4444; }

/* Control Bar */
.control-bar {
  background: ${colors.panelGlass};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid ${colors.border};
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-group {
  display: flex;
  gap: 4px;
  background: ${colors.card};
  padding: 4px;
  border-radius: 12px;
  border: 1px solid ${colors.border};
}

.view-btn {
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: ${colors.textMuted};
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 6px;
}

.view-btn:hover {
  background: ${colors.panel};
  color: ${colors.text};
}

.view-btn.active {
  background: ${colors.accent};
  color: white;
  box-shadow: 0 2px 8px ${colors.accentGlow};
}

.view-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.divider {
  width: 1px;
  height: 28px;
  background: ${colors.border};
  margin: 0 4px;
}

/* Canvas Container */
.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse at center, ${colors.bg} 0%, #000 200%);
}

#canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* Floating Controls */
.floating-controls {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: ${colors.panelGlass};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 8px;
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.ctrl-btn {
  width: 44px;
  height: 44px;
  border: none;
  background: ${colors.card};
  color: ${colors.text};
  font-size: 20px;
  font-weight: 700;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${colors.border};
}

.ctrl-btn:hover {
  background: ${colors.accent};
  color: white;
  transform: scale(1.05);
  box-shadow: 0 4px 12px ${colors.accentGlow};
}

.ctrl-btn:active {
  transform: scale(0.95);
}

/* Premium Legend */
.legend-panel {
  position: absolute;
  left: 12px;
  bottom: 12px;
  background: ${colors.panelGlass};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 14px;
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.legend-title {
  font-size: 10px;
  font-weight: 700;
  color: ${colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0;
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.legend-color.empty { background: linear-gradient(135deg, #374151, #4b5563); }
.legend-color.low { background: linear-gradient(135deg, #22c55e, #4ade80); }
.legend-color.medium { background: linear-gradient(135deg, #84cc16, #a3e635); }
.legend-color.high { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
.legend-color.full { background: linear-gradient(135deg, #ef4444, #f87171); }

.legend-text {
  font-size: 12px;
  color: ${colors.text};
  font-weight: 500;
}

/* Stats Footer */
.stats-footer {
  background: ${colors.panelGlass};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid ${colors.border};
  padding: 10px 16px;
  display: flex;
  justify-content: space-around;
}

.stat-card {
  flex: 1;
  max-width: 100px;
  text-align: center;
  padding: 10px 8px;
  background: ${colors.card};
  border-radius: 12px;
  border: 1px solid ${colors.border};
  margin: 0 4px;
}

.stat-icon {
  font-size: 18px;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 800;
  color: ${colors.text};
  letter-spacing: -0.5px;
}

.stat-label {
  font-size: 9px;
  color: ${colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.stat-card.success .stat-value { color: ${colors.success}; }
.stat-card.warning .stat-value { color: ${colors.warning}; }
.stat-card.danger .stat-value { color: ${colors.danger}; }

/* Premium Tooltip */
.tooltip {
  position: fixed;
  background: ${colors.panel};
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 16px;
  min-width: 200px;
  max-width: 280px;
  pointer-events: none;
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
  box-shadow: 0 20px 40px rgba(0,0,0,0.3);
}

.tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${colors.border};
}

.tooltip-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, ${colors.accent}, #8b5cf6);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px ${colors.accentGlow};
}

.tooltip-icon svg {
  width: 20px;
  height: 20px;
  fill: white;
}

.tooltip-title-group {
  flex: 1;
}

.tooltip-title {
  font-size: 15px;
  font-weight: 700;
  color: ${colors.text};
  letter-spacing: -0.2px;
}

.tooltip-subtitle {
  font-size: 11px;
  color: ${colors.textMuted};
  margin-top: 2px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.tooltip-label {
  font-size: 12px;
  color: ${colors.textMuted};
}

.tooltip-value {
  font-size: 13px;
  font-weight: 600;
  color: ${colors.text};
}

.tooltip-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  margin-top: 8px;
}

.tooltip-badge.warning {
  background: rgba(245, 158, 11, 0.15);
  color: ${colors.warning};
}

.tooltip-badge.locked {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

/* Fill Bar */
.fill-bar-container {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid ${colors.border};
}

.fill-bar-label {
  font-size: 10px;
  color: ${colors.textMuted};
  margin-bottom: 6px;
}

.fill-bar {
  height: 8px;
  background: ${colors.card};
  border-radius: 4px;
  overflow: hidden;
}

.fill-bar-inner {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.fill-bar-text {
  font-size: 11px;
  font-weight: 600;
  color: ${colors.text};
  margin-top: 4px;
  text-align: right;
}

/* Ambient Particles Overlay */
.particles-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.4;
  background-image:
    radial-gradient(1px 1px at 20% 30%, ${colors.accent} 0%, transparent 100%),
    radial-gradient(1px 1px at 40% 70%, ${colors.accent} 0%, transparent 100%),
    radial-gradient(1px 1px at 80% 20%, ${colors.accent} 0%, transparent 100%),
    radial-gradient(1px 1px at 60% 80%, ${colors.accent} 0%, transparent 100%);
  animation: particlesFloat 20s ease-in-out infinite;
}

@keyframes particlesFloat {
  0%, 100% { opacity: 0.2; transform: translateY(0); }
  50% { opacity: 0.5; transform: translateY(-10px); }
}

/* Labels */
#labels-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.block-label {
  position: absolute;
  font-size: 13px;
  font-weight: 800;
  color: ${colors.accent};
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
  letter-spacing: 1px;
  transform: translate(-50%, -50%);
}

/* Responsive */
@media (max-width: 400px) {
  .header { padding: 10px 12px; }
  .header-title { font-size: 15px; }
  .header-stats { display: none; }
  .legend-panel { padding: 10px; }
  .ctrl-btn { width: 38px; height: 38px; font-size: 18px; }
}
</style>
</head>
<body>
<div class="app-container">
  <!-- Header -->
  <div class="header">
    <div class="header-icon">
      <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.2l2 2H20v10z"/></svg>
    </div>
    <div class="header-content">
      <div class="header-title">${shelfName}</div>
      <div class="header-subtitle">${blocks} Blöcke · ${levels} Ebenen · ${spotsPerLevel} Plätze</div>
    </div>
    <div class="header-stats">
      <div class="header-stat">
        <div class="header-stat-value">${totalSpots}</div>
        <div class="header-stat-label">Gesamt</div>
      </div>
      <div class="header-stat">
        <div class="header-stat-value" id="stat-utilization">0%</div>
        <div class="header-stat-label">Auslastung</div>
      </div>
    </div>
  </div>

  <!-- Search Bar -->
  ${showSearch ? `
  <div class="search-bar">
    <input type="text" class="search-input" id="search-input" placeholder="Artikel oder Code suchen...">
    ${showFilters ? `
    <div class="filter-chips">
      <button class="filter-chip active" data-filter="all">Alle</button>
      <button class="filter-chip" data-filter="empty">Frei</button>
      <button class="filter-chip" data-filter="filled">Belegt</button>
      <button class="filter-chip" data-filter="warning">⚠️</button>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <!-- Control Bar -->
  <div class="control-bar">
    <div class="btn-group">
      <button class="view-btn active" id="btn-perspective">
        <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zM12 17c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>
        3D
      </button>
      <button class="view-btn" id="btn-top">
        <svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>
        Oben
      </button>
      <button class="view-btn" id="btn-front">
        <svg viewBox="0 0 24 24"><path d="M12 8l-6 6h12z"/></svg>
        Front
      </button>
    </div>
    <div class="divider"></div>
    <div class="btn-group">
      <button class="view-btn" id="btn-auto-rotate">🔄 Drehen</button>
      <button class="view-btn" id="btn-reset">🎯 Zurücksetzen</button>
    </div>
  </div>

  <!-- Canvas -->
  <div class="canvas-container">
    <canvas id="canvas"></canvas>
    <div class="particles-overlay"></div>
    <div id="labels-layer"></div>

    <!-- Floating Controls -->
    <div class="floating-controls">
      <button class="ctrl-btn" id="btn-zoom-in" title="Vergrößern">+</button>
      <button class="ctrl-btn" id="btn-zoom-out" title="Verkleinern">−</button>
      <button class="ctrl-btn" id="btn-rot-left" title="Links drehen">↺</button>
      <button class="ctrl-btn" id="btn-rot-right" title="Rechts drehen">↻</button>
    </div>

    <!-- Legend -->
    <div class="legend-panel">
      <div class="legend-title">Füllstand</div>
      <div class="legend-item"><div class="legend-color empty"></div><span class="legend-text">Leer (0%)</span></div>
      <div class="legend-item"><div class="legend-color low"></div><span class="legend-text">Niedrig (1-40%)</span></div>
      <div class="legend-item"><div class="legend-color medium"></div><span class="legend-text">Mittel (41-70%)</span></div>
      <div class="legend-item"><div class="legend-color high"></div><span class="legend-text">Hoch (71-90%)</span></div>
      <div class="legend-item"><div class="legend-color full"></div><span class="legend-text">Voll (91-100%)</span></div>
    </div>
  </div>

  <!-- Stats Footer -->
  <div class="stats-footer">
    <div class="stat-card">
      <div class="stat-value">${totalSpots}</div>
      <div class="stat-label">Plätze</div>
    </div>
    <div class="stat-card success">
      <div class="stat-value" id="stat-free">0</div>
      <div class="stat-label">Frei</div>
    </div>
    <div class="stat-card warning">
      <div class="stat-value" id="stat-filled">0</div>
      <div class="stat-label">Belegt</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="stat-avg">0%</div>
      <div class="stat-label">Ø Füllung</div>
    </div>
  </div>
</div>

<!-- Tooltip -->
<div class="tooltip" id="tooltip">
  <div class="tooltip-header">
    <div class="tooltip-icon">
      <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
    </div>
    <div class="tooltip-title-group">
      <div class="tooltip-title" id="tip-title">Code</div>
      <div class="tooltip-subtitle" id="tip-subtitle">Position</div>
    </div>
  </div>
  <div class="tooltip-row">
    <span class="tooltip-label">Artikel</span>
    <span class="tooltip-value" id="tip-article">-</span>
  </div>
  <div class="tooltip-row">
    <span class="tooltip-label">Bestand</span>
    <span class="tooltip-value" id="tip-stock">-</span>
  </div>
  <div class="fill-bar-container">
    <div class="fill-bar-label">Füllstand</div>
    <div class="fill-bar">
      <div class="fill-bar-inner" id="tip-fill-bar" style="width: 0%"></div>
    </div>
    <div class="fill-bar-text" id="tip-fill">0%</div>
  </div>
  <div id="tip-badges"></div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
// ============================================
// KONFIGURATION
// ============================================
const CFG = { blocks: ${blocks}, levels: ${levels}, spots: ${spotsPerLevel} };
const SPOT_DATA = ${JSON.stringify(spotData)};
const SEL_SPOT = ${selectedSpot ? `"${selectedSpot}"` : 'null'};
const SEL_SPOTS = ${JSON.stringify(selectedSpots || [])};
const HIGHLIGHT_ARTICLE = ${highlightArticleId ? `"${highlightArticleId}"` : 'null'};
const MULTI_SELECT = ${multiSelectMode ? 'true' : 'false'};
const IS_DARK = ${isDark};

const COLORS = IS_DARK ? {
  bg: 0x030712,
  floor: 0x0f172a,
  frame: 0x1e40af,
  board: 0x44403c,
  accent: 0x3b82f6,
  empty: 0x374151,
  low: 0x22c55e,
  medium: 0x84cc16,
  high: 0xf59e0b,
  full: 0xef4444
} : {
  bg: 0xf8fafc,
  floor: 0xe2e8f0,
  frame: 0x1d4ed8,
  board: 0xa8a29e,
  accent: 0x2563eb,
  empty: 0x94a3b8,
  low: 0x16a34a,
  medium: 0x65a30d,
  high: 0xd97706,
  full: 0xdc2626
};

// ============================================
// THREE.JS SETUP
// ============================================
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);

// Fog für Tiefe
scene.fog = new THREE.FogExp2(COLORS.bg, 0.03);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
let camTheta = Math.PI * 0.25;
let camPhi = Math.PI * 0.32;
let camRadius = 9;
let camTarget = new THREE.Vector3(0, CFG.levels * 0.5, 0);
let autoRotate = false;
let targetTheta = camTheta, targetPhi = camPhi, targetRadius = camRadius;

// ============================================
// BELEUCHTUNG - Premium Global Illumination
// ============================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Hauptlicht (Sun) mit weichen Schatten
const sunLight = new THREE.DirectionalLight(0xfff5eb, 1.8);
sunLight.position.set(25, 35, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(4096, 4096);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 100;
sunLight.shadow.camera.left = -30;
sunLight.shadow.camera.right = 30;
sunLight.shadow.camera.top = 30;
sunLight.shadow.camera.bottom = -30;
sunLight.shadow.bias = -0.0002;
sunLight.shadow.normalBias = 0.02;
sunLight.shadow.radius = 4;
scene.add(sunLight);

// Fülllicht (weiches Himmellicht)
const fillLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.6);
scene.add(fillLight);

// Randlicht (Rim) für Tiefe
const rimLight = new THREE.DirectionalLight(0x3b82f6, 0.4);
rimLight.position.set(-20, 10, -15);
scene.add(rimLight);

// Spotlight für Fokusbereich
const spotLight = new THREE.SpotLight(0x3b82f6, 0.8, 35, Math.PI * 0.2, 0.6, 1.5);
spotLight.position.set(0, 20, 8);
spotLight.castShadow = true;
spotLight.shadow.mapSize.set(1024, 1024);
scene.add(spotLight);

// Ambient Occlusion Simulation durch dunkle Ecken
const aoLight = new THREE.PointLight(0x000020, 0.3, 15);
aoLight.position.set(0, -1, 0);
scene.add(aoLight);

// ============================================
// MATERIALIEN - Premium Realistic Textures
// ============================================
// Metallrahmen - gebürsteter Stahl Look
const matFrame = new THREE.MeshStandardMaterial({
  color: COLORS.frame,
  metalness: 0.95,
  roughness: 0.25,
  envMapIntensity: 1.2,
});

// Holzregalboden - natürliche Textur
const matBoard = new THREE.MeshStandardMaterial({
  color: COLORS.board,
  roughness: 0.85,
  metalness: 0.02,
});

// Boden - Beton-ähnlich
const matFloor = new THREE.MeshStandardMaterial({
  color: COLORS.floor,
  roughness: 0.95,
  metalness: 0.0,
});

// Glasrückwand
const matGlass = new THREE.MeshStandardMaterial({
  color: COLORS.accent,
  transparent: true,
  opacity: 0.04,
  side: THREE.DoubleSide,
});

// Leere Plätze (dunkel, leicht transparent)
const matEmpty = new THREE.MeshStandardMaterial({
  color: COLORS.empty,
  metalness: 0.1,
  roughness: 0.7,
  transparent: true,
  opacity: 0.6,
});

// Box Material Cache mit Glow-Unterstützung
const boxMatCache = {};
function getBoxMat(pct, selected, highlighted, warning) {
  const key = pct + '-' + selected + '-' + highlighted + '-' + warning;
  if (boxMatCache[key]) return boxMatCache[key];

  // Accessible Farbschema mit unterschiedlichen Helligkeitswerten
  let color, emissive, emissiveIntensity;

  if (pct === 0) {
    color = COLORS.empty;
    emissive = 0x000000;
    emissiveIntensity = 0;
  } else if (pct <= 40) {
    // Grün - Niedrig
    color = COLORS.low;
    emissive = selected || highlighted ? 0x22c55e : 0x000000;
    emissiveIntensity = selected ? 0.3 : highlighted ? 0.15 : 0;
  } else if (pct <= 70) {
    // Gelb-Grün - Mittel
    color = COLORS.medium;
    emissive = selected || highlighted ? 0x84cc16 : 0x000000;
    emissiveIntensity = selected ? 0.35 : highlighted ? 0.2 : 0;
  } else if (pct <= 90) {
    // Orange - Hoch
    color = COLORS.high;
    emissive = 0xf59e0b;
    emissiveIntensity = selected ? 0.4 : highlighted ? 0.25 : warning ? 0.3 : 0.1;
  } else {
    // Rot - Voll/Kritisch
    color = COLORS.full;
    emissive = 0xef4444;
    emissiveIntensity = selected ? 0.5 : highlighted ? 0.35 : warning ? 0.4 : 0.15;
  }

  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.2,
    roughness: 0.4,
    emissive,
    emissiveIntensity,
    envMapIntensity: 0.8
  });

  boxMatCache[key] = mat;
  return mat;
}

// ============================================
// SZENE AUFBAUEN
// ============================================
let shelfGroup = null;
const hitMeshes = [];
const labelData = [];

// Search and Filter State
let currentFilter = 'all';
let searchQuery = '';

const SPOT_W = 1.0;
const SHELF_D = 0.65;
const POST_R = 0.03;
const BEAM_H = 0.05;
const CELL_H = 0.85;
const LEVEL_H = CELL_H + BEAM_H;
const BLOCK_GAP = 0.5;

function buildScene() {
  if (shelfGroup) scene.remove(shelfGroup);
  hitMeshes.length = 0;
  labelData.length = 0;
  Object.keys(boxMatCache).forEach(k => delete boxMatCache[k]);
  document.getElementById('labels-layer').innerHTML = '';

  shelfGroup = new THREE.Group();
  scene.add(shelfGroup);

  // Boden
  const floorGeo = new THREE.PlaneGeometry(50, 50);
  const floor = new THREE.Mesh(floorGeo, matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.005;
  floor.receiveShadow = true;
  shelfGroup.add(floor);

  // Grid
  const grid = new THREE.GridHelper(40, 40, COLORS.accent, COLORS.accent);
  grid.material.opacity = 0.08;
  grid.material.transparent = true;
  shelfGroup.add(grid);

  let freeCount = 0, filledCount = 0, totalFill = 0;

  for (let b = 0; b < CFG.blocks; b++) {
    const rx = b * (CFG.spots * (SPOT_W + POST_R * 2) + BLOCK_GAP);
    const blockW = CFG.spots * (SPOT_W + POST_R * 2);

    // Pfosten
    for (let pp = 0; pp <= CFG.spots; pp++) {
      const px = rx + pp * (SPOT_W + POST_R * 2);
      const postGeo = new THREE.CylinderGeometry(POST_R, POST_R, CFG.levels * LEVEL_H + BEAM_H, 12);
      const post = new THREE.Mesh(postGeo, matFrame);
      post.position.set(px + POST_R, (CFG.levels * LEVEL_H + BEAM_H) / 2, SHELF_D / 2);
      post.castShadow = true;
      shelfGroup.add(post);

      // Kappe oben
      const capGeo = new THREE.SphereGeometry(POST_R * 1.3, 12, 8);
      const cap = new THREE.Mesh(capGeo, matFrame);
      cap.position.set(px + POST_R, CFG.levels * LEVEL_H + BEAM_H + POST_R * 0.5, SHELF_D / 2);
      shelfGroup.add(cap);
    }

    // Ebenen
    for (let e = 0; e < CFG.levels; e++) {
      const gy = e * LEVEL_H + BEAM_H;

      // Bodenplatte
      const boardGeo = new THREE.BoxGeometry(blockW - POST_R * 2, 0.025, SHELF_D - 0.02);
      const board = new THREE.Mesh(boardGeo, matBoard);
      board.position.set(rx + blockW / 2, gy + 0.0125, SHELF_D / 2);
      board.receiveShadow = true;
      shelfGroup.add(board);

      // Vordere Kante
      const edgeGeo = new THREE.BoxGeometry(blockW - POST_R * 2, 0.03, 0.02);
      const edge = new THREE.Mesh(edgeGeo, matFrame);
      edge.position.set(rx + blockW / 2, gy + 0.035, 0);
      shelfGroup.add(edge);

      // Plätze
      for (let s = 0; s < CFG.spots; s++) {
        const px = rx + s * (SPOT_W + POST_R * 2) + POST_R;
        const code = String(b + 1).padStart(2, '0') + '-' + String(CFG.levels - e).padStart(2, '0') + '-' + String(s + 1).padStart(2, '0');
        const d = SPOT_DATA[code] || { pct: 0 };
        const pct = d.pct;
        const selected = SEL_SPOT === code || SEL_SPOTS.includes(code);
        const highlighted = HIGHLIGHT_ARTICLE && d.articleId === HIGHLIGHT_ARTICLE;
        const hasWarning = d.hasWarning || pct >= 90;

        if (pct > 0) {
          filledCount++;
          totalFill += pct;

          const boxH = CELL_H * 0.6 * Math.min(pct / 100, 1);
          const boxGeo = new THREE.BoxGeometry(SPOT_W * 0.92, boxH, SHELF_D * 0.88);
          const box = new THREE.Mesh(boxGeo, getBoxMat(pct, selected, highlighted, hasWarning));
          box.position.set(px + SPOT_W / 2, gy + 0.04 + boxH / 2, SHELF_D / 2);
          box.castShadow = true;
          box.receiveShadow = true;
          box.userData = { code, pct, hasWarning, isHighlight: highlighted };
          shelfGroup.add(box);

          // Selection Ring mit Glow
          if (selected) {
            const ringColor = SEL_SPOTS.includes(code) ? 0x8b5cf6 : COLORS.accent;
            // Äußerer Glow
            const outerGlowGeo = new THREE.TorusGeometry(Math.max(SPOT_W, boxH) * 0.75, 0.04, 8, 32);
            const outerGlowMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.3 });
            const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
            outerGlow.rotation.x = Math.PI / 2;
            outerGlow.position.set(px + SPOT_W / 2, gy + 0.02, SHELF_D / 2);
            shelfGroup.add(outerGlow);
            // Innerer Ring
            const ringGeo = new THREE.TorusGeometry(Math.max(SPOT_W, boxH) * 0.6, 0.02, 8, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.9 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(px + SPOT_W / 2, gy + 0.02, SHELF_D / 2);
            shelfGroup.add(ring);
          }

          // Highlighted article pulsing glow
          if (highlighted) {
            const glowGeo = new THREE.SphereGeometry(SPOT_W * 0.8, 16, 16);
            const glowMat = new THREE.MeshBasicMaterial({
              color: COLORS.accent,
              transparent: true,
              opacity: 0.25
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.set(px + SPOT_W / 2, gy + boxH / 2 + 0.15, SHELF_D / 2);
            glow.userData.isHighlight = true;
            glow.userData.baseScale = 1;
            shelfGroup.add(glow);
          }

          // Warning/Kritisch Glow
          if (hasWarning && !selected && !highlighted) {
            const warnGlowGeo = new THREE.RingGeometry(SPOT_W * 0.35, SPOT_W * 0.45, 32);
            const warnGlowMat = new THREE.MeshBasicMaterial({
              color: 0xef4444,
              transparent: true,
              opacity: 0.5,
              side: THREE.DoubleSide
            });
            const warnGlow = new THREE.Mesh(warnGlowGeo, warnGlowMat);
            warnGlow.rotation.x = -Math.PI / 2;
            warnGlow.position.set(px + SPOT_W / 2, gy + 0.03, SHELF_D / 2);
            warnGlow.userData.isWarning = true;
            shelfGroup.add(warnGlow);
          }

          if (d.hasWarning) {
            const warnGeo = new THREE.OctahedronGeometry(0.08);
            const warnMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
            const warn = new THREE.Mesh(warnGeo, warnMat);
            warn.position.set(px + SPOT_W / 2, gy + CELL_H + 0.05, SHELF_D / 2 + 0.3);
            shelfGroup.add(warn);
          }
        } else {
          freeCount++;
        }

        // Hit Box
        const hitGeo = new THREE.BoxGeometry(SPOT_W, CELL_H * 0.9, SHELF_D);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.position.set(px + SPOT_W / 2, gy + CELL_H * 0.45, SHELF_D / 2);
        hit.userData = { block: b + 1, level: CFG.levels - e, spot: s + 1, code, pct, ...d };
        hitMeshes.push(hit);
        shelfGroup.add(hit);
      }
    }

    // Rückwand
    const panelGeo = new THREE.PlaneGeometry(blockW, CFG.levels * LEVEL_H);
    const panel = new THREE.Mesh(panelGeo, matGlass);
    panel.position.set(rx + blockW / 2, CFG.levels * LEVEL_H / 2, 0);
    shelfGroup.add(panel);

    // Block Label
    labelData.push({
      pos: new THREE.Vector3(rx + blockW / 2, CFG.levels * LEVEL_H + 0.7, SHELF_D / 2),
      text: 'B' + String(b + 1).padStart(2, '0'),
      el: null
    });
  }

  // Stats
  const util = Math.round((filledCount / (CFG.blocks * CFG.levels * CFG.spots)) * 100);
  document.getElementById('stat-free').textContent = freeCount;
  document.getElementById('stat-filled').textContent = filledCount;
  document.getElementById('stat-avg').textContent = filledCount > 0 ? Math.round(totalFill / filledCount) + '%' : '0%';
  document.getElementById('stat-utilization').textContent = util + '%';

  updateLabels();
}

function updateLabels() {
  const layer = document.getElementById('labels-layer');
  layer.innerHTML = '';
  labelData.forEach(ld => {
    const div = document.createElement('div');
    div.className = 'block-label';
    div.textContent = ld.text;
    layer.appendChild(div);
    ld.el = div;
  });
}

function positionLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  labelData.forEach(ld => {
    if (!ld.el) return;
    const v = ld.pos.clone().project(camera);
    if (v.z > 1) { ld.el.style.display = 'none'; return; }
    ld.el.style.display = 'block';
    ld.el.style.left = ((v.x + 1) / 2 * w) + 'px';
    ld.el.style.top = ((-v.y + 1) / 2 * h) + 'px';
  });
}

// ============================================
// KAMERA
// ============================================
function updateCamera() {
  camTheta += (targetTheta - camTheta) * 0.08;
  camPhi += (targetPhi - camPhi) * 0.08;
  camRadius += (targetRadius - camRadius) * 0.08;

  camera.position.set(
    camTarget.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta),
    camTarget.y + camRadius * Math.cos(camPhi),
    camTarget.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta)
  );
  camera.lookAt(camTarget);
}

function onResize() {
  const container = document.querySelector('.canvas-container');
  renderer.setSize(container.clientWidth, container.clientHeight);
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjection();
}
window.addEventListener('resize', onResize);

// ============================================
// INTERAKTION
// ============================================
let dragging = false, lastX = 0, lastY = 0, clickStart = 0;
const container = document.querySelector('.canvas-container');
const tooltip = document.getElementById('tooltip');
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

container.addEventListener('mousedown', e => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  clickStart = Date.now();
});

window.addEventListener('mousemove', e => {
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    targetTheta -= dx * 0.006;
    targetPhi = Math.max(0.12, Math.min(Math.PI * 0.48, targetPhi - dy * 0.006));
    lastX = e.clientX;
    lastY = e.clientY;
    tooltip.classList.remove('visible');
  } else {
    handleHover(e);
  }
});

window.addEventListener('mouseup', e => {
  if (dragging && Date.now() - clickStart < 180) {
    handleClick(e);
  }
  dragging = false;
});

container.addEventListener('wheel', e => {
  e.preventDefault();
  targetRadius = Math.max(4, Math.min(20, targetRadius + e.deltaY * 0.006));
}, { passive: false });

// Touch
let lastTouch = null, pinchDist = 0;
container.addEventListener('touchstart', e => {
  if (e.touches.length === 1) lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  else if (e.touches.length === 2) pinchDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
}, { passive: true });

container.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && lastTouch) {
    const dx = e.touches[0].clientX - lastTouch.x;
    const dy = e.touches[0].clientY - lastTouch.y;
    targetTheta -= dx * 0.008;
    targetPhi = Math.max(0.12, Math.min(Math.PI * 0.48, targetPhi - dy * 0.008));
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
    targetRadius = Math.max(4, Math.min(20, targetRadius + (pinchDist - d) * 0.015));
    pinchDist = d;
  }
}, { passive: true });

function handleClick(e) {
  const rect = container.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(hitMeshes);
  if (hits.length > 0) {
    const d = hits[0].object.userData;
    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'select', block: d.block, level: d.level, spot: d.spot, code: d.code, pct: d.pct
    }));
  }
}

function handleHover(e) {
  const rect = container.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(hitMeshes);

  if (hits.length > 0) {
    const d = hits[0].object.userData;
    const sd = SPOT_DATA[d.code] || {};

    document.getElementById('tip-title').textContent = d.code;
    document.getElementById('tip-subtitle').textContent = 'B' + d.block + ' · E' + d.level + ' · P' + d.spot;
    document.getElementById('tip-article').textContent = sd.article || 'Kein Artikel';
    document.getElementById('tip-stock').textContent = sd.stock !== undefined ? sd.stock + ' Stk.' : '-';

    const fillBar = document.getElementById('tip-fill-bar');
    const fillPercent = d.pct || 0;
    fillBar.style.width = fillPercent + '%';
    fillBar.style.background = fillPercent === 0 ? '#64748b' :
      fillPercent <= 40 ? '#22c55e' : fillPercent <= 70 ? '#84cc16' : fillPercent <= 90 ? '#f59e0b' : '#ef4444';
    document.getElementById('tip-fill').textContent = fillPercent + '%';

    let badges = '';
    if (d.hasWarning) badges += '<span class="tooltip-badge warning">⚠️ Warnung</span>';
    if (d.isLocked) badges += '<span class="tooltip-badge locked">🔒 Gesperrt</span>';
    document.getElementById('tip-badges').innerHTML = badges;

    tooltip.classList.add('visible');
    tooltip.style.left = Math.min(e.clientX + 16, window.innerWidth - 300) + 'px';
    tooltip.style.top = Math.min(e.clientY - 16, window.innerHeight - 180) + 'px';
    container.style.cursor = 'pointer';
  } else {
    tooltip.classList.remove('visible');
    container.style.cursor = 'grab';
  }
}

// ============================================
// BUTTONS
// ============================================
document.getElementById('btn-zoom-in').onclick = () => { targetRadius = Math.max(4, targetRadius - 1.5); };
document.getElementById('btn-zoom-out').onclick = () => { targetRadius = Math.min(20, targetRadius + 1.5); };
document.getElementById('btn-rot-left').onclick = () => { targetTheta -= 0.4; };
document.getElementById('btn-rot-right').onclick = () => { targetTheta += 0.4; };

document.getElementById('btn-perspective').onclick = function() {
  document.querySelectorAll('.btn-group .view-btn').forEach(b => b.classList.remove('active'));
  this.classList.add('active');
  targetTheta = Math.PI * 0.25;
  targetPhi = Math.PI * 0.32;
};

document.getElementById('btn-top').onclick = function() {
  document.querySelectorAll('.btn-group .view-btn').forEach(b => b.classList.remove('active'));
  this.classList.add('active');
  targetPhi = 0.12;
};

document.getElementById('btn-front').onclick = function() {
  document.querySelectorAll('.btn-group .view-btn').forEach(b => b.classList.remove('active'));
  this.classList.add('active');
  targetTheta = 0;
  targetPhi = Math.PI * 0.4;
};

document.getElementById('btn-auto-rotate').onclick = function() {
  autoRotate = !autoRotate;
  this.classList.toggle('active', autoRotate);
};

document.getElementById('btn-reset').onclick = () => {
  targetTheta = Math.PI * 0.25;
  targetPhi = Math.PI * 0.32;
  targetRadius = 9;
  camTarget.set(0, CFG.levels * 0.5, 0);
  document.querySelectorAll('.btn-group .view-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-perspective').classList.add('active');
};

// ============================================
// SEARCH AND FILTER HANDLERS
// ============================================
const searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    applyFilters();
  });
}

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', function() {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active', 'empty', 'filled', 'warning'));
    const filter = this.dataset.filter;
    currentFilter = filter;
    if (filter === 'empty') this.classList.add('empty');
    else if (filter === 'filled') this.classList.add('filled');
    else if (filter === 'warning') this.classList.add('warning');
    else this.classList.add('active');
    applyFilters();
  });
});

function applyFilters() {
  let visibleCount = 0, filteredCount = 0;
  hitMeshes.forEach(hit => {
    const d = hit.userData;
    const code = d.code.toLowerCase();
    const article = (d.article || '').toLowerCase();
    const articleId = (d.articleId || '').toLowerCase();
    const pct = d.pct || 0;
    const hasWarning = d.hasWarning || false;

    // Search filter
    const matchesSearch = !searchQuery ||
      code.includes(searchQuery) ||
      article.includes(searchQuery) ||
      articleId.includes(searchQuery);

    // Status filter
    let matchesFilter = true;
    if (currentFilter === 'empty') matchesFilter = pct === 0;
    else if (currentFilter === 'filled') matchesFilter = pct > 0;
    else if (currentFilter === 'warning') matchesFilter = hasWarning;

    // Apply visibility
    const isVisible = matchesSearch && matchesFilter;
    hit.visible = isVisible;
    visibleCount++;
    if (isVisible) filteredCount++;
  });

  // Update stats
  const filtered = hitMeshes.filter(h => h.visible);
  const free = filtered.filter(h => (h.userData.pct || 0) === 0).length;
  const filled = filtered.filter(h => (h.userData.pct || 0) > 0).length;
  document.getElementById('stat-free').textContent = free;
  document.getElementById('stat-filled').textContent = filled;
  document.getElementById('stat-utilization').textContent = filtered.length > 0 ? Math.round((filled / filtered.length) * 100) + '%' : '0%';
}

// ============================================
// EXPORT IMAGE
// ============================================
function exportImage() {
  renderer.render(scene, camera);
  const imageData = canvas.toDataURL('image/png');
  window.ReactNativeWebView?.postMessage(JSON.stringify({
    type: 'export',
    imageData: imageData
  }));
}

// ============================================
// ANIMATION
// ============================================
let animTime = 0;
function animate() {
  requestAnimationFrame(animate);
  animTime += 0.03;
  if (autoRotate) targetTheta += 0.004;

  // Pulse highlight glows
  shelfGroup?.traverse(obj => {
    if (obj.userData?.isHighlight && obj.material) {
      obj.material.opacity = 0.2 + Math.sin(animTime * 2) * 0.15;
      obj.scale.setScalar(1 + Math.sin(animTime * 2) * 0.1);
    }
  });

  updateCamera();
  positionLabels();
  renderer.render(scene, camera);
}

onResize();
buildScene();
updateCamera();
animate();
<\/script>
</body>
</html>`;
}

// ============================================================
// REACT KOMPONENTE
// ============================================================

export default function WarehouseVisualizer3D({
  config,
  data,
  onSpotSelect,
  onMultiSelect,
  onExport,
  selectedSpot,
  theme = 'auto',
  showLabels = true,
  enableAnimation = true,
  compactMode = false,
  showSearch = false,
  showFilters = false,
  highlightArticleId = null,
  multiSelectMode = false,
}: Shelf3DProps) {
  const { isDark, colors } = useTheme();
  const resolvedTheme = theme === 'auto' ? (isDark ? 'dark' : 'light') : theme;
  const [localSelected, setLocalSelected] = useState<string | null>(selectedSpot ?? null);
  const [selectedSpots, setSelectedSpots] = useState<Set<string>>(new Set());
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (selectedSpot !== undefined) setLocalSelected(selectedSpot);
  }, [selectedSpot]);

  // Generate HTML with multi-select support
  const html = useMemo(() => {
    return generate3DHtml(config, data, {
      isDark: resolvedTheme === 'dark',
      showLabels,
      selectedSpot: localSelected,
      enableAnimation,
      compactMode,
      showSearch,
      showFilters,
      highlightArticleId,
      multiSelectMode,
      selectedSpots: Array.from(selectedSpots),
    });
  }, [config, data, resolvedTheme, showLabels, localSelected, enableAnimation, compactMode, showSearch, showFilters, highlightArticleId, multiSelectMode, selectedSpots]);

  // Handle messages from WebView
  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'select') {
        if (multiSelectMode) {
          setSelectedSpots(prev => {
            const newSet = new Set(prev);
            if (newSet.has(msg.code)) {
              newSet.delete(msg.code);
            } else {
              newSet.add(msg.code);
            }
            return newSet;
          });
        } else {
          setLocalSelected(msg.code);
          const spotData = data[msg.code];
          onSpotSelect?.(msg.block, msg.level, msg.spot, msg.code, spotData || { code: msg.code, fillPercent: msg.pct });
        }
      } else if (msg.type === 'export') {
        onExport?.(msg.imageData);
      }
    } catch {}
  }, [data, onSpotSelect, onExport, multiSelectMode]);

  // Export current view
  const handleExport = useCallback(() => {
    webViewRef.current?.injectJavaScript('exportImage();');
  }, []);

  // Confirm multi-select
  const handleConfirmMultiSelect = useCallback(() => {
    const spots = Array.from(selectedSpots).map(code => {
      const parts = code.split('-');
      const spotData = data[code];
      return {
        block: parseInt(parts[0]),
        level: parseInt(parts[1]),
        spot: parseInt(parts[2]),
        code,
        data: spotData || { code, fillPercent: 0 },
      };
    });
    onMultiSelect?.(spots);
    setSelectedSpots(new Set());
  }, [selectedSpots, data, onMultiSelect]);

  return (
    <View style={[styles.container, compactMode && styles.compact]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        originWhitelist={['*']}
        onMessage={handleMessage}
        allowsInlineMediaPlayback
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />

      {/* Multi-Select Bar */}
      {multiSelectMode && selectedSpots.size > 0 && (
        <View style={[styles.multiSelectBar, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <Text style={[styles.multiSelectText, { color: colors.text }]}>
            {selectedSpots.size} ausgewählt
          </Text>
          <TouchableOpacity
            style={[styles.multiSelectAction, { backgroundColor: '#8B5CF6' }]}
            onPress={handleConfirmMultiSelect}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.multiSelectActionText}>Bestätigen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Export Button */}
      {!compactMode && onExport && (
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: colors.card }]}
          onPress={handleExport}
        >
          <Ionicons name="camera" size={20} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 450 },
  compact: { minHeight: 280 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  multiSelectBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  multiSelectText: {
    fontSize: 14,
    fontWeight: '600',
  },
  multiSelectAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  multiSelectActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  exportBtn: {
    position: 'absolute',
    right: 12,
    bottom: 80,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});