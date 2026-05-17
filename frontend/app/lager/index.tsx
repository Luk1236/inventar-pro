// frontend/app/warehouse/index.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ActivityIndicator,
  TouchableOpacity, StyleSheet, SafeAreaView, TextInput,
  Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/apiService';
import IsometricWarehouse from '../../components/warehouse/IsometricWarehouse';
import SchematicWarehouse from '../../components/warehouse/SchematicWarehouse';
import LocationPanel from '../../components/warehouse/LocationPanel';
import {
  Article,
  StorageZone,
  StorageLocation,
  getArticlesForLocation,
  getLocationFillRatio,
  getLocationCapacity,
} from '../../utils/warehouseUtils';
import { useTheme } from '../../contexts/ThemeContext';

const zoneColors = ['#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#E53935'];

export default function WarehouseScreen() {
  const { colors, isDark } = useTheme();
  const [zones, setZones] = useState<StorageZone[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [view3D, setView3D] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set());
  // Gemeinsamer Regal-Layout-State für 2D & 3D
  const [customPos, setCustomPos] = useState<Record<string, { gx: number; gz: number }>>({});
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [filterMode, setFilterMode] = useState<'all' | 'free' | 'low' | 'full'>('all');
  const [showStatsModal, setShowStatsModal] = useState(false);

  const toggleZone = useCallback((zoneId: string) => {
    setCollapsedZones(prev => {
      const next = new Set(prev);
      next.has(zoneId) ? next.delete(zoneId) : next.add(zoneId);
      return next;
    });
  }, []);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return locations
      .filter(l => l.name.toLowerCase().includes(q))
      .map(l => l.id);
  }, [searchQuery, locations]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
    loadingText: { fontSize: 16, color: colors.textSecondary, marginTop: 8 },
    errorText: { fontSize: 16, color: '#FF3B30', textAlign: 'center' },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    retryText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
    emptyText: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
    emptySubText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [z, l, a] = await Promise.all([
        apiService.get<StorageZone[]>('/api/storage-zones'),
        apiService.get<StorageLocation[]>('/api/storage-locations'),
        apiService.get<Article[]>('/api/articles'),
      ]);
      setZones(z);
      setLocations(l);
      setArticles(a);
      // Restore persisted shelf layout (gx/gz/rotation) from each location.
      const pos: Record<string, { gx: number; gz: number }> = {};
      const rots: Record<string, number> = {};
      for (const loc of l) {
        const lp = (loc as any).layout_pos;
        if (lp) {
          pos[loc.id] = { gx: lp.gx, gz: lp.gz };
          rots[loc.id] = lp.rotation ?? 0;
        }
      }
      setCustomPos(pos);
      setRotations(rots);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  // Save indicator + persistence callback for the IsometricWarehouse editor.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLayoutChange = useCallback(async (
    locId: string,
    layout: { gx: number; gz: number; rotation: number },
  ) => {
    setSaveStatus('saving');
    try {
      await apiService.put(`/api/storage-locations/${locId}/layout`, layout, { showErrorAlert: false });
      setSaveStatus('saved');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaveStatus('idle'), 1800);
    } catch {
      setSaveStatus('error');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Inject print CSS on web so only the SVG canvas is printed
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.id = 'warehouse-print-css';
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #warehouse-print-root { display: block !important; }
        .warehouse-toolbar, .warehouse-stats-bar { display: none !important; }
        svg { max-width: 100%; height: auto; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('warehouse-print-css')?.remove(); };
  }, []);

  const handleArticleMoved = useCallback((articleId: string, newLocationId: string) => {
    setArticles(prev =>
      prev.map(a => a.id === articleId ? { ...a, storage_location_id: newLocationId } : a)
    );
  }, []);

  const selectedLocation = locations.find(l => l.id === selectedLocationId) ?? null;
  const selectedZone = selectedLocation
    ? zones.find(z => z.id === selectedLocation.zone_id) ?? null
    : null;
  const selectedArticles = selectedLocationId
    ? getArticlesForLocation(articles, selectedLocationId)
    : [];

  const fillRatioMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const loc of locations) {
      const count = articles.filter(a => a.storage_location_id === loc.id).length;
      map.set(loc.id, getLocationFillRatio(loc, count));
    }
    return map;
  }, [locations, articles]);

  const filteredLocations = useMemo(() => {
    if (filterMode === 'all') return locations;
    return locations.filter(loc => {
      const r = fillRatioMap.get(loc.id) ?? 0;
      if (filterMode === 'free') return r < 0.7;
      if (filterMode === 'low')  return r >= 0.7 && r < 0.92;
      if (filterMode === 'full') return r >= 0.92;
      return true;
    });
  }, [locations, filterMode, fillRatioMap]);

  const totalFill = useMemo(() => {
    if (locations.length === 0) return 0;
    const sum = locations.reduce((s, l) => s + (fillRatioMap.get(l.id) ?? 0), 0);
    return Math.round((sum / locations.length) * 100);
  }, [locations, fillRatioMap]);

  const criticalCount = useMemo(() =>
    locations.filter(l => (fillRatioMap.get(l.id) ?? 0) >= 0.92).length,
    [locations, fillRatioMap]
  );

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Lager wird geladen…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="wifi-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (zones.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="business-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>Keine Lagerplätze angelegt.</Text>
        <Text style={styles.emptySubText}>Bitte zuerst Zonen unter „Lagerorte{'"'} erstellen.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Toolbar */}
      <View style={{
        backgroundColor: '#060e1a',
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
        padding: 10,
        gap: 8,
      }}>
        {/* Row 1: Search + Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: '#0f1e35', borderRadius: 8, borderWidth: 1,
            borderColor: searchMatches.length > 0 ? '#FFD700' : '#1e293b',
            paddingHorizontal: 10, paddingVertical: 6,
          }}>
            <Ionicons name="search-outline" size={14}
              color={searchMatches.length > 0 ? '#FFD700' : '#64748b'} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Lagerort suchen…"
              placeholderTextColor="#475569"
              style={{ flex: 1, fontSize: 13, color: '#e2e8f0', outline: 'none' } as any}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={14} color="#475569" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowStatsModal(true)}
            style={{ backgroundColor: '#0f1e35', borderRadius: 8, borderWidth: 1,
              borderColor: '#1e293b', padding: 7 }}
          >
            <Ionicons name="bar-chart-outline" size={16} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePrint}
            style={{ backgroundColor: '#0f1e35', borderRadius: 8, borderWidth: 1,
              borderColor: '#1e293b', padding: 7 }}
          >
            <Ionicons name="print-outline" size={16} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setView3D(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: view3D ? '#4f46e5' : '#1d4ed8',
              paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 }}
          >
            <Ionicons name={view3D ? 'layers-outline' : 'cube-outline'} size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
              {view3D ? '2D' : '3D'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Filter chips */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['all', 'free', 'low', 'full'] as const).map(mode => {
            const labels = { all: 'Alle', free: 'Frei', low: 'Knapp', full: 'Voll' };
            const chipColors = { all: '#1d4ed8', free: '#16a34a', low: '#d97706', full: '#dc2626' };
            const active = filterMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => setFilterMode(mode)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                  backgroundColor: active ? chipColors[mode] + '30' : '#0f1e35',
                  borderWidth: 1,
                  borderColor: active ? chipColors[mode] : '#1e293b',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600',
                  color: active ? chipColors[mode] : '#64748b' }}>
                  {labels[mode]}
                </Text>
              </TouchableOpacity>
            );
          })}
          {searchMatches.length > 0 && (
            <Text style={{ fontSize: 11, color: '#FFD700', alignSelf: 'center', marginLeft: 4 }}>
              {searchMatches.length} Treffer
            </Text>
          )}
          {saveStatus !== 'idle' && (
            <Text style={{
              fontSize: 11,
              color: saveStatus === 'error' ? '#EF5350' : saveStatus === 'saving' ? '#94a3b8' : '#22C55E',
              alignSelf: 'center', marginLeft: 8, fontWeight: '600',
            }}>
              {saveStatus === 'saving' ? '⏳ Speichern…'
                : saveStatus === 'saved' ? '💾 Gespeichert'
                : '⚠ Speichern fehlgeschlagen'}
            </Text>
          )}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {view3D ? (
          <IsometricWarehouse
            zones={zones} locations={filteredLocations} articles={articles}
            selectedLocationId={selectedLocationId} onLocationSelect={setSelectedLocationId}
            customPos={customPos} setCustomPos={setCustomPos}
            rotations={rotations} setRotations={setRotations}
            searchMatches={searchMatches}
            collapsedZones={collapsedZones} onToggleZone={toggleZone}
            onLayoutChange={handleLayoutChange}
          />
        ) : (
          <SchematicWarehouse
            zones={zones} locations={filteredLocations} articles={articles}
            selectedLocationId={selectedLocationId} onLocationSelect={setSelectedLocationId}
            rotations={rotations} setRotations={setRotations}
            customPos={customPos}
            searchMatches={searchMatches}
            collapsedZones={collapsedZones} onToggleZone={toggleZone}
            onLayoutChange={handleLayoutChange}
          />
        )}

        {selectedLocationId && selectedLocation && selectedZone && (
          <LocationPanel
            location={selectedLocation}
            zone={selectedZone}
            articles={selectedArticles}
            allLocations={locations}
            onClose={() => setSelectedLocationId(null)}
            onArticleMoved={handleArticleMoved}
          />
        )}
      </View>

      {/* Stats bar */}
      <View style={{
        flexDirection: 'row', backgroundColor: '#060e1a',
        borderTopWidth: 1, borderTopColor: '#1e293b',
        paddingHorizontal: 16, paddingVertical: 8,
      }}>
        {[
          { label: 'Auslastung', value: `${totalFill}%`, color: totalFill > 85 ? '#ef4444' : totalFill > 60 ? '#f59e0b' : '#22c55e' },
          { label: 'Kritisch', value: String(criticalCount), color: criticalCount > 0 ? '#ef4444' : '#22c55e' },
          { label: 'Artikel', value: String(articles.length), color: '#60a5fa' },
          { label: 'Zonen', value: String(zones.length), color: '#a78bfa' },
        ].map(s => (
          <View key={s.label} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: s.color, fontSize: 16, fontWeight: '700' }}>{s.value}</Text>
            <Text style={{ color: '#475569', fontSize: 10 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Stats Modal */}
      <Modal visible={showStatsModal} transparent animationType="slide"
        onRequestClose={() => setShowStatsModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View style={{ backgroundColor: '#0f1e35', borderTopLeftRadius: 20,
            borderTopRightRadius: 20, padding: 20, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '700' }}>
                Lager-Statistiken
              </Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(() => {
                return zones.map((zone, zi) => {
                const zoneLocs = locations.filter(l => l.zone_id === zone.id);
                const zoneArts = articles.filter(a =>
                  zoneLocs.some(l => l.id === a.storage_location_id));
                const maxSlots = zoneLocs.reduce((s, l) => s + getLocationCapacity(l), 0);
                const fillPct = maxSlots > 0 ? Math.round((zoneArts.length / maxSlots) * 100) : 0;
                const color = zoneColors[zi % zoneColors.length];
                return (
                  <View key={zone.id} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                      marginBottom: 4 }}>
                      <Text style={{ color: color, fontWeight: '600', fontSize: 13 }}>
                        {zone.name}
                      </Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>
                        {zoneLocs.length} Regale · {zoneArts.length} Artikel · {fillPct}%
                      </Text>
                    </View>
                    <View style={{ backgroundColor: '#1e293b', height: 8, borderRadius: 4 }}>
                      <View style={{
                        backgroundColor: fillPct >= 92 ? '#ef4444' : fillPct >= 70 ? '#f59e0b' : '#22c55e',
                        height: 8, borderRadius: 4, width: `${fillPct}%` as any,
                      }} />
                    </View>
                  </View>
                );
              });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
