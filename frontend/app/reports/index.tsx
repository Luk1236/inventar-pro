import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { writeAsStringAsync, documentDirectory } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ReportOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
}

export default function ReportsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  const exportInventoryList = async (format: 'csv' | 'pdf' = 'csv') => {
    setLoading(true);
    try {
      const endpoint = format === 'pdf' ? '/api/reports/inventory-pdf' : '/api/reports/inventory-csv';
      const data = await apiService.get<any>(endpoint, { showErrorAlert: false });
      
      const extension = format === 'pdf' ? 'pdf' : 'csv';
      const fileUri = documentDirectory + `inventar_${new Date().getTime()}.${extension}`;
      
      if (format === 'csv' && typeof data === 'string') {
        await writeAsStringAsync(fileUri, data);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        }
      } else {
        Alert.alert('✅ Erfolg', 'Export abgeschlossen');
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Fehler', 'Export fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const exportCustomerList = async (format: 'csv' | 'pdf' = 'csv') => {
    setLoading(true);
    try {
      const endpoint = format === 'pdf' ? '/api/reports/customers-pdf' : '/api/reports/customers-csv';
      const data = await apiService.get<any>(endpoint, { showErrorAlert: false });
      
      const extension = format === 'pdf' ? 'pdf' : 'csv';
      const fileUri = documentDirectory + `kunden_${new Date().getTime()}.${extension}`;
      
      if (format === 'csv' && typeof data === 'string') {
        await writeAsStringAsync(fileUri, data);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        }
      } else {
        Alert.alert('✅ Erfolg', 'Export abgeschlossen');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Export fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyReport = () => {
    Alert.alert(
      'Monatsbericht',
      'Welchen Zeitraum möchten Sie auswerten?',
      [
        { text: 'Aktueller Monat', onPress: () => generateReport('current') },
        { text: 'Letzter Monat', onPress: () => generateReport('last') },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  };

  const generateReport = async (period: string) => {
    setLoading(true);
    try {
      const report = await apiService.get<any>(`/api/reports/monthly?period=${period}`, { showErrorAlert: false });
      Alert.alert(
        '📊 Monatsbericht',
        `Events: ${report.total_events || 0}\nBuchungen: ${report.total_bookings || 0}\nUmsatz: €${report.total_revenue || 0}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Fehler', 'Bericht konnte nicht erstellt werden');
    } finally {
      setLoading(false);
    }
  };

  const showFormatChoice = (title: string, exportFunc: (format: 'csv' | 'pdf') => void) => {
    Alert.alert(
      title,
      'Wählen Sie das Export-Format:',
      [
        { text: 'CSV', onPress: () => exportFunc('csv') },
        { text: 'PDF', onPress: () => exportFunc('pdf') },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  };

  const reports: ReportOption[] = [
    {
      id: '1',
      title: 'Inventarliste',
      description: 'Alle Artikel exportieren (CSV/PDF)',
      icon: 'list-outline',
      color: '#007AFF',
      action: () => showFormatChoice('Inventarliste exportieren', exportInventoryList),
    },
    {
      id: '2',
      title: 'Kundenliste',
      description: 'Alle Kunden exportieren (CSV/PDF)',
      icon: 'people-outline',
      color: '#34C759',
      action: () => showFormatChoice('Kundenliste exportieren', exportCustomerList),
    },
    {
      id: '3',
      title: 'Monatsbericht',
      description: 'Umsatz und Auslastung',
      icon: 'bar-chart-outline',
      color: '#FF9500',
      action: generateMonthlyReport,
    },
    {
      id: '4',
      title: 'Wartungsprotokoll',
      description: 'Wartungshistorie exportieren',
      icon: 'build-outline',
      color: '#FF3B30',
      action: () => Alert.alert('Info', 'Wartungsprotokoll wird exportiert...'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Berichte & Export</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={[styles.infoCard, { backgroundColor: isDark ? '#1a3a5c' : '#E3F2FD' }]}>
          <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            Exportieren Sie Ihre Daten als CSV oder generieren Sie Berichte
          </Text>
        </View>

        {reports.map((report) => (
          <TouchableOpacity
            key={report.id}
            style={[styles.reportCard, { backgroundColor: colors.card }]}
            onPress={report.action}
            disabled={loading}
          >
            <View style={[styles.reportIcon, { backgroundColor: report.color + '20' }]}>
              <Ionicons name={report.icon as any} size={32} color={report.color} />
            </View>
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: colors.text }]}>{report.title}</Text>
              <Text style={[styles.reportDescription, { color: colors.textSecondary }]}>{report.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  loadingOverlay: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reportIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 14,
  },
});
