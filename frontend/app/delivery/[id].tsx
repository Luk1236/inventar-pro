import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiService from '../../services/apiService';
import SignaturePad from '../../components/SignaturePad';
import { useTheme } from '../../contexts/ThemeContext';

interface DeliveryItem {
  article_id: string;
  article_name: string;
  inventory_code: string;
  quantity: number;
  checked: boolean;
}

interface DeliveryData {
  id: string;
  event_id: string;
  event_name: string;
  customer_name: string;
  delivery_date: string;
  status: string;
  items: DeliveryItem[];
  signature?: string;
  signed_by?: string;
  signed_at?: string;
}

export default function DeliveryPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [showSignature, setShowSignature] = useState(false);
  const [saving, setSaving] = useState(false);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    checkAllText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
    content: { flex: 1, padding: 16 },
    infoCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, gap: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    infoLabel: { fontSize: 14, color: colors.textSecondary, width: 60 },
    infoValue: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
    progressContainer: { marginBottom: 20 },
    progressBar: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#34C759', borderRadius: 4 },
    progressText: { fontSize: 13, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
    itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12 },
    itemCardChecked: { backgroundColor: '#34C75910', borderWidth: 1, borderColor: '#34C759' },
    checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: colors.textSecondary, justifyContent: 'center', alignItems: 'center' },
    checkboxChecked: { backgroundColor: '#34C759', borderColor: '#34C759' },
    itemContent: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '600', color: colors.text },
    itemNameChecked: { textDecorationLine: 'line-through', color: colors.textSecondary },
    itemCode: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    quantityBadge: { backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    quantityText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    signatureSection: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginTop: 16, alignItems: 'center' },
    signatureHint: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    signatureDisplay: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginTop: 16, alignItems: 'center' },
    signatureTitle: { fontSize: 16, fontWeight: '700', color: '#34C759', marginBottom: 12 },
    signatureImage: { width: '100%', height: 100, resizeMode: 'contain', marginBottom: 12 },
    signedInfo: { fontSize: 12, color: colors.textSecondary },
    bottomAction: { backgroundColor: colors.card, padding: 16, borderTopWidth: 0.5, borderTopColor: colors.border },
    signButton: { flexDirection: 'row', backgroundColor: '#34C759', borderRadius: 14, paddingVertical: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
    signButtonDisabled: { backgroundColor: colors.textSecondary },
    signButtonText: { fontSize: 17, fontWeight: '600', color: colors.card },
  });

  const loadDelivery = useCallback(async () => {
    try {
      // Load event bookings as delivery items
      const event = await apiService.get<any>(`/api/events/${id}`);
      const bookings = await apiService.get<any[]>(`/api/bookings?event_id=${id}`);
      const customer = event.customer_id
        ? await apiService.get<any>(`/api/customers/${event.customer_id}`, { showErrorAlert: false })
        : null;

      const items: DeliveryItem[] = await Promise.all(
        (bookings || []).map(async (booking: any) => {
          const article = await apiService.get<any>(`/api/articles/${booking.article_id}`, { showErrorAlert: false });
          return {
            article_id: booking.article_id,
            article_name: article?.name || 'Unbekannt',
            inventory_code: article?.inventory_code || '',
            quantity: booking.quantity || 1,
            checked: false,
          };
        })
      );

      setDelivery({
        id: event.id,
        event_id: event.id,
        event_name: event.event_name,
        customer_name: customer?.company_name || 'N/A',
        delivery_date: event.start_date,
        status: 'pending',
        items,
      });
    } catch (error) {
      console.error('Error loading delivery:', error);
      Alert.alert('Fehler', 'Lieferschein konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDelivery();
  }, [id, loadDelivery]);

  const toggleItem = (articleId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(articleId)) {
      newChecked.delete(articleId);
    } else {
      newChecked.add(articleId);
    }
    setCheckedItems(newChecked);
  };

  const checkAllItems = () => {
    if (delivery) {
      const allIds = new Set(delivery.items.map(item => item.article_id));
      setCheckedItems(allIds);
    }
  };

  const handleSignature = async (signatureData: string) => {
    if (checkedItems.size !== delivery?.items.length) {
      Alert.alert('Hinweis', 'Bitte bestätigen Sie alle Artikel vor der Unterschrift');
      return;
    }

    setSaving(true);
    try {
      // Save delivery with signature
      await apiService.post(`/api/events/${id}/delivery-confirmation`, {
        signature: signatureData,
        signed_by: 'Kunde',
        signed_at: new Date().toISOString(),
        confirmed_items: Array.from(checkedItems),
      });

      Alert.alert(
        '✅ Erfolgreich',
        'Lieferschein wurde unterschrieben und gespeichert.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const allChecked = checkedItems.size === delivery?.items.length;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lieferschein</Text>
        <TouchableOpacity onPress={checkAllItems}>
          <Text style={styles.checkAllText}>Alle ✓</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Event Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color="#5856D6" />
            <Text style={styles.infoLabel}>Event:</Text>
            <Text style={styles.infoValue}>{delivery?.event_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color="#34C759" />
            <Text style={styles.infoLabel}>Kunde:</Text>
            <Text style={styles.infoValue}>{delivery?.customer_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time" size={20} color="#FF9500" />
            <Text style={styles.infoLabel}>Datum:</Text>
            <Text style={styles.infoValue}>
              {delivery?.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString('de-DE') : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(checkedItems.size / (delivery?.items.length || 1)) * 100}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {checkedItems.size} von {delivery?.items.length} bestätigt
          </Text>
        </View>

        {/* Items List */}
        <Text style={styles.sectionTitle}>Artikel ({delivery?.items.length})</Text>

        {delivery?.items.map((item, index) => {
          const isChecked = checkedItems.has(item.article_id);
          return (
            <TouchableOpacity
              key={`${item.article_id}-${index}`}
              style={[styles.itemCard, isChecked && styles.itemCardChecked]}
              onPress={() => toggleItem(item.article_id)}
            >
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                {isChecked && <Ionicons name="checkmark" size={18} color="white" />}
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemName, isChecked && styles.itemNameChecked]}>
                  {item.article_name}
                </Text>
                <Text style={styles.itemCode}>{item.inventory_code}</Text>
              </View>
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityText}>{item.quantity}x</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Signature Section */}
        {delivery?.signature ? (
          <View style={styles.signatureDisplay}>
            <Text style={styles.signatureTitle}>✅ Unterschrieben</Text>
            <Image source={{ uri: delivery.signature }} style={styles.signatureImage} />
            <Text style={styles.signedInfo}>
              Unterschrieben von {delivery.signed_by} am {new Date(delivery.signed_at!).toLocaleString('de-DE')}
            </Text>
          </View>
        ) : (
          <View style={styles.signatureSection}>
            <Text style={styles.signatureHint}>
              {allChecked
                ? '✅ Alle Artikel bestätigt - Bereit zur Unterschrift'
                : '⚠️ Bitte alle Artikel bestätigen vor der Unterschrift'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      {!delivery?.signature && (
        <View style={[styles.bottomAction, { paddingBottom: insets.bottom || 20 }]}>
          <TouchableOpacity
            style={[styles.signButton, !allChecked && styles.signButtonDisabled]}
            onPress={() => setShowSignature(true)}
            disabled={!allChecked || saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="pencil" size={22} color="white" />
                <Text style={styles.signButtonText}>Unterschreiben & Bestätigen</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <SignaturePad
        visible={showSignature}
        onClose={() => setShowSignature(false)}
        onSave={handleSignature}
        title="Übergabe bestätigen"
        description="Der Kunde bestätigt den Empfang aller aufgelisteten Artikel"
      />
    </SafeAreaView>
  );
}
