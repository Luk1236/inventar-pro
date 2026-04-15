import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StorageZone {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
  current_usage?: number;
}

interface StorageLocation {
  id: string;
  zone_id: string;
  name: string;
  type: string;
  capacity?: number;
  current_stock?: number;
}

export default function StorageManagementPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zones, setZones] = useState<StorageZone[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [activeTab, setActiveTab] = useState<'zones' | 'locations' | 'movements'>('zones');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/');
        return;
      }

      const [zonesData, locationsData] = await Promise.all([
        apiService.get<StorageZone[]>('/api/storage-zones', { showErrorAlert: false }),
        apiService.get<StorageLocation[]>('/api/storage-locations', { showErrorAlert: false }),
      ]);

      setZones(zonesData);
      setLocations(locationsData);
    } catch (error) {
      console.error('Error loading storage data:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Laden der Daten');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getLocationsByZone = (zoneId: string) => {
    return locations.filter(loc => loc.zone_id === zoneId);
  };

  const getUsagePercentage = (current: number | undefined, capacity: number | undefined) => {
    if (!capacity || !current) return 0;
    return Math.min(Math.round((current / capacity) * 100), 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#FF3B30';
    if (percentage >= 70) return '#FF9500';
    if (percentage >= 50) return '#FFCC00';
    return '#34C759';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Lagerorte...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Lagerorte</Text>
        <TouchableOpacity onPress={() => router.push('/storage/create')}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'zones' && styles.activeTab]}
          onPress={() => setActiveTab('zones')}
        >
          <Text style={[styles.tabText, activeTab === 'zones' && styles.activeTabText]}>
            Lagerzonen
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'locations' && styles.activeTab]}
          onPress={() => setActiveTab('locations')}
        >
          <Text style={[styles.tabText, activeTab === 'locations' && styles.activeTabText]}>
            Lagerorte
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'movements' && styles.activeTab]}
          onPress={() => setActiveTab('movements')}
        >
          <Text style={[styles.tabText, activeTab === 'movements' && styles.activeTabText]}>
            Bewegungen
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {activeTab === 'zones' && (
          <View style={styles.zonesList}>
            {zones.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>Keine Lagerzonen gefunden</Text>
                <Text style={styles.emptyText}>
                  Erstellen Sie Ihre erste Lagerzone um Artikel zu organisieren
                </Text>
                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={() => router.push('/storage/create?type=zone')}
                >
                  <Text style={styles.addButtonText}>Lagerzone erstellen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              zones.map((zone) => {
                const zoneLocations = getLocationsByZone(zone.id);
                const usagePercent = getUsagePercentage(zone.current_usage, zone.capacity);
                
                return (
                  <TouchableOpacity
                    key={zone.id}
                    style={styles.zoneCard}
                    onPress={() => router.push(`/storage/zone/${zone.id}`)}
                  >
                    <View style={styles.zoneHeader}>
                      <Ionicons name="business" size={24} color="#007AFF" />
                      <View style={styles.zoneInfo}>
                        <Text style={styles.zoneName}>{zone.name}</Text>
                        {zone.description && (
                          <Text style={styles.zoneDescription}>{zone.description}</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.zoneStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Lagerorte</Text>
                        <Text style={styles.statValue}>{zoneLocations.length}</Text>
                      </View>
                      
                      {zone.capacity && (
                        <>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Kapazität</Text>
                            <Text style={styles.statValue}>{zone.capacity}</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Auslastung</Text>
                            <Text style={[styles.statValue, { color: getUsageColor(usagePercent) }]}>
                              {usagePercent}%
                            </Text>
                          </View>
                        </>
                      )}
                    </View>

                    {zone.capacity && (
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${usagePercent}%`,
                              backgroundColor: getUsageColor(usagePercent),
                            },
                          ]}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'locations' && (
          <View style={styles.locationsList}>
            {locations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>Keine Lagerorte gefunden</Text>
                <Text style={styles.emptyText}>
                  Erstellen Sie Lagerorte in Ihren Lagerzonen
                </Text>
                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={() => router.push('/storage/create?type=location')}
                >
                  <Text style={styles.addButtonText}>Lagerort erstellen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              locations.map((location) => {
                const zone = zones.find(z => z.id === location.zone_id);
                const usagePercent = getUsagePercentage(location.current_stock, location.capacity);
                
                return (
                  <TouchableOpacity
                    key={location.id}
                    style={styles.locationCard}
                    onPress={() => router.push(`/storage/location/${location.id}`)}
                  >
                    <View style={styles.locationHeader}>
                      <View style={styles.locationIcon}>
                        <Ionicons 
                          name={
                            location.type === 'shelf' ? 'albums' :
                            location.type === 'rack' ? 'grid' :
                            location.type === 'case' ? 'cube' :
                            'location'
                          } 
                          size={20} 
                          color="#007AFF" 
                        />
                      </View>
                      <View style={styles.locationInfo}>
                        <Text style={styles.locationName}>{location.name}</Text>
                        {zone && (
                          <Text style={styles.locationZone}>📍 {zone.name}</Text>
                        )}
                        <Text style={styles.locationType}>
                          Typ: {location.type === 'shelf' ? 'Regal' :
                                location.type === 'rack' ? 'Gestell' :
                                location.type === 'case' ? 'Koffer' :
                                location.type}
                        </Text>
                      </View>
                    </View>

                    {location.capacity && (
                      <View style={styles.locationCapacity}>
                        <Text style={styles.capacityText}>
                          {location.current_stock || 0} / {location.capacity}
                        </Text>
                        <View style={styles.miniProgressBar}>
                          <View
                            style={[
                              styles.miniProgressFill,
                              {
                                width: `${usagePercent}%`,
                                backgroundColor: getUsageColor(usagePercent),
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'movements' && (
          <View style={styles.movementsContainer}>
            <View style={styles.movementsHeader}>
              <Text style={styles.movementsTitle}>Warenbewegungen</Text>
              <TouchableOpacity 
                style={styles.newMovementButton}
                onPress={() => router.push('/storage/movement/new')}
              >
                <Ionicons name="add-circle" size={20} color="white" />
                <Text style={styles.newMovementText}>Neue Bewegung</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.emptyContainer}>
              <Ionicons name="swap-horizontal-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Bewegungshistorie</Text>
              <Text style={styles.emptyText}>
                Hier sehen Sie alle Warenbewegungen (Ein-/Auslagerungen, Transfers)
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  zonesList: {
    padding: 16,
  },
  zoneCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  zoneInfo: {
    flex: 1,
    marginLeft: 12,
  },
  zoneName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  zoneDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  zoneStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f4',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f1f3f4',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  locationsList: {
    padding: 16,
  },
  locationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationZone: {
    fontSize: 13,
    color: '#007AFF',
    marginBottom: 2,
  },
  locationType: {
    fontSize: 12,
    color: '#999',
  },
  locationCapacity: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f4',
  },
  capacityText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  miniProgressBar: {
    height: 4,
    backgroundColor: '#f1f3f4',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  movementsContainer: {
    padding: 16,
  },
  movementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  movementsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  newMovementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  newMovementText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
