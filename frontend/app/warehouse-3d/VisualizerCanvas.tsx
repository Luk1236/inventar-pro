// Native fallback — R3F braucht einen Browser
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export default function VisualizerCanvas() {
  return (
    <View style={s.wrap}>
      <Text style={s.icon}>🧊</Text>
      <Text style={s.title}>3D Visualizer</Text>
      <Text style={s.sub}>Nur im Browser verfügbar.</Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1720', gap: 10 },
  icon:  { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '700', color: '#e2e8f0' },
  sub:   { fontSize: 14, color: '#64748b' },
})
