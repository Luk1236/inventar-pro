import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArchivedLocation {
  id: string;
  name: string;
  description?: string;
  location_type?: string;
}

const LOCATION_TYPE_COLORS: Record<string, string> = {
  lager: '#007AFF',
  regal: '#34C759',
  raum: '#FF9500',
  extern: '#8E8E93',
};

export default function ArchivedLocationsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [locations, setLocations] = useState<ArchivedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get<ArchivedLocation[]>('/api/storage-locations/archived');
      setLocations(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const restoreLocation = (location: ArchivedLocation) => {
    Alert.alert(
      'Standort wiederherstellen?',
      `"${location.name}" aus dem Archiv wiederherstellen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Wiederherstellen',
          onPress: async () => {
            try {
              await apiService.post(`/api/storage-locations/${location.id}/unarchive`);
              await load();
            } catch (e: any) {
              Alert.alert('Fehler', e.message || 'Wiederherstellen fehlgeschlagen');
            }
          },
        },
      ]
    );
  };

  const typeColor = (type?: string): string =>
    type ? (LOCATION_TYPE_COLORS[type.toLowerCase()] || '#8E8E93') : '#8E8E93';

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Archivierte Standorte</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="archive-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Archivierte Lagerorte
            </Text>
          </View>

          {locations.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="location-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16 }}>
                Keine archivierten Standorte
              </Text>
            </View>
          ) : (
            locations.map(loc => (
              <TouchableOpacity
                key={loc.id}
                style={[styles.card, { backgroundColor: colors.card }]}
                onPress={() => restoreLocation(loc)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{loc.name}</Text>
                      {loc.location_type ? (
                        <View style={[styles.badge, { backgroundColor: typeColor(loc.location_type) }]}>
                          <Text style={styles.badgeText}>{loc.location_type}</Text>
                        </View>
                      ) : null}
                    </View>
                    {loc.description ? (
                      <Text
                        numberOfLines={2}
                        style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}
                      >
                        {loc.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="refresh-outline" size={20} color={colors.primary} style={{ marginLeft: 8 }} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1,
  },
  infoText: { fontSize: 13, flex: 1 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
});
