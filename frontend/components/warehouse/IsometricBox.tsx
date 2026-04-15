// frontend/components/warehouse/IsometricBox.tsx
// Zeichnet eine kleine isometrische Box aus 3 SVG-Polygonen.
// Drei sichtbare Flächen: Decke (top), Front (z=gz), Rechts (x=gx+s)

import React from 'react';
import { Polygon } from 'react-native-svg';
import { isoProject, darkenColor } from '../../utils/warehouseUtils';

interface Props {
  gx: number;
  gy: number;
  gz: number;
  color: string;
  size?: number;
}

export default function IsometricBox({ gx, gy, gz, color, size = 0.35 }: Props) {
  const s = size;

  // 8 Eckpunkte des Würfels
  const corners = {
    tfl: isoProject(gx,     gy + s, gz),
    tfr: isoProject(gx + s, gy + s, gz),
    tbl: isoProject(gx,     gy + s, gz + s),
    tbr: isoProject(gx + s, gy + s, gz + s),
    bfl: isoProject(gx,     gy,     gz),
    bfr: isoProject(gx + s, gy,     gz),
    bbl: isoProject(gx,     gy,     gz + s),
    bbr: isoProject(gx + s, gy,     gz + s),
  };

  const p = (pt: { sx: number; sy: number }) => `${pt.sx},${pt.sy}`;

  // Isometrische Sichtbarkeit (Kamera von oben-rechts-vorne):
  // Top (y=gy+s), Front (z=gz), Right (x=gx+s)
  const topColor = color;
  const frontColor = darkenColor(color, 25);
  const rightColor = darkenColor(color, 50);

  return (
    <>
      {/* Deckfläche (y=gy+s): tfl→tfr→tbr→tbl */}
      <Polygon
        points={`${p(corners.tfl)} ${p(corners.tfr)} ${p(corners.tbr)} ${p(corners.tbl)}`}
        fill={topColor}
        stroke="#00000022"
        strokeWidth={0.5}
      />
      {/* Frontfläche (z=gz): tfl→bfl→bfr→tfr */}
      <Polygon
        points={`${p(corners.tfl)} ${p(corners.bfl)} ${p(corners.bfr)} ${p(corners.tfr)}`}
        fill={frontColor}
        stroke="#00000022"
        strokeWidth={0.5}
      />
      {/* Rechte Fläche (x=gx+s): tfr→bfr→bbr→tbr */}
      <Polygon
        points={`${p(corners.tfr)} ${p(corners.bfr)} ${p(corners.bbr)} ${p(corners.tbr)}`}
        fill={rightColor}
        stroke="#00000022"
        strokeWidth={0.5}
      />
    </>
  );
}
