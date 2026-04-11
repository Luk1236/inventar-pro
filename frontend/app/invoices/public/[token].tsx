import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  SafeAreaView, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getBackendUrl } from '../../../services/apiService';
const BACKEND_URL = getBackendUrl();

function formatDate(d: any) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('de-DE'); } catch { return String(d); }
}
function formatEur(n: number) {
  return (n ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function PublicInvoicePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND_URL}/api/invoices/public/${token}`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.detail || `Fehler ${r.status}`);
        }
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const primary = data?.letterhead_primary_color || '#FF9500';

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#FF9500" />
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Text style={{ fontSize: 40, marginBottom: 16 }}>
        {error.includes('deaktiviert') ? '🔒' : '❌'}
      </Text>
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', marginBottom: 8 }}>
        {error.includes('deaktiviert') ? 'Online-Rechnungen deaktiviert' : 'Rechnung nicht gefunden'}
      </Text>
      <Text style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center' }}>{error}</Text>
    </SafeAreaView>
  );

  if (!data) return null;

  const paid = data.payment_status === 'bezahlt';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ backgroundColor: primary, padding: 28, paddingTop: 40 }}>
          {data.letterhead_logo_url ? (
            <Text style={{ color: 'white', fontSize: 13, opacity: 0.8, marginBottom: 4 }}>{data.company_name}</Text>
          ) : (
            <Text style={{ color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 4 }}>{data.company_name}</Text>
          )}
          <Text style={{ color: 'white', fontSize: 28, fontWeight: '700', marginTop: 8 }}>
            Rechnung {data.invoice_number}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: paid ? '#34C75940' : 'rgba(255,255,255,0.2)' }}>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                {paid ? '✓ Bezahlt' : data.payment_status ?? 'Offen'}
              </Text>
            </View>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <Row label="Kunde" value={data.customer_name} />
          <Row label="Event" value={data.event_name} />
          <Row label="Rechnungsdatum" value={formatDate(data.issue_date)} />
          <Row label="Fällig bis" value={formatDate(data.due_date)} last />
        </View>

        {/* Items */}
        <Text style={styles.sectionTitle}>Positionen</Text>
        <View style={styles.card}>
          {(data.items || []).map((item: any, i: number) => (
            <View key={i} style={[styles.itemRow, i < data.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#E5E5EA' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1C1C1E' }}>{item.article_name}</Text>
                <Text style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{item.quantity}x · {formatEur(item.unit_price)}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1C1E' }}>{formatEur(item.total_price)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.card}>
          <Row label="Netto" value={formatEur(data.subtotal)} />
          <Row label={`MwSt. ${data.tax_rate ?? 19}%`} value={formatEur(data.tax_amount)} />
          <View style={[styles.rowContainer, { borderTopWidth: 2, borderTopColor: '#E5E5EA', marginTop: 8, paddingTop: 12 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1C1E' }}>Gesamt</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: primary }}>{formatEur(data.total_amount)}</Text>
          </View>
        </View>

        {data.notes && (
          <>
            <Text style={styles.sectionTitle}>Hinweise</Text>
            <View style={styles.card}>
              <Text style={{ fontSize: 14, color: '#3C3C43', lineHeight: 20 }}>{data.notes}</Text>
            </View>
          </>
        )}

        {data.payment_text && !paid && (
          <>
            <Text style={styles.sectionTitle}>Zahlungsinformationen</Text>
            <View style={styles.card}>
              <Text style={{ fontSize: 14, color: '#3C3C43', lineHeight: 20 }}>{data.payment_text}</Text>
            </View>
          </>
        )}

        {/* Footer */}
        <View style={{ alignItems: 'center', padding: 24 }}>
          {data.company_email && <Text style={{ color: '#8E8E93', fontSize: 13 }}>{data.company_email}</Text>}
          {data.company_phone && <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 2 }}>{data.company_phone}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.rowContainer, !last && { borderBottomWidth: 1, borderBottomColor: '#E5E5EA', paddingBottom: 10, marginBottom: 10 }]}>
      <Text style={{ fontSize: 14, color: '#8E8E93' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1C1E', flex: 1, textAlign: 'right', marginLeft: 12 }}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#8E8E93', marginHorizontal: 16, marginBottom: 6, marginTop: 8, textTransform: 'uppercase' },
  rowContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemRow: { paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
