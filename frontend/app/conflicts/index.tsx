import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ConflictsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'artikel' | 'crew'>('artikel');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [articleConflicts, setArticleConflicts] = useState<any[]>([]);
  const [crewConflicts, setCrewConflicts] = useState<any[]>([]);

  const loadConflicts = useCallback(async () => {
    try {
      const [ac, cc] = await Promise.all([
        apiService.get<any[]>('/api/conflicts', { showErrorAlert: false }),
        apiService.get<any[]>('/api/conflicts/crew', { showErrorAlert: false }),
      ]);
      setArticleConflicts(ac);
      setCrewConflicts(cc);
    } catch (e) {
      console.error('Error loading conflicts:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadConflicts(); }, [loadConflicts]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    tabRow: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 3, borderBottomColor: colors.primary },
    tabText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: colors.primary },
    content: { flex: 1, padding: 16 },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#FF3B30' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
    eventRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    eventText: { fontSize: 13, color: colors.textSecondary },
    eventLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    vsText: { fontSize: 12, color: '#FF3B30', fontWeight: '700', textAlign: 'center', marginVertical: 4 },
    emptyContainer: { alignItems: 'center', paddingVertical: 64 },
    emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 16 },
    emptySubText: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const currentConflicts = activeTab === 'artikel' ? articleConflicts : crewConflicts;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Konfliktanalyse</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'artikel' && styles.tabActive]} onPress={() => setActiveTab('artikel')}>
          <Text style={[styles.tabText, activeTab === 'artikel' && styles.tabTextActive]}>
            Artikel {articleConflicts.length > 0 ? `(${articleConflicts.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'crew' && styles.tabActive]} onPress={() => setActiveTab('crew')}>
          <Text style={[styles.tabText, activeTab === 'crew' && styles.tabTextActive]}>
            Crew {crewConflicts.length > 0 ? `(${crewConflicts.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConflicts(); }} />}
      >
        {currentConflicts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            <Text style={styles.emptyText}>Keine Konflikte gefunden</Text>
            <Text style={styles.emptySubText}>
              {activeTab === 'artikel' ? 'Alle Artikel sind korrekt eingeplant' : 'Alle Crew-Mitglieder sind korrekt eingeplant'}
            </Text>
          </View>
        ) : (
          currentConflicts.map((conflict, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardTitle}>
                {activeTab === 'artikel' ? `Artikel: ${conflict.article_name}` : `Crew: ${conflict.crew_name}`}
              </Text>
              <TouchableOpacity onPress={() => router.push(`/events/detail/${conflict.event1_id}`)}>
                <Text style={styles.eventLink}>{conflict.event1_name}</Text>
              </TouchableOpacity>
              <Text style={styles.eventText}>{conflict.start1} - {conflict.end1}</Text>
              <Text style={styles.vsText}>UBERSCHNEIDUNG</Text>
              <TouchableOpacity onPress={() => router.push(`/events/detail/${conflict.event2_id}`)}>
                <Text style={styles.eventLink}>{conflict.event2_name}</Text>
              </TouchableOpacity>
              <Text style={styles.eventText}>{conflict.start2} - {conflict.end2}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
