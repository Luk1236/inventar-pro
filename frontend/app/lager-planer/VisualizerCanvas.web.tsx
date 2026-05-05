/**
 * WarehouseVisualizer — Parametric 2D/3D Warehouse Layout (Web only)
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrthographicCamera, OrbitControls, Html, Grid, Line,
} from '@react-three/drei'
import * as THREE from 'three'

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          '#080f1c',
  floor:       '#0c1929',
  gridMaj:     '#1e4070',
  gridMin:     '#0f1e34',
  wall:        '#2e7ab8',
  frame:       '#1c5a94',
  frameHov:    '#3aacde',
  frameEdge:   '#4cbcf5',
  shelf:       '#c9a97c',
  shelfHov:    '#e0be93',
  endCap:      '#8fa5b8',
  panel:       'rgba(5,12,26,0.97)',
  panelBorder: 'rgba(59,130,246,0.22)',
  text:        '#e8edf5',
  textDim:     '#4e6a85',
  accent:      '#3b82f6',
  accentHov:   '#60a5fa',
  accentDim:   'rgba(59,130,246,0.15)',
  lbl:         '#7a9ab8',
  green:       '#22d370',
  greenDim:    'rgba(34,211,112,0.14)',
  amber:       '#f5b80b',
  amberDim:    'rgba(245,184,11,0.14)',
  tooltip:     '#040c1e',
  divider:     'rgba(255,255,255,0.07)',
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
  const emit = hovered ? 0.28 : 0.0

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
            <meshStandardMaterial color={fc} metalness={0.72} roughness={0.28}
              emissive={T.frameEdge} emissiveIntensity={emit} />
          </mesh>
          <mesh position={[0, PH / 2 + 0.022, 0]}>
            <boxGeometry args={[S + 0.02, 0.04, S + 0.02]} />
            <meshStandardMaterial color={T.endCap} metalness={0.85} roughness={0.18} />
          </mesh>
        </group>
      )))}

      {/* horizontal beams */}
      {beamYs.map(y => uprightZs.map(z => (
        <mesh key={`hb${y}${z}`} position={[0, y, z]}>
          <boxGeometry args={[W, 0.05, 0.05]} />
          <meshStandardMaterial color={fc} metalness={0.65} roughness={0.35}
            emissive={T.frameEdge} emissiveIntensity={emit * 0.4} />
        </mesh>
      )))}

      {/* depth connectors */}
      {beamYs.map(y => uprightXs.map(x => (
        <mesh key={`db${y}${x}`} position={[x, y, 0]}>
          <boxGeometry args={[0.04, 0.04, D]} />
          <meshStandardMaterial color={fc} metalness={0.65} roughness={0.35} />
        </mesh>
      )))}

      {/* shelf boards */}
      {shelfYs.map(y => (
        <mesh key={`s${y}`} position={[0, y + 0.018, 0]} receiveShadow>
          <boxGeometry args={[W - 0.04, 0.038, D - 0.07]} />
          <meshStandardMaterial color={sc} roughness={0.82} metalness={0.04} />
        </mesh>
      ))}

      {/* glow ring when hovered */}
      {hovered && (
        <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.72, 32]} />
          <meshBasicMaterial color={T.accentHov} transparent opacity={0.18} />
        </mesh>
      )}

      {/* tooltip */}
      {hovered && (
        <Html position={[0, PH + 0.55, 0]} center distanceFactor={12} zIndexRange={[200, 0]}>
          <div style={{
            background: 'rgba(4,12,30,0.97)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            color: T.text,
            padding: '12px 16px', borderRadius: 10,
            border: '1px solid rgba(59,130,246,0.28)',
            fontSize: 12, fontFamily: 'system-ui,-apple-system,sans-serif',
            pointerEvents: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
          }}>
            <div style={{
              color: T.accentHov, fontWeight: 700, fontSize: 13, marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 10, opacity: 0.6 }}>▪</span>
              {rackId}
            </div>
            <div style={{ width: '100%', height: 1, background: T.divider, marginBottom: 8 }} />
            {[
              { l: 'Reihe',     v: rowIdx + 1,          c: T.lbl,   },
              { l: 'Segment',   v: bayIdx + 1,           c: T.lbl,   },
              { l: 'Ebenen',    v: levels,               c: T.amber, },
              { l: 'Kapazität', v: `${capacity} Einh.`,  c: T.green, },
            ].map(({ l, v, c }) => (
              <div key={l} style={{
                display: 'flex', justifyContent: 'space-between',
                gap: 20, lineHeight: '1.75', alignItems: 'center',
              }}>
                <span style={{ color: T.textDim, fontSize: 11 }}>{l}</span>
                <span style={{ color: c, fontWeight: 700, fontSize: 12 }}>{v}</span>
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
        <planeGeometry args={[width + 12, depth + 12]} />
        <meshStandardMaterial color={T.floor} roughness={0.94} metalness={0.06} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[width + 12, depth + 12]}
        cellSize={1} cellThickness={0.5} cellColor={T.gridMin}
        sectionSize={5} sectionThickness={1.2} sectionColor={T.gridMaj}
        fadeDistance={90} fadeStrength={1.2} infiniteGrid={false}
      />
      <Line points={wallPts} color={T.wall} lineWidth={2} />
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
      enableDamping dampingFactor={0.055}
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

      {/* Lighting */}
      <ambientLight intensity={0.5} color="#9ab8e8" />
      <directionalLight
        position={[14, 24, 12]} intensity={1.4} castShadow
        color="#ffffff"
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
      />
      {/* Cool fill from opposite side */}
      <directionalLight position={[-10, 8, -10]} intensity={0.35} color="#1a3aaa" />
      {/* Warm rim light from front */}
      <directionalLight position={[0, 4, 20]} intensity={0.18} color="#4488ff" />

      <Floor width={warehouseW} depth={warehouseD} />
      <RackSystem rows={rows} bays={bays} levels={levels} aisleWidth={aisleWidth} />
      <fog attach="fog" args={[T.bg, 60, 120]} />
    </>
  )
}

// ─── Controls Panel ───────────────────────────────────────────────────────────
const SLIDERS = [
  { section: 'Lagerhalle', icon: '🏭', items: [
    { key: 'warehouseW', label: 'Breite',          min: 10,  max: 60,  step: 1,   unit: 'm' },
    { key: 'warehouseD', label: 'Tiefe',           min: 8,   max: 50,  step: 1,   unit: 'm' },
  ]},
  { section: 'Regal-Layout', icon: '📦', items: [
    { key: 'rows',       label: 'Reihen',          min: 1,   max: 10,  step: 1,   unit: ''  },
    { key: 'bays',       label: 'Spalten / Reihe', min: 1,   max: 14,  step: 1,   unit: ''  },
    { key: 'levels',     label: 'Ebenen',          min: 1,   max: 8,   step: 1,   unit: ''  },
    { key: 'aisleWidth', label: 'Gangbreite',      min: 0.8, max: 4.0, step: 0.1, unit: 'm' },
  ]},
]

const sliderCSS = `
  .ws-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 3px; outline: none; cursor: pointer; border-radius: 2px; background: rgba(255,255,255,0.08); }
  .ws-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #3b82f6; border: 2px solid rgba(96,165,250,0.6); box-shadow: 0 0 6px rgba(59,130,246,0.5); cursor: pointer; }
  .ws-slider::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #3b82f6; border: 2px solid rgba(96,165,250,0.6); cursor: pointer; }
  .ws-slider::-webkit-slider-runnable-track { height: 3px; border-radius: 2px; }
`

function ControlsPanel({ is2D, setIs2D, cfg, setCfg }: any) {
  const upd = useCallback((k: string, v: string) =>
    setCfg((p: any) => ({ ...p, [k]: parseFloat(v) })), [setCfg])

  const totalRacks = cfg.rows * cfg.bays
  const totalCap   = totalRacks * cfg.levels * 4
  const area       = (cfg.warehouseW * cfg.warehouseD).toFixed(0)

  return (
    <>
      <style>{sliderCSS}</style>
      <div style={{
        position: 'absolute', top: 16, left: 16, width: 268, zIndex: 10,
        background: T.panel,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${T.panelBorder}`,
        borderRadius: 14,
        overflow: 'hidden',
        color: T.text,
        fontFamily: 'system-ui,-apple-system,sans-serif',
        fontSize: 13, userSelect: 'none',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
      }}>

        {/* Panel header */}
        <div style={{
          padding: '14px 16px 12px',
          background: 'linear-gradient(135deg, rgba(30,64,148,0.4) 0%, rgba(12,24,50,0) 100%)',
          borderBottom: `1px solid ${T.divider}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'rgba(59,130,246,0.2)',
              border: '1px solid rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>🏗</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Lager 3D Visualizer</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>Parametrische Lagerplanung</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 16px' }}>

          {/* 2D / 3D toggle */}
          <div style={{
            display: 'flex', gap: 3,
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 9, padding: 3,
            marginBottom: 18,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {[
              { l: '⬛ 2D Grundriss', v: true  },
              { l: '🧊 3D Ansicht',   v: false },
            ].map(({ l, v }) => (
              <button key={l} onClick={() => setIs2D(v)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 7, border: 'none',
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: is2D === v
                  ? 'linear-gradient(135deg,#2563eb,#1d4ed8)'
                  : 'transparent',
                color: is2D === v ? '#fff' : T.textDim,
                transition: 'all 0.18s',
                boxShadow: is2D === v ? '0 2px 8px rgba(37,99,235,0.4)' : 'none',
              }}>{l}</button>
            ))}
          </div>

          {/* sliders */}
          {SLIDERS.map(({ section, icon, items }) => (
            <div key={section} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 11,
              }}>
                <span style={{ fontSize: 11 }}>{icon}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.1em', color: T.lbl,
                  textTransform: 'uppercase',
                }}>{section}</span>
                <div style={{ flex: 1, height: 1, background: T.divider }} />
              </div>

              {items.map(({ key, label, min, max, step, unit }) => {
                const val = cfg[key]
                const pct = ((val - min) / (max - min)) * 100
                const fmt = Number.isInteger(val) ? val : val.toFixed(1)
                return (
                  <div key={key} style={{ marginBottom: 13 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 6,
                    }}>
                      <span style={{ color: T.lbl, fontSize: 12 }}>{label}</span>
                      <span style={{
                        color: T.accent, fontWeight: 700,
                        fontFamily: 'ui-monospace,monospace', fontSize: 12,
                        background: T.accentDim,
                        padding: '1px 7px', borderRadius: 5,
                        border: '1px solid rgba(59,130,246,0.2)',
                      }}>
                        {fmt}{unit}
                      </span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        position: 'absolute', top: '50%', left: 0,
                        transform: 'translateY(-50%)',
                        width: `${pct}%`, height: 3,
                        background: 'linear-gradient(90deg,#1d4ed8,#3b82f6)',
                        borderRadius: 2, pointerEvents: 'none',
                        transition: 'width 0.08s',
                      }} />
                      <input
                        className="ws-slider"
                        type="range" min={min} max={max} step={step} value={val}
                        onChange={e => upd(key, e.target.value)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* stats */}
          <div style={{
            borderTop: `1px solid ${T.divider}`,
            paddingTop: 13,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
          }}>
            {[
              { l: 'Regale',    v: totalRacks,          c: T.accentHov, bg: T.accentDim,  border: 'rgba(59,130,246,0.2)' },
              { l: 'Kapazität', v: String(totalCap),    c: T.green,     bg: T.greenDim,   border: 'rgba(34,211,112,0.2)' },
              { l: 'Fläche',    v: `${area} m²`,        c: T.amber,     bg: T.amberDim,   border: 'rgba(245,184,11,0.2)'  },
              { l: 'Ansicht',   v: is2D ? '2D' : '3D',  c: T.lbl,       bg: 'rgba(255,255,255,0.04)', border: T.divider },
            ].map(({ l, v, c, bg, border }) => (
              <div key={l} style={{
                background: bg,
                borderRadius: 8, padding: '8px 10px',
                border: `1px solid ${border}`,
              }}>
                <div style={{ color: T.textDim, fontSize: 10, marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{l}</div>
                <div style={{ color: c, fontWeight: 700, fontSize: 15, fontFamily: 'ui-monospace,monospace' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 11, color: T.textDim,
            fontSize: 10, textAlign: 'center',
            letterSpacing: '0.02em',
          }}>
            Hover über Regale für Details
          </div>
        </div>
      </div>
    </>
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

      {/* R3F canvas */}
      <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }} dpr={[1, 2]}
        style={{ width: '100%', height: '100%' }}>
        <color attach="background" args={[T.bg]} />
        <Scene is2D={is2D} cfg={cfg} />
      </Canvas>

      {/* control panel */}
      <ControlsPanel
        is2D={is2D} setIs2D={setIs2D}
        cfg={cfg} setCfg={setCfg}
      />
    </div>
  )
}
