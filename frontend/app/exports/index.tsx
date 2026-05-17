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
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService, { getToken } from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Event {
  id: string;
  event_name: string;
  event_number: string;
  start_date: string;
  end_date: string;
  location: string;
}

interface LoadingCalc {
  event_name: string;
  calculation: {
    total_weight_kg: number;
    total_volume_m3: number;
    loading_meters: number;
  };
  truck_recommendations: Array<{
    type: string;
    capacity: string;
    suitable: boolean;
  }>;
  items_count: number;
}

export default function ExportsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loadingCalc, setLoadingCalc] = useState<LoadingCalc | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const data = await apiService.get<Event[]>('/api/events', { showErrorAlert: false });
      setEvents(data || []);
      if (data && data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateLademeter = async () => {
    if (!selectedEventId) {
      Alert.alert('Fehler', 'Bitte wählen Sie ein Event');
      return;
    }
    
    setExporting('lademeter');
    try {
      const data = await apiService.get<LoadingCalc>(`/api/events/${selectedEventId}/loading-calculation`);
      setLoadingCalc(data);
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Berechnung fehlgeschlagen');
    } finally {
      setExporting(null);
    }
  };

  const downloadFile = async (endpoint: string, filename: string) => {
    setExporting(endpoint);
    try {
      const token = await getToken();
      const url = `${BACKEND_URL}${endpoint}`;

      Alert.alert(
        'Download',
        `${filename} wird heruntergeladen...`,
        [
          {
            text: 'Öffnen',
            onPress: () => Linking.openURL(url)
          },
          { text: 'OK' }
        ]
      );
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Download fehlgeschlagen');
    } finally {
      setExporting(null);
    }
  };

  const exportPackingListPDF = () => {
    if (!selectedEventId) {
      Alert.alert('Fehler', 'Bitte wählen Sie ein Event');
      return;
    }
    const selectedEvent = events.find(e => e.id === selectedEventId);
    downloadFile(`/api/events/${selectedEventId}/packing-list/pdf`, `Packliste ${selectedEvent?.event_number || ''}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>📄 Dokumente & Export</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        
        {/* Excel Exports */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 Excel-Exporte</Text>
          
          <TouchableOpacity
            style={[styles.exportCard, { backgroundColor: colors.card }]}
            onPress={() => downloadFile('/api/reports/articles-xlsx', 'Artikel.xlsx')}
            disabled={exporting !== null}
          >
            <View style={[styles.iconBox, { backgroundColor: '#34C75920' }]}>
              <Ionicons name="grid-outline" size={24} color="#34C759" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Artikel-Liste (.xlsx)</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Alle Artikel mit Bestand, Preisen, Status
              </Text>
            </View>
            {exporting === '/api/reports/articles-xlsx' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={24} color="#34C759" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportCard, { backgroundColor: colors.card }]}
            onPress={() => downloadFile('/api/reports/bookings-xlsx', 'Buchungen.xlsx')}
            disabled={exporting !== null}
          >
            <View style={[styles.iconBox, { backgroundColor: '#5856D620' }]}>
              <Ionicons name="calendar-outline" size={24} color="#5856D6" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Buchungen (.xlsx)</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Alle Buchungen mit Artikeln, Daten, Status
              </Text>
            </View>
            {exporting === '/api/reports/bookings-xlsx' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={24} color="#5856D6" />
            )}
          </TouchableOpacity>
        </View>

        {/* Event Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Event wählen</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventScroll}>
            {events.map(event => (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.eventChip,
                  { backgroundColor: colors.card },
                  selectedEventId === event.id && styles.eventChipSelected
                ]}
                onPress={() => { setSelectedEventId(event.id); setLoadingCalc(null); }}
              >
                <Text style={[
                  styles.eventChipText,
                  { color: selectedEventId === event.id ? '#fff' : colors.text }
                ]}>
                  {event.event_name}
                </Text>
                <Text style={[
                  styles.eventChipSub,
                  { color: selectedEventId === event.id ? '#ffffffaa' : colors.textSecondary }
                ]}>
                  {event.event_number}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Packing List PDF */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📦 Packliste PDF</Text>
          
          <TouchableOpacity
            style={[styles.exportCard, { backgroundColor: colors.card }]}
            onPress={exportPackingListPDF}
            disabled={!selectedEventId || exporting !== null}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FF950020' }]}>
              <Ionicons name="document-text-outline" size={24} color="#FF9500" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Packliste generieren</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                PDF mit allen gebuchten Artikeln zum Abhaken
              </Text>
            </View>
            <Ionicons name="download-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Lademeter Calculation */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🚛 Lademeter-Berechnung</Text>
          
          <TouchableOpacity
            style={[styles.calcButton, { backgroundColor: colors.primary }]}
            onPress={calculateLademeter}
            disabled={!selectedEventId || exporting !== null}
          >
            {exporting === 'lademeter' ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="calculator-outline" size={20} color="white" />
                <Text style={styles.calcButtonText}>Berechnen</Text>
              </>
            )}
          </TouchableOpacity>

          {loadingCalc && (
            <View style={[styles.calcResult, { backgroundColor: colors.card }]}>
              <Text style={[styles.calcResultTitle, { color: colors.text }]}>
                {loadingCalc.event_name}
              </Text>
              
              <View style={styles.calcStats}>
                <View style={styles.calcStat}>
                  <Text style={[styles.calcStatValue, { color: colors.primary }]}>
                    {loadingCalc.calculation.loading_meters.toFixed(1)}
                  </Text>
                  <Text style={[styles.calcStatLabel, { color: colors.textSecondary }]}>Lademeter</Text>
                </View>
                <View style={styles.calcStat}>
                  <Text style={[styles.calcStatValue, { color: '#FF9500' }]}>
                    {loadingCalc.calculation.total_weight_kg.toFixed(0)}
                  </Text>
                  <Text style={[styles.calcStatLabel, { color: colors.textSecondary }]}>kg Gewicht</Text>
                </View>
                <View style={styles.calcStat}>
                  <Text style={[styles.calcStatValue, { color: '#34C759' }]}>
                    {loadingCalc.calculation.total_volume_m3.toFixed(2)}
                  </Text>
                  <Text style={[styles.calcStatLabel, { color: colors.textSecondary }]}>m³ Volumen</Text>
                </View>
              </View>

              <Text style={[styles.calcSubtitle, { color: colors.text }]}>LKW-Empfehlungen:</Text>
              {loadingCalc.truck_recommendations.map((truck, idx) => (
                <View key={idx} style={[styles.truckRow, { backgroundColor: truck.suitable ? '#34C75910' : colors.background }]}>
                  <Ionicons 
                    name={truck.suitable ? 'checkmark-circle' : 'close-circle'} 
                    size={20} 
                    color={truck.suitable ? '#34C759' : '#FF3B30'} 
                  />
                  <Text style={[styles.truckText, { color: colors.text }]}>
                    {truck.type}
                  </Text>
                  <Text style={[styles.truckCapacity, { color: colors.textSecondary }]}>
                    {truck.capacity}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* PDF Exports */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📑 PDF-Berichte</Text>
          
          <TouchableOpacity
            style={[styles.exportCard, { backgroundColor: colors.card }]}
            onPress={() => downloadFile('/api/reports/inventory-pdf', 'Inventar PDF')}
            disabled={exporting !== null}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FF3B3020' }]}>
              <Ionicons name="document-outline" size={24} color="#FF3B30" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Inventar PDF</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Komplette Inventarliste als PDF
              </Text>
            </View>
            <Ionicons name="download-outline" size={24} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportCard, { backgroundColor: colors.card }]}
            onPress={() => downloadFile('/api/reports/customers-pdf', 'Kunden PDF')}
            disabled={exporting !== null}
          >
            <View style={[styles.iconBox, { backgroundColor: '#007AFF20' }]}>
              <Ionicons name="people-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Kunden PDF</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Kundenliste mit Kontaktdaten
              </Text>
            </View>
            <Ionicons name="download-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  exportCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardDesc: { fontSize: 12, marginTop: 2 },
  eventScroll: { marginBottom: 8 },
  eventChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 10 },
  eventChipSelected: { backgroundColor: '#007AFF' },
  eventChipText: { fontSize: 14, fontWeight: '600' },
  eventChipSub: { fontSize: 11, marginTop: 2 },
  calcButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10, gap: 8, marginBottom: 16 },
  calcButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  calcResult: { padding: 16, borderRadius: 12 },
  calcResultTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  calcStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  calcStat: { alignItems: 'center' },
  calcStatValue: { fontSize: 28, fontWeight: 'bold' },
  calcStatLabel: { fontSize: 12, marginTop: 4 },
  calcSubtitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  truckRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 8, gap: 10 },
  truckText: { flex: 1, fontSize: 14, fontWeight: '500' },
  truckCapacity: { fontSize: 12 },
});
