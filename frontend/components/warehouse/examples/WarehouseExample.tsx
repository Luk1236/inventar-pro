/**
 * USAGE EXAMPLE: Warehouse Visualization
 *
 * This file demonstrates how to use the warehouse visualization components
 * in the Inventar Pro app.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import apiService, { getToken } from '../../services/apiService';
import { router } from 'expo-router';

// Import visualization components
import WarehouseVisualizer2D, {
  WarehouseZone,
  StorageLocation2D,
} from '../WarehouseVisualizer2D';
import WarehouseVisualizer3D, {
  Shelf3DConfig,
  Shelf3DData,
} from '../WarehouseVisualizer3D';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// EXAMPLE: Storage Overview Page
// ============================================================

interface StorageZone {
  id: string;
  name: string;
  type: 'shelf' | 'floor' | 'cold' | 'hazardous';
  grid_width: number;
  grid_height: number;
}

interface Shelf {
  id: string;
  name: string;
  zone_id: string;
  rows: number;
  columns: number;
  levels: number;
}

export default function StorageOverviewExample() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [locations, setLocations] = useState<StorageLocation2D[]>([]);
  const [shelfConfig, setShelfConfig] = useState<Shelf3DConfig | null>(null);
  const [shelfData, setShelfData] = useState<Record<string, Shelf3DData>>({});
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      // Load zones and locations
      const [zonesData, locationsData, shelvesData] = await Promise.all([
        apiService.get<StorageZone[]>('/api/storage-zones'),
        apiService.get<any[]>('/api/storage-locations'),
        apiService.get<Shelf[]>('/api/shelves').catch(() => []),
      ]);

      // Transform zones for 2D view
      const transformedZones: WarehouseZone[] = zonesData.map((z, i) => ({
        id: z.id,
        name: z.name,
        type: z.type || 'shelf',
        x: i * 3,
        y: 0,
        width: z.grid_width || 3,
        height: z.grid_height || 2,
      }));

      // Transform locations for 2D view
      const transformedLocations: StorageLocation2D[] = locationsData.map((loc, i) => ({
        id: loc.id,
        zone_id: loc.zone_id,
        name: loc.name,
        code: loc.code || `LOC-${i + 1}`,
        x: (i % 10) * 0.8,
        y: Math.floor(i / 10) * 0.8,
        width: 0.7,
        height: 0.7,
        fillPercent: Math.floor(Math.random() * 100), // TODO: Get from API
        articleCount: Math.floor(Math.random() * 5),
        capacity: 10,
        warning: Math.random() > 0.8,
      }));

      setZones(transformedZones);
      setLocations(transformedLocations);

      // Setup 3D shelf config
      if (shelvesData.length > 0) {
        const shelf = shelvesData[0];
        setShelfConfig({
          blocks: shelf.rows || 2,
          levels: shelf.levels || 4,
          spotsPerLevel: shelf.columns || 5,
          name: shelf.name,
        });

        // Generate sample shelf data
        const data: Record<string, Shelf3DData> = {};
        for (let b = 1; b <= (shelf.rows || 2); b++) {
          for (let l = 1; l <= (shelf.levels || 4); l++) {
            for (let s = 1; s <= (shelf.columns || 5); s++) {
              const code = `${String(b).padStart(2, '0')}-${String(l).padStart(2, '0')}-${String(s).padStart(2, '0')}`;
              data[code] = {
                code,
                fillPercent: Math.floor(Math.random() * 100),
                articleName: Math.random() > 0.3 ? `Artikel ${Math.floor(Math.random() * 50) + 1}` : undefined,
                stock: Math.floor(Math.random() * 20),
              };
            }
          }
        }
        setShelfData(data);
      }

    } catch (error) {
      console.error('Error loading storage data:', error);
      Alert.alert('Fehler', 'Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationPress = useCallback((location: StorageLocation2D) => {
    setSelectedLocation(location.id);
    // Navigate to location details
    // router.push(`/storage/location/${location.id}`);
  }, []);

  const handleSpotSelect = useCallback((
    block: number,
    level: number,
    spot: number,
    code: string,
    data: Shelf3DData
  ) => {
    setSelectedLocation(code);
    Alert.alert(
      `Platz ${code}`,
      `Artikel: ${data.articleName || 'Leer'}\nBestand: ${data.stock ?? 0}\nFüllstand: ${data.fillPercent}%`,
      [
        { text: 'Schließen', style: 'cancel' },
        { text: 'Details', onPress: () => console.log('Navigate to details') },
      ]
    );
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Lagerübersicht</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === '2d' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('2d')}
          >
            <Text style={[styles.toggleText, { color: viewMode === '2d' ? '#fff' : colors.text }]}>
              2D
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === '3d' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('3d')}
          >
            <Text style={[styles.toggleText, { color: viewMode === '3d' ? '#fff' : colors.text }]}>
              3D
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Visualization */}
      {viewMode === '2d' ? (
        <WarehouseVisualizer2D
          zones={zones}
          locations={locations}
          onLocationPress={handleLocationPress}
          selectedLocationId={selectedLocation}
          showLabels={true}
          showCapacity={true}
        />
      ) : (
        shelfConfig && (
          <WarehouseVisualizer3D
            config={shelfConfig}
            data={shelfData}
            onSpotSelect={handleSpotSelect}
            selectedSpot={selectedLocation}
            theme="auto"
            showLabels={true}
          />
        )
      )}

      {/* Quick Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="scan" size={20} color="#fff" />
          <Text style={styles.actionText}>Scannen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>Suchen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card }]}>
          <Ionicons name="add-circle" size={20} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>Neu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});