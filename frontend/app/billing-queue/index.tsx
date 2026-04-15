import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BillingQueueItem {
  event_id: string;
  event_name: string;
  customer_name: string;
  start_date: string;
  end_date: string;
  total_value: number;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  abgeschlossen: '#34C759',
  bereit: '#007AFF',
  ausstehend: '#FF9500',
};

const formatCurrency = (amount: number) => {
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

const formatDateRange = (start: string, end: string) => {
  if (!start && !end) return '';
  if (!end) return start;
  if (!start) return end;
  return `${start} – ${end}`;
};

export default function BillingQueuePage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [queueItems, setQueueItems] = useState<BillingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await apiService.get<BillingQueueItem[]>('/api/billing-queue');
      setQueueItems(data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const createInvoice = (item: BillingQueueItem) => {
    Alert.alert(
      'Rechnung erstellen',
      `Rechnung für "${item.event_name}" erstellen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Erstellen',
          onPress: async () => {
            setCreatingFor(item.event_id);
            try {
              await apiService.post('/api/invoices', {
                event_id: item.event_id,
                customer_name: item.customer_name,
                total_amount: item.total_value,
              });
              Alert.alert('', '✅ Rechnung erstellt', [
                { text: 'OK', onPress: () => load() },
              ]);
            } catch (e: any) {
              Alert.alert('Fehler', e.message || 'Rechnung konnte nicht erstellt werden');
            }
            setCreatingFor(null);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Zu fakturieren</Text>
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
          {/* Info banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Diese Events haben noch keine Rechnung
            </Text>
          </View>

          {queueItems.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="checkmark-circle-outline" size={52} color={colors.success || '#34C759'} />
              <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 15, textAlign: 'center' }}>
                Alle Events wurden bereits fakturiert ✓
              </Text>
            </View>
          ) : (
            queueItems.map(item => (
              <TouchableOpacity
                key={item.event_id}
                style={[styles.card, { backgroundColor: colors.card }]}
                onPress={() => createInvoice(item)}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={[styles.iconCircle, { backgroundColor: (colors.primary) + '20' }]}>
                    {creatingFor === item.event_id
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{item.event_name}</Text>
                      {item.status ? (
                        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] || '#8E8E93' }]}>
                          <Text style={styles.badgeText}>{item.status}</Text>
                        </View>
                      ) : null}
                    </View>
                    {item.customer_name ? (
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                        {item.customer_name}
                      </Text>
                    ) : null}
                    {(item.start_date || item.end_date) ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>
                        {formatDateRange(item.start_date, item.end_date)}
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 }}>
                      {formatCurrency(item.total_value || 0)}
                    </Text>
                  </View>
                  <View style={[styles.invoiceBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                      Rechnung
                    </Text>
                  </View>
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
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 16,
  },
  infoText: { fontSize: 13, flex: 1 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  invoiceBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
});
