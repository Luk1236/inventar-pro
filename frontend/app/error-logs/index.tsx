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
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { errorLogger, ErrorLog } from '../../services/errorLogger';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ErrorLogsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'network'>('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const allLogs = await errorLogger.getLogs();
      setLogs(allLogs);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Alle Fehler löschen?',
      'Möchten Sie wirklich alle Fehlerprotokolle löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await errorLogger.clearLogs();
            setLogs([]);
            Alert.alert('✅ Erfolg', 'Fehlerprotokolle gelöscht');
          },
        },
      ]
    );
  };

  const getFilteredLogs = () => {
    switch (filter) {
      case 'critical':
        return logs.filter(log => log.severity === 'critical');
      case 'high':
        return logs.filter(log => log.severity === 'high' || log.severity === 'critical');
      case 'network':
        return logs.filter(log => log.type === 'network');
      default:
        return logs;
    }
  };

  const getSeverityColor = (severity: ErrorLog['severity']) => {
    switch (severity) {
      case 'critical': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#FFCC00';
      case 'low': return '#34C759';
      default: return colors.textSecondary;
    }
  };

  const getTypeIcon = (type: ErrorLog['type']) => {
    switch (type) {
      case 'network': return 'cloud-offline';
      case 'api': return 'server';
      case 'app': return 'bug';
      default: return 'alert-circle';
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredLogs = getFilteredLogs();

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Lade Fehlerprotokolle...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Fehlerprotokolle</Text>
        <TouchableOpacity onPress={handleClearLogs} disabled={logs.length === 0}>
          <Ionicons name="trash-outline" size={24} color={logs.length > 0 ? '#FF3B30' : colors.border} />
        </TouchableOpacity>
      </View>

      {/* Filter Bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'all' && { backgroundColor: colors.primary },
              { borderColor: colors.border }
            ]}
            onPress={() => setFilter('all')}
          >
            <Text style={[
              styles.filterText,
              { color: filter === 'all' ? 'white' : colors.text }
            ]}>
              Alle ({logs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'critical' && { backgroundColor: '#FF3B30' },
              { borderColor: colors.border }
            ]}
            onPress={() => setFilter('critical')}
          >
            <Text style={[
              styles.filterText,
              { color: filter === 'critical' ? 'white' : colors.text }
            ]}>
              Kritisch ({logs.filter(l => l.severity === 'critical').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'high' && { backgroundColor: '#FF9500' },
              { borderColor: colors.border }
            ]}
            onPress={() => setFilter('high')}
          >
            <Text style={[
              styles.filterText,
              { color: filter === 'high' ? 'white' : colors.text }
            ]}>
              Hoch ({logs.filter(l => l.severity === 'high' || l.severity === 'critical').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'network' && { backgroundColor: colors.primary },
              { borderColor: colors.border }
            ]}
            onPress={() => setFilter('network')}
          >
            <Text style={[
              styles.filterText,
              { color: filter === 'network' ? 'white' : colors.text }
            ]}>
              Netzwerk ({logs.filter(l => l.type === 'network').length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Fehler gefunden</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {logs.length === 0 
                ? 'Es wurden noch keine Fehler protokolliert'
                : 'Keine Fehler in dieser Kategorie'}
            </Text>
          </View>
        ) : (
          <View style={styles.logsList}>
            {filteredLogs.map((log, index) => (
              <View key={log.id} style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.logHeader}>
                  <View style={styles.logTypeContainer}>
                    <Ionicons name={getTypeIcon(log.type)} size={20} color={getSeverityColor(log.severity)} />
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(log.severity) }]}>
                      <Text style={styles.severityText}>{log.severity.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.logDate, { color: colors.textSecondary }]}>
                    {formatDate(log.timestamp)}
                  </Text>
                </View>

                <Text style={[styles.logMessage, { color: colors.text }]}>
                  {log.message}
                </Text>

                {log.endpoint && (
                  <View style={styles.logDetail}>
                    <Ionicons name="link" size={14} color={colors.textSecondary} />
                    <Text style={[styles.logDetailText, { color: colors.textSecondary }]}>
                      {log.endpoint}
                    </Text>
                  </View>
                )}

                {log.statusCode && (
                  <View style={styles.logDetail}>
                    <Ionicons name="code" size={14} color={colors.textSecondary} />
                    <Text style={[styles.logDetailText, { color: colors.textSecondary }]}>
                      HTTP {log.statusCode}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
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
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  logsList: {
    padding: 16,
  },
  logCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  logDate: {
    fontSize: 12,
  },
  logMessage: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  logDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  logDetailText: {
    fontSize: 12,
  },
});
