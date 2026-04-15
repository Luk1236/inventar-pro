// frontend/app/quotes/public/[token].tsx
// Public quote view — no authentication required.
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';

const BACKEND_URL: string =
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL as string) ??
  (process.env.EXPO_PUBLIC_BACKEND_URL as string) ??
  '';

interface PublicQuote {
  quote_number: string;
  customer_name: string;
  event_name: string;
  event_date?: string;
  valid_until?: string;
  items: Array<{
    article_name: string;
    quantity: number;
    unit_price: number;
    days: number;
    total: number;
  }>;
  discount_percent: number;
  total_net: number;
  status: string;
  notes?: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  letterhead_primary_color: string;
  letterhead_logo_url: string;
  letterhead_slogan: string;
}

const STATUS_LABELS: Record<string, string> = {
  entwurf: 'Entwurf',
  gesendet: 'Gesendet',
  akzeptiert: 'Akzeptiert',
  abgelehnt: 'Abgelehnt',
};
const STATUS_COLORS: Record<string, string> = {
  entwurf: '#8E8E93',
  gesendet: '#007AFF',
  akzeptiert: '#34C759',
  abgelehnt: '#FF3B30',
};

export default function PublicQuotePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND_URL}/api/quotes/public/${token}`)
      .then(r => {
        if (r.status === 410) throw new Error('Dieser Link ist abgelaufen.');
        if (r.status === 403) throw new Error('Online-Angebote sind deaktiviert.');
        if (!r.ok) throw new Error('Angebot nicht gefunden oder Link ungültig.');
        return r.json();
      })
      .then(data => setQuote(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF9500" />
        <Text style={styles.loadingText}>Angebot wird geladen…</Text>
      </View>
    );
  }

  if (error || !quote) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Angebot nicht verfügbar</Text>
        <Text style={styles.errorMsg}>{error || 'Unbekannter Fehler'}</Text>
      </View>
    );
  }

  const color = quote.letterhead_primary_color || '#FF9500';
  const statusColor = STATUS_COLORS[quote.status] || '#8E8E93';
  const statusLabel = STATUS_LABELS[quote.status] || quote.status;

  const subtotal = quote.items.reduce((s, i) => s + (i.total || 0), 0);
  const discount = subtotal * (quote.discount_percent / 100);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: color }]}>
        {quote.letterhead_logo_url ? (
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          <View style={styles.logoBox}>
            <Text style={{ color, fontWeight: '700', fontSize: 20 }}>{quote.company_name}</Text>
          </View>
        ) : (
          <Text style={[styles.companyName, { color }]}>{quote.company_name}</Text>
        )}
        {quote.letterhead_slogan ? (
          <Text style={styles.slogan}>{quote.letterhead_slogan}</Text>
        ) : null}
        <View style={styles.contactRow}>
          {quote.company_phone ? <Text style={styles.contactText}>{quote.company_phone}</Text> : null}
          {quote.company_email ? <Text style={styles.contactText}>{quote.company_email}</Text> : null}
        </View>
      </View>

      {/* Document title */}
      <View style={styles.docTitle}>
        <View>
          <Text style={styles.docTitleText}>ANGEBOT</Text>
          <Text style={styles.docNumber}>{quote.quote_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      {/* Recipient */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color }]}>An</Text>
        <Text style={styles.recipientName}>{quote.customer_name}</Text>
        {quote.event_name ? <Text style={styles.detail}>Projekt: {quote.event_name}</Text> : null}
        {quote.event_date ? <Text style={styles.detail}>Datum: {quote.event_date}</Text> : null}
        {quote.valid_until ? <Text style={styles.detail}>Gültig bis: {quote.valid_until}</Text> : null}
      </View>

      {/* Items table */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color }]}>Positionen</Text>
        <View style={[styles.tableHeader, { backgroundColor: color }]}>
          <Text style={[styles.thCell, { flex: 3 }]}>Artikel</Text>
          <Text style={[styles.thCell, { flex: 1, textAlign: 'right' }]}>Menge</Text>
          <Text style={[styles.thCell, { flex: 1, textAlign: 'right' }]}>Tage</Text>
          <Text style={[styles.thCell, { flex: 1.5, textAlign: 'right' }]}>Gesamt</Text>
        </View>
        {quote.items.map((item, i) => (
          <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
            <Text style={[styles.tdCell, { flex: 3 }]} numberOfLines={2}>{item.article_name}</Text>
            <Text style={[styles.tdCell, { flex: 1, textAlign: 'right' }]}>{item.quantity}</Text>
            <Text style={[styles.tdCell, { flex: 1, textAlign: 'right' }]}>{item.days}</Text>
            <Text style={[styles.tdCell, { flex: 1.5, textAlign: 'right' }]}>€{(item.total || 0).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totalsBox}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Zwischensumme</Text>
          <Text style={styles.totalValue}>€{subtotal.toFixed(2)}</Text>
        </View>
        {quote.discount_percent > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Rabatt ({quote.discount_percent}%)</Text>
            <Text style={[styles.totalValue, { color: '#FF3B30' }]}>−€{discount.toFixed(2)}</Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.totalFinal, { borderTopColor: color }]}>
          <Text style={[styles.totalFinalLabel, { color }]}>Nettobetrag</Text>
          <Text style={[styles.totalFinalValue, { color }]}>€{(quote.total_net || 0).toFixed(2)}</Text>
        </View>
      </View>

      {/* Notes */}
      {quote.notes ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color }]}>Hinweise</Text>
          <Text style={styles.notes}>{quote.notes}</Text>
        </View>
      ) : null}

      {/* CTA */}
      {quote.status === 'gesendet' && (
        <View style={[styles.ctaBox, { borderColor: color }]}>
          <Text style={styles.ctaTitle}>Angebot annehmen?</Text>
          <Text style={styles.ctaText}>
            Bitte kontaktieren Sie uns, um dieses Angebot zu bestätigen:
          </Text>
          {quote.company_email ? (
            <TouchableOpacity>
              <Text style={[styles.ctaLink, { color }]}>{quote.company_email}</Text>
            </TouchableOpacity>
          ) : null}
          {quote.company_phone ? (
            <TouchableOpacity>
              <Text style={[styles.ctaLink, { color }]}>{quote.company_phone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 24, maxWidth: 680, alignSelf: 'center', width: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#888', fontSize: 15 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  errorMsg: { fontSize: 14, color: '#888', textAlign: 'center' },

  header: { borderBottomWidth: 3, paddingBottom: 16, marginBottom: 24 },
  logoBox: { marginBottom: 4 },
  companyName: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  slogan: { fontSize: 13, color: '#888', marginBottom: 4 },
  contactRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  contactText: { fontSize: 12, color: '#666' },

  docTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  docTitleText: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  docNumber: { fontSize: 13, color: '#666', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  statusText: { color: 'white', fontSize: 12, fontWeight: '700' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  recipientName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  detail: { fontSize: 13, color: '#666', marginTop: 2 },

  tableHeader: { flexDirection: 'row', padding: 10, borderRadius: 6, marginBottom: 2 },
  thCell: { color: 'white', fontSize: 12, fontWeight: '700' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tdCell: { fontSize: 13, color: '#333' },

  totalsBox: { backgroundColor: '#F8F9FA', borderRadius: 10, padding: 16, marginBottom: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalLabel: { fontSize: 14, color: '#666' },
  totalValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  totalFinal: { borderTopWidth: 2, marginTop: 6, paddingTop: 10 },
  totalFinalLabel: { fontSize: 17, fontWeight: '700' },
  totalFinalValue: { fontSize: 17, fontWeight: '800' },

  notes: { fontSize: 13, color: '#555', lineHeight: 20 },

  ctaBox: { borderWidth: 1.5, borderRadius: 12, padding: 18, marginBottom: 16 },
  ctaTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 6 },
  ctaText: { fontSize: 13, color: '#666', marginBottom: 10 },
  ctaLink: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
});
