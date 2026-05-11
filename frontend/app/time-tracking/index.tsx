import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TimeTrackingPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'entries' | 'summary'>('entries');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [crew, setCrew] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = useCallback(async () => {
    try {
      const [e, c, s] = await Promise.all([
        apiService.get<any[]>('/api/time-entries', { showErrorAlert: false }),
        apiService.get<any[]>('/api/crew', { showErrorAlert: false }),
        apiService.get<any[]>(`/api/time-entries/summary?month=${currentMonth}`, { showErrorAlert: false }),
      ]);
      setEntries(e || []);
      setCrew(c || []);
      setSummary(s || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [currentMonth]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const deleteEntry = (entry: any) => {
    Alert.alert('Eintrag löschen', 'Diesen Zeiteintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        try {
          await apiService.delete(`/api/time-entries/${entry.id}`);
          setEntries(prev => prev.filter(e => e.id !== entry.id));
        } catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
      }},
    ]);
  };

  const crewMap = Object.fromEntries(crew.map(c => [c.id, c]));

  const changeMonth = (delta: number) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    tabRow: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 3, borderBottomColor: colors.primary },
    tabText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: colors.primary },
    content: { flex: 1, padding: 16 },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    crewName: { fontSize: 15, fontWeight: '700', color: colors.text },
    dateText: { fontSize: 13, color: colors.textSecondary },
    detailRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
    detailText: { fontSize: 13, color: colors.textSecondary },
    hoursText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    payText: { fontSize: 13, color: '#34C759', fontWeight: '600' },
    deleteBtn: { marginTop: 8, alignSelf: 'flex-end' },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    monthText: { fontSize: 16, fontWeight: '600', color: colors.text },
    summaryCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10 },
    summaryName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { fontSize: 13, color: colors.textSecondary },
    summaryValue: { fontSize: 13, fontWeight: '600', color: colors.text },
    totalPayValue: { fontSize: 16, fontWeight: '700', color: '#34C759' },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { color: colors.textSecondary, fontSize: 15, marginTop: 12 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  if (loading) return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stundenerfassung</Text>
        <TouchableOpacity onPress={() => router.push('/time-tracking/create')}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'entries' && styles.tabActive]} onPress={() => setActiveTab('entries')}>
          <Text style={[styles.tabText, activeTab === 'entries' && styles.tabTextActive]}>Einträge ({entries.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'summary' && styles.tabActive]} onPress={() => setActiveTab('summary')}>
          <Text style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}>Lohnübersicht</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'summary' && (
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{formatMonth(currentMonth)}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {activeTab === 'entries' ? (
          entries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={56} color={colors.border} />
              <Text style={styles.emptyText}>Keine Zeiteinträge</Text>
            </View>
          ) : (
            entries.map(entry => {
              const cm = crewMap[entry.crew_member_id];
              return (
                <View key={entry.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.crewName}>{cm?.name || entry.crew_member_id}</Text>
                    <Text style={styles.dateText}>{entry.date}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailText}>{entry.start_time} – {entry.end_time}</Text>
                    {entry.break_minutes > 0 && <Text style={styles.detailText}>Pause: {entry.break_minutes} min</Text>}
                  </View>
                  {entry.activity ? <Text style={[styles.detailText, { marginTop: 4 }]}>{entry.activity}</Text> : null}
                  <View style={[styles.detailRow, { marginTop: 8, justifyContent: 'space-between' }]}>
                    <Text style={styles.hoursText}>{entry.hours_worked}h</Text>
                    {entry.hourly_rate > 0 && <Text style={styles.payText}>€{entry.total_pay.toFixed(2)}</Text>}
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteEntry(entry)}>
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              );
            })
          )
        ) : (
          summary.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="bar-chart-outline" size={56} color={colors.border} />
              <Text style={styles.emptyText}>Keine Daten für {formatMonth(currentMonth)}</Text>
            </View>
          ) : (
            summary.map(s => (
              <View key={s.crew_id} style={styles.summaryCard}>
                <Text style={styles.summaryName}>{s.crew_name}</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Einträge</Text>
                  <Text style={styles.summaryValue}>{s.entry_count}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Stunden gesamt</Text>
                  <Text style={styles.summaryValue}>{s.total_hours}h</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Stundensatz</Text>
                  <Text style={styles.summaryValue}>€{s.hourly_rate.toFixed(2)}/h</Text>
                </View>
                <View style={[styles.summaryRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={[styles.summaryLabel, { fontWeight: '700', color: colors.text }]}>Lohn gesamt</Text>
                  <Text style={styles.totalPayValue}>€{s.total_pay.toFixed(2)}</Text>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
