import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { LayoutState, LayoutItem, StockState } from './index';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: '#080f1c', floor: '#0c1929', gridMaj: '#1e4070', gridMin: '#0f1e34', text: '#e8edf5',
  zone: 'rgba(59, 130, 246, 0.4)', door: 'rgba(16, 185, 129, 0.6)',
  rackFrame: '#2563eb', rackShelf: '#c9a97c', cantileverFrame: '#ea580c', cablerack: '#eab308',
  hazmat: '#dc2626',
  pallet: '#8B5A2B', table: '#4b5563', pillar: '#374151',
  forklift: '#eab308', palletjack: '#9ca3af', conveyor: '#374151', conveyorBelt: '#111827',
  dolly: '#d97706', scissorlift: '#f97316',
  workbench: '#4b5563', charging: '#164e63', trash: '#374151',
  office: '#1e3a8a', rolldoor: '#94a3b8', ramp: '#475569', stairs: '#64748b', wall: '#cbd5e1',
  fireext: '#ef4444', dangerzone: '#eab308',
  wirebox: '#d1d5db', flightcase: '#111827', wirecart: '#9ca3af', ibc: '#f1f5f9',
};

type Planner3DProps = { layout: LayoutState; stock: StockState; articles: any[]; pickRoute: string[] };

function Item3D({ item, gridWidth, gridHeight, stock, articles, pickRoute }: { item: LayoutItem, gridWidth: number, gridHeight: number, stock: StockState, articles: any[], pickRoute: string[] }) {
  const [hovered, setHovered] = React.useState(false);
  const cx = item.x + item.w / 2 - gridWidth / 2;
  const cz = item.y + item.h / 2 - gridHeight / 2;
  const cy = 0;

  return (
    <group position={[cx, cy, cz]} onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }} rotation={[0, (item.rotation * Math.PI) / 180, 0]}>
      
      {/* 🏗️ Regale */}
      {item.type === 'rack' && <Rack3D rackId={item.id} w={item.w} d={item.h} levels={item.levels||4} spots={item.spots||4} hovered={hovered} stock={stock} articles={articles} pickRoute={pickRoute} />}
      {item.type === 'cantilever' && <Cantilever3D rackId={item.id} w={item.w} d={item.h} levels={item.levels||4} spots={item.spots||4} hovered={hovered} stock={stock} articles={articles} pickRoute={pickRoute} />}
      {item.type === 'shelf' && <Shelf3D rackId={item.id} w={item.w} d={item.h} levels={item.levels||4} spots={item.spots||4} hovered={hovered} stock={stock} articles={articles} pickRoute={pickRoute} />}
      {item.type === 'cablerack' && <CableRack3D rackId={item.id} w={item.w} d={item.h} levels={item.levels||4} spots={item.spots||4} hovered={hovered} />}
      {item.type === 'hazmat' && <Hazmat3D w={item.w} d={item.h} />}
      
      {/* 🚜 Fahrzeuge */}
      {item.type === 'forklift' && <Forklift3D w={item.w} d={item.h} />}
      {item.type === 'palletjack' && <PalletJack3D w={item.w} d={item.h} />}
      {item.type === 'conveyor' && <Conveyor3D w={item.w} d={item.h} />}
      {item.type === 'dolly' && <Dolly3D w={item.w} d={item.h} />}
      {item.type === 'scissorlift' && <ScissorLift3D w={item.w} d={item.h} />}
      
      {/* 🛠️ Arbeitsbereiche */}
      {item.type === 'table' && <Table3D w={item.w} d={item.h} />}
      {item.type === 'office' && <Office3D w={item.w} d={item.h} />}
      {item.type === 'workbench' && <Workbench3D w={item.w} d={item.h} />}
      {item.type === 'charging' && <Charging3D w={item.w} d={item.h} />}
      {item.type === 'trash' && <Trash3D w={item.w} d={item.h} />}

      {/* 🧱 Infrastruktur */}
      {item.type === 'zone' && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[item.w, item.h]} /><meshBasicMaterial color={item.color || T.zone} transparent opacity={hovered ? 0.8 : 0.4} /></mesh>
      )}
      {item.type === 'dangerzone' && <DangerZone3D w={item.w} d={item.h} hovered={hovered} />}
      {item.type === 'door' && (
        <mesh position={[0, 1.5, 0]}><boxGeometry args={[item.w, 3, item.h]} /><meshStandardMaterial color={T.door} transparent opacity={0.6} /></mesh>
      )}
      {item.type === 'rolldoor' && <RollDoor3D w={item.w} d={item.h} />}
      {item.type === 'ramp' && <Ramp3D w={item.w} d={item.h} />}
      {item.type === 'stairs' && <Stairs3D w={item.w} d={item.h} />}
      {item.type === 'pillar' && (
        <mesh position={[0, 3, 0]}><boxGeometry args={[item.w, 6, item.h]} /><meshStandardMaterial color={T.pillar} roughness={0.8} /></mesh>
      )}
      {item.type === 'wall' && <Wall3D w={item.w} d={item.h} />}
      {item.type === 'fireext' && <FireExt3D w={item.w} d={item.h} />}

      {/* 🧰 Ladehilfsmittel */}
      {item.type === 'pallet' && (
        <mesh position={[0, 0.07, 0]}><boxGeometry args={[item.w - 0.1, 0.15, item.h - 0.1]} /><meshStandardMaterial color={T.pallet} roughness={0.9} /></mesh>
      )}
      {item.type === 'wirebox' && <Wirebox3D w={item.w} d={item.h} />}
      {item.type === 'flightcase' && <Flightcase3D w={item.w} d={item.h} />}
      {item.type === 'wirecart' && <Wirecart3D w={item.w} d={item.h} />}
      {item.type === 'ibc' && <IBC3D w={item.w} d={item.h} />}

      {/* Tooltip */}
      {hovered && (
        <Html position={[0, ['rack','cantilever','shelf','cablerack'].includes(item.type) ? (item.levels||4)*0.8+1 : 3, 0]} center zIndexRange={[100, 0]}>
          <div style={{ background: 'rgba(4,12,30,0.9)', backdropFilter: 'blur(10px)', color: T.text, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', fontSize: 12, fontFamily: 'system-ui', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 'bold' }}>{item.label}</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>{item.w}m x {item.h}m</div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── GEOMETRY COMPONENTS ──────────────────────────────────────────────────

function StockCrates({ rackStock, articles, w, d, spots, LH, pickRoute }: any) {
  const spotWidth = w / spots;
  return rackStock.map((m: any) => {
    const art = articles.find((a: any) => a.id === m.article_id);
    const cx = -w / 2 + (m.spot - 1) * spotWidth + spotWidth / 2;
    const isPicked = pickRoute && pickRoute.includes(m.article_id);
    return (
      <group key={`c-${m.level}-${m.spot}`} position={[cx, m.level * LH + 0.2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[spotWidth - 0.2, 0.4, d - 0.2]} />
          <meshStandardMaterial color={isPicked ? '#10b981' : '#d97706'} emissive={isPicked ? '#10b981' : '#000'} emissiveIntensity={isPicked ? 0.5 : 0} />
        </mesh>
        {isPicked && <pointLight position={[0, 0.5, 0]} color="#10b981" intensity={1} distance={2} />}
        {isPicked && (
          <Html position={[0, 0.6, 0]} center zIndexRange={[100,0]}>
            <div style={{ color: '#10b981', fontSize: 24, animation: 'bounce 1s infinite' }}>📍</div>
          </Html>
        )}
        <Html position={[0, 0.3, 0]} center zIndexRange={[50,0]}><div style={{ background: '#0f172a', color: isPicked ? '#34d399' : '#38bdf8', fontSize: 9, padding: '2px 6px', borderRadius: 4, border: isPicked ? '1px solid #10b981' : 'none' }}>📦 {art?.name || 'Unbekannt'}</div></Html>
      </group>
    );
  });
}

function Rack3D({ rackId, w, d, levels, spots, hovered, stock, articles, pickRoute }: any) {
  const S = 0.08, LH = 0.8, H = levels * LH;
  const uprightXs = Array.from({ length: spots + 1 }, (_, i) => -w / 2 + i * (w / spots));
  const shelfYs = Array.from({ length: levels }, (_, i) => (i + 1) * LH);
  const rackStock = stock.mapping.filter((m: any) => m.rack_id === rackId);

  return (
    <group>
      {uprightXs.map(x => [-d/2+S/2, d/2-S/2].map(z => <mesh key={`u${x}${z}`} position={[x, H/2, z]} castShadow><boxGeometry args={[S, H, S]} /><meshStandardMaterial color={hovered ? '#60a5fa' : T.rackFrame} /></mesh>))}
      {shelfYs.map(y => <mesh key={`s${y}`} position={[0, y, 0]} receiveShadow castShadow><boxGeometry args={[w, 0.05, d]} /><meshStandardMaterial color={hovered ? '#fde047' : T.rackShelf} /></mesh>)}
      <StockCrates rackStock={rackStock} articles={articles} w={w} d={d} spots={spots} LH={LH} pickRoute={pickRoute} />
    </group>
  );
}

function Cantilever3D({ rackId, w, d, levels, spots, hovered, stock, articles, pickRoute }: any) {
  const S = 0.1, LH = 0.8, H = levels * LH;
  const uprightXs = Array.from({ length: spots + 1 }, (_, i) => -w / 2 + i * (w / spots));
  const shelfYs = Array.from({ length: levels }, (_, i) => (i + 1) * LH);
  const rackStock = stock.mapping.filter((m: any) => m.rack_id === rackId);

  return (
    <group>
      {uprightXs.map(x => (
        <group key={`u${x}`}>
          <mesh position={[x, H/2, -d/2+S/2]} castShadow><boxGeometry args={[S, H, S]} /><meshStandardMaterial color={hovered ? '#f97316' : T.cantileverFrame} /></mesh>
          <mesh position={[x, 0.1, 0]} castShadow><boxGeometry args={[S, 0.2, d]} /><meshStandardMaterial color={T.cantileverFrame} /></mesh>
          {shelfYs.map(y => <mesh key={`a${y}`} position={[x, y, 0]} castShadow><boxGeometry args={[0.05, 0.05, d]} /><meshStandardMaterial color={T.cantileverFrame} /></mesh>)}
        </group>
      ))}
      <StockCrates rackStock={rackStock} articles={articles} w={w} d={d} spots={spots} LH={LH} pickRoute={pickRoute} />
    </group>
  );
}

function Shelf3D({ rackId, w, d, levels, spots, hovered, stock, articles, pickRoute }: any) {
  const S = 0.02, LH = 0.6, H = levels * LH;
  const shelfYs = Array.from({ length: levels }, (_, i) => (i + 1) * LH);
  const rackStock = stock.mapping.filter((m: any) => m.rack_id === rackId);

  return (
    <group>
      <mesh position={[-w/2+S/2, H/2, 0]}><boxGeometry args={[S, H, d]} /><meshStandardMaterial color="#94a3b8" /></mesh>
      <mesh position={[w/2-S/2, H/2, 0]}><boxGeometry args={[S, H, d]} /><meshStandardMaterial color="#94a3b8" /></mesh>
      <mesh position={[0, H/2, -d/2+S/2]}><boxGeometry args={[w, H, S]} /><meshStandardMaterial color="#64748b" /></mesh>
      {shelfYs.map(y => <mesh key={`s${y}`} position={[0, y, 0]} receiveShadow><boxGeometry args={[w, 0.05, d]} /><meshStandardMaterial color={hovered ? '#fde047' : '#cbd5e1'} /></mesh>)}
      <StockCrates rackStock={rackStock} articles={articles} w={w} d={d} spots={spots} LH={LH} pickRoute={pickRoute} />
    </group>
  );
}

function CableRack3D({ w, d, levels, spots, hovered }: any) {
  const S = 0.08, LH = 0.8, H = levels * LH;
  const uprightXs = Array.from({ length: spots + 1 }, (_, i) => -w / 2 + i * (w / spots));
  const shelfYs = Array.from({ length: levels }, (_, i) => (i + 1) * LH);

  return (
    <group>
      {uprightXs.map(x => [-d/2+S/2, d/2-S/2].map(z => <mesh key={`u${x}${z}`} position={[x, H/2, z]} castShadow><boxGeometry args={[S, H, S]} /><meshStandardMaterial color={hovered ? '#fde047' : T.cablerack} /></mesh>))}
      {shelfYs.map(y => (
        <group key={`c${y}`}>
          {Array.from({length: spots}).map((_, i) => (
            <mesh key={i} position={[-w/2 + i*(w/spots) + (w/spots)/2, y, 0]} rotation={[0, 0, Math.PI/2]} castShadow>
              <cylinderGeometry args={[d/2.5, d/2.5, w/spots - 0.2, 16]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Hazmat3D({ w, d }: any) {
  return (
    <group position={[0, 1, 0]}>
      <mesh castShadow><boxGeometry args={[w, 2, d]} /><meshStandardMaterial color={T.hazmat} metalness={0.8} roughness={0.2} /></mesh>
      <mesh position={[0, 0, d/2 + 0.01]}><planeGeometry args={[w-0.2, 1.8]} /><meshBasicMaterial color="#ef4444" /></mesh>
      {/* Doors line */}
      <mesh position={[0, 0, d/2 + 0.02]}><boxGeometry args={[0.02, 1.8, 0.01]} /><meshBasicMaterial color="#111" /></mesh>
    </group>
  );
}

// ─── TRANSPORT ───

function Forklift3D({ w, d }: any) {
  return (
    <group>
      <mesh position={[0, 0.6, d/4]} castShadow><boxGeometry args={[w-0.2, 1, d/1.5]} /><meshStandardMaterial color={T.forklift} /></mesh>
      <mesh position={[0, 1.6, d/4]} castShadow><boxGeometry args={[w-0.4, 1, d/2]} /><meshStandardMaterial color="#333" transparent opacity={0.8} /></mesh>
      <mesh position={[0, 1.5, -d/2+0.2]} castShadow><boxGeometry args={[w-0.2, 3, 0.2]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0, 0.1, -d/2-0.5]} castShadow><boxGeometry args={[w-0.4, 0.05, 1.5]} /><meshStandardMaterial color="#111" /></mesh>
    </group>
  );
}

function PalletJack3D({ w, d }: any) {
  return (
    <group position={[0, 0.1, 0]}>
      <mesh position={[0, 0, 0]}><boxGeometry args={[w-0.2, 0.1, d]} /><meshStandardMaterial color={T.palletjack} /></mesh>
      <mesh position={[0, 0.5, d/2-0.2]}><boxGeometry args={[0.1, 1, 0.1]} /><meshStandardMaterial color="#111" /></mesh>
    </group>
  );
}

function Conveyor3D({ w, d }: any) {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[w, 0.2, d]} /><meshStandardMaterial color={T.conveyor} /></mesh>
      <mesh position={[0, 0.95, 0]}><boxGeometry args={[w, 0.05, d-0.1]} /><meshStandardMaterial color={T.conveyorBelt} /></mesh>
      {[-w/2+0.2, w/2-0.2].map(x => <mesh key={`l${x}`} position={[x, 0.4, 0]}><boxGeometry args={[0.1, 0.8, d-0.1]} /><meshStandardMaterial color={T.conveyor} /></mesh>)}
    </group>
  );
}

function Dolly3D({ w, d }: any) {
  return (
    <group position={[0, 0.15, 0]}>
      <mesh castShadow><boxGeometry args={[w-0.1, 0.05, d-0.1]} /><meshStandardMaterial color="#92400e" roughness={0.9} /></mesh>
      {[-w/2+0.1, w/2-0.1].map(x => [-d/2+0.1, d/2-0.1].map(z => (
        <mesh key={`w${x}${z}`} position={[x, -0.1, z]}><cylinderGeometry args={[0.05, 0.05, 0.05]} /><meshStandardMaterial color="#111" /></mesh>
      )))}
    </group>
  );
}

function ScissorLift3D({ w, d }: any) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[w-0.1, 0.4, d-0.1]} /><meshStandardMaterial color={T.scissorlift} /></mesh>
      <mesh position={[0, 1.5, 0]}><boxGeometry args={[w-0.2, 2.2, 0.1]} /><meshStandardMaterial color="#64748b" wireframe /></mesh>
      <mesh position={[0, 2.8, 0]} castShadow><boxGeometry args={[w-0.1, 0.6, d-0.1]} /><meshStandardMaterial color={T.scissorlift} wireframe /></mesh>
    </group>
  );
}

// ─── WORKSPACES ───

function Table3D({ w, d }: any) {
  return (
    <group>
      <mesh position={[0, 1, 0]} castShadow><boxGeometry args={[w, 0.1, d]} /><meshStandardMaterial color={T.table} /></mesh>
      {[-w/2+0.1, w/2-0.1].map(x => [-d/2+0.1, d/2-0.1].map(z => <mesh key={`l${x}${z}`} position={[x, 0.5, z]}><boxGeometry args={[0.1, 1, 0.1]} /><meshStandardMaterial color={T.table} /></mesh>))}
    </group>
  );
}

function Workbench3D({ w, d }: any) {
  return (
    <group>
      <mesh position={[0, 1, 0]} castShadow><boxGeometry args={[w, 0.1, d]} /><meshStandardMaterial color="#854d0e" roughness={0.8} /></mesh>
      {[-w/2+0.1, w/2-0.1].map(x => [-d/2+0.1, d/2-0.1].map(z => <mesh key={`l${x}${z}`} position={[x, 0.5, z]}><boxGeometry args={[0.1, 1, 0.1]} /><meshStandardMaterial color="#374151" /></mesh>))}
      {/* Toolboard */}
      <mesh position={[0, 1.8, -d/2+0.05]} castShadow><boxGeometry args={[w, 1.5, 0.1]} /><meshStandardMaterial color="#1f2937" /></mesh>
    </group>
  );
}

function Charging3D({ w, d }: any) {
  return (
    <group>
      <mesh position={[0, 1, 0]} castShadow><boxGeometry args={[w, 0.1, d]} /><meshStandardMaterial color="#0f172a" /></mesh>
      <mesh position={[0, 1.5, -d/2+0.2]} castShadow><boxGeometry args={[w, 1, 0.4]} /><meshStandardMaterial color="#1e293b" /></mesh>
      {Array.from({length: 4}).map((_, i) => (
        <mesh key={i} position={[-w/2 + 0.3 + i*0.4, 1.6, -d/2+0.3]}>
          <boxGeometry args={[0.1, 0.2, 0.1]} />
          <meshBasicMaterial color="#06b6d4" />
        </mesh>
      ))}
    </group>
  );
}

function Trash3D({ w, d }: any) {
  const binW = w/3 - 0.1;
  const colors = ['#2563eb', '#eab308', '#4b5563'];
  return (
    <group position={[0, 0.6, 0]}>
      {colors.map((color, i) => (
        <mesh key={i} position={[-w/2 + binW/2 + 0.05 + i*(binW+0.05), 0, 0]} castShadow>
          <boxGeometry args={[binW, 1.2, d-0.2]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Office3D({ w, d }: any) {
  return (
    <group>
      <mesh position={[0, 1.5, 0]} castShadow><boxGeometry args={[w, 3, d]} /><meshStandardMaterial color={T.office} transparent opacity={0.6} /></mesh>
      <mesh position={[0, 3.1, 0]}><boxGeometry args={[w+0.1, 0.2, d+0.1]} /><meshStandardMaterial color="#1e40af" /></mesh>
    </group>
  );
}

// ─── INFRASTRUCTURE ───

function DangerZone3D({ w, d, hovered }: any) {
  return (
    <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      {/* Simple representation: Yellow with low opacity */}
      <meshBasicMaterial color={T.dangerzone} transparent opacity={hovered ? 0.8 : 0.4} />
    </mesh>
  );
}

function RollDoor3D({ w, d }: any) {
  return (
    <group position={[0, 2, 0]}>
      <mesh><boxGeometry args={[w, 4, d]} /><meshStandardMaterial color={T.rolldoor} roughness={0.5} metalness={0.8} /></mesh>
      {Array.from({length: 10}).map((_, i) => <mesh key={i} position={[0, -1.8 + i*0.4, d/2]}><boxGeometry args={[w, 0.05, 0.05]} /><meshStandardMaterial color="#475569" /></mesh>)}
    </group>
  );
}

function Ramp3D({ w, d }: any) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(0, 1); shape.lineTo(d, 0); shape.lineTo(0, 0);
    const extrudeSettings = { depth: w, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    return geometry;
  }, [w, d]);
  return <mesh position={[0, 0.5, 0]} rotation={[0, -Math.PI/2, 0]} geometry={geo} castShadow receiveShadow><meshStandardMaterial color={T.ramp} /></mesh>;
}

function Stairs3D({ w, d }: any) {
  const steps = 6, stepD = d / steps, stepH = 1.5 / steps;
  return (
    <group>
      {Array.from({length: steps}).map((_, i) => (
        <mesh key={i} position={[0, (i+1)*stepH/2, -d/2 + i*stepD + stepD/2]} castShadow receiveShadow>
          <boxGeometry args={[w, (i+1)*stepH, stepD]} /><meshStandardMaterial color={T.stairs} />
        </mesh>
      ))}
    </group>
  );
}

function Wall3D({ w, d }: any) {
  return (
    <mesh position={[0, 3, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, 6, d]} />
      <meshStandardMaterial color={T.wall} roughness={0.9} />
    </mesh>
  );
}

function FireExt3D({ w, d }: any) {
  return (
    <group position={[0, 1.5, 0]}>
      <mesh position={[0, 0, -d/2 + 0.1]} castShadow><boxGeometry args={[0.4, 0.6, 0.1]} /><meshStandardMaterial color="#fff" /></mesh>
      <mesh position={[0, 0, -d/2 + 0.2]} castShadow><cylinderGeometry args={[0.1, 0.1, 0.4]} /><meshStandardMaterial color={T.fireext} /></mesh>
    </group>
  );
}

// ─── MEDIA ───

function Wirebox3D({ w, d }: any) {
  return (
    <group position={[0, 0.5, 0]}>
      <mesh><boxGeometry args={[w-0.1, 1, d-0.1]} /><meshStandardMaterial color={T.wirebox} wireframe transparent opacity={0.6} /></mesh>
      <mesh position={[0, -0.45, 0]}><boxGeometry args={[w, 0.1, d]} /><meshStandardMaterial color={T.pallet} /></mesh>
    </group>
  );
}

function Flightcase3D({ w, d }: any) {
  return (
    <group position={[0, 0.5, 0]}>
      <mesh castShadow><boxGeometry args={[w-0.1, 0.8, d-0.1]} /><meshStandardMaterial color={T.flightcase} roughness={0.8} /></mesh>
      {/* Casters */}
      {[-w/2+0.1, w/2-0.1].map(x => [-d/2+0.1, d/2-0.1].map(z => <mesh key={`c${x}${z}`} position={[x, -0.45, z]}><cylinderGeometry args={[0.05, 0.05, 0.1]} /><meshStandardMaterial color="#475569" /></mesh>))}
      {/* Edges */}
      <mesh><boxGeometry args={[w-0.05, 0.85, d-0.05]} /><meshStandardMaterial color="#d1d5db" wireframe /></mesh>
    </group>
  );
}

function Wirecart3D({ w, d }: any) {
  return (
    <group position={[0, 1, 0]}>
      <mesh><boxGeometry args={[w-0.1, 1.8, d-0.1]} /><meshStandardMaterial color={T.wirecart} wireframe /></mesh>
      <mesh position={[0, -0.9, 0]}><boxGeometry args={[w-0.1, 0.05, d-0.1]} /><meshStandardMaterial color="#374151" /></mesh>
      {[-w/2+0.1, w/2-0.1].map(x => [-d/2+0.1, d/2-0.1].map(z => <mesh key={`c${x}${z}`} position={[x, -0.95, z]}><cylinderGeometry args={[0.05, 0.05, 0.1]} /><meshStandardMaterial color="#111" /></mesh>))}
    </group>
  );
}

function IBC3D({ w, d }: any) {
  return (
    <group position={[0, 0.6, 0]}>
      <mesh castShadow><boxGeometry args={[w-0.15, 0.9, d-0.15]} /><meshStandardMaterial color={T.ibc} transparent opacity={0.8} roughness={0.3} /></mesh>
      <mesh><boxGeometry args={[w-0.1, 1, d-0.1]} /><meshStandardMaterial color="#94a3b8" wireframe /></mesh>
      <mesh position={[0, -0.55, 0]}><boxGeometry args={[w-0.1, 0.1, d-0.1]} /><meshStandardMaterial color="#9ca3af" /></mesh>
    </group>
  );
}

// ─── MAIN SCENE ──────────────────────────────────────────────────────────

export default function Planner3D({ layout, stock, articles, pickRoute }: Planner3DProps) {
  const { width, height } = layout.grid;
  return (
    <div style={{ width: '100%', height: '100%', background: T.bg }}>
      <Canvas shadows camera={{ position: [0, 20, 30], fov: 45 }}>
        <color attach="background" args={[T.bg]} />
        <ambientLight intensity={0.6} color="#9ab8e8" />
        <directionalLight position={[20, 30, 20]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-10, 10, -10]} intensity={0.4} color="#1a3aaa" />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[width, height]} /><meshStandardMaterial color={T.floor} roughness={0.9} /></mesh>
        <Grid position={[0, 0.01, 0]} args={[width, height]} cellSize={1} cellThickness={1} cellColor={T.gridMin} sectionSize={5} sectionThickness={1.5} sectionColor={T.gridMaj} fadeDistance={100} fadeStrength={1} />
        
        {layout.items.map(item => <Item3D key={item.id} item={item} gridWidth={width} gridHeight={height} stock={stock} articles={articles} pickRoute={pickRoute} />)}
        <fog attach="fog" args={[T.bg, 40, 100]} />
      </Canvas>
    </div>
  );
}
