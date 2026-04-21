import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform,
} from 'react-native'
import { router } from 'expo-router'
import apiService from '../../services/apiService'

// Metro picks VisualizerCanvas.web.tsx on web, VisualizerCanvas.tsx on native
import VisualizerCanvas from './VisualizerCanvas'
// Data-driven 3D visualizer (uses real storage zone data)
import { WarehouseVisualizer3D } from '../../components/warehouse'

type ViewMode = 'planer' | 'live'

export default function Warehouse3DScreen() {
  const [mode, setMode] = useState<ViewMode>('planer')
  const [zones, setZones] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadZones = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiService.get<any[]>('/api/storage-zones', { showErrorAlert: false })
      setZones(data ?? [])
    } catch {
      setError('Lagerdaten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode === 'live') loadZones()
  }, [mode, loadZones])

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lager 3D</Text>
        {/* Tab toggle */}
        <View style={styles.tabs}>
          {(['planer', 'live'] as ViewMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.tab, mode === m && styles.tabActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                {m === 'planer' ? '🧊 Planer' : '📦 Live'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.canvas}>
        {mode === 'planer' ? (
          // Parametric planner — web-only via VisualizerCanvas.web.tsx
          Platform.OS === 'web' ? (
            <div style={{ width: '100%', height: '100%' }}>
              <VisualizerCanvas />
            </div>
          ) : (
            <View style={styles.center}>
              <Text style={styles.hint}>3D-Ansicht nur im Browser verfügbar.</Text>
            </View>
          )
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#488fe0" />
            <Text style={styles.hint}>Lade Lagerdaten…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadZones} style={styles.retryBtn}>
              <Text style={styles.retryText}>Erneut versuchen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WarehouseVisualizer3D
            config={{ blocks: zones.length || 4, levels: 4, spotsPerLevel: 6 }}
            data={zones}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0d1720' },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                   paddingTop: 50, paddingBottom: 12, backgroundColor: '#111b2a',
                   borderBottomWidth: 1, borderBottomColor: '#1d3a5c' },
  backBtn:       { paddingRight: 12 },
  backText:      { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  title:         { flex: 1, color: '#e2e8f0', fontSize: 17, fontWeight: '700' },
  tabs:          { flexDirection: 'row', gap: 4 },
  tab:           { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                   backgroundColor: '#08121e' },
  tabActive:     { backgroundColor: '#3b82f6' },
  tabText:       { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  canvas:        { flex: 1 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hint:          { color: '#64748b', fontSize: 14 },
  errorText:     { color: '#FF453A', fontSize: 14 },
  retryBtn:      { backgroundColor: '#1d3a5c', paddingHorizontal: 20, paddingVertical: 10,
                   borderRadius: 8 },
  retryText:     { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
})
