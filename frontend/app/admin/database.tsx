import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DatabaseStats {
  articles: number;
  categories: number;
  suppliers: number;
  customers: number;
  events: number;
  bookings: number;
  invoices: number;
  storage_locations: number;
  storage_zones: number;
  inventory_movements: number;
  maintenance_tasks: number;
  bom: number;
  teams: number;
  users: number;
  audit_logs: number;
  total_documents: number;
}

export default function DatabaseManagementPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [resetting, setResetting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await apiService.get<DatabaseStats>('/api/admin/database-stats', { showErrorAlert: false });
      setStats(data);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      if (error.message?.includes('403')) {
        Alert.alert('Fehler', 'Nur Administratoren können auf diese Seite zugreifen');
        router.back();
      } else {
        Alert.alert('Fehler', 'Konnte Statistiken nicht laden');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const handleResetDatabase = () => {
    Alert.alert(
      '⚠️ WARNUNG: Datenbank zurücksetzen',
      'Dies wird ALLE Daten unwiderruflich löschen:\n\n• Alle Artikel\n• Alle Kunden\n• Alle Events & Buchungen\n• Alle Lagerorte\n• Alle Kategorien & Lieferanten\n• Alle Wartungsaufgaben\n• ALLE anderen Daten\n\nNUR DER ADMIN-BENUTZER BLEIBT ERHALTEN.\n\nSind Sie absolut sicher?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'JA, ALLES LÖSCHEN',
          style: 'destructive',
          onPress: () => confirmResetDatabase(),
        },
      ]
    );
  };

  const confirmResetDatabase = () => {
    Alert.alert(
      '🚨 LETZTE WARNUNG',
      'Dies ist Ihre LETZTE CHANCE!\n\nAlle Daten werden PERMANENT gelöscht.\n\nGeben Sie zur Bestätigung OK ein.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'OK - LÖSCHEN',
          style: 'destructive',
          onPress: () => executeReset(),
        },
      ]
    );
  };

  const executeReset = async () => {
    setResetting(true);
    try {
      const result = await apiService.post<any>('/api/admin/reset-database', null);
      Alert.alert(
        '✅ Erfolg',
        `Datenbank wurde zurückgesetzt.\n\nGelöschte Dokumente: ${result.total_deleted}`,
        [{ text: 'OK', onPress: () => loadStats() }]
      );
    } catch (error) {
      console.error('Reset error:', error);
      Alert.alert('Fehler', 'Zurücksetzen fehlgeschlagen');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Statistiken...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Datenbankverwaltung</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Warning */}
        <View style={[styles.warningCard, { backgroundColor: isDark ? '#3d2e00' : '#FFF3CD' }]}>
          <Ionicons name="warning" size={32} color="#FF3B30" />
          <Text style={[styles.warningTitle, { color: '#FF3B30' }]}>Admin-Bereich</Text>
          <Text style={[styles.warningText, { color: isDark ? '#FFB300' : '#856404' }]}>
            Vorsicht: Hier können Sie die gesamte Datenbank zurücksetzen. Dies ist irreversibel!
          </Text>
        </View>

        {/* Database Stats */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 Datenbank-Statistiken</Text>
          
          {stats && (
            <View style={styles.statsGrid}>
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Artikel:</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.articles}</Text>
              </View>
              
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Kategorien:</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.categories}</Text>
              </View>
              
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Lieferanten:</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.suppliers}</Text>
              </View>
              
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Kunden:</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.customers}</Text>
              </View>
              
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Events:</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.events}</Text>
              </View>
              
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Buchungen:</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.bookings}</Text>
              </View>
              
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Lagerorte:</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.storage_locations}</Text>
              </View>
              
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Teams:</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.teams}</Text>
              </View>
              
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Benutzer:</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.users}</Text>
              </View>

              <View style={[styles.statRow, styles.totalRow, { borderTopColor: colors.primary }]}>
                <Text style={[styles.statLabel, styles.totalLabel, { color: colors.text }]}>
                  Gesamt Dokumente:
                </Text>
                <Text style={[styles.statValue, styles.totalValue, { color: colors.primary }]}>
                  {stats.total_documents}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Reset Button */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🗑️ Datenbank zurücksetzen</Text>
          
          <View style={[styles.resetInfo, { backgroundColor: isDark ? '#3d2e00' : '#FFF3CD' }]}>
            <Text style={[styles.resetInfoText, { color: isDark ? '#FFB300' : '#856404' }]}>
              Alle Daten werden gelöscht. Nur der Admin-Benutzer bleibt erhalten.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.resetButton, resetting && styles.resetButtonDisabled]}
            onPress={handleResetDatabase}
            disabled={resetting}
          >
            {resetting ? (
              <>
                <ActivityIndicator color="white" />
                <Text style={styles.resetButtonText}>Wird zurückgesetzt...</Text>
              </>
            ) : (
              <>
                <Ionicons name="trash" size={20} color="white" />
                <Text style={styles.resetButtonText}>Datenbank zurücksetzen</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  warningCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    gap: 0,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 2,
    borderBottomWidth: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetInfo: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  resetInfoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
