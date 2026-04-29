// frontend/components/warehouse/IsometricWarehouse.tsx
// Bearbeitungsmodus:
//   - Regal anklicken → auswählen (orange Rahmen)
//   - Pfeiltasten ← → (oder ↑ ↓) → 90°-Drehung
//   - Regal ziehen → verschieben
//   - Zonen-Rahmen passt sich an tatsächliche Positionen an

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import Svg, { G, Polygon, Rect, Text as SvgText, Defs, LinearGradient, Stop, Filter, FeGaussianBlur, FeFlood, FeComposite, FeMerge, FeMergeNode, Line as SvgLine } from 'react-native-svg';
import {
  isoProject, getArticlesForLocation,
  getLocationsForZone, sortByDepth, getLocationCapacity,
  Article, StorageZone, StorageLocation, TILE_SIZE,
} from '../../utils/warehouseUtils';
import IsometricShelf, { SHELF_W, SHELF_D, SHELF_H, shelfEffDims } from './IsometricShelf';

// ── Layout-Konstanten ────────────────────────────────────────────────────────
const COLS    = 3;
const PITCH_X = SHELF_W + 0.5;
const PITCH_Z = SHELF_D + 0.8;
const ZONE_W  = COLS * PITCH_X + 2.5;

const cos30 = Math.cos(Math.PI / 6);
const sin30 = Math.sin(Math.PI / 6);
function svgDeltaToGrid(dx: number, dy: number) {
  return {
    dgx: (dx / (cos30 * TILE_SIZE) + dy / (sin30 * TILE_SIZE)) / 2,
    dgz: (dy / (sin30 * TILE_SIZE) - dx / (cos30 * TILE_SIZE)) / 2,
  };
}

interface Props {
  zones: StorageZone[];
  locations: StorageLocation[];
  articles: Article[];
  selectedLocationId: string | null;
  onLocationSelect: (id: string) => void;
  customPos: Record<string, { gx: number; gz: number }>;
  setCustomPos: React.Dispatch<React.SetStateAction<Record<string, { gx: number; gz: number }>>>;
  rotations: Record<string, number>;
  setRotations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  searchMatches?: string[];
  collapsedZones?: Set<string>;
  onToggleZone?: (zoneId: string) => void;
}

const ZONE_PALETTE = [
  { fill: 'rgba(30,136,229,0.15)', stroke: '#1E88E5', text: '#64B5F6' },
  { fill: 'rgba(67,160,71,0.15)',  stroke: '#43A047', text: '#81C784' },
  { fill: 'rgba(251,140,0,0.15)',  stroke: '#FB8C00', text: '#FFB74D' },
  { fill: 'rgba(142,36,170,0.15)', stroke: '#8E24AA', text: '#CE93D8' },
  { fill: 'rgba(229,57,53,0.15)',  stroke: '#E53935', text: '#EF9A9A' },
];

export default function IsometricWarehouse({ zones, locations, articles, selectedLocationId, onLocationSelect, customPos, setCustomPos, rotations, setRotations, searchMatches = [], collapsedZones = new Set(), onToggleZone }: Props) {
  // ── Ansicht ────────────────────────────────────────────────────────────────
  const [scale, setScale]         = useState(1);
  const [offset, setOffset]       = useState({ x: 0, y: 0 });
  const [smoothTransition, setSmoothTransition] = useState(false);
  const isPanning                 = useRef(false);
  const lastMouse                 = useRef({ x: 0, y: 0 });
  const containerRef              = useRef<any>(null);

  // ── Hover-Tooltip ──────────────────────────────────────────────────────────
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Heatmap & Filter ───────────────────────────────────────────────────────
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'critical' | 'low'>('all');

  // ── Bearbeitungs-State ─────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editSelectedId, setEditSelectedId] = useState<string | null>(null);
  const [shelfPreview, setShelfPreview]   = useState<{ id: string; gx: number; gz: number } | null>(null);

  const draggingIdRef         = useRef<string | null>(null);
  const shelfGridStartRef     = useRef<{ gx: number; gz: number } | null>(null);
  const shelfMouseStartRef    = useRef<{ x: number; y: number } | null>(null);
  const shelfPreviewRef       = useRef<{ id: string; gx: number; gz: number } | null>(null);
  const editSelectedIdRef     = useRef<string | null>(null);
  const locationsWithPosRef   = useRef<typeof locationsWithPos>([]);
  const rotationsRef          = useRef<Record<string, number>>({});
  editSelectedIdRef.current   = editSelectedId;

  // ── Tastatursteuerung ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!editMode || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const id = editSelectedIdRef.current;
      if (!id) return;
      if (['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const delta = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? 3 : 1;
        setRotations(prev => ({ ...prev, [id]: ((prev[id] ?? 0) + delta) % 4 }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode]);

  // ── Positionen ─────────────────────────────────────────────────────────────
  const locationsWithPos = useMemo(() => locations.map(loc => {
    const zi = Math.max(0, zones.findIndex(z => z.id === loc.zone_id));
    const zoneLocs = getLocationsForZone(locations, loc.zone_id);
    const li = zoneLocs.findIndex(l => l.id === loc.id);
    const col = li % COLS;
    const row = Math.floor(li / COLS);
    const baseGx = zi * ZONE_W + col * PITCH_X;
    const baseGz = row * PITCH_Z;
    const custom = customPos[loc.id];
    const gx = custom?.gx ?? baseGx;
    const gz = custom?.gz ?? baseGz;
    const rotation = rotations[loc.id] ?? 0;
    const { effW, effD } = shelfEffDims(rotation);
    return { loc, gx, gz, zoneIndex: zi, rotation, effW, effD };
  }), [zones, locations, customPos, rotations]);

  locationsWithPosRef.current = locationsWithPos;
  rotationsRef.current = rotations;

  const sortedLocations = useMemo(() => sortByDepth([...locationsWithPos]), [locationsWithPos]);

  const dragCollision = useMemo(() => {
    if (!shelfPreview) return false;
    const { id, gx, gz } = shelfPreview;
    const dragRot = rotations[id] ?? 0;
    const { effW, effD } = shelfEffDims(dragRot);
    const eps = 0.05;
    return locationsWithPos.some(l => {
      if (l.loc.id === id) return false;
      return gx < l.gx + l.effW - eps && gx + effW > l.gx + eps &&
             gz < l.gz + l.effD - eps && gz + effD > l.gz + eps;
    });
  }, [shelfPreview, locationsWithPos, rotations]);

  const maxGx = locationsWithPos.reduce((m, l) => Math.max(m, l.gx + l.effW), 0) + 8;
  const maxGz = locationsWithPos.reduce((m, l) => Math.max(m, l.gz + l.effD), 0) + 6;
  const svgW = Math.max(800, (maxGx + maxGz) * TILE_SIZE * 1.2 + 300);
  const svgH = Math.max(550, (maxGx + maxGz) * TILE_SIZE * 0.65 + 380);
  const originX = svgW / 2, originY = 320;

  // ── Heatmap-Farbe pro Location ─────────────────────────────────────────────
  function heatColor(locId: string): string {
    const arts = getArticlesForLocation(articles, locId);
    if (arts.length === 0) return '#607D8B';
    const avgRatio = arts.reduce((s, a) => s + (a.current_stock / Math.max(a.min_stock_level ?? 1, 1)), 0) / arts.length;
    if (avgRatio < 1)  return '#EF5350'; // Kritisch → Rot
    if (avgRatio < 2)  return '#FF9800'; // Knapp → Orange
    if (avgRatio < 4)  return '#4CAF50'; // OK → Grün
    return '#26C6DA';                    // Überfüllt → Cyan (Slow Mover)
  }

  // ── Filter: welche Regale sollen ghost-mäßig ausgeblendet werden ───────────
  function isGhosted(locId: string): boolean {
    if (filterMode === 'all') return false;
    const arts = getArticlesForLocation(articles, locId);
    const crit = arts.some(a => a.current_stock < (a.min_stock_level ?? 1));
    const low  = arts.some(a => a.current_stock < (a.min_stock_level ?? 1) * 1.3);
    if (filterMode === 'critical') return !crit;
    if (filterMode === 'low') return !low;
    return false;
  }

  // ── Camera Fly-To bei Suchtreffer ─────────────────────────────────────────
  useEffect(() => {
    if (searchMatches.length === 0 || Platform.OS !== 'web') return;
    const firstId = searchMatches[0];
    const hit = locationsWithPosRef.current.find(l => l.loc.id === firstId);
    if (!hit) return;
    const iso = isoProject(hit.gx + hit.effW / 2, SHELF_H, hit.gz + hit.effD / 2);
    const targetX = originX + iso.sx;
    const targetY = originY + iso.sy;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cW = rect.width, cH = rect.height;
    const newScale = 1.8;
    setSmoothTransition(true);
    setScale(newScale);
    setOffset({
      x: cW / 2 - (targetX - svgW / 2) * newScale - svgW / 2,
      y: cH / 2 - (targetY - svgH / 2) * newScale - svgH / 2,
    });
  }, [searchMatches]);

  // ── Grid ───────────────────────────────────────────────────────────────────
  const GRID = Math.max(maxGx, maxGz) + 3;
  const gridLines: React.ReactElement[] = [];
  for (let i = 0; i <= GRID; i++) {
    const major = i % 5 === 0;
    const isAxis = i === 0;
    const a = isoProject(i,0,0), b = isoProject(i,0,GRID);
    const c = isoProject(0,0,i), d = isoProject(GRID,0,i);
    gridLines.push(
      <Polygon key={`gx${i}`} points={`${a.sx},${a.sy} ${b.sx},${b.sy}`} fill="none"
        stroke={isAxis ? '#4FC3F7' : major ? '#FFFFFF38' : '#FFFFFF14'}
        strokeWidth={isAxis ? 2 : major ? 1.2 : 0.6}/>,
      <Polygon key={`gz${i}`} points={`${c.sx},${c.sy} ${d.sx},${d.sy}`} fill="none"
        stroke={isAxis ? '#4FC3F7' : major ? '#FFFFFF38' : '#FFFFFF14'}
        strokeWidth={isAxis ? 2 : major ? 1.2 : 0.6}/>,
    );
  }

  // ── Maus-Handler ──────────────────────────────────────────────────────────
  const setCursor = useCallback((c: string) => {
    if (containerRef.current) containerRef.current.style.cursor = c;
  }, []);

  const onMouseDown = useCallback((e: any) => {
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setSmoothTransition(false);
    setCursor('grabbing');
  }, [setCursor]);

  const onMouseMove = useCallback((e: any) => {
    // Tooltip-Position verfolgen
    setTooltipPos({ x: e.clientX, y: e.clientY });

    if (draggingIdRef.current && shelfGridStartRef.current && shelfMouseStartRef.current) {
      const svgDx = (e.clientX - shelfMouseStartRef.current.x) / scale;
      const svgDy = (e.clientY - shelfMouseStartRef.current.y) / scale;
      const { dgx, dgz } = svgDeltaToGrid(svgDx, svgDy);
      let snapGx = Math.max(0, Math.round((shelfGridStartRef.current.gx + dgx) * 2) / 2);
      let snapGz = Math.max(0, Math.round((shelfGridStartRef.current.gz + dgz) * 2) / 2);

      const dragId = draggingIdRef.current!;
      const dragRot = rotationsRef.current[dragId] ?? 0;
      const { effW: dW, effD: dD } = shelfEffDims(dragRot);
      const AISLE_SNAP = 0.6;
      const AISLE_GAP  = 0.5;
      locationsWithPosRef.current.forEach(l => {
        if (l.loc.id === dragId) return;
        if (Math.abs(snapGx - (l.gx + l.effW + AISLE_GAP)) < AISLE_SNAP)
          snapGx = l.gx + l.effW + AISLE_GAP;
        if (Math.abs(snapGx + dW - (l.gx - AISLE_GAP)) < AISLE_SNAP)
          snapGx = l.gx - dW - AISLE_GAP;
        if (Math.abs(snapGz - (l.gz + l.effD + AISLE_GAP)) < AISLE_SNAP)
          snapGz = l.gz + l.effD + AISLE_GAP;
        if (Math.abs(snapGz + dD - (l.gz - AISLE_GAP)) < AISLE_SNAP)
          snapGz = l.gz - dD - AISLE_GAP;
      });
      snapGx = Math.max(0, snapGx);
      snapGz = Math.max(0, snapGz);
      const preview = { id: draggingIdRef.current, gx: snapGx, gz: snapGz };
      shelfPreviewRef.current = preview;
      setShelfPreview(preview);
      return;
    }
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setOffset(p => ({ x: p.x + dx, y: p.y + dy }));
  }, [scale]);

  const onMouseUp = useCallback((e: any) => {
    if (draggingIdRef.current) {
      const id = draggingIdRef.current;
      const ms = shelfMouseStartRef.current;
      const dx = ms ? e.clientX - ms.x : 0;
      const dy = ms ? e.clientY - ms.y : 0;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        setEditSelectedId(prev => prev === id ? null : id);
      } else if (shelfPreviewRef.current) {
        const { gx, gz } = shelfPreviewRef.current;
        const dragRot = rotationsRef.current[id] ?? 0;
        const { effW, effD } = shelfEffDims(dragRot);
        const eps = 0.05;
        const hasCollision = locationsWithPosRef.current.some(l => {
          if (l.loc.id === id) return false;
          return gx < l.gx + l.effW - eps && gx + effW > l.gx + eps &&
                 gz < l.gz + l.effD - eps && gz + effD > l.gz + eps;
        });
        if (!hasCollision) setCustomPos(prev => ({ ...prev, [id]: { gx, gz } }));
      }

      draggingIdRef.current = null;
      shelfGridStartRef.current = null;
      shelfMouseStartRef.current = null;
      shelfPreviewRef.current = null;
      setShelfPreview(null);
      setCursor(editMode ? 'default' : 'grab');
      return;
    }
    isPanning.current = false;
    setCursor(editMode ? 'default' : 'grab');
  }, [editMode, setCursor]);

  const onMouseLeave = useCallback(() => {
    setHoveredId(null);
    isPanning.current = false;
    if (draggingIdRef.current) {
      draggingIdRef.current = null;
      shelfGridStartRef.current = null;
      shelfMouseStartRef.current = null;
      shelfPreviewRef.current = null;
      setShelfPreview(null);
    }
    setCursor(editMode ? 'default' : 'grab');
  }, [editMode, setCursor]);

  const onWheel = useCallback((e: any) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setSmoothTransition(false);
    setScale(s => Math.min(4, Math.max(0.2, s * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  const handleShelfMouseDown = useCallback((e: any, id: string, gx: number, gz: number) => {
    e.stopPropagation();
    draggingIdRef.current = id;
    shelfGridStartRef.current = { gx, gz };
    shelfMouseStartRef.current = { x: e.clientX, y: e.clientY };
    setCursor('grabbing');
  }, [setCursor]);

  const toggleEditMode = useCallback(() => {
    setEditMode(v => {
      if (v) setEditSelectedId(null);
      setCursor(!v ? 'default' : 'grab');
      return !v;
    });
  }, [setCursor]);

  // ── Zonen-BoundingBox ──────────────────────────────────────────────────────
  // Wenn grid_width/grid_depth gesetzt: explizite Maße (angeheftet an Zone-Ursprung).
  // Sonst: Auto-Berechnung aus Regal-Positionen.
  function getZoneBounds(zoneId: string, zoneIndex: number, gridWidth?: number, gridDepth?: number) {
    const pad = 0.5;
    if (gridWidth && gridDepth) {
      const originGx = zoneIndex * ZONE_W;
      return {
        x0: originGx - pad,
        x1: originGx + gridWidth - pad,
        z0: -pad,
        z1: gridDepth - pad,
      };
    }
    const shelves = locationsWithPos.filter(l => l.loc.zone_id === zoneId);
    if (shelves.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    shelves.forEach(s => {
      const isDrag = shelfPreview?.id === s.loc.id;
      const gx = isDrag ? shelfPreview!.gx : s.gx;
      const gz = isDrag ? shelfPreview!.gz : s.gz;
      minX = Math.min(minX, gx);         maxX = Math.max(maxX, gx + s.effW);
      minZ = Math.min(minZ, gz);         maxZ = Math.max(maxZ, gz + s.effD);
    });
    return { x0: minX - pad, x1: maxX + pad, z0: minZ - pad, z1: maxZ + pad };
  }

  // ── Scene ──────────────────────────────────────────────────────────────────
  const scene = (
    <Svg width={svgW} height={svgH}>
      <Defs>
        <LinearGradient id="bg3d" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor="#0F1B2D" /><Stop offset="1" stopColor="#1A2744" />
        </LinearGradient>
        <Filter id="glow-sel" x="-30%" y="-30%" width="160%" height="160%">
          <FeGaussianBlur stdDeviation="3" result="blur" />
          <FeFlood floodColor="#FFD700" floodOpacity="0.55" result="color" />
          <FeComposite in="color" in2="blur" operator="in" result="glow" />
          <FeMerge>
            <FeMergeNode in="glow" />
            <FeMergeNode in="SourceGraphic" />
          </FeMerge>
        </Filter>
      </Defs>
      <Rect x={0} y={0} width={svgW} height={svgH} fill="url(#bg3d)" />
      <G x={originX} y={originY}>
        {gridLines}

        {/* Zonen-Bodenfliesen */}
        {locationsWithPos.filter(s => !collapsedZones.has(s.loc.zone_id)).map(({ loc, gx: baseGx, gz: baseGz, zoneIndex, effW: baseEffW, effD: baseEffD }) => {
          const isDrag = shelfPreview?.id === loc.id;
          const gx = isDrag ? shelfPreview!.gx : baseGx;
          const gz = isDrag ? shelfPreview!.gz : baseGz;
          const rot = rotations[loc.id] ?? 0;
          const { effW, effD } = shelfEffDims(rot);
          const pal = ZONE_PALETTE[zoneIndex % ZONE_PALETTE.length];
          const collision = isDrag && dragCollision;
          const isSearchHit = searchMatches.length > 0 && searchMatches.includes(loc.id);
          const tileFill  = collision ? 'rgba(239,83,80,0.25)' : isSearchHit ? 'rgba(255,215,0,0.18)' : pal.stroke + '22';
          const tileStroke = collision ? '#EF5350' : isSearchHit ? '#FFD700' : pal.stroke + '55';
          const tileStrokeW = collision ? 2 : isSearchHit ? 1.5 : 0.8;
          const tl = isoProject(gx, 0, gz);
          const tr = isoProject(gx + effW, 0, gz);
          const br = isoProject(gx + effW, 0, gz + effD);
          const bl = isoProject(gx, 0, gz + effD);
          return (
            <Polygon key={`ft-${loc.id}`}
              points={`${tl.sx},${tl.sy} ${tr.sx},${tr.sy} ${br.sx},${br.sy} ${bl.sx},${bl.sy}`}
              fill={tileFill} stroke={tileStroke} strokeWidth={tileStrokeW}
            />
          );
        })}

        {/* Zonen-Rahmen */}
        {zones.map((zone, zi) => {
          const bounds = getZoneBounds(zone.id, zi, zone.grid_width, zone.grid_depth);
          if (!bounds) return null;
          const { x0, x1, z0, z1 } = bounds;
          const tl = isoProject(x0,0,z0), tr = isoProject(x1,0,z0);
          const br = isoProject(x1,0,z1), bl = isoProject(x0,0,z1);
          const pal = ZONE_PALETTE[zi % ZONE_PALETTE.length];
          const cx = (x0 + x1) / 2;
          const lp   = isoProject(cx, 0, z0 - 1.2);
          const lp2  = isoProject(cx, 0, z0 - 0.68);
          const leaderAnchor = isoProject(cx, 0, z0 - 0.1);
          const zoneLocs = getLocationsForZone(locations, zone.id);
          const isCollapsed = collapsedZones.has(zone.id);
          const zoneArtCount = articles.filter(a =>
            zoneLocs.some(l => l.id === a.storage_location_id)
          ).length;
          const zoneMaxSlots = zoneLocs.reduce((s, l) => s + getLocationCapacity(l), 0);
          const zoneFillPct = zoneMaxSlots > 0 ? Math.round((zoneArtCount / zoneMaxSlots) * 100) : 0;
          const lblW = 180, lblH = 22;
          // Maße-String: wenn grid_width/grid_depth gesetzt, echte Meter anzeigen
          const dimStr = (zone.grid_width && zone.grid_depth)
            ? ` · ${(zone.grid_width * 1.5).toFixed(0)}×${(zone.grid_depth * 1.5).toFixed(0)} m`
            : '';
          return (
            <G key={zone.id}>
              <Polygon points={`${tl.sx},${tl.sy} ${tr.sx},${tr.sy} ${br.sx},${br.sy} ${bl.sx},${bl.sy}`}
                fill={isCollapsed ? pal.stroke + '08' : pal.fill}
                stroke={pal.stroke} strokeWidth={1.5} strokeDasharray="6,4" />
              {/* Leader Line: Zone-Rand → Label */}
              <Polygon
                points={`${leaderAnchor.sx},${leaderAnchor.sy} ${lp.sx},${lp.sy + 12}`}
                fill="none" stroke={pal.stroke + '66'} strokeWidth={1} strokeDasharray="3,3"
              />
              {/* Label-Hintergrund */}
              <Rect x={lp.sx - lblW/2} y={lp.sy - 15} width={lblW} height={lblH}
                fill="rgba(5,12,28,0.78)" rx={6} stroke={pal.stroke + '55'} strokeWidth={1} />
              <SvgText x={lp.sx} y={lp.sy} textAnchor="middle" fontSize={14} fontWeight="bold" fill={pal.text} letterSpacing={1.8}
                onPress={() => onToggleZone?.(zone.id)}>
                {isCollapsed ? '▶ ' : '▼ '}ZONE {String.fromCharCode(65+zi)}: {zone.name.toUpperCase()}
              </SvgText>
              <SvgText x={lp2.sx} y={lp2.sy} textAnchor="middle" fontSize={10} fill={pal.text} opacity={0.8}>
                {zone.type} · {zoneLocs.length} Lagerorte{dimStr}{isCollapsed ? ' (ausgeblendet)' : ''}
              </SvgText>
              <SvgText x={lp2.sx} y={lp2.sy + 13} textAnchor="middle" fontSize={8} fill={pal.text} opacity={0.6}>
                {`${zoneLocs.length} Regale · ${zoneFillPct}% belegt`}
              </SvgText>
            </G>
          );
        })}

        {/* Regale */}
        {sortedLocations.filter(s => !collapsedZones.has(s.loc.zone_id)).map(({ loc, gx: baseGx, gz: baseGz, rotation }) => {
          const isDragging = shelfPreview?.id === loc.id;
          const gx = isDragging ? shelfPreview!.gx : baseGx;
          const gz = isDragging ? shelfPreview!.gz : baseGz;
          const isEditSel = editMode && editSelectedId === loc.id;
          const isSearchHit = searchMatches.length > 0 && searchMatches.includes(loc.id);
          const isSelected = editMode ? isEditSel : (loc.id === selectedLocationId || isSearchHit);
          const ghosted = !editMode && isGhosted(loc.id);
          return (
            <G key={loc.id} filter={isSelected ? 'url(#glow-sel)' : undefined}>
              <IsometricShelf
                location={loc}
                articles={getArticlesForLocation(articles, loc.id)}
                gx={gx} gz={gz}
                isSelected={isSelected}
                rotation={rotation}
                isDragging={isDragging}
                ghosted={ghosted}
                heatmapMode={heatmapMode}
                heatmapColor={heatmapMode ? heatColor(loc.id) : undefined}
                onPress={() => !editMode && onLocationSelect(loc.id)}
                onShelfMouseDown={editMode ? (e:any) => handleShelfMouseDown(e, loc.id, baseGx, baseGz) : undefined}
                onHoverIn={!editMode ? (e: any) => { setHoveredId(loc.id); setTooltipPos({ x: e.clientX, y: e.clientY }); } : undefined}
                onHoverOut={!editMode ? () => setHoveredId(null) : undefined}
              />
            </G>
          );
        })}
      </G>
    </Svg>
  );

  if (Platform.OS === 'web') {
    // Tooltip-Daten
    const tooltipLoc = hoveredId ? locations.find(l => l.id === hoveredId) : null;
    const tooltipArts = hoveredId ? getArticlesForLocation(articles, hoveredId) : [];

    return (
      <div
        ref={containerRef}
        style={{ position:'relative', width:'100%', height:'100%', minHeight:480, overflow:'hidden', backgroundColor:'#0F1B2D', cursor: editMode ? 'default' : 'grab', userSelect:'none' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onWheel={onWheel}
      >
        <div style={{ transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`, transformOrigin:'center center', display:'inline-block', transition: smoothTransition ? 'transform 0.35s cubic-bezier(0.25,0.1,0.25,1)' : 'none' }}>
          {scene}
        </div>

        <ZoomControls scale={scale} setScale={setScale} setOffset={setOffset} setSmoothTransition={setSmoothTransition} />
        <CameraPresets zones={zones} locationsWithPos={locationsWithPos} svgW={svgW} svgH={svgH} originX={originX} originY={originY} containerRef={containerRef} setScale={setScale} setOffset={setOffset} setSmoothTransition={setSmoothTransition} />
        <Legend3D />

        {/* Bearbeitungs-Panel */}
        <div style={{ position:'absolute', top:14, left:14, display:'flex', flexDirection:'column', gap:8 }}>
          <button onClick={toggleEditMode}
            title={editMode ? 'Bearbeitung verlassen' : 'Layout bearbeiten — Regale per Drag verschieben, Pfeiltasten ←→↑↓ zum 90°-Drehen'}
            style={{
            padding:'9px 16px', borderRadius:12,
            border:`1px solid ${editMode ? '#FF9500' : 'rgba(255,255,255,0.2)'}`,
            background: editMode ? 'rgba(255,149,0,0.28)' : 'rgba(255,255,255,0.10)',
            backdropFilter:'blur(12px)', color: editMode ? '#FF9500' : 'white',
            fontSize:13, fontWeight:700, cursor:'pointer',
            boxShadow: editMode ? '0 0 14px rgba(255,149,0,0.25)' : '0 2px 10px rgba(0,0,0,0.35)',
            transition:'all 0.2s ease',
            display:'flex', alignItems:'center', gap:7,
          }}>
            <span style={{fontSize:15}}>{editMode ? '✓' : '✏'}</span>
            {editMode ? 'Bearbeiten aktiv' : 'Layout bearbeiten'}
          </button>
          {!editMode && (
            <div style={{
              fontSize:10, color:'rgba(255,255,255,0.45)',
              padding:'0 4px', maxWidth:180, lineHeight:1.4,
            }}>
              Drag = Verschieben · ← → = 90° drehen
            </div>
          )}

          {editMode && (
            <div style={{
              background:'rgba(5,12,28,0.9)', borderRadius:12, padding:'12px 16px',
              border:'1px solid rgba(255,149,0,0.2)',
              backdropFilter:'blur(12px)',
              boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
            }}>
              {editSelectedId && (
                <>
                  <div style={{ color:'#FFD700', fontSize:12, fontWeight:700, marginBottom:10,
                    display:'flex', alignItems:'center', gap:6 }}>
                    <span>▶</span>
                    <span>{locations.find(l=>l.id===editSelectedId)?.name}</span>
                  </div>
                  <div style={{ height:1, background:'rgba(255,149,0,0.2)', marginBottom:10 }} />
                </>
              )}
              {[
                ['🖱', 'Klick', 'Regal wählen'],
                ['⌨', '← →', '90° drehen'],
                ['⠿', 'Ziehen', 'Verschieben'],
              ].map(([icon, key, desc]) => (
                <div key={key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                  <span style={{fontSize:13, width:18, textAlign:'center'}}>{icon}</span>
                  <span style={{color:'#FF9500', fontWeight:700, fontSize:11, minWidth:42}}>{key}</span>
                  <span style={{color:'rgba(255,255,255,0.65)', fontSize:11}}>{desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Heatmap & Filter-Panel */}
        {!editMode && (
          <div style={{
            position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)',
            display:'flex', gap:6, background:'rgba(5,12,28,0.88)',
            borderRadius:12, padding:'7px 10px',
            border:'1px solid rgba(255,255,255,0.1)',
            backdropFilter:'blur(10px)',
            boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
          }}>
            <ToolbarButton
              active={heatmapMode}
              onClick={() => setHeatmapMode(v => !v)}
              label="🌡 Heatmap"
              accent="255,200,0"
              title="Regale nach Füllstand einfärben"
            />
            <div style={{ width:1, background:'rgba(255,255,255,0.15)', margin:'0 2px' }} />
            {([
              { id: 'all',      label: '☰ Alle',      title: 'Alle Regale anzeigen' },
              { id: 'critical', label: '🔴 Kritisch',  title: 'Nur kritische Bestände' },
              { id: 'low',      label: '🟡 Knapp',     title: 'Nur knappe Bestände' },
            ] as { id: 'all'|'critical'|'low', label: string, title: string }[]).map(f => (
              <ToolbarButton
                key={f.id}
                active={filterMode === f.id}
                onClick={() => setFilterMode(f.id)}
                label={f.label}
                title={f.title}
              />
            ))}
          </div>
        )}

        {/* Hover-Tooltip */}
        {hoveredId && tooltipLoc && (
          <div style={{
            position:'fixed',
            left: tooltipPos.x + 16,
            top: Math.max(8, tooltipPos.y - 10),
            background:'rgba(5,12,28,0.97)',
            border:'1px solid rgba(100,180,255,0.35)',
            borderRadius:10,
            padding:'10px 14px',
            color:'white',
            fontSize:12,
            pointerEvents:'none',
            zIndex:9999,
            minWidth:190,
            maxWidth:260,
            boxShadow:'0 6px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontWeight:700, color:'#64B5F6', marginBottom:7, fontSize:13, borderBottom:'1px solid rgba(100,180,255,0.2)', paddingBottom:6 }}>
              📦 {tooltipLoc.name}
            </div>
            {tooltipArts.length === 0 ? (
              <div style={{ color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>Keine Artikel</div>
            ) : (
              tooltipArts.slice(0, 5).map(a => {
                const isCrit = a.current_stock < (a.min_stock_level ?? 1);
                const isLow  = a.current_stock < (a.min_stock_level ?? 1) * 1.3;
                const color  = isCrit ? '#EF5350' : isLow ? '#FF9800' : '#4CAF50';
                return (
                  <div key={a.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:4 }}>
                    <span style={{ color:'rgba(255,255,255,0.75)', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11 }}>
                      {a.name}
                    </span>
                    <span style={{ color, fontWeight:700, fontSize:12, minWidth:30, textAlign:'right' }}>
                      {a.current_stock}
                    </span>
                  </div>
                );
              })
            )}
            {tooltipArts.length > 5 && (
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:10, marginTop:4 }}>
                +{tooltipArts.length - 5} weitere…
              </div>
            )}
          </div>
        )}

        <div style={{ position:'absolute', bottom:14, right:14, color:'rgba(255,255,255,0.28)', fontSize:10, pointerEvents:'none', textAlign:'right' }}>
          Ziehen = Verschieben<br/>Ctrl+Scroll = Zoomen
        </div>
      </div>
    );
  }
  const { ScrollView } = require('react-native');
  return <ScrollView horizontal style={{flex:1,backgroundColor:'#0F1B2D'}}><ScrollView>{scene}</ScrollView></ScrollView>;
}

// ── Toolbar-Button ─────────────────────────────────────────────────────────
function ToolbarButton({ active, onClick, label, accent, title }: { active: boolean; onClick: () => void; label: string; accent?: string; title?: string }) {
  const [hov, setHov] = React.useState(false);
  const ac = accent ?? '100,180,255';
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:'5px 11px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer',
        border:`1px solid ${active ? `rgba(${ac},0.7)` : hov ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}`,
        background: active ? `rgba(${ac},0.28)` : hov ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: active ? `rgb(${ac})` : 'rgba(255,255,255,0.8)',
        transition:'all 0.15s ease',
        boxShadow: active ? `0 0 10px rgba(${ac},0.3)` : 'none',
      }}
    >
      {label}
    </button>
  );
}

// ── Kamera-Presets ─────────────────────────────────────────────────────────
function CameraPresets({ zones, locationsWithPos, svgW, svgH, originX, originY, containerRef, setScale, setOffset, setSmoothTransition }: any) {
  const [hov, setHov] = React.useState<string | null>(null);

  function flyTo(targetSvgX: number, targetSvgY: number, newScale: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSmoothTransition(true);
    setScale(newScale);
    setOffset({
      x: rect.width  / 2 - (targetSvgX - svgW / 2) * newScale - svgW / 2,
      y: rect.height / 2 - (targetSvgY - svgH / 2) * newScale - svgH / 2,
    });
  }

  const presets: { id: string; label: string; fn: () => void }[] = [
    {
      id: 'iso',
      label: '⬡ ISO',
      fn: () => { setSmoothTransition(true); setScale(1); setOffset({ x: 0, y: 0 }); },
    },
    {
      id: 'overview',
      label: '🗺 Übersicht',
      fn: () => { setSmoothTransition(true); setScale(0.6); setOffset({ x: 0, y: 0 }); },
    },
  ];

  // Zone-Presets
  const zoneLetters = ['A','B','C','D','E'];
  zones.forEach((zone: StorageZone, zi: number) => {
    const zoneLocs = locationsWithPos.filter((l: any) => l.loc.zone_id === zone.id);
    if (zoneLocs.length === 0) return;
    const minX = Math.min(...zoneLocs.map((l: any) => l.gx));
    const maxX = Math.max(...zoneLocs.map((l: any) => l.gx + l.effW));
    const minZ = Math.min(...zoneLocs.map((l: any) => l.gz));
    const maxZ = Math.max(...zoneLocs.map((l: any) => l.gz + l.effD));
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const iso = isoProject(cx, SHELF_H / 2, cz);
    presets.push({
      id: zone.id,
      label: `Zone ${zoneLetters[zi] ?? zi + 1}`,
      fn: () => flyTo(originX + iso.sx, originY + iso.sy, 2),
    });
  });

  const btnStyle = (id: string) => ({
    padding:'6px 12px', borderRadius:9, fontSize:11, fontWeight:600 as const, cursor:'pointer',
    border:`1px solid ${hov === id ? 'rgba(100,200,255,0.6)' : 'rgba(255,255,255,0.18)'}`,
    background: hov === id ? 'rgba(100,200,255,0.2)' : 'rgba(255,255,255,0.08)',
    color: hov === id ? '#64CFFF' : 'rgba(255,255,255,0.75)',
    backdropFilter:'blur(8px)',
    transition:'all 0.15s ease',
    whiteSpace:'nowrap' as const,
  });

  return (
    <div style={{
      position:'absolute', top:14, right:60,
      display:'flex', flexDirection:'column', gap:6,
    }}>
      {presets.map(p => (
        <button key={p.id} style={btnStyle(p.id)}
          onClick={p.fn}
          onMouseEnter={() => setHov(p.id)}
          onMouseLeave={() => setHov(null)}
          title={`Ansicht: ${p.label}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Zoom-Controls ─────────────────────────────────────────────────────────
function ZoomControls({ scale, setScale, setOffset, setSmoothTransition }: any) {
  const [hovered, setHovered] = React.useState<string | null>(null);

  const btnStyle = (id: string, accent?: string) => ({
    width:38, height:38, borderRadius:10,
    background: hovered === id
      ? (accent ? `rgba(${accent},0.38)` : 'rgba(255,255,255,0.25)')
      : (accent ? `rgba(${accent},0.18)` : 'rgba(255,255,255,0.10)'),
    backdropFilter:'blur(8px)',
    border:`1px solid ${accent ? `rgba(${accent},${hovered===id?'0.7':'0.4'})` : (hovered===id?'rgba(255,255,255,0.45)':'rgba(255,255,255,0.2)')}`,
    color:'white', fontSize:20, fontWeight:'bold' as const, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    boxShadow: hovered === id ? `0 4px 16px rgba(0,0,0,0.6)` : '0 2px 10px rgba(0,0,0,0.4)',
    transform: hovered === id ? 'scale(1.12)' : 'scale(1)',
    transition: 'all 0.15s ease',
  });

  const zoomIn  = () => { setSmoothTransition(true);  setScale((s:number) => Math.min(4, s*1.25)); };
  const zoomOut = () => { setSmoothTransition(true);  setScale((s:number) => Math.max(0.2, s*0.8)); };
  const reset   = () => { setSmoothTransition(true);  setScale(1); setOffset({x:0,y:0}); };

  return (
    <div style={{ position:'absolute', top:14, right:14, display:'flex', flexDirection:'column', gap:8 }}>
      <button onClick={zoomIn}  style={btnStyle('in')}           title="Hineinzoomen"
        onMouseEnter={()=>setHovered('in')}  onMouseLeave={()=>setHovered(null)}>＋</button>
      <button onClick={zoomOut} style={btnStyle('out')}          title="Herauszoomen"
        onMouseEnter={()=>setHovered('out')} onMouseLeave={()=>setHovered(null)}>－</button>
      <button onClick={reset}   style={btnStyle('rst','100,180,255')} title="Ansicht zurücksetzen"
        onMouseEnter={()=>setHovered('rst')} onMouseLeave={()=>setHovered(null)}>⌖</button>
      <div style={{ color:'rgba(255,255,255,0.4)',fontSize:10,textAlign:'center' }}>{Math.round(scale*100)}%</div>
    </div>
  );
}

// ── Legende ───────────────────────────────────────────────────────────────
function Legend3D() {
  return (
    <div style={{ position:'absolute', bottom:14, left:14, background:'rgba(8,16,32,0.88)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'12px 16px', minWidth:175 }}>
      <div style={{ color:'#B0C4DE',fontSize:11,fontWeight:700,letterSpacing:1.5,marginBottom:10,textTransform:'uppercase' }}>Legende</div>
      {[['#4CAF50','Verfügbar'],['#FF9800','Auslastung hoch'],['#EF5350','Kritisch']].map(([c,l]) => (
        <div key={l} style={{ display:'flex',alignItems:'center',gap:9,marginBottom:8 }}>
          <div style={{ width:14,height:14,borderRadius:3,backgroundColor:c,boxShadow:`0 0 6px ${c}99` }} />
          <span style={{ color:'rgba(255,255,255,0.8)',fontSize:12 }}>{l}</span>
        </div>
      ))}
      <div style={{ marginTop:8, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:8 }}>
        <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10 }}>
          Balken links = Füllstand
        </div>
      </div>
    </div>
  );
}
