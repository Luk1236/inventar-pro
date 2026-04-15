import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Inspection {
  id: string;
  article_id?: string;
  article_name?: string;
  inspection_type?: string;
  due_date?: string;
  result?: string;
  notes?: string;
}

const today = (): string => new Date().toISOString().split('T')[0];

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '–';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
};

export default function InspectionDuePage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [items, setItems] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get<Inspection[]>('/api/inspections');
      const pending = (data || []).filter(i => i.result === 'ausstehend');
      pending.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
      setItems(pending);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const getDueDateColor = (due?: string): string => {
    if (!due) return colors.textSecondary;
    const t = today();
    if (due < t) return '#FF3B30';
    if (due <= addDays(t, 30)) return '#FF9500';
    return colors.textSecondary;
  };

  const isOverdue = (due?: string): boolean => !!due && due < today();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Zu prüfende Materialien</Text>
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
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Artikel, deren Prüfung aussteht oder überfällig ist
            </Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>✅</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Alle Prüfungen sind aktuell</Text>
            </View>
          ) : (
            items.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, { backgroundColor: colors.card }]}
                onPress={() => router.push('/inspections')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {item.article_name || `Inspektion #${item.id}`}
                    </Text>
                    {item.inspection_type ? (
                      <View style={[styles.badge, { backgroundColor: colors.primary + '20', marginTop: 6 }]}>
                        <Text style={[styles.badgeText, { color: colors.primary }]}>{item.inspection_type}</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.dueText, { color: getDueDateColor(item.due_date) }]}>
                      Fällig: {formatDate(item.due_date)}
                    </Text>
                  </View>
                  {isOverdue(item.due_date) && (
                    <View style={[styles.overdueBadge]}>
                      <Text style={styles.overdueText}>ÜBERFÄLLIG</Text>
                    </View>
                  )}
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
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  dueText: { fontSize: 13, marginTop: 6, fontWeight: '500' },
  overdueBadge: {
    backgroundColor: '#FF3B30', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start',
  },
  overdueText: { color: 'white', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
