/**
 * WarehouseVisualizer — Parametric 2D/3D Warehouse Layout
 * Requires: three, @react-three/fiber, @react-three/drei
 */

import React, {
  useState, useRef, useEffect, useMemo, useCallback,
} from 'react'
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'

// ─── Web-only: React Three Fiber & Drei ───────────────────────────────────────
let Canvas: any, useFrame: any, useThree: any,
  OrthographicCamera: any, OrbitControls: any,
  Html: any, Grid: any, Line: any, THREE: any

if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fiber = require('@react-three/fiber')
  Canvas    = fiber.Canvas
  useFrame  = fiber.useFrame
  useThree  = fiber.useThree
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const drei = require('@react-three/drei')
  OrthographicCamera = drei.OrthographicCamera
  OrbitControls      = drei.OrbitControls
  Html               = drei.Html
  Grid               = drei.Grid
  Line               = drei.Line
  THREE = require('three')
}

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

// ─── Physical constants (metres) ──────────────────────────────────────────────
const BAY_W  = 1.2
const RACK_D = 0.8
const LVL_H  = 0.5
const PILLAR = 0.065

// ─────────────────────────────────────────────────────────────────────────────
// 3-D COMPONENTS  (only rendered on web)
// ─────────────────────────────────────────────────────────────────────────────

function RackBay({ position, levels, rowIdx, bayIdx }: any) {
  const [hovered, setHovered] = useState(false)

  const W  = BAY_W
  const H  = levels * LVL_H
  const D  = RACK_D
  const PH = H + 0.1
  const S  = PILLAR

  const fc   = hovered ? T.frameHov : T.frame
  const sc   = hovered ? T.shelfHov : T.shelf
  const emit = hovered ? 0.22 : 0.0

  const uprightXs = useMemo(() => [-W / 2, W / 2], [W])
  const uprightZs = useMemo(() => [-D / 2, D / 2], [D])
  const beamYs    = useMemo(
    () => Array.from({ length: levels + 1 }, (_: any, i: number) => i * LVL_H),
    [levels],
  )
  const shelfYs = useMemo(() => beamYs.slice(0, -1), [beamYs])

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
      {uprightXs.map((x: number) => uprightZs.map((z: number) => (
        <group key={`u${x}${z}`} position={[x, PH / 2, z]}>
          <mesh castShadow>
            <boxGeometry args={[S, PH, S]} />
            <meshStandardMaterial
              color={fc} metalness={0.65} roughness={0.35}
              emissive={T.frameEdge} emissiveIntensity={emit}
            />
          </mesh>
          {/* silver end cap */}
          <mesh position={[0, PH / 2 + 0.022, 0]}>
            <boxGeometry args={[S + 0.02, 0.04, S + 0.02]} />
            <meshStandardMaterial color={T.endCap} metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )))}

      {/* horizontal beams – front + back, every level */}
      {beamYs.map((y: number) => uprightZs.map((z: number) => (
        <mesh key={`hb${y}${z}`} position={[0, y, z]}>
          <boxGeometry args={[W, 0.05, 0.05]} />
          <meshStandardMaterial
            color={fc} metalness={0.6} roughness={0.4}
            emissive={T.frameEdge} emissiveIntensity={emit * 0.4}
          />
        </mesh>
      )))}

      {/* depth connectors */}
      {beamYs.map((y: number) => uprightXs.map((x: number) => (
        <mesh key={`db${y}${x}`} position={[x, y, 0]}>
          <boxGeometry args={[0.04, 0.04, D]} />
          <meshStandardMaterial color={fc} metalness={0.6} roughness={0.4} />
        </mesh>
      )))}

      {/* shelf boards */}
      {shelfYs.map((y: number) => (
        <mesh key={`s${y}`} position={[0, y + 0.018, 0]} receiveShadow>
          <boxGeometry args={[W - 0.04, 0.035, D - 0.07]} />
          <meshStandardMaterial color={sc} roughness={0.88} />
        </mesh>
      ))}

      {/* hover tooltip */}
      {hovered && Html && (
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
            <TipRow label="Reihe"     value={rowIdx + 1} />
            <TipRow label="Segment"   value={bayIdx + 1} />
            <TipRow label="Ebenen"    value={levels}     color={T.amber} />
            <TipRow label="Kapazität" value={`${capacity} Einh.`} color={T.green} />
          </div>
        </Html>
      )}
    </group>
  )
}

function TipRow({ label, value, color = T.lbl }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, lineHeight: '1.7' }}>
      <span style={{ color: T.textDim }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}

function RackSystem({ rows, bays, levels, aisleWidth }: any) {
  const rowPitch = RACK_D + aisleWidth
  const totalX   = bays * BAY_W
  const totalZ   = (rows - 1) * rowPitch
  return (
    <group>
      {Array.from({ length: rows }, (_: any, ri: number) =>
        Array.from({ length: bays }, (_: any, bi: number) => (
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

function Floor({ width, depth }: any) {
  const hw = width / 2
  const hd = depth / 2
  const wallPts = useMemo(() =>
    [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [-hw, 0, -hd]]
      .map((p: any) => new THREE.Vector3(...p)),
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
        sectionSize={5} sectionThickness={1.0} sectionColor={T.gridMaj}
        fadeDistance={80} fadeStrength={1} infiniteGrid={false}
      />
      <Line points={wallPts} color={T.wall} lineWidth={1.5} />
    </>
  )
}

function CameraRig({ is2D, warehouseW, warehouseD }: any) {
  const { camera } = useThree()
  const controlsRef  = useRef<any>()
  const animRef      = useRef(false)
  const targetPosRef = useRef(new THREE.Vector3())
  const targetUpRef  = useRef(new THREE.Vector3(0, 1, 0))
  const targetZoomRef = useRef(55)

  const maxDim = Math.max(warehouseW, warehouseD)

  useEffect(() => {
    if (is2D) {
      targetPosRef.current   = new THREE.Vector3(0, maxDim * 2.4, 0)
      targetUpRef.current    = new THREE.Vector3(0, 0, -1)
      targetZoomRef.current  = Math.round(480 / maxDim)
    } else {
      targetPosRef.current   = new THREE.Vector3(warehouseW * 0.85, maxDim * 0.72, warehouseD * 1.1)
      targetUpRef.current    = new THREE.Vector3(0, 1, 0)
      targetZoomRef.current  = 55
    }
    animRef.current = true
    if (controlsRef.current) controlsRef.current.enabled = false
  }, [is2D, warehouseW, warehouseD, maxDim])

  useFrame(() => {
    if (!animRef.current) return
    const S = 0.055
    camera.position.lerp(targetPosRef.current, S)
    camera.up.lerp(targetUpRef.current, S).normalize()
    camera.zoom = THREE.MathUtils.lerp(camera.zoom, targetZoomRef.current, S)
    camera.updateProjectionMatrix()
    if (controlsRef.current) controlsRef.current.update()
    if (
      camera.position.distanceTo(targetPosRef.current) < 0.12 &&
      Math.abs(camera.zoom - targetZoomRef.current) < 0.5
    ) {
      animRef.current = false
      if (controlsRef.current) controlsRef.current.enabled = true
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping dampingFactor={0.06}
      enableRotate={!is2D}
      maxPolarAngle={is2D ? 0.0001 : Math.PI / 2.05}
      target={[0, 1.2, 0]}
    />
  )
}

function WarehouseScene({ is2D, cfg }: any) {
  const { warehouseW, warehouseD, rows, bays, levels, aisleWidth } = cfg
  return (
    <>
      <OrthographicCamera makeDefault position={[14, 18, 14]} zoom={55} near={0.1} far={1000} />
      <CameraRig is2D={is2D} warehouseW={warehouseW} warehouseD={warehouseD} />
      <ambientLight intensity={0.55} color="#aac8ff" />
      <directionalLight
        position={[12, 22, 10]} intensity={1.3} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-25} shadow-camera-right={25}
        shadow-camera-top={25}   shadow-camera-bottom={-25}
      />
      <directionalLight position={[-8, 10, -8]} intensity={0.4} color="#2244bb" />
      <Floor width={warehouseW} depth={warehouseD} />
      <RackSystem rows={rows} bays={bays} levels={levels} aisleWidth={aisleWidth} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// UI PANEL
// ─────────────────────────────────────────────────────────────────────────────

const SLIDERS = [
  {
    section: 'LAGERHALLE', items: [
      { key: 'warehouseW', label: 'Breite',     min: 10, max: 60, step: 1,   unit: 'm' },
      { key: 'warehouseD', label: 'Tiefe',      min: 8,  max: 50, step: 1,   unit: 'm' },
    ],
  },
  {
    section: 'REGAL-LAYOUT', items: [
      { key: 'rows',       label: 'Reihen',         min: 1,   max: 10,  step: 1,   unit: '' },
      { key: 'bays',       label: 'Spalten / Reihe', min: 1,   max: 14,  step: 1,   unit: '' },
      { key: 'levels',     label: 'Ebenen',         min: 1,   max: 8,   step: 1,   unit: '' },
      { key: 'aisleWidth', label: 'Gangbreite',     min: 0.8, max: 4.0, step: 0.1, unit: 'm' },
    ],
  },
]

function ControlsUI({ is2D, setIs2D, cfg, setCfg }: any) {
  const update = useCallback((key: string, val: string) =>
    setCfg((prev: any) => ({ ...prev, [key]: parseFloat(val) })), [setCfg])

  const totalRacks = cfg.rows * cfg.bays
  const totalCap   = totalRacks * cfg.levels * 4
  const floorArea  = (cfg.warehouseW * cfg.warehouseD).toFixed(0)

  return (
    <div style={{
      position: 'absolute', top: 16, left: 16,
      width: 255,
      background: T.panel,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: `1px solid ${T.panelBorder}`,
      borderRadius: 12,
      padding: '18px 16px',
      color: T.text,
      fontFamily: 'system-ui,-apple-system,sans-serif',
      fontSize: 13,
      userSelect: 'none',
      zIndex: 10,
    }}>

      {/* header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.02em' }}>
          Lager 3D Visualizer
        </div>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
          Parametrische 2D / 3D Lagerplanung
        </div>
      </div>

      {/* 2D / 3D toggle */}
      <div style={{
        display: 'flex', gap: 4,
        background: '#08121e', borderRadius: 8, padding: 4,
        marginBottom: 18,
      }}>
        {[
          { label: '⬛ 2D Grundriss', val: true  },
          { label: '🧊 3D Ansicht',   val: false },
        ].map(({ label, val }) => {
          const active = is2D === val
          return (
            <button key={label} onClick={() => setIs2D(val)} style={{
              flex: 1, padding: '7px 4px',
              borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              background: active ? T.accent : 'transparent',
              color: active ? '#fff' : T.textDim,
              transition: 'all 0.2s',
            }}>
              {label}
            </button>
          )
        })}
      </div>

      {/* sliders */}
      {SLIDERS.map(({ section, items }) => (
        <div key={section} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            color: T.textDim, textTransform: 'uppercase', marginBottom: 10,
          }}>
            {section}
          </div>
          {items.map(({ key, label, min, max, step, unit }) => {
            const val  = cfg[key]
            const fmt  = Number.isInteger(val) ? val : val.toFixed(1)
            return (
              <div key={key} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ color: T.lbl }}>{label}</span>
                  <span style={{ color: T.accent, fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
                    {fmt}{unit}
                  </span>
                </div>
                <input
                  type="range" min={min} max={max} step={step} value={val}
                  onChange={e => update(key, e.target.value)}
                  style={{ width: '100%', accentColor: T.accent, cursor: 'pointer', height: 4 }}
                />
              </div>
            )
          })}
        </div>
      ))}

      {/* stats */}
      <div style={{
        borderTop: `1px solid ${T.panelBorder}`, paddingTop: 12,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7,
      }}>
        {[
          { label: 'Regale',    value: totalRacks,        color: T.accentHov },
          { label: 'Kapazität', value: String(totalCap),  color: T.green },
          { label: 'Fläche',    value: `${floorArea} m²`, color: T.amber },
          { label: 'Ansicht',   value: is2D ? '2D' : '3D', color: T.lbl },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: '#08121e', borderRadius: 7,
            padding: '7px 10px',
            border: `1px solid ${T.panelBorder}`,
          }}>
            <div style={{ color: T.textDim, fontSize: 10, marginBottom: 3 }}>{label}</div>
            <div style={{ color, fontWeight: 700, fontSize: 14 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, color: T.textDim, fontSize: 10, textAlign: 'center' }}>
        Hover über Regale für Details
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function Warehouse3DScreen() {
  const [is2D, setIs2D] = useState(false)
  const [cfg, setCfg]   = useState({
    warehouseW:  32,
    warehouseD:  22,
    rows:        4,
    bays:        6,
    levels:      4,
    aisleWidth:  1.5,
  })

  // Fallback for non-web platforms
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackIcon}>🧊</Text>
        <Text style={styles.fallbackTitle}>3D Visualizer</Text>
        <Text style={styles.fallbackSub}>
          Diese Funktion ist nur im Browser verfügbar.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Zurück</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: T.bg, position: 'relative' }}>

      {/* back button */}
      <button
        onClick={() => router.back()}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: T.panel, border: `1px solid ${T.panelBorder}`,
          borderRadius: 8, padding: '8px 14px',
          color: T.text, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', zIndex: 20,
          backdropFilter: 'blur(10px)',
        }}
      >
        ← Zurück
      </button>

      {/* 3D canvas */}
      <Canvas
        shadows
        gl={{ antialias: true }}
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[T.bg]} />
        <WarehouseScene is2D={is2D} cfg={cfg} />
      </Canvas>

      {/* control panel */}
      <ControlsUI is2D={is2D} setIs2D={setIs2D} cfg={cfg} setCfg={setCfg} />
    </div>
  )
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0d1720', gap: 12,
  },
  fallbackIcon:  { fontSize: 48 },
  fallbackTitle: { fontSize: 22, fontWeight: '700', color: '#e2e8f0' },
  fallbackSub:   { fontSize: 15, color: '#64748b', textAlign: 'center', paddingHorizontal: 32 },
  backBtn: {
    marginTop: 16, backgroundColor: '#1d4ed8',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
  },
  backBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
