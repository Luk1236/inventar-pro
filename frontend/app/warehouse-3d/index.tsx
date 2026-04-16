import React from 'react'
import { router } from 'expo-router'
// Metro wählt automatisch VisualizerCanvas.web.tsx im Browser
// und VisualizerCanvas.tsx auf nativen Plattformen
import VisualizerCanvas from './VisualizerCanvas'

export default function Warehouse3DScreen() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <VisualizerCanvas onBack={() => router.back()} />
    </div>
  )
}
