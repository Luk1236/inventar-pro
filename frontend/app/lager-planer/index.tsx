import React, { useState, useEffect, useCallback, Suspense } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import apiService from '../../services/apiService';

// Lazy load the web-only components
const Planner2D = Platform.OS === 'web' ? React.lazy(() => import('./Planner2D')) : null;
const Planner3D = Platform.OS === 'web' ? React.lazy(() => import('./Planner3D')) : null;

export type LayoutItem = {
  id: string;
  type: 'rack' | 'cantilever' | 'shelf' | 'zone' | 'door' | 'pallet' | 'table' | 'pillar' | 'forklift' | 'palletjack' | 'conveyor' | 'office' | 'ramp' | 'rolldoor' | 'stairs' | 'wirebox' | 'cablerack' | 'hazmat' | 'dolly' | 'scissorlift' | 'workbench' | 'charging' | 'trash' | 'fireext' | 'dangerzone' | 'flightcase' | 'wirecart' | 'ibc' | 'wall';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  label: string;
  levels?: number;
  spots?: number;
  color?: string;
};

export type LayoutState = {
  grid: { width: number; height: number };
  items: LayoutItem[];
};

export type StockMappingItem = {
  article_id: string;
  rack_id: string;
  level: number;
  spot: number;
  quantity: number;
};

export type StockState = {
  mapping: StockMappingItem[];
};

type ViewMode = '2d' | '3d';

export default function WarehousePlannerScreen() {
  const [mode, setMode] = useState<ViewMode>('2d');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickRoute, setPickRoute] = useState<string[]>([]);
  const [layout, setLayout] = useState<LayoutState>({
    grid: { width: 40, height: 30 },
    items: [],
  });
  const [stock, setStock] = useState<StockState>({ mapping: [] });
  const [articles, setArticles] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [layoutData, stockData, articlesData] = await Promise.all([
        apiService.get<LayoutState>('/api/warehouse-layout/main', { showErrorAlert: false }).catch(() => null),
        apiService.get<StockState>('/api/warehouse-stock/main', { showErrorAlert: false }).catch(() => null),
        apiService.get<any[]>('/api/articles', { showErrorAlert: false }).catch(() => [])
      ]);
      
      if (layoutData && layoutData.grid && layoutData.items) setLayout(layoutData);
      if (stockData && stockData.mapping) setStock(stockData);
      if (articlesData) setArticles(articlesData);
    } catch (e) {
      console.log('Could not load warehouse data.', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const printLabels = () => {
    // Generate HTML for labels
    let html = `
      <html>
      <head>
        <title>Regal-Etiketten</title>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 20px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .label { border: 2px dashed #000; padding: 15px; text-align: center; border-radius: 8px; page-break-inside: avoid; }
          .title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .subtitle { font-size: 14px; color: #555; margin-bottom: 15px; }
          img { width: 150px; height: 150px; }
          @media print { .grid { grid-template-columns: repeat(3, 1fr); gap: 10mm; } }
        </style>
      </head>
      <body>
        <h1>Inventar Pro - Lager-Etiketten</h1>
        <div class="grid">
    `;

    layout.items.filter(it => ['rack', 'cantilever', 'shelf', 'cablerack'].includes(it.type)).forEach(rack => {
      const levels = rack.levels || 4;
      const spots = rack.spots || 4;
      for (let l = 1; l <= levels; l++) {
        for (let s = 1; s <= spots; s++) {
          // Unique ID for the slot: RACKID-Lx-Sx
          const slotId = `${rack.id}-L${l}-S${s}`;
          const qrUrl = `https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=${encodeURIComponent(slotId)}&choe=UTF-8`;
          html += `
            <div class="label">
              <div class="title">${rack.label}</div>
              <div class="subtitle">Ebene ${l} - Platz ${s}</div>
              <img src="${qrUrl}" alt="QR Code" />
              <div style="margin-top:10px; font-size:10px; color:#999;">${slotId}</div>
            </div>
          `;
        }
      }
    });

    html += `</div>
      <script>
        window.onload = function() { window.print(); }
      </script>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const saveData = async () => {
    setSaving(true);
    try {
      await Promise.all([
        apiService.put('/api/warehouse-layout/main', layout),
        apiService.put('/api/warehouse-stock/main', stock)
      ]);
      Alert.alert('Gespeichert', 'Lager-Layout wurde erfolgreich gespeichert.');
    } catch (e) {
      Alert.alert('Fehler', 'Konnte das Layout nicht speichern.');
    } finally {
      setSaving(false);
    }
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Der interaktive Lagerplaner ist derzeit nur im Browser (Web) verfügbar.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#3b82f6' }}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        
        <Text style={styles.title}>Lager Planer</Text>
        
        <View style={styles.tabs}>
          {(['2d', '3d'] as ViewMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.tab, mode === m && styles.tabActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                {m === '2d' ? '⬛ 2D Planer' : '🧊 3D Ansicht'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {mode === '2d' && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {Platform.OS === 'web' && (
              <TouchableOpacity onPress={printLabels} style={{ ...styles.saveBtn, backgroundColor: '#8b5cf6' }}>
                <Text style={styles.saveText}>🖨️ Etiketten Drucken</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={saveData} style={styles.saveBtn} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Speichert...' : '💾 Speichern'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.canvas}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.hint}>Lade Lager-Layout…</Text>
          </View>
        ) : mode === '2d' && Planner2D ? (
          <Suspense fallback={<View style={styles.center}><ActivityIndicator color="#3b82f6" /></View>}>
            <Planner2D layout={layout} setLayout={setLayout} stock={stock} setStock={setStock} articles={articles} pickRoute={pickRoute} setPickRoute={setPickRoute} />
          </Suspense>
        ) : mode === '3d' && Planner3D ? (
          <Suspense fallback={<View style={styles.center}><ActivityIndicator color="#3b82f6" /></View>}>
            <Planner3D layout={layout} stock={stock} articles={articles} pickRoute={pickRoute} />
          </Suspense>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#080f1c' },
  header:        {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14,
    backgroundColor: '#0c1929',
    borderBottomWidth: 1, borderBottomColor: 'rgba(30,64,148,0.4)',
    gap: 16,
  },
  backBtn:       { paddingRight: 14, paddingVertical: 4 },
  backText:      { color: '#60a5fa', fontSize: 15, fontWeight: '600' },
  title:         {
    flex: 1, color: '#e8edf5', fontSize: 17, fontWeight: '700',
    letterSpacing: -0.3,
  },
  tabs:          {
    flexDirection: 'row', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10, padding: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  tab:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tabActive:     {
    backgroundColor: '#2563eb',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  tabText:       { color: '#4e6a85', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontSize: 12, fontWeight: '700' },
  saveBtn:       {
    backgroundColor: '#10b981',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100, alignItems: 'center',
  },
  saveText:      { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  canvas:        { flex: 1 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hint:          { color: '#4e6a85', fontSize: 14 },
});
