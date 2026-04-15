import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Movement {
  id: string;
  article_name?: string;
  article_id?: string;
  type?: string;
  movement_type?: string;
  quantity?: number;
  from_location?: string;
  to_location?: string;
  created_at: string;
  created_by?: string;
  reason?: string;
}

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  IN: '#34C759',
  OUT: '#FF3B30',
  TRANSFER: '#007AFF',
  ADJUSTMENT: '#FF9500',
  RETURN: '#AF52DE',
  LOSS: '#FF3B30',
  eingang: '#34C759',
  ausgang: '#FF3B30',
  umbuchung: '#007AFF',
  korrektur: '#FF9500',
};

function getTypeColor(type?: string): string {
  if (!type) return '#8E8E93';
  return MOVEMENT_TYPE_COLORS[type] || MOVEMENT_TYPE_COLORS[type.toLowerCase()] || '#8E8E93';
}

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

function getMovementType(movement: Movement): string {
  return movement.type || movement.movement_type || '';
}

function getArticleName(movement: Movement): string {
  return movement.article_name || movement.article_id || 'Unbekannter Artikel';
}

export default function TrackingLogPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const load = async () => {
    try {
      const data = await apiService.get<Movement[]>('/api/movements');
      setMovements(data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredMovements = movements.filter(m => {
    const articleName = getArticleName(m).toLowerCase();
    const matchesSearch = searchText.trim() === '' || articleName.includes(searchText.trim().toLowerCase());

    const matchesDate = dateFilter.trim() === '' || (m.created_at || '').startsWith(dateFilter.trim());

    return matchesSearch && matchesDate;
  });

  const inputStyle = [styles.filterInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Lager-Tracking-Log</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter row */}
      <View style={[styles.filterRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1, position: 'relative' }}>
          <Ionicons
            name="search-outline"
            size={16}
            color={colors.textSecondary}
            style={styles.filterIcon}
          />
          <TextInput
            style={[inputStyle, { paddingLeft: 32 }]}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Artikel suchen..."
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={{ flex: 1, position: 'relative' }}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={colors.textSecondary}
            style={styles.filterIcon}
          />
          <TextInput
            style={[inputStyle, { paddingLeft: 32 }]}
            value={dateFilter}
            onChangeText={setDateFilter}
            placeholder="JJJJ-MM-TT"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filteredMovements.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Lagerbewegungen</Text>
            </View>
          )}

          {filteredMovements.map(movement => {
            const movType = getMovementType(movement);
            const typeColor = getTypeColor(movType);

            return (
              <View key={movement.id} style={[styles.card, { backgroundColor: colors.card }]}>
                {/* Date / time row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {formatDateTime(movement.created_at)}
                  </Text>
                  {movType ? (
                    <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
                      <Text style={[styles.typeBadgeText, { color: typeColor }]}>{movType}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Article name */}
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {getArticleName(movement)}
                </Text>

                {/* Quantity */}
                {movement.quantity != null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <Ionicons
                      name={movType === 'OUT' || movType === 'ausgang' ? 'arrow-up-outline' : 'arrow-down-outline'}
                      size={14}
                      color={typeColor}
                    />
                    <Text style={{ color: typeColor, fontSize: 14, fontWeight: '600' }}>
                      {movement.quantity}
                    </Text>
                  </View>
                )}

                {/* From / To location */}
                {(movement.from_location || movement.to_location) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4, flexWrap: 'wrap' }}>
                    {movement.from_location ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{movement.from_location}</Text>
                    ) : null}
                    {movement.from_location && movement.to_location ? (
                      <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} />
                    ) : null}
                    {movement.to_location ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{movement.to_location}</Text>
                    ) : null}
                  </View>
                )}

                {/* Reason */}
                {movement.reason ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3, fontStyle: 'italic' }}>
                    {movement.reason}
                  </Text>
                ) : null}

                {/* Created by */}
                {movement.created_by ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>
                    von {movement.created_by}
                  </Text>
                ) : null}
              </View>
            );
          })}
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
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  filterRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterInput: {
    borderRadius: 8, borderWidth: 1, padding: 9, fontSize: 14,
  },
  filterIcon: { position: 'absolute', left: 10, top: 11, zIndex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
});
