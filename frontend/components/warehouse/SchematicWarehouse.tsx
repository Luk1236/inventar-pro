// frontend/components/warehouse/SchematicWarehouse.tsx
// Flat 2D schematic warehouse view — professional dashboard style.

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import Svg, { G, Rect, Text as T, Line, Defs, Pattern, Path } from 'react-native-svg';
import {
  getArticlesForLocation, getLocationsForZone, getLocationCapacity, getHeatmapColor,
  Article, StorageZone, StorageLocation,
} from '../../utils/warehouseUtils';

interface Props {
  zones: StorageZone[];
  locations: StorageLocation[];
  articles: Article[];
  selectedLocationId: string | null;
  onLocationSelect: (id: string) => void;
  rotations?: Record<string, number>;
  setRotations?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  /** Read-only: existing positions (from IsometricWarehouse drag).
   *  Used to preserve gx/gz when rotation is changed in 2D edit mode. */
  customPos?: Record<string, { gx: number; gz: number }>;
  searchMatches?: string[];
  collapsedZones?: Set<string>;
  onToggleZone?: (zoneId: string) => void;
  /** Optional persistence callback — same signature as IsometricWarehouse so
   *  parent can wire one handler for both 2D and 3D edit. */
  onLayoutChange?: (locId: string, layout: { gx: number; gz: number; rotation: number }) => void;
}

/* ─── Layout constants ──────────────────────────────── */
const SW      = 80;    // shelf width (wider to match 3D aspect ratio)
const SH      = 165;   // shelf body height
const LEVELS  = 3;     // match 3D: 3 levels
const LH      = SH / LEVELS;           // level height = 55
const SGAP    = 6;     // gap between shelves
const AISLE   = 44;    // aisle between sections
const SECT    = 3;     // shelves per section
const ZPX     = 28;    // zone horizontal padding
const ZPY     = 22;    // zone vertical padding
const ZTOP    = 60;    // zone title zone height
const REIHE_H = 34;    // "REIHE" label height above shelf
const ZGAP    = 58;    // vertical gap between zones
const ETAGE   = ['1', '2', '3'];       // match 3D level numbering
const ZCOLORS = ['#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#E53935'];
const BG      = '#0A1628';
const GRID    = '#FFFFFF09';
/* ───────────────────────────────────────────────────── */

function palletColor(ratio: number) {
  if (ratio <= 0)   return null;
  if (ratio < 0.7)  return { top: '#4CAF50', mid: '#388E3C', bot: '#8B6010' };
  if (ratio < 0.92) return { top: '#FF9800', mid: '#E65100', bot: '#7A4800' };
  return               { top: '#EF5350', mid: '#B71C1C', bot: '#7A1010' };
}

const ROT_LABELS = ['', '90°', '180°', '270°'];

function ShelfCol({ x, y, loc, arts, color, selected, rotation, highlighted, heatmapMode, onPress, onHoverIn, onHoverOut }: {
  x: number; y: number; loc: StorageLocation; arts: Article[];
  color: string; selected: boolean; rotation: number; highlighted?: boolean;
  heatmapMode?: boolean;
  onPress: () => void;
  onHoverIn?: (e: any) => void; onHoverOut?: () => void;
}) {
  // Rotated shelves (90°/270°) swap width ↔ depth → appear narrower in plan
  const isRotated = rotation % 2 === 1;
  const w = isRotated ? SW * 0.38 : SW;   // narrower when rotated 90°/270°
  const h = isRotated ? SH * 1.6  : SH;   // taller when rotated (depth becomes height)

  const borderColor = selected ? '#FFD700' : highlighted ? '#FFD70088' : color + '66';
  const bw = selected ? 2 : highlighted ? 1.5 : 1;

  const lh = h / LEVELS;   // dynamic level height based on actual shelf height

  // Overall fill ratio for this shelf
  const totalSlots = LEVELS * (isRotated ? 1 : 3);
  const filledSlots = Math.min(arts.length, totalSlots);
  const fillRatio = totalSlots > 0 ? filledSlots / totalSlots : 0;
  // Heatmap recolors the fill bar by stock-vs-minimum ratio (matches 3D iso view).
  // Default colors track shelf occupancy (>92% red = full).
  const fillColor = heatmapMode
    ? getHeatmapColor(arts)
    : fillRatio >= 0.92 ? '#EF5350' : fillRatio >= 0.7 ? '#FF9800' : '#4CAF50';

  return (
    <G onPress={onPress} onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
      {/* REIHE label */}
      <Rect x={x} y={y - REIHE_H} width={w} height={REIHE_H - 4} fill="#0D1F38" rx={3}
        stroke={borderColor} strokeWidth={bw} />
      <T x={x + w / 2} y={y - REIHE_H / 2 + 4} textAnchor="middle" fontSize={7.5}
        fontWeight="bold" fill={selected ? '#FFD700' : color}>
        {loc.name.length > 9 ? loc.name.slice(0, 9) : loc.name}
      </T>
      {rotation > 0 && (
        <T x={x + w - 3} y={y - REIHE_H + 9} textAnchor="end" fontSize={6}
          fill="#FF9500" fontWeight="bold">
          ↺{ROT_LABELS[rotation]}
        </T>
      )}
      {/* Füllstand-Balken im REIHE-Header */}
      <Rect x={x + 2} y={y - 7} width={w - 4} height={4} fill="#0A1020" rx={2} />
      <Rect x={x + 2} y={y - 7} width={Math.max(0, (w - 4) * fillRatio)} height={4}
        fill={fillColor} rx={2} opacity={0.9} />
      <T x={x + w - 4} y={y - 4} textAnchor="end" fontSize={5.5} fill={fillColor} opacity={0.85}>
        {Math.round(fillRatio * 100)}%
      </T>
      {/* Rotation indicator arrow on shelf body */}
      {isRotated && (
        <T x={x + w / 2} y={y + h / 2} textAnchor="middle" fontSize={isRotated ? 9 : 11}
          fill={color + '55'} fontWeight="bold">
          ↕
        </T>
      )}

      {/* Shelf body */}
      <Rect x={x} y={y} width={w} height={h} fill="#0A1828"
        stroke={borderColor} strokeWidth={bw} rx={2} />

      {/* Levels */}
      {Array.from({ length: LEVELS }).map((_, li) => {
        const ly = y + li * lh;
        const slots = isRotated ? 1 : 3;   // rotated shelf: 1 deep slot per level
        const levelArts = arts.slice(li * slots, li * slots + slots);
        const levelArtCount = Math.min(slots, levelArts.length);
        const ratio = levelArtCount / slots;
        const pc = palletColor(ratio);

        return (
          <G key={li}>
            {/* Level divider */}
            {li > 0 && <Line x1={x} y1={ly} x2={x + w} y2={ly}
              stroke={color + '30'} strokeWidth={0.8} />}

            {/* EBENE label on left strip */}
            <Rect x={x} y={ly} width={isRotated ? 12 : 20} height={lh} fill={color + '22'} />
            <T x={x + (isRotated ? 6 : 10)} y={ly + lh / 2 + 4} textAnchor="middle" fontSize={isRotated ? 6 : 8}
              fontWeight="bold" fill={color + 'CC'} rotation={-90}
              originX={x + (isRotated ? 6 : 10)} originY={ly + lh / 2}>
              {ETAGE[li]}
            </T>

            {/* palette slots */}
            {Array.from({ length: slots }).map((_, pi) => {
              const hasItem = pi < levelArtCount;
              const stripW = isRotated ? 12 : 24;
              const gap = 4;
              const bx = x + stripW + gap + pi * ((w - stripW - gap * 2) / slots);
              const bw2 = (w - stripW - gap * 2) / slots - 3;
              if (!hasItem) return (
                <Rect key={pi} x={bx} y={ly + 5} width={bw2} height={lh - 10}
                  fill="#101E30" rx={2} />
              );
              return (
                <G key={pi}>
                  <Rect x={bx} y={ly + 5} width={bw2} height={lh - 14}
                    fill={pc!.top} rx={2} opacity={0.9} />
                  <Rect x={bx} y={ly + lh - 11} width={bw2} height={5}
                    fill={pc!.bot} rx={1} />
                  <Line x1={bx + 1} y1={ly + 7} x2={bx + bw2 - 1} y2={ly + 7}
                    stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                </G>
              );
            })}
          </G>
        );
      })}

      {/* Article count badge */}
      {arts.length > 0 && (
        <>
          <Rect x={x + w - 18} y={y + h - 16} width={16} height={13}
            fill={color} rx={3} opacity={0.85} />
          <T x={x + w - 10} y={y + h - 6} textAnchor="middle" fontSize={7}
            fontWeight="bold" fill="white">{arts.length}</T>
        </>
      )}
    </G>
  );
}

function ZoneBlock({ zone, locs, arts, y, zi, selectedId, rotations, searchMatches, collapsed, heatmapMode, onToggle, onSelect, onHoverIn, onHoverOut }: {
  zone: StorageZone; locs: StorageLocation[]; arts: Article[];
  y: number; zi: number; selectedId: string | null;
  rotations: Record<string, number>;
  searchMatches: string[];
  collapsed: boolean;
  heatmapMode?: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onHoverIn: (e: any, loc: StorageLocation, locArts: Article[]) => void;
  onHoverOut: () => void;
}) {
  const color = ZCOLORS[zi % ZCOLORS.length];

  // Zone-level stats for the header label
  const locIds = new Set(locs.map(l => l.id));
  const usedArticles = arts.filter(a => a.storage_location_id != null && locIds.has(a.storage_location_id)).length;
  const maxSlots = locs.reduce((s, l) => s + getLocationCapacity(l), 0);
  const fillPct = maxSlots > 0 ? Math.round((usedArticles / maxSlots) * 100) : 0;
  const statsText = `${locs.length} Regale · ${fillPct}% belegt`;

  // Rotation-aware shelf dimensions
  const sw = (loc: StorageLocation) => (rotations[loc.id] ?? 0) % 2 === 1 ? SW * 0.38 : SW;
  const sh = (loc: StorageLocation) => (rotations[loc.id] ?? 0) % 2 === 1 ? SH * 1.6  : SH;

  // Split locations into sections of SECT
  const sections: StorageLocation[][] = [];
  for (let i = 0; i < locs.length; i += SECT) sections.push(locs.slice(i, i + SECT));
  if (sections.length === 0) sections.push([]);

  // Section names
  const SECT_NAMES = ['BEREICH NORD', 'BEREICH SÜD', 'KOMMISSIONIERUNG',
    'BEREICH OST', 'BEREICH WEST', 'SONDER'];

  // Compute zone width (accounting for rotation-aware shelf widths)
  let totalW = ZPX * 2;
  sections.forEach((s, si) => {
    const sectW = s.reduce((acc, loc, li) => acc + sw(loc) + (li < s.length - 1 ? SGAP : 0), 0);
    totalW += sectW;
    if (si < sections.length - 1) totalW += AISLE;
  });
  totalW = Math.max(totalW, 260);

  // Zone body height: accommodate tallest shelf in zone
  const maxShelfH = locs.length > 0 ? Math.max(...locs.map(l => sh(l))) : SH;
  const zoneBodyH = REIHE_H + maxShelfH + ZPY * 2;

  return (
    <G>
      {/* Zone title (above border) */}
      <T x={totalW / 2} y={y + ZTOP - 32} textAnchor="middle"
        fontSize={15} fontWeight="bold" fill={color} letterSpacing={1.5}>
        ZONE {String.fromCharCode(65 + zi)}: {zone.name.toUpperCase()}
      </T>
      <T x={totalW / 2} y={y + ZTOP - 14} textAnchor="middle"
        fontSize={9} fill={color} opacity={0.65}>
        {zone.type} · {locs.length} Lagerorte
      </T>
      <T x={totalW / 2} y={y + ZTOP - 2} textAnchor="middle"
        fontSize={8} fill={color + '99'}>
        {statsText}
      </T>

      {/* Collapse / Expand toggle button */}
      <Rect x={totalW - 30} y={y + ZTOP - 40} width={28} height={18}
        fill={color + '28'} stroke={color + '66'} strokeWidth={1} rx={4}
        onPress={onToggle} />
      <T x={totalW - 16} y={y + ZTOP - 27} textAnchor="middle"
        fontSize={11} fontWeight="bold" fill={color} onPress={onToggle}>
        {collapsed ? '▶' : '▼'}
      </T>

      {/* Zone border box */}
      <Rect x={0} y={y + ZTOP} width={totalW} height={collapsed ? 28 : zoneBodyH}
        fill={color + '12'} stroke={color} strokeWidth={1.5}
        strokeDasharray="8,5" rx={8} />

      {collapsed && (
        <T x={totalW / 2} y={y + ZTOP + 18} textAnchor="middle"
          fontSize={9} fill={color} opacity={0.5}>
          {locs.length} Lagerorte ausgeblendet
        </T>
      )}

      {/* Render sections + shelves */}
      {!collapsed && (() => {
        const els: React.ReactElement[] = [];
        let curX = ZPX;
        sections.forEach((sect, si) => {
          // Rotation-aware section width
          const sectW = sect.reduce((acc, loc, li) => acc + sw(loc) + (li < sect.length - 1 ? SGAP : 0), 0);
          // Section background highlight
          if (sect.length > 1) {
            els.push(
              <Rect key={`sh-${si}`}
                x={curX - 4} y={y + ZTOP + ZPY - 4}
                width={sectW + 8} height={REIHE_H + maxShelfH + 8}
                fill={color + '08'} rx={4} />
            );
          }
          // Section label
          els.push(
            <T key={`sl-${si}`}
              x={curX + sectW / 2}
              y={y + ZTOP + ZPY + REIHE_H + maxShelfH / 2 + 10}
              textAnchor="middle" fontSize={16} fontWeight="bold"
              fill="white" opacity={0.07}>
              {SECT_NAMES[si] || `BEREICH ${String.fromCharCode(65 + si)}`}
            </T>
          );
          // Shelves — advance x by actual shelf width per shelf
          let shelfX = curX;
          sect.forEach((loc) => {
            els.push(
              <ShelfCol key={loc.id}
                x={shelfX} y={y + ZTOP + ZPY + REIHE_H}
                loc={loc} arts={getArticlesForLocation(arts, loc.id)}
                color={color}
                selected={loc.id === selectedId}
                rotation={rotations[loc.id] ?? 0}
                heatmapMode={heatmapMode}
                onPress={() => onSelect(loc.id)}
                highlighted={searchMatches.includes(loc.id)}
                onHoverIn={(e) => onHoverIn(e, loc, getArticlesForLocation(arts, loc.id))}
                onHoverOut={onHoverOut}
              />
            );
            shelfX += sw(loc) + SGAP;
          });
          // Aisle marker
          if (si < sections.length - 1) {
            const ax = curX + sectW + 2;
            els.push(
              <Line key={`al-${si}`}
                x1={ax + AISLE / 2} y1={y + ZTOP + ZPY + REIHE_H + 10}
                x2={ax + AISLE / 2} y2={y + ZTOP + ZPY + REIHE_H + SH - 10}
                stroke={color + '25'} strokeWidth={1} strokeDasharray="4,4" />
            );
          }
          curX += sectW + AISLE;
        });
        return els;
      })()}
    </G>
  );
}

export default function SchematicWarehouse({ zones, locations, articles, selectedLocationId, onLocationSelect, rotations = {}, setRotations, customPos = {}, searchMatches = [], collapsedZones = new Set(), onToggleZone, onLayoutChange }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editSelectedId, setEditSelectedId] = useState<string | null>(null);
  const editSelectedIdRef = useRef<string | null>(null);
  editSelectedIdRef.current = editSelectedId;
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; loc: StorageLocation; arts: Article[] } | null>(null);

  // Arrow-key rotation in edit mode (web only). Same UX as IsometricWarehouse.
  useEffect(() => {
    if (!editMode || Platform.OS !== 'web' || !setRotations) return;
    const onKey = (e: KeyboardEvent) => {
      const id = editSelectedIdRef.current;
      if (!id) return;
      if (['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const delta = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? 3 : 1;
        setRotations(prev => {
          const newRot = ((prev[id] ?? 0) + delta) % 4;
          if (onLayoutChange) {
            // Preserve existing position; 2D edit only changes rotation.
            const cur = customPos[id] ?? { gx: 0, gz: 0 };
            onLayoutChange(id, { gx: cur.gx, gz: cur.gz, rotation: newRot });
          }
          return { ...prev, [id]: newRot };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, setRotations, onLayoutChange]);

  const handleHoverIn = useCallback((e: any, loc: StorageLocation, arts: Article[]) => {
    setTooltip({ x: e.clientX, y: e.clientY, loc, arts });
  }, []);
  const handleHoverOut = useCallback(() => setTooltip(null), []);

  const onMouseDown = useCallback((e: any) => {
    dragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = 'grabbing';
  }, []);
  const onMouseMove = useCallback((e: any) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setOffset(p => ({ x: p.x + dx, y: p.y + dy }));
  }, []);
  const onMouseUp = useCallback((e: any) => {
    dragging.current = false; e.currentTarget.style.cursor = 'grab';
  }, []);
  const onWheel = useCallback((e: any) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setScale(s => Math.min(4, Math.max(0.2, s * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  // Compute layout dimensions per zone (rotation-aware)
  const zoneData = useMemo(() => zones.map((zone, zi) => {
    const locs = getLocationsForZone(locations, zone.id);
    const locSW = (loc: StorageLocation) => (rotations[loc.id] ?? 0) % 2 === 1 ? SW * 0.38 : SW;
    const locSH = (loc: StorageLocation) => (rotations[loc.id] ?? 0) % 2 === 1 ? SH * 1.6  : SH;
    const maxH = locs.length > 0 ? Math.max(...locs.map(locSH)) : SH;
    const totalLocW = locs.reduce((acc, loc) => acc + locSW(loc) + SGAP, 0);
    const numSects = Math.ceil(Math.max(1, locs.length) / SECT);
    const w = ZPX * 2 + totalLocW - SGAP + (numSects - 1) * (AISLE - SGAP);
    const collapsed = collapsedZones.has(zone.id);
    const h = collapsed ? ZTOP + 28 : ZTOP + REIHE_H + maxH + ZPY * 2;
    return { zone, locs, w: Math.max(w, 280), h, zi };
  }), [zones, locations, rotations, collapsedZones]);

  // Stack zones vertically with gaps
  const zoneYs: number[] = [];
  let curY = 30;
  zoneData.forEach(zd => { zoneYs.push(curY); curY += zd.h + ZGAP; });

  const maxW = Math.max(600, ...zoneData.map(z => z.w)) + 80;
  const totalH = Math.max(400, curY + 20);

  // Grid
  const GRID_STEP = 40;
  const gridEls: React.ReactElement[] = [];
  for (let gx = 0; gx <= maxW; gx += GRID_STEP)
    gridEls.push(<Line key={`gx${gx}`} x1={gx} y1={0} x2={gx} y2={totalH} stroke={GRID} strokeWidth={0.6} />);
  for (let gy = 0; gy <= totalH; gy += GRID_STEP)
    gridEls.push(<Line key={`gy${gy}`} x1={0} y1={gy} x2={maxW} y2={gy} stroke={GRID} strokeWidth={0.6} />);

  const scene = (
    <Svg width={maxW} height={totalH}>
      {/* Background */}
      <Rect x={0} y={0} width={maxW} height={totalH} fill={BG} />
      {gridEls}

      <G x={40}>
        {zoneData.map((zd, i) => (
          <ZoneBlock
            key={zd.zone.id}
            zone={zd.zone} locs={zd.locs} arts={articles}
            y={zoneYs[i]} zi={zd.zi}
            selectedId={editMode ? editSelectedId : selectedLocationId}
            rotations={rotations}
            searchMatches={searchMatches}
            collapsed={collapsedZones.has(zd.zone.id)}
            heatmapMode={heatmapMode}
            onToggle={() => onToggleZone?.(zd.zone.id)}
            onSelect={editMode ? setEditSelectedId : onLocationSelect}
            onHoverIn={handleHoverIn}
            onHoverOut={handleHoverOut}
          />
        ))}
      </G>
    </Svg>
  );

  if (Platform.OS === 'web') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 440, overflow: 'hidden', backgroundColor: BG, cursor: 'grab', userSelect: 'none' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
      >
        <div style={{ transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`, transformOrigin: 'center center', display: 'inline-block' }}>
          {scene}
        </div>

        {/* Edit-Mode Toggle (top-left, only when persistence is wired) */}
        {setRotations && (
          <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
            <button
              onClick={() => { setEditMode(v => !v); if (editMode) setEditSelectedId(null); }}
              title={editMode ? 'Bearbeitung verlassen' : 'Layout bearbeiten — Regal anklicken, dann Pfeiltasten ←→↑↓ zum 90°-Drehen'}
              style={{
                padding: '9px 16px', borderRadius: 12,
                border: `1px solid ${editMode ? '#FF9500' : 'rgba(255,255,255,0.2)'}`,
                background: editMode ? 'rgba(255,149,0,0.28)' : 'rgba(255,255,255,0.10)',
                backdropFilter: 'blur(12px)', color: editMode ? '#FF9500' : 'white',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
              <span style={{ fontSize: 15 }}>{editMode ? '✓' : '✏'}</span>
              {editMode ? 'Bearbeiten aktiv' : 'Layout bearbeiten'}
            </button>
            {!editMode && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', padding: '0 4px', maxWidth: 200, lineHeight: 1.4 }}>
                Klick + ← → = Regal drehen
              </div>
            )}
            {editMode && editSelectedId && (
              <div style={{
                background: 'rgba(5,12,28,0.9)', borderRadius: 10, padding: '8px 12px',
                border: '1px solid rgba(255,149,0,0.25)', color: '#FFD700',
                fontSize: 11, fontWeight: 700,
              }}>
                ▶ {locations.find(l => l.id === editSelectedId)?.name ?? editSelectedId}
                <div style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 400, marginTop: 4 }}>
                  ← → ↑ ↓ = 90° drehen
                </div>
              </div>
            )}
          </div>
        )}

        {/* Zoom controls + Heatmap toggle */}
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setHeatmapMode(v => !v)}
            title={heatmapMode
              ? 'Heatmap aus — Standard-Füllstand-Farben'
              : 'Heatmap an — Regale nach Stock-vs-Mindestbestand einfärben'}
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: heatmapMode ? 'rgba(255,200,0,0.28)' : 'rgba(255,255,255,0.10)',
              border: `1px solid ${heatmapMode ? 'rgba(255,200,0,0.7)' : 'rgba(255,255,255,0.2)'}`,
              backdropFilter: 'blur(8px)',
              color: heatmapMode ? '#FFC800' : 'white',
              fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: heatmapMode ? '0 0 10px rgba(255,200,0,0.3)' : '0 2px 10px rgba(0,0,0,0.4)',
            }}>
            🌡
          </button>
          {[['＋', () => setScale(s => Math.min(4, s * 1.25))], ['－', () => setScale(s => Math.max(0.2, s * 0.8))], ['○', () => { setScale(1); setOffset({ x: 0, y: 0 }); }]].map(([label, fn]: any) => (
            <button key={label} onClick={fn} style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: label === '○' ? 18 : 22, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
              {label}
            </button>
          ))}
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center' }}>{Math.round(scale * 100)}%</div>
        </div>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 14, left: 14, background: 'rgba(8,16,32,0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 16px', minWidth: 190 }}>
          <div style={{ color: '#B0C4DE', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10, textTransform: 'uppercase' }}>Legende</div>
          {[['#4CAF50', 'Verfügbar (< 70%)'], ['#FF9800', 'Auslastung (70–92%)'], ['#EF5350', 'Kritisch (> 92%)'], ['#0A1828', 'Leer']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: c, border: '1px solid rgba(255,255,255,0.2)', boxShadow: c !== '#0A1828' ? `0 0 5px ${c}88` : 'none' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{l}</span>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div style={{ position: 'absolute', bottom: 14, right: 16, color: 'rgba(255,255,255,0.28)', fontSize: 10, pointerEvents: 'none', textAlign: 'right' }}>
          Ziehen = Verschieben<br />Ctrl+Scroll = Zoomen
        </div>

        {/* Hover Tooltip */}
        {tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10,
            background: 'rgba(5,12,28,0.97)', border: '1px solid rgba(100,160,255,0.3)',
            borderRadius: 10, padding: '10px 14px', maxWidth: 220,
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)', pointerEvents: 'none', zIndex: 9999,
          }}>
            <div style={{ color: '#64B5F6', fontWeight: 700, fontSize: 12, marginBottom: 5 }}>
              {tooltip.loc.name}
            </div>
            {tooltip.arts.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Keine Artikel</div>
            ) : (
              tooltip.arts.slice(0, 8).map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{a.name}</span>
                  <span style={{ color: a.current_stock < a.min_stock_level ? '#EF5350' : a.current_stock <= a.min_stock_level * 1.3 ? '#FF9800' : '#4CAF50', fontSize: 11, fontWeight: 700 }}>
                    {a.current_stock}
                  </span>
                </div>
              ))
            )}
            {tooltip.arts.length > 8 && (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 4 }}>
                +{tooltip.arts.length - 8} weitere
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const { ScrollView } = require('react-native');
  return <ScrollView horizontal style={{ flex: 1, backgroundColor: BG }}><ScrollView>{scene}</ScrollView></ScrollView>;
}
