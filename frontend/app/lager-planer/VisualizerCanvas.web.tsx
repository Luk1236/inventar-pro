/**
 * WarehouseVisualizer — Parametric 2D/3D Warehouse Layout (Web only)
 * Bundled only for web via Metro's platform-specific file resolution.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrthographicCamera, OrbitControls, Html, Grid, Line,
} from '@react-three/drei'
import * as THREE from 'three'

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          '#0d1720',
  floor:       '#111b2a',
  gridMaj:     '#1a3a5c',
  gridMin:     '#0e2235',
  wall:        '#2a6fa8',
  frame:       '#1d5b94',
  frameHov:    '#3a9fd4',
  frameEdge:   '#4aafee',
  shelf:       '#c6a273',
  shelfHov:    '#dfb98a',
  endCap:      '#889aaa',
  panel:       'rgba(8,18,35,0.93)',
  panelBorder: '#1d3a5c',
  text:        '#e2e8f0',
  textDim:     '#64748b',
  accent:      '#3b82f6',
  accentHov:   '#60a5fa',
  lbl:         '#94a3b8',
  green:       '#22c55e',
  amber:       '#f59e0b',
  tooltip:     '#060f1e',
}

const BAY_W  = 1.2
const RACK_D = 0.8
const LVL_H  = 0.5
const PILLAR = 0.065

// ─── Rack Bay ─────────────────────────────────────────────────────────────────
function RackBay({ position, levels, rowIdx, bayIdx }: {
  position: [number, number, number]
  levels: number
  rowIdx: number
  bayIdx: number
}) {
  const [hovered, setHovered] = useState(false)

  const W  = BAY_W
  const H  = levels * LVL_H
  const D  = RACK_D
  const PH = H + 0.1
  const S  = PILLAR

  const fc   = hovered ? T.frameHov : T.frame
  const sc   = hovered ? T.shelfHov : T.shelf
  const emit = hovered ? 0.22 : 0.0

  const uprightXs = [-W / 2, W / 2]
  const uprightZs = [-D / 2, D / 2]
  const beamYs    = Array.from({ length: levels + 1 }, (_, i) => i * LVL_H)
  const shelfYs   = beamYs.slice(0, -1)

  const rackId   = `R${String(rowIdx + 1).padStart(2, '0')}-S${String(bayIdx + 1).padStart(2, '0')}`
  const capacity = levels * 4

  const onOver = useCallback((e: any) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }, [])
  const onOut = useCallback(() => {
    setHovered(false)
    document.body.style.cursor = 'auto'
  }, [])

  return (
    <group position={position} onPointerOver={onOver} onPointerOut={onOut}>

      {/* 4 corner uprights */}
      {uprightXs.map(x => uprightZs.map(z => (
        <group key={`u${x}${z}`} position={[x, PH / 2, z]}>
          <mesh castShadow>
            <boxGeometry args={[S, PH, S]} />
            <meshStandardMaterial color={fc} metalness={0.65} roughness={0.35}
              emissive={T.frameEdge} emissiveIntensity={emit} />
          </mesh>
          <mesh position={[0, PH / 2 + 0.022, 0]}>
            <boxGeometry args={[S + 0.02, 0.04, S + 0.02]} />
            <meshStandardMaterial color={T.endCap} metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )))}

      {/* horizontal beams */}
      {beamYs.map(y => uprightZs.map(z => (
        <mesh key={`hb${y}${z}`} position={[0, y, z]}>
          <boxGeometry args={[W, 0.05, 0.05]} />
          <meshStandardMaterial color={fc} metalness={0.6} roughness={0.4}
            emissive={T.frameEdge} emissiveIntensity={emit * 0.4} />
        </mesh>
      )))}

      {/* depth connectors */}
      {beamYs.map(y => uprightXs.map(x => (
        <mesh key={`db${y}${x}`} position={[x, y, 0]}>
          <boxGeometry args={[0.04, 0.04, D]} />
          <meshStandardMaterial color={fc} metalness={0.6} roughness={0.4} />
        </mesh>
      )))}

      {/* shelf boards */}
      {shelfYs.map(y => (
        <mesh key={`s${y}`} position={[0, y + 0.018, 0]} receiveShadow>
          <boxGeometry args={[W - 0.04, 0.035, D - 0.07]} />
          <meshStandardMaterial color={sc} roughness={0.88} />
        </mesh>
      ))}

      {/* tooltip */}
      {hovered && (
        <Html position={[0, PH + 0.55, 0]} center distanceFactor={12} zIndexRange={[200, 0]}>
          <div style={{
            background: T.tooltip, color: T.text,
            padding: '10px 14px', borderRadius: 8,
            border: `1px solid ${T.panelBorder}`,
            fontSize: 12, fontFamily: 'monospace',
            pointerEvents: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          }}>
            <div style={{ color: T.accentHov, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              {rackId}
            </div>
            {[
              { l: 'Reihe',     v: rowIdx + 1,          c: T.lbl   },
              { l: 'Segment',   v: bayIdx + 1,           c: T.lbl   },
              { l: 'Ebenen',    v: levels,               c: T.amber },
              { l: 'Kapazität', v: `${capacity} Einh.`,  c: T.green },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, lineHeight: '1.7' }}>
                <span style={{ color: T.textDim }}>{l}</span>
                <span style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── Rack System ──────────────────────────────────────────────────────────────
function RackSystem({ rows, bays, levels, aisleWidth }: {
  rows: number; bays: number; levels: number; aisleWidth: number
}) {
  const rowPitch = RACK_D + aisleWidth
  const totalX   = bays * BAY_W
  const totalZ   = (rows - 1) * rowPitch

  return (
    <group>
      {Array.from({ length: rows }, (_, ri) =>
        Array.from({ length: bays }, (_, bi) => (
          <RackBay
            key={`${ri}-${bi}`}
            position={[
              bi * BAY_W - totalX / 2 + BAY_W / 2,
              0,
              ri * rowPitch - totalZ / 2,
            ]}
            levels={levels}
            rowIdx={ri}
            bayIdx={bi}
          />
        ))
      )}
    </group>
  )
}

// ─── Floor ────────────────────────────────────────────────────────────────────
function Floor({ width, depth }: { width: number; depth: number }) {
  const hw = width / 2
  const hd = depth / 2
  const wallPts = useMemo(() =>
    [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [-hw, 0, -hd]]
      .map(p => new THREE.Vector3(...(p as [number, number, number]))),
    [hw, hd],
  )
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[width + 10, depth + 10]} />
        <meshStandardMaterial color={T.floor} roughness={0.92} />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[width + 10, depth + 10]}
        cellSize={1} cellThickness={0.4} cellColor={T.gridMin}
        sectionSize={5} sectionThickness={1} sectionColor={T.gridMaj}
        fadeDistance={80} fadeStrength={1} infiniteGrid={false}
      />
      <Line points={wallPts} color={T.wall} lineWidth={1.5} />
    </>
  )
}

// ─── Camera Rig ───────────────────────────────────────────────────────────────
function CameraRig({ is2D, warehouseW, warehouseD }: {
  is2D: boolean; warehouseW: number; warehouseD: number
}) {
  const { camera } = useThree()
  const ctrlRef      = useRef<any>()
  const animRef      = useRef(false)
  const tPosRef      = useRef(new THREE.Vector3())
  const tUpRef       = useRef(new THREE.Vector3(0, 1, 0))
  const tZoomRef     = useRef(55)

  const maxDim = Math.max(warehouseW, warehouseD)

  useEffect(() => {
    if (is2D) {
      tPosRef.current  = new THREE.Vector3(0, maxDim * 2.4, 0)
      tUpRef.current   = new THREE.Vector3(0, 0, -1)
      tZoomRef.current = Math.round(480 / maxDim)
    } else {
      tPosRef.current  = new THREE.Vector3(warehouseW * 0.85, maxDim * 0.72, warehouseD * 1.1)
      tUpRef.current   = new THREE.Vector3(0, 1, 0)
      tZoomRef.current = 55
    }
    animRef.current = true
    if (ctrlRef.current) ctrlRef.current.enabled = false
  }, [is2D, warehouseW, warehouseD, maxDim])

  useFrame(() => {
    if (!animRef.current) return
    const S = 0.06
    camera.position.lerp(tPosRef.current, S)
    camera.up.lerp(tUpRef.current, S).normalize()
    camera.zoom = THREE.MathUtils.lerp(camera.zoom, tZoomRef.current, S)
    camera.updateProjectionMatrix()
    if (ctrlRef.current) ctrlRef.current.update()

    if (
      camera.position.distanceTo(tPosRef.current) < 0.12 &&
      Math.abs(camera.zoom - tZoomRef.current) < 0.5
    ) {
      animRef.current = false
      if (ctrlRef.current) ctrlRef.current.enabled = true
    }
  })

  return (
    <OrbitControls
      ref={ctrlRef}
      enableDamping dampingFactor={0.06}
      enableRotate={!is2D}
      maxPolarAngle={is2D ? 0.0001 : Math.PI / 2.05}
      target={[0, 1.2, 0]}
    />
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ is2D, cfg }: { is2D: boolean; cfg: any }) {
  const { warehouseW, warehouseD, rows, bays, levels, aisleWidth } = cfg
  return (
    <>
      <OrthographicCamera makeDefault position={[14, 18, 14]} zoom={55} near={0.1} far={1000} />
      <CameraRig is2D={is2D} warehouseW={warehouseW} warehouseD={warehouseD} />
      <ambientLight intensity={0.55} color="#aac8ff" />
      <directionalLight position={[12, 22, 10]} intensity={1.3} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-25} shadow-camera-right={25}
        shadow-camera-top={25} shadow-camera-bottom={-25} />
      <directionalLight position={[-8, 10, -8]} intensity={0.4} color="#2244bb" />
      <Floor width={warehouseW} depth={warehouseD} />
      <RackSystem rows={rows} bays={bays} levels={levels} aisleWidth={aisleWidth} />
    </>
  )
}

// ─── Controls Panel ───────────────────────────────────────────────────────────
const SLIDERS = [
  { section: 'LAGERHALLE', items: [
    { key: 'warehouseW', label: 'Breite',          min: 10,  max: 60,  step: 1,   unit: 'm' },
    { key: 'warehouseD', label: 'Tiefe',           min: 8,   max: 50,  step: 1,   unit: 'm' },
  ]},
  { section: 'REGAL-LAYOUT', items: [
    { key: 'rows',       label: 'Reihen',          min: 1,   max: 10,  step: 1,   unit: ''  },
    { key: 'bays',       label: 'Spalten / Reihe', min: 1,   max: 14,  step: 1,   unit: ''  },
    { key: 'levels',     label: 'Ebenen',          min: 1,   max: 8,   step: 1,   unit: ''  },
    { key: 'aisleWidth', label: 'Gangbreite',      min: 0.8, max: 4.0, step: 0.1, unit: 'm' },
  ]},
]

function ControlsPanel({ is2D, setIs2D, cfg, setCfg, onBack }: any) {
  const upd = useCallback((k: string, v: string) =>
    setCfg((p: any) => ({ ...p, [k]: parseFloat(v) })), [setCfg])

  const totalRacks = cfg.rows * cfg.bays
  const totalCap   = totalRacks * cfg.levels * 4
  const area       = (cfg.warehouseW * cfg.warehouseD).toFixed(0)

  return (
    <div style={{
      position: 'absolute', top: 16, left: 16, width: 255, zIndex: 10,
      background: T.panel, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      border: `1px solid ${T.panelBorder}`, borderRadius: 12,
      padding: '18px 16px', color: T.text,
      fontFamily: 'system-ui,-apple-system,sans-serif', fontSize: 13, userSelect: 'none',
    }}>
      {/* header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Lager 3D Visualizer</div>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
          Parametrische 2D / 3D Lagerplanung
        </div>
      </div>

      {/* 2D / 3D toggle */}
      <div style={{ display: 'flex', gap: 4, background: '#08121e', borderRadius: 8, padding: 4, marginBottom: 18 }}>
        {[{ l: '⬛ 2D Grundriss', v: true }, { l: '🧊 3D Ansicht', v: false }].map(({ l, v }) => (
          <button key={l} onClick={() => setIs2D(v)} style={{
            flex: 1, padding: '7px 4px', borderRadius: 6, border: 'none',
            cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: is2D === v ? T.accent : 'transparent',
            color: is2D === v ? '#fff' : T.textDim,
            transition: 'all 0.2s',
          }}>{l}</button>
        ))}
      </div>

      {/* sliders */}
      {SLIDERS.map(({ section, items }) => (
        <div key={section} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: T.textDim, textTransform: 'uppercase', marginBottom: 10 }}>
            {section}
          </div>
          {items.map(({ key, label, min, max, step, unit }) => {
            const val = cfg[key]
            const fmt = Number.isInteger(val) ? val : val.toFixed(1)
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: T.lbl }}>{label}</span>
                  <span style={{ color: T.accent, fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
                    {fmt}{unit}
                  </span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => upd(key, e.target.value)}
                  style={{ width: '100%', accentColor: T.accent, cursor: 'pointer', height: 4 }} />
              </div>
            )
          })}
        </div>
      ))}

      {/* stats */}
      <div style={{ borderTop: `1px solid ${T.panelBorder}`, paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        {[
          { l: 'Regale',    v: totalRacks,       c: T.accentHov },
          { l: 'Kapazität', v: String(totalCap), c: T.green },
          { l: 'Fläche',    v: `${area} m²`,     c: T.amber },
          { l: 'Ansicht',   v: is2D ? '2D' : '3D', c: T.lbl },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: '#08121e', borderRadius: 7, padding: '7px 10px', border: `1px solid ${T.panelBorder}` }}>
            <div style={{ color: T.textDim, fontSize: 10, marginBottom: 3 }}>{l}</div>
            <div style={{ color: c, fontWeight: 700, fontSize: 14 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, color: T.textDim, fontSize: 10, textAlign: 'center' }}>
        Hover über Regale für Details
      </div>
    </div>
  )
}

// ─── Default Export ───────────────────────────────────────────────────────────
export default function VisualizerCanvas({ onBack }: { onBack?: () => void }) {
  const [is2D, setIs2D] = useState(false)
  const [cfg, setCfg]   = useState({
    warehouseW: 32, warehouseD: 22,
    rows: 4, bays: 6, levels: 4, aisleWidth: 1.5,
  })

  return (
    <div style={{ width: '100%', height: '100%', background: T.bg, position: 'relative' }}>
      {/* back button */}
      <button onClick={onBack} style={{
        position: 'absolute', top: 16, right: 16, zIndex: 20,
        background: T.panel, border: `1px solid ${T.panelBorder}`,
        borderRadius: 8, padding: '8px 16px',
        color: T.text, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', backdropFilter: 'blur(10px)',
      }}>
        ← Zurück
      </button>

      {/* R3F canvas */}
      <Canvas shadows gl={{ antialias: true }} dpr={[1, 2]}
        style={{ width: '100%', height: '100%' }}>
        <color attach="background" args={[T.bg]} />
        <Scene is2D={is2D} cfg={cfg} />
      </Canvas>

      {/* control panel */}
      <ControlsPanel
        is2D={is2D} setIs2D={setIs2D}
        cfg={cfg} setCfg={setCfg}
        onBack={onBack}
      />
    </div>
  )
}
