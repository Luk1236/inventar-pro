// frontend/components/warehouse/IsometricShelf.tsx
// Industrieregal mit 4 Rotationsstufen (0°/90°/180°/270°).
import React from 'react';
import { G, Polygon, Line, Rect, Text as SvgText } from 'react-native-svg';
import { isoProject, Article, StorageLocation } from '../../utils/warehouseUtils';

interface Props {
  location: StorageLocation;
  articles: Article[];
  gx: number;
  gz: number;
  isSelected: boolean;
  rotation?: number;       // 0 | 1 | 2 | 3  (×90°)
  isDragging?: boolean;
  ghosted?: boolean;       // Filter-Ghosting: halbtransparent
  heatmapMode?: boolean;   // Überschreibt Cargo-Farben mit heatmapColor
  heatmapColor?: string;   // Farbe für Heatmap (vom Parent berechnet)
  onPress: () => void;
  onShelfMouseDown?: (e: any) => void;
  onHoverIn?: (e: any) => void;
  onHoverOut?: () => void;
}

// ── Basis-Abmessungen ────────────────────────────────────────────────────────
export const SHELF_W = 4.0;
export const SHELF_D = 1.2;
export const SHELF_H = 3.3;
const PT    = 0.12;
const BH    = 0.08;
const PLATZ = 3;
const LVL   = [0.0, 1.10, 2.20];

// ── Farben ───────────────────────────────────────────────────────────────────
const C = {
  pillarTop:   '#C8D8E8', pillarFront: '#8EAABF', pillarSide: '#5A7890',
  beamTop:     '#5AAAE0', beamFront:   '#1A5FA8', beamSide:   '#0D4080',
  brace:       '#507090',
  palTop:      '#C8A870', palFront:    '#9A7030', palSide:    '#6A4A10',
};

// ── Koordinaten-Transformation (lokal → Welt) ─────────────────────────────
function tw(lx: number, lz: number, gx: number, gz: number, rot: number) {
  const W = SHELF_W, D = SHELF_D;
  switch (rot % 4) {
    case 1: return { x: gx + (D - lz), z: gz + lx };
    case 2: return { x: gx + (W - lx), z: gz + (D - lz) };
    case 3: return { x: gx + lz,       z: gz + (W - lx) };
    default: return { x: gx + lx,      z: gz + lz };
  }
}

export function shelfEffDims(rot: number) {
  return rot % 2 === 0
    ? { effW: SHELF_W, effD: SHELF_D }
    : { effW: SHELF_D, effD: SHELF_W };
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function IsometricShelf({
  location, articles, gx, gz, isSelected,
  rotation = 0, isDragging = false,
  ghosted = false, heatmapMode = false, heatmapColor,
  onPress, onShelfMouseDown, onHoverIn, onHoverOut,
}: Props) {
  const rot = (rotation ?? 0) % 4;
  const sel = isSelected;

  // Selektions-/Drag-Farben
  const bF = sel ? '#2878CC' : C.beamFront;
  const bS = sel ? '#1A5A9A' : C.beamSide;
  const bT = sel ? '#68B0E8' : C.beamTop;
  const pF = sel ? '#B0C8D8' : C.pillarFront;
  const pS = sel ? '#80A0B8' : C.pillarSide;
  const pT = sel ? '#E0ECF4' : C.pillarTop;
  const sk = sel ? '#FFD700' : '#00000020';
  const sw = sel ? 1.5 : 0.4;

  const T = (lx: number, lz: number) => tw(lx, lz, gx, gz, rot);

  const pp = (lx: number, ly: number, lz: number) => {
    const w = T(lx, lz);
    const p = isoProject(w.x, ly, w.z);
    return `${p.sx},${p.sy}`;
  };

  const polyL = (pts: [number,number,number][], fill: string, stroke='none', strokeW=0) => {
    const s = pts.map(([x,y,z]) => pp(x,y,z)).join(' ');
    return <Polygon points={s} fill={fill} stroke={stroke} strokeWidth={strokeW} />;
  };

  const lineL = (lx1:number,ly1:number,lz1:number,lx2:number,ly2:number,lz2:number, color:string, strokeW:number) => {
    const w1 = T(lx1,lz1), w2 = T(lx2,lz2);
    const a = isoProject(w1.x,ly1,w1.z), b = isoProject(w2.x,ly2,w2.z);
    return <Line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={color} strokeWidth={strokeW} />;
  };

  const box = (lx:number,ly:number,lz:number, lw:number,lh:number,ld:number,
               cT:string,cF:string,cR:string, st='none',sw=0) => {
    const top = [
      [lx,ly+lh,lz],[lx+lw,ly+lh,lz],[lx+lw,ly+lh,lz+ld],[lx,ly+lh,lz+ld]
    ] as [number,number,number][];

    let frontFace: [number,number,number][], rightFace: [number,number,number][];
    switch (rot) {
      case 1:
        frontFace = [[lx,ly,lz],[lx,ly+lh,lz],[lx,ly+lh,lz+ld],[lx,ly,lz+ld]];
        rightFace = [[lx,ly,lz],[lx,ly+lh,lz],[lx+lw,ly+lh,lz],[lx+lw,ly,lz]];
        break;
      case 2:
        frontFace = [[lx,ly,lz+ld],[lx,ly+lh,lz+ld],[lx+lw,ly+lh,lz+ld],[lx+lw,ly,lz+ld]];
        rightFace = [[lx,ly,lz],[lx,ly+lh,lz],[lx,ly+lh,lz+ld],[lx,ly,lz+ld]];
        break;
      case 3:
        frontFace = [[lx+lw,ly,lz],[lx+lw,ly+lh,lz],[lx+lw,ly+lh,lz+ld],[lx+lw,ly,lz+ld]];
        rightFace = [[lx,ly,lz+ld],[lx,ly+lh,lz+ld],[lx+lw,ly+lh,lz+ld],[lx+lw,ly,lz+ld]];
        break;
      default:
        frontFace = [[lx,ly,lz],[lx,ly+lh,lz],[lx+lw,ly+lh,lz],[lx+lw,ly,lz]];
        rightFace = [[lx+lw,ly,lz],[lx+lw,ly+lh,lz],[lx+lw,ly+lh,lz+ld],[lx+lw,ly,lz+ld]];
    }
    return <>
      {polyL(top, cT, st, sw)}
      {polyL(frontFace as [number,number,number][], cF, st, sw)}
      {polyL(rightFace as [number,number,number][], cR, st, sw)}
    </>;
  };

  // ── Geometrie ───────────────────────────────────────────────────────────────
  const W = SHELF_W, D = SHELF_D;
  const BAY = (W - PT) / PLATZ;

  const tapPts = [[0,SHELF_H,0],[W,SHELF_H,0],[W,SHELF_H,D],[0,SHELF_H,D]]
    .map(([lx,ly,lz]) => pp(lx,ly,lz)).join(' ');

  const centerW = T(W/2, D/2);
  const lpISO  = isoProject(centerW.x, SHELF_H + 0.52, centerW.z);
  const lp2ISO = isoProject(centerW.x, SHELF_H + 0.18, centerW.z);
  const lpHintISO = onShelfMouseDown ? isoProject(centerW.x, SHELF_H + 0.85, centerW.z) : null;

  const rotLabels = ['0°','90°','180°','270°'];

  function cargoClr(cur: number, min: number) {
    if (heatmapMode && heatmapColor) {
      // Heatmap: einheitliche Farbe vom Parent
      const darker = heatmapColor + 'CC';
      const darkest = heatmapColor + '99';
      return { t: heatmapColor, f: darker, s: darkest };
    }
    if (cur < min)        return { t: '#EF5350', f: '#C62828', s: '#B71C1C' };
    if (cur <= min * 1.3) return { t: '#FF9800', f: '#F57C00', s: '#E65100' };
    return                       { t: '#4CAF50', f: '#388E3C', s: '#2E7D32' };
  }

  // Füllstand-Fortschrittsbalken: gesamte Artikel relativ zu Kapazität
  const totalSlots = LVL.length * PLATZ;
  const filledSlots = articles.filter(a => a && a.current_stock > 0).length;
  const fillRatio = totalSlots > 0 ? Math.min(1, filledSlots / totalSlots) : 0;

  // Position des Fortschrittsbalkens: vordere linke Stütze, außen
  const barW0 = T(-0.22, 0);
  const barBase = isoProject(barW0.x, 0, barW0.z);
  const barTop  = isoProject(barW0.x, SHELF_H, barW0.z);
  const barFillY = barBase.sy - (barBase.sy - barTop.sy) * fillRatio;
  const barColor = fillRatio < 0.3 ? '#EF5350' : fillRatio < 0.7 ? '#FF9800' : '#4CAF50';

  return (
    <G opacity={isDragging ? 0.5 : ghosted ? 0.15 : 1}>
      {/* Bodenschatten */}
      {polyL([
        [-0.15,0,-0.15],[W+0.15,0,-0.15],[W+0.15,0,D+0.15],[-0.15,0,D+0.15]
      ], isDragging ? 'rgba(255,149,0,0.18)' : ghosted ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.22)')}

      {/* X-Verstrebungen */}
      {lineL(0,0,D, W,SHELF_H,D, C.brace,1.0)}
      {lineL(W,0,D, 0,SHELF_H,D, C.brace,1.0)}
      {lineL(W,0,0, W,SHELF_H,D, C.brace,1.0)}
      {lineL(W,0,D, W,SHELF_H,0, C.brace,1.0)}

      {/* 4 Eck-Stützen */}
      {([
        [0,   0,   0],
        [W-PT,0,   0],
        [0,   0,   D-PT],
        [W-PT,0,   D-PT],
      ] as [number,number,number][]).map(([px,py,pz],i) => (
        <React.Fragment key={i}>
          {box(px,py,pz, PT,SHELF_H,PT, pT,pF,pS, sk,sw)}
        </React.Fragment>
      ))}

      {/* Holme + Paletten pro Ebene */}
      {LVL.map((fh, li) => (
        <React.Fragment key={li}>
          {box(0,fh,0,    W,BH,PT, bT,bF,bS, sk,sw*0.75)}
          {box(0,fh,D-PT, W,BH,PT, bT,bF,bS, sk,sw*0.75)}

          {Array.from({length:PLATZ}).map((_,si) => {
            const artIdx = li * PLATZ + si;
            const bx = PT*0.5 + si*BAY + 0.05;
            const bz = PT + 0.05;
            const bw = BAY - 0.12;
            const bd = D - PT*2 - 0.10;
            const art = articles[artIdx];
            const cc = art ? cargoClr(art.current_stock ?? 0, art.min_stock_level ?? 1) : null;
            return (
              <React.Fragment key={si}>
                {box(bx,fh+BH+0.01,bz, bw,0.07,bd, C.palTop,C.palFront,C.palSide, '#00000015',0.3)}
                {cc && box(bx+0.04,fh+BH+0.08,bz+0.04, bw-0.08,0.28,bd-0.08, cc.t,cc.f,cc.s, '#00000028',0.4)}
              </React.Fragment>
            );
          })}
        </React.Fragment>
      ))}

      {/* Füllstand-Fortschrittsbalken (linke Außenseite) */}
      {!ghosted && (
        <>
          {/* Hintergrund */}
          <Line
            x1={barBase.sx} y1={barBase.sy}
            x2={barTop.sx}  y2={barTop.sy}
            stroke="rgba(0,0,0,0.4)" strokeWidth={4}
          />
          {/* Füllstand */}
          <Line
            x1={barBase.sx} y1={barBase.sy}
            x2={barBase.sx + (barTop.sx - barBase.sx) * fillRatio}
            y2={barFillY}
            stroke={barColor} strokeWidth={3}
            strokeLinecap="round"
          />
        </>
      )}

      {/* Beschriftung */}
      <SvgText x={lpISO.sx} y={lpISO.sy} textAnchor="middle"
        fontSize={sel?14:11} fontWeight="bold" fill={sel?'#FFD700':'#CCDDEE'}>
        {location.name}  {rot > 0 ? rotLabels[rot] : ''}
      </SvgText>
      {articles.length > 0 && (
        <SvgText x={lp2ISO.sx} y={lp2ISO.sy} textAnchor="middle" fontSize={9} fill="#AABBCC">
          {articles.length} Artikel
        </SvgText>
      )}
      {lpHintISO && (
        <SvgText x={lpHintISO.sx} y={lpHintISO.sy} textAnchor="middle" fontSize={10} fill="#FF9500" opacity={0.9}>
          ← → drehen  ✥ ziehen
        </SvgText>
      )}

      {/* Transparente Tap/Drag/Hover-Fläche */}
      <Polygon
        points={tapPts}
        fill={onShelfMouseDown ? 'rgba(255,149,0,0.06)' : 'transparent'}
        stroke={onShelfMouseDown ? (sel ? '#FFD700' : '#FF9500') : 'none'}
        strokeWidth={onShelfMouseDown ? 1.5 : 0}
        strokeDasharray={onShelfMouseDown ? '5,3' : undefined}
        onPress={onPress}
        onMouseDown={onShelfMouseDown}
        {...{ onMouseEnter: onHoverIn, onMouseLeave: onHoverOut } as any}
      />
    </G>
  );
}
