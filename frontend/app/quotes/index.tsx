import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl, Alert, Modal, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SignaturePad from '../../components/SignaturePad';
import Constants from 'expo-constants';

const STATUS_COLORS: Record<string, string> = {
  entwurf: '#8E8E93',
  gesendet: '#007AFF',
  akzeptiert: '#34C759',
  abgelehnt: '#FF3B30',
};
const STATUS_LABELS: Record<string, string> = {
  entwurf: 'Entwurf',
  gesendet: 'Gesendet',
  akzeptiert: 'Akzeptiert',
  abgelehnt: 'Abgelehnt',
};

export default function QuotesPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);

  // Signature state
  const [signPadVisible, setSignPadVisible] = useState(false);
  const [signingQuote, setSigningQuote] = useState<any>(null);
  const [signedByName, setSignedByName] = useState('');
  const [nameModalVisible, setNameModalVisible] = useState(false);

  const loadQuotes = useCallback(async () => {
    try {
      const data = await apiService.get<any[]>('/api/quotes', { showErrorAlert: false });
      setQuotes(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);
  useFocusEffect(useCallback(() => { loadQuotes(); }, [loadQuotes]));

  const handleSignQuote = (quote: any) => {
    setSigningQuote(quote);
    setSignedByName('');
    setNameModalVisible(true);
  };

  const saveQuoteSignature = async (base64Svg: string) => {
    if (!signingQuote) return;
    try {
      await apiService.put(`/api/quotes/${signingQuote.id}/sign`, {
        signature_customer: base64Svg,
        signed_by: signedByName,
      });
      setQuotes(prev => prev.map(q => q.id === signingQuote.id ? { ...q, status: 'akzeptiert' } : q));
      Alert.alert('Erfolg', 'Angebot wurde angenommen und unterschrieben');
    } catch {
      Alert.alert('Fehler', 'Unterschrift konnte nicht gespeichert werden');
    }
  };

  const BACKEND_URL: string =
    (Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL as string) ??
    (process.env.EXPO_PUBLIC_BACKEND_URL as string) ??
    '';

  const handleShareQuote = async (q: any) => {
    if (q.public_token) {
      const link = `${BACKEND_URL}/quotes/public/${q.public_token}`;
      Alert.alert('Öffentlicher Link', link);
      return;
    }
    try {
      const res = await apiService.post<{ public_token: string }>(`/api/quotes/${q.id}/share`, {});
      const link = `${BACKEND_URL}/quotes/public/${res.public_token}`;
      setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, public_token: res.public_token } : x));
      Alert.alert('Link erstellt', `Öffentlicher Link:\n\n${link}`);
    } catch {
      Alert.alert('Fehler', 'Link konnte nicht erstellt werden');
    }
  };

  const changeStatus = (quote: any) => {
    const options = ['entwurf', 'gesendet', 'akzeptiert', 'abgelehnt'];
    Alert.alert(
      'Status ändern',
      `Aktuell: ${STATUS_LABELS[quote.status] || quote.status}`,
      [
        ...options.map(opt => ({
          text: STATUS_LABELS[opt],
          onPress: async () => {
            try {
              await apiService.put(`/api/quotes/${quote.id}/status`, { status: opt });
              setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: opt } : q));
            } catch { Alert.alert('Fehler', 'Status konnte nicht geändert werden'); }
          },
        })),
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  };

  const deleteQuote = async (quote: any) => {
    if (!(window as any).confirm(`"${quote.quote_number}" wirklich löschen?`)) return;
    try { await apiService.delete(`/api/quotes/${quote.id}`); setQuotes(prev => prev.filter(q => q.id !== quote.id)); }
    catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    content: { flex: 1, padding: 16 },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    quoteNumber: { fontSize: 15, fontWeight: '700', color: colors.text },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    badgeText: { fontSize: 12, color: 'white', fontWeight: '600' },
    customerName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
    eventName: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 },
    totalLabel: { fontSize: 13, color: colors.textSecondary },
    totalValue: { fontSize: 16, fontWeight: '700', color: colors.primary },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    emptyContainer: { alignItems: 'center', paddingVertical: 64 },
    emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 16 },
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
        <Text style={styles.headerTitle}>Angebote ({quotes.length})</Text>
        <TouchableOpacity onPress={() => router.push('/quotes/create')}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Name input before signature */}
      <Modal visible={nameModalVisible} animationType="fade" transparent onRequestClose={() => setNameModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Unterzeichner</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.background, marginBottom: 16 }}
              value={signedByName}
              onChangeText={setSignedByName}
              placeholder="Vor- und Nachname"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setNameModalVisible(false)} style={{ flex: 1, padding: 13, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setNameModalVisible(false); setSignPadVisible(true); }}
                style={{ flex: 2, padding: 13, borderRadius: 10, backgroundColor: '#34C759', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              >
                <Ionicons name="create-outline" size={16} color="white" />
                <Text style={{ color: 'white', fontWeight: '600' }}>Zur Unterschrift</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SignaturePad
        visible={signPadVisible}
        title={signingQuote ? `Angebot ${signingQuote.quote_number}` : 'Unterschrift'}
        description="Bitte unterschreiben Sie zur Annahme des Angebots"
        onSave={saveQuoteSignature}
        onClose={() => setSignPadVisible(false)}
      />

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadQuotes(); }} />}>
        {quotes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={colors.border} />
            <Text style={styles.emptyText}>Keine Angebote</Text>
            <TouchableOpacity onPress={() => router.push('/quotes/create')} style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Erstes Angebot erstellen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          quotes.map(q => (
            <View key={q.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.quoteNumber}>{q.quote_number}</Text>
                <TouchableOpacity style={[styles.badge, { backgroundColor: STATUS_COLORS[q.status] || '#8E8E93' }]} onPress={() => changeStatus(q)}>
                  <Text style={styles.badgeText}>{STATUS_LABELS[q.status] || q.status}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.customerName}>{q.customer_name}</Text>
              <Text style={styles.eventName}>{q.event_name}{q.event_date ? ` · ${q.event_date}` : ''}</Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{q.items?.length || 0} Position(en)</Text>
                <Text style={styles.totalValue}>€{(q.total_net || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.actionsRow}>
                {q.status === 'gesendet' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: '#34C759', backgroundColor: '#34C75910', flex: 1.5 }]}
                    onPress={() => handleSignQuote(q)}
                  >
                    <Ionicons name="create-outline" size={16} color="#34C759" />
                    <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '600' }}>Akzeptieren & Unterschreiben</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: q.public_token ? '#34C759' : '#007AFF' }]}
                  onPress={() => handleShareQuote(q)}
                >
                  <Ionicons name={q.public_token ? 'link-outline' : 'share-outline'} size={16} color={q.public_token ? '#34C759' : '#007AFF'} />
                  <Text style={{ color: q.public_token ? '#34C759' : '#007AFF', fontSize: 13, fontWeight: '600' }}>
                    {q.public_token ? 'Link kopieren' : 'Teilen'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => deleteQuote(q)}>
                  <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                  <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '600' }}>Löschen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
