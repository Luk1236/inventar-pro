import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../../contexts/ThemeContext';
import apiService from '../../../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface TruckRecommendation {
  type: string;
  capacity: string;
  suitable: boolean;
}

interface LoadingCalculation {
  event_id: string;
  event_name: string;
  calculation: {
    total_weight_kg: number;
    total_volume_m3: number;
    loading_meters: number;
    truck_dimensions: {
      width_m: number;
      height_m: number;
    };
  };
  truck_recommendations: TruckRecommendation[];
  items_count: number;
  items: Array<{
    article_name: string;
    quantity: number;
    weight_kg: number;
    estimated_volume_m3: number;
  }>;
}

export default function LogisticsPage() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoadingCalculation | null>(null);

  const loadLogistics = useCallback(async () => {
    try {
      const result = await apiService.get<LoadingCalculation>(`/api/events/${id}/loading-calculation`);
      setData(result);
    } catch (error) {
      console.error('Error loading logistics:', error);
      Alert.alert('Fehler', 'Logistik-Daten konnten nicht geladen werden');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadLogistics();
  }, [loadLogistics]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const { calculation, truck_recommendations, items } = data;
  const ldm = calculation.loading_meters;
  
  // A standard trailer is 13.6 LDM
  const maxLdm = 13.6;
  const fillPercentage = Math.min((ldm / maxLdm) * 100, 100);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lademeter & LKW-Planung</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.section}>
          <Text style={styles.eventName}>{data.event_name}</Text>
          <Text style={styles.summaryText}>
            Basierend auf {data.items_count} Positionen
          </Text>
        </View>

        {/* Visual Lademeter Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚚 Visueller Ladeplan (13.6m Standard)</Text>
          
          <View style={styles.truckContainer}>
            <View style={styles.truckCabin} />
            <View style={[styles.truckBed, { borderColor: colors.border }]}>
              {/* Scale marks */}
              {[2, 4, 6, 8, 10, 12].map(m => (
                <View key={m} style={[styles.scaleMark, { left: `${(m / maxLdm) * 100}%`, backgroundColor: colors.border }]}>
                  <Text style={styles.scaleText}>{m}m</Text>
                </View>
              ))}
              
              {/* Fill indicator */}
              <View 
                style={[
                  styles.fillSegment, 
                  { 
                    width: `${fillPercentage}%`,
                    backgroundColor: ldm > 12 ? '#FF3B30' : ldm > 6 ? '#FF9500' : '#34C759'
                  }
                ]} 
              >
                <Text style={styles.fillText}>{ldm.toFixed(1)} LDM</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Lademeter</Text>
              <Text style={styles.statValue}>{ldm.toFixed(2)} m</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Gesamtgewicht</Text>
              <Text style={styles.statValue}>{calculation.total_weight_kg.toFixed(0)} kg</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Volumen</Text>
              <Text style={styles.statValue}>{calculation.total_volume_m3.toFixed(2)} m³</Text>
            </View>
          </View>
        </View>

        {/* Truck Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 LKW Empfehlungen</Text>
          {truck_recommendations.map((truck, index) => (
            <View 
              key={index} 
              style={[
                styles.truckCard, 
                { opacity: truck.suitable ? 1 : 0.5, borderLeftColor: truck.suitable ? '#34C759' : '#ccc' }
              ]}
            >
              <View>
                <Text style={styles.truckType}>{truck.type}</Text>
                <Text style={styles.truckCap}>Kapazität: {truck.capacity}</Text>
              </View>
              {truck.suitable ? (
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              ) : (
                <Ionicons name="close-circle" size={24} color="#FF3B30" />
              )}
            </View>
          ))}
        </View>

        {/* Items List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Schwere & Sperrige Artikel</Text>
          {items.sort((a, b) => b.weight_kg - a.weight_kg).map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.article_name}</Text>
                <Text style={styles.itemSub}>Menge: {item.quantity}x</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemWeight}>{item.weight_kg.toFixed(1)} kg</Text>
                <Text style={styles.itemVolume}>{item.estimated_volume_m3.toFixed(2)} m³</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { padding: 20 },
  section: { marginBottom: 30 },
  eventName: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  summaryText: { fontSize: 14, color: '#666' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 15, color: '#333' },
  
  // Truck Visualization
  truckContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 20,
  },
  truckCabin: {
    width: 40,
    height: 60,
    backgroundColor: '#333',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 5,
  },
  truckBed: {
    flex: 1,
    height: 80,
    borderWidth: 2,
    borderLeftWidth: 0,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    position: 'relative',
    backgroundColor: '#f8f9fa',
  },
  fillSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  fillText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  scaleMark: {
    position: 'absolute',
    top: -5,
    bottom: 0,
    width: 1,
  },
  scaleText: {
    position: 'absolute',
    top: -20,
    left: -10,
    fontSize: 10,
    color: '#999',
    width: 30,
    textAlign: 'center',
  },
  
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f1f3f4',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  
  truckCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  truckType: { fontSize: 16, fontWeight: 'bold' },
  truckCap: { fontSize: 13, color: '#666', marginTop: 2 },
  
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemSub: { fontSize: 12, color: '#999', marginTop: 2 },
  itemWeight: { fontSize: 14, fontWeight: '600' },
  itemVolume: { fontSize: 12, color: '#666' },
});
