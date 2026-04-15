import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  user_id: string;
  user_name: string;
  changes?: any;
  timestamp: string;
}

export default function AuditLogPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    try {
      const data = await apiService.get<AuditLog[]>('/api/audit-logs', { showErrorAlert: false });
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return '#34C759';
      case 'UPDATE': return colors.primary;
      case 'DELETE': return '#FF3B30';
      case 'LOGIN': return '#5AC8FA';
      case 'LOGOUT': return '#666';
      default: return '#999';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return 'add-circle';
      case 'UPDATE': return 'create';
      case 'DELETE': return 'trash';
      case 'LOGIN': return 'log-in';
      case 'LOGOUT': return 'log-out';
      default: return 'help-circle';
    }
  };

  const filteredLogs = logs.filter(log => filter === 'all' || log.action === filter);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Änderungsprotokoll</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {['all', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'].map((f) => (
          <TouchableOpacity key={f} style={[styles.filterChip, { backgroundColor: colors.background }, filter === f && { backgroundColor: colors.primary }]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterChipText, { color: colors.textSecondary }, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'Alle' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Protokolleinträge</Text>
          </View>
        ) : (
          filteredLogs.map((log) => (
            <View key={log.id} style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.logHeader}>
                <View style={[styles.logIcon, { backgroundColor: getActionColor(log.action) + '20' }]}>
                  <Ionicons name={getActionIcon(log.action) as any} size={20} color={getActionColor(log.action)} />
                </View>
                <View style={styles.logInfo}>
                  <Text style={[styles.logAction, { color: colors.text }]}>{log.action}</Text>
                  <Text style={[styles.logEntity, { color: colors.textSecondary }]}>{log.entity_type} {log.entity_name && `- ${log.entity_name}`}</Text>
                  <Text style={[styles.logUser, { color: colors.textSecondary }]}>Von: {log.user_name} | {new Date(log.timestamp).toLocaleString('de-DE')}</Text>
                </View>
              </View>
              {log.changes && (
                <View style={[styles.logChanges, { borderTopColor: colors.border }]}>
                  <Text style={[styles.logChangesTitle, { color: colors.textSecondary }]}>Änderungen:</Text>
                  {Object.entries(log.changes).map(([key, value]) => (
                    <Text key={key} style={[styles.logChangesText, { color: colors.textSecondary }]}>• {key}: {JSON.stringify(value)}</Text>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.statsBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Text style={[styles.statsText, { color: colors.textSecondary }]}>
          {filteredLogs.length} Eintrag/Einträge {filter !== 'all' && `(gefiltert von ${logs.length})`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  filterContainer: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  filterChipText: { fontSize: 13, fontWeight: '500' },
  filterChipTextActive: { color: 'white' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 16 },
  emptyContainer: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 16, marginTop: 16 },
  logCard: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  logHeader: { flexDirection: 'row' },
  logIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logInfo: { flex: 1 },
  logAction: { fontSize: 14, fontWeight: '600' },
  logEntity: { fontSize: 13, marginTop: 2 },
  logUser: { fontSize: 11, marginTop: 4 },
  logChanges: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  logChangesTitle: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  logChangesText: { fontSize: 11, marginTop: 2 },
  statsBar: { paddingHorizontal: 24, paddingVertical: 12, borderTopWidth: 1 },
  statsText: { fontSize: 13, textAlign: 'center' },
});
